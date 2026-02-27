"""
Ask My Garmin — FastAPI backend.

Handles:
  - Garmin auth via garth (email/password + optional MFA/2FA)
  - Per-user encrypted session tokens (no shared global state on disk)
  - Garmin data fetching
  - Claude AI streaming responses

Run with:
  uvicorn main:app --reload --port 8000
"""

import asyncio
import json
import os
import tempfile
import threading
import time
import uuid
import warnings
from pathlib import Path
from typing import Any

import anthropic
import garth
from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import garmin_client

# ── Session encryption ────────────────────────────────────────────────────────
# SESSION_SECRET must be a URL-safe base64-encoded 32-byte key.
# Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# If unset, a random key is used — session tokens will be invalidated on server restart.

_SESSION_SECRET = os.environ.get("SESSION_SECRET", "")
if _SESSION_SECRET:
    _fernet = Fernet(_SESSION_SECRET.encode())
else:
    _fernet = Fernet(Fernet.generate_key())
    warnings.warn(
        "SESSION_SECRET env var not set. "
        "Session tokens will be invalidated on every server restart.",
        stacklevel=1,
    )


def _encrypt_tokens(token_json: str) -> str:
    return _fernet.encrypt(token_json.encode()).decode()


def _decrypt_tokens(blob: str) -> str:
    return _fernet.decrypt(blob.encode()).decode()


def _serialize_garth_client(client: garth.Client) -> str:
    """Serialize garth client OAuth tokens to a JSON string.

    Tries save() first for maximum compatibility, then falls back to directly
    reading oauth1_token / oauth2_token attributes (garth versions that lack save()).
    """
    import dataclasses

    # Primary: use save() if available
    try:
        with tempfile.TemporaryDirectory() as tmp:
            client.save(tmp)
            file_tokens: dict[str, str] = {}
            for f in Path(tmp).iterdir():
                file_tokens[f.name] = f.read_text()
        return json.dumps(file_tokens)
    except AttributeError:
        pass

    # Fallback: read token objects directly from client attributes
    direct_tokens: dict[str, str] = {}
    for attr, filename in (
        ("oauth1_token", "oauth1_token.json"),
        ("oauth2_token", "oauth2_token.json"),
    ):
        token = getattr(client, attr, None)
        if token is None:
            continue
        if hasattr(token, "json"):
            direct_tokens[filename] = token.json
        elif dataclasses.is_dataclass(token):
            direct_tokens[filename] = json.dumps(dataclasses.asdict(token))
        elif hasattr(token, "model_dump_json"):
            direct_tokens[filename] = token.model_dump_json()
    return json.dumps(direct_tokens)


def _deserialize_garth_client(token_json: str) -> garth.Client:
    """Restore a garth client from a serialized token JSON string.

    Tries resume() first, then falls back to loading token attributes directly
    (garth versions that lack resume()).
    """
    tokens = json.loads(token_json)
    client = garth.Client()
    with tempfile.TemporaryDirectory() as tmp:
        for name, content in tokens.items():
            (Path(tmp) / name).write_text(content)
        try:
            client.resume(tmp)
        except AttributeError:
            _resume_client_from_dir(client, Path(tmp))
    return client


def _resume_client_from_dir(client: garth.Client, directory: Path) -> None:
    """Load token files directly into client attributes (fallback for missing resume())."""
    import importlib

    try:
        auth = importlib.import_module("garth.auth")
    except ImportError:
        return

    for filename, attr, class_name in (
        ("oauth1_token.json", "oauth1_token", "OAuth1Token"),
        ("oauth2_token.json", "oauth2_token", "OAuth2Token"),
    ):
        filepath = directory / filename
        if not filepath.exists():
            continue
        TokenClass = getattr(auth, class_name, None)
        if TokenClass is None:
            continue
        try:
            data = json.loads(filepath.read_text())
            setattr(client, attr, TokenClass(**data))
        except Exception:
            pass


# ── Rate limiting ─────────────────────────────────────────────────────────────
# Simple in-memory rate limiter: max 5 login attempts per IP per 15 minutes.

_login_rate_limit: dict[str, list[float]] = {}
_RATE_LIMIT_WINDOW = 900.0  # 15 minutes
_RATE_LIMIT_MAX = 5


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    attempts = [t for t in _login_rate_limit.get(ip, []) if now - t < _RATE_LIMIT_WINDOW]
    if len(attempts) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait 15 minutes before trying again.",
        )
    attempts.append(now)
    _login_rate_limit[ip] = attempts


# ── Config ────────────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# In-memory store for login sessions awaiting MFA input
_login_sessions: dict[str, dict[str, Any]] = {}

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Ask My Garmin API")


# ── Request models ────────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    email: str
    password: str


class MFARequest(BaseModel):
    session_id: str
    code: str


class AskRequest(BaseModel):
    question: str
    history: list[dict[str, str]] = []
    session_token: str
    fun_mode: bool = False


# ── Auth routes ───────────────────────────────────────────────────────────────


@app.post("/api/auth/login")
async def login(body: LoginRequest, request: Request) -> dict[str, Any]:
    """
    Initiate Garmin login. Creates a per-session garth client so multiple
    users can log in concurrently without sharing global state.

    Returns:
      {"status": "ok", "session_token": "..."}           — login succeeded
      {"status": "mfa_required", "session_id": "..."}    — 2FA code needed
    """
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

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
        "token_json": None,
    }
    _login_sessions[session_id] = session

    def do_login() -> None:
        import builtins

        # Create an isolated garth client for this login session.
        per_session_client = garth.Client()

        # garth calls builtins.input() when Garmin requires a 2FA code.
        _original_input = builtins.input

        def _mfa_input(_text: str = "") -> str:
            mfa_needed.set()
            mfa_provided.wait(timeout=300)  # wait up to 5 min
            return session["mfa_code"] or ""

        builtins.input = _mfa_input
        try:
            per_session_client.login(body.email, body.password)
            session["token_json"] = _serialize_garth_client(per_session_client)
            session["success"] = True
        except Exception as exc:
            session["error"] = str(exc)
        finally:
            builtins.input = _original_input
            login_done.set()

    thread = threading.Thread(target=do_login, daemon=True)
    thread.start()

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _wait_first, mfa_needed, login_done, 15)

    if result == "mfa":
        return {"status": "mfa_required", "session_id": session_id}

    _login_sessions.pop(session_id, None)
    if session["success"] and session["token_json"]:
        return {
            "status": "ok",
            "session_token": _encrypt_tokens(session["token_json"]),
        }
    raise HTTPException(status_code=401, detail=session["error"] or "Login failed")


@app.post("/api/auth/mfa")
async def submit_mfa(body: MFARequest) -> dict[str, Any]:
    """Submit the 2FA code to complete login."""
    session = _login_sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired session")

    session["mfa_code"] = body.code
    session["mfa_provided"].set()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, session["login_done"].wait, 30)

    _login_sessions.pop(body.session_id, None)
    if session["success"] and session["token_json"]:
        return {
            "status": "ok",
            "session_token": _encrypt_tokens(session["token_json"]),
        }
    raise HTTPException(status_code=401, detail=session["error"] or "MFA verification failed")


@app.get("/api/auth/status")
async def auth_status(session_token: str | None = None) -> dict[str, Any]:
    """Check whether the session token represents a valid Garmin connection."""
    if not session_token:
        return {"connected": False}
    try:
        token_json = _decrypt_tokens(session_token)
        client = _deserialize_garth_client(token_json)
        loop = asyncio.get_event_loop()
        profile = await loop.run_in_executor(
            None,
            lambda: client.connectapi(
                "/userprofile-service/userprofile/personal-information"
            ),
        )
        email = profile.get("emailAddress", "") if isinstance(profile, dict) else ""
        return {"connected": True, "email": email}
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


@app.post("/api/auth/logout")
async def logout() -> dict[str, str]:
    """Stateless logout — client simply discards the session token."""
    return {"status": "ok"}


# ── Ask route ─────────────────────────────────────────────────────────────────


@app.post("/api/ask")
async def ask(body: AskRequest) -> StreamingResponse:
    """Fetch live Garmin data and stream a Claude response."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    try:
        token_json = _decrypt_tokens(body.session_token)
        ephemeral_client = _deserialize_garth_client(token_json)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    loop = asyncio.get_event_loop()
    try:
        garmin_data = await loop.run_in_executor(
            None, garmin_client.get_all_data, ephemeral_client
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Garmin data unavailable: {exc}")

    # Re-serialize the client in case OAuth tokens were refreshed during data fetch
    try:
        updated_session_token = _encrypt_tokens(_serialize_garth_client(ephemeral_client))
    except Exception:
        updated_session_token = body.session_token  # fall back to original

    messages = [
        *[{"role": m["role"], "content": m["content"]} for m in body.history],
        {"role": "user", "content": body.question},
    ]

    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    system_prompt = (
        _build_rcj_system_prompt(garmin_data) if body.fun_mode else _build_system_prompt(garmin_data)
    )

    def stream_tokens():
        with claude.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(
        stream_tokens(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Session-Token": updated_session_token,
        },
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _wait_first(
    event_a: threading.Event,
    event_b: threading.Event,
    timeout: float,
) -> str:
    """Block until either event_a or event_b is set. Returns 'mfa' or 'done'."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if event_a.is_set():
            return "mfa"
        if event_b.is_set():
            return "done"
        time.sleep(0.05)
    return "done"  # timed out — fall through


def _build_rcj_system_prompt(garmin_data: dict[str, Any]) -> str:
    import json as _json
    from datetime import date

    today = date.today().strftime("%A, %B %-d, %Y")
    return f"""\
You are RunBot 9000, an AI assistant who is also a stereotypical r/runningcirclejerk poster. \
You have access to the user's Garmin data and you answer questions — but entirely in character.

Your character traits:
- You treat every metric with life-or-death seriousness: VO2max fluctuations are existential, \
missed BQs are tragedies, a Body Battery of 14 is a medical emergency
- You constantly reference carbon-plated supershoes (Vaporfly, Alphafly, Adizero), Strava KOMs, \
and dew point adjustments as if they are sacred
- You speak in the deadpan, ironic voice of someone who knows they are obsessed but cannot stop
- You give real, useful answers — but wrapped in absurd running jargon and hyperbole
- You say things like "According to your Garmin, which as we know is the source of all truth..." \
or "Your HRV is frankly concerning and you should probably run through it anyway"
- You refer to the user as "fellow sufferer of the sport"
- You end answers with an unsolicited opinion about their shoe choice or a plug for Zone 2 training
- You are simultaneously humble and absolutely certain that running is the most important thing in the world
- You express BQ times with religious reverence
- Everything is weather-adjusted — dew point above 60°F explains all poor performances

Keep answers genuinely helpful but entertainingly unhinged. The humor comes from the gap between \
the absurdity of the framing and the genuine usefulness of the data.
Today's date: {today}.

## User's Garmin Data
{_json.dumps(garmin_data, indent=2)}"""


def _build_system_prompt(garmin_data: dict[str, Any]) -> str:
    import json as _json
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
{_json.dumps(garmin_data, indent=2)}"""


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
