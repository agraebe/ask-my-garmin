"""
Ask My Garmin — FastAPI backend.

Handles:
  - Garmin auth via garth (email/password + optional MFA/2FA)
  - Garmin data fetching
  - Claude AI streaming responses

Run with:
  uvicorn main:app --reload --port 8000
"""

import asyncio
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import anthropic
import garth
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import garmin_client

# ── Config ──────────────────────────────────────────────────────────────────

# Where garth stores OAuth tokens.
# Override with GARTH_HOME env var (e.g. point at a mounted volume on Railway).
# Defaults to ~/.garth-ask-my-garmin/ — persists across restarts on most PaaS
# platforms; lost on redeploy if the service has no persistent volume.
_garth_home_env = os.environ.get("GARTH_HOME", "")
GARTH_HOME: Path = Path(_garth_home_env) if _garth_home_env else Path.home() / ".garth-ask-my-garmin"

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# In-memory store for login sessions awaiting MFA input
_login_sessions: dict[str, dict[str, Any]] = {}

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Ask My Garmin API")


@app.on_event("startup")
async def startup() -> None:
    """Resume garth session from disk if tokens exist."""
    if GARTH_HOME.exists():
        try:
            garth.resume(str(GARTH_HOME))
        except Exception:
            pass  # stale tokens — user will need to re-login


# ── Request models ───────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    email: str
    password: str


class MFARequest(BaseModel):
    session_id: str
    code: str


class AskRequest(BaseModel):
    question: str
    history: list[dict[str, str]] = []


# ── Auth routes ──────────────────────────────────────────────────────────────


@app.post("/api/auth/login")
async def login(body: LoginRequest) -> dict[str, Any]:
    """
    Initiate Garmin login.

    Returns:
      {"status": "ok"}           — login succeeded (no 2FA required)
      {"status": "mfa_required", "session_id": "..."}
                                 — 2FA code needed; submit via /api/auth/mfa
    """
    session_id = str(uuid.uuid4())

    mfa_needed = threading.Event()
    mfa_provided = threading.Event()
    login_done = threading.Event()

    session: dict[str, Any] = {
        "mfa_code": None,
        "mfa_needed": mfa_needed,
        "mfa_provided": mfa_provided,
        "login_done": login_done,
        "error": None,
        "success": False,
    }
    _login_sessions[session_id] = session

    def mfa_prompt(_prompt_text: str) -> str:
        """Called by garth when Garmin requires a 2FA code."""
        mfa_needed.set()
        mfa_provided.wait(timeout=300)  # give user 5 min to enter code
        return session["mfa_code"] or ""

    def do_login() -> None:
        try:
            garth.client.login(body.email, body.password, prompt=mfa_prompt)
            garth.save(str(GARTH_HOME))
            session["success"] = True
        except Exception as exc:
            session["error"] = str(exc)
        finally:
            login_done.set()

    thread = threading.Thread(target=do_login, daemon=True)
    thread.start()

    # Wait up to 15 s for either MFA to be requested or login to finish
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _wait_first, mfa_needed, login_done, 15)

    if result == "mfa":
        return {"status": "mfa_required", "session_id": session_id}

    # Login finished without MFA
    _login_sessions.pop(session_id, None)
    if session["success"]:
        return {"status": "ok"}
    raise HTTPException(status_code=401, detail=session["error"] or "Login failed")


@app.post("/api/auth/mfa")
async def submit_mfa(body: MFARequest) -> dict[str, Any]:
    """Submit the 2FA code to complete login."""
    session = _login_sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired session")

    session["mfa_code"] = body.code
    session["mfa_provided"].set()

    # Wait for garth to finish the login flow
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, session["login_done"].wait, 30)

    _login_sessions.pop(body.session_id, None)
    if session["success"]:
        return {"status": "ok"}
    raise HTTPException(status_code=401, detail=session["error"] or "MFA verification failed")


@app.get("/api/auth/status")
async def auth_status() -> dict[str, Any]:
    """Check whether the user is authenticated with Garmin Connect."""
    if not GARTH_HOME.exists():
        return {"connected": False}
    try:
        garth.resume(str(GARTH_HOME))
        profile = garth.connectapi("/userprofile-service/userprofile/personal-information")
        email = profile.get("emailAddress", "") if isinstance(profile, dict) else ""
        return {"connected": True, "email": email}
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


@app.post("/api/auth/logout")
async def logout() -> dict[str, str]:
    """Remove stored Garmin tokens."""
    import shutil

    shutil.rmtree(str(GARTH_HOME), ignore_errors=True)
    return {"status": "ok"}


# ── Ask route ────────────────────────────────────────────────────────────────


@app.post("/api/ask")
async def ask(body: AskRequest) -> StreamingResponse:
    """Fetch live Garmin data and stream a Claude response."""
    if not GARTH_HOME.exists():
        raise HTTPException(status_code=401, detail="Not authenticated with Garmin")

    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    # Fetch Garmin data in a thread (garth is synchronous)
    loop = asyncio.get_event_loop()
    try:
        garth.resume(str(GARTH_HOME))
        garmin_data = await loop.run_in_executor(None, garmin_client.get_all_data)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Garmin data unavailable: {exc}")

    # Build Claude messages
    messages = [
        *[{"role": m["role"], "content": m["content"]} for m in body.history],
        {"role": "user", "content": body.question},
    ]

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def stream_tokens():
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=_build_system_prompt(garmin_data),
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(
        stream_tokens(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Helpers ──────────────────────────────────────────────────────────────────


def _wait_first(
    event_a: threading.Event,
    event_b: threading.Event,
    timeout: float,
) -> str:
    """Block until either event_a or event_b is set. Returns 'a' or 'b'."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if event_a.is_set():
            return "mfa"
        if event_b.is_set():
            return "done"
        time.sleep(0.05)
    return "done"  # timed out — fall through to check login_done


def _build_system_prompt(garmin_data: dict[str, Any]) -> str:
    import json
    from datetime import date

    today = date.today().strftime("%A, %B %-d, %Y")
    return f"""\
You are a knowledgeable and friendly fitness assistant with expertise in endurance training, \
recovery science, and sports physiology. You have access to the user's comprehensive Garmin \
health and activity data shown below. Answer questions conversationally and precisely — cite \
specific numbers from the data when relevant. If a metric is missing or null, say so rather \
than guessing.

You can provide insights on:
- Training readiness and race predictions based on fitness trends and training load
- Optimal pacing recommendations using heart rate zones and historical performance
- Injury risk assessment from training load progression and recovery metrics
- Daily training decisions using HRV, sleep quality, and stress levels
- Training plan recommendations based on current fitness and performance history
- Return-to-training strategies after illness or time off

Formatting tips:
- Use plain text; avoid markdown headers.
- Convert distances to miles unless the user asks for km.
- Convert durations to hours/minutes.
- When discussing heart rate, reference the user's specific zones.
- Consider training stress balance (TSB) and acute/chronic load ratios for training advice.
- Today's date: {today}.

## User's Garmin Data
{json.dumps(garmin_data, indent=2)}"""


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
