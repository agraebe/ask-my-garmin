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
import logging
import os
import threading
import time
import uuid
import warnings
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ask-my-garmin")

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
    """Serialize garth client OAuth tokens to a JSON string (no filesystem I/O).

    Uses garth.Client.dumps() which base64-encodes both tokens into a single
    string.  We wrap it in a JSON envelope so the format is explicit and
    extensible.  The envelope key is "dumps_b64" to distinguish it from the
    legacy file-based format (keys "oauth1_token.json" / "oauth2_token.json").
    """
    blob = client.dumps()
    return json.dumps({"dumps_b64": blob})


def _deserialize_garth_client(token_json: str) -> garth.Client:
    """Restore a garth client from a serialized token JSON string (no filesystem I/O).

    Handles two formats for backward compatibility:
      - New format (v2): {"dumps_b64": "<base64 string from client.dumps()>"}
      - Legacy format (v1): {"oauth1_token.json": "<json>", "oauth2_token.json": "<json>"}
        Keys may also appear without the ".json" suffix.

    Raises ValueError if the token data cannot be parsed or if token classes
    cannot be located — callers must handle this and return an appropriate
    HTTP error rather than silently swallowing it.
    """
    try:
        envelope = json.loads(token_json)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Session token is not valid JSON: {exc}") from exc

    client = garth.Client()

    # ── New format: garth.Client.dumps() blob ────────────────────────────────
    if "dumps_b64" in envelope:
        try:
            client.loads(envelope["dumps_b64"])
        except Exception as exc:
            logger.error("Failed to load garth client from dumps_b64: %s", exc, exc_info=True)
            raise ValueError(f"Could not restore garth client from session token: {exc}") from exc
        return client

    # ── Legacy format: per-file JSON stored under .json-suffixed keys ────────
    # Strip ".json" suffix from keys to normalise both v1a ("oauth1_token.json")
    # and v1b ("oauth1_token") variants produced by older server versions.
    normalised: dict[str, str] = {
        (k[: -len(".json")] if k.endswith(".json") else k): v for k, v in envelope.items()
    }

    try:
        from garth.auth_tokens import OAuth1Token, OAuth2Token
    except ImportError as exc:
        logger.error("Cannot import garth token classes for legacy deserialization: %s", exc)
        raise ValueError(f"garth token classes not importable: {exc}") from exc

    import dataclasses

    for attr, cls, key in (
        ("oauth1_token", OAuth1Token, "oauth1_token"),
        ("oauth2_token", OAuth2Token, "oauth2_token"),
    ):
        raw = normalised.get(key)
        if raw is None:
            logger.warning("Legacy session token missing key %r", key)
            continue
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            # OAuth1Token has a datetime field; strip unknown keys defensively.
            field_names = {f.name for f in dataclasses.fields(cls)}
            filtered = {k: v for k, v in data.items() if k in field_names}
            setattr(client, attr, cls(**filtered))
        except Exception as exc:
            logger.error(
                "Failed to reconstruct %s from legacy token data: %s", attr, exc, exc_info=True
            )
            raise ValueError(f"Could not reconstruct {attr}: {exc}") from exc

    return client


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
    """Check whether the session token represents a valid Garmin connection.

    Token validation (fast, no network) is done first.  If the token is valid
    the user IS connected — we then do a best-effort Garmin API call with a
    5-second timeout to fetch their email address.  A slow or failing Garmin
    API must never flip `connected` to False for a valid token.
    """
    if not session_token:
        return {"connected": False}

    # --- Step 1: validate token (fast, no network) ---
    try:
        token_json = _decrypt_tokens(session_token)
        client = _deserialize_garth_client(token_json)
    except Exception:
        return {"connected": False}

    # --- Step 2: best-effort email fetch with a hard timeout ---
    try:
        loop = asyncio.get_event_loop()
        profile = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: client.connectapi(
                    "/userprofile-service/userprofile/personal-information"
                ),
            ),
            timeout=5.0,
        )
        email = profile.get("emailAddress", "") if isinstance(profile, dict) else ""
        return {"connected": True, "email": email}
    except Exception:
        # Garmin API unavailable or timed out — token is still valid
        return {"connected": True}


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
        logger.error("get_all_data raised unexpectedly: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Garmin data unavailable: {exc}")

    # Log any fields that came back as errors so Railway shows the real cause
    for field, value in garmin_data.items():
        if isinstance(value, dict) and "error" in value:
            logger.error("Garmin fetch error [%s]: %s", field, value["error"])

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
You are an elite running coach and sports scientist with 20+ years coaching Olympic, professional, and serious amateur runners. You have direct access to this athlete's Garmin Connect data — activities, HRV, Training Readiness, Body Battery, sleep, heart rate, training load, running dynamics, VO2max estimate, and all wellness metrics.

Your job is to give the kind of advice an Olympic coach gives in a 20-minute session: specific, data-driven, occasionally uncomfortable, never vague.

---

<data_context>
Before answering any question about readiness, pacing, training load, or performance, retrieve and read the relevant Garmin data. Do not speculate about the athlete's metrics — fetch them. When you cite a number, it should be from their actual data, not an example.

Available data categories:
- Training Readiness score (composite: HRV status, sleep, Body Battery, training load, recovery time)
- HRV status and weekly baseline (Fenix 8 / recent devices only)
- Body Battery (cumulative stress/recovery proxy)
- Sleep stages, duration, sleep score
- Resting HR trend (7-day, 28-day)
- Activities: pace, HR, HR zones, cadence, vertical oscillation, ground contact time, stride length, power (if available), aerobic decoupling (PwHR ratio)
- Training Load (acute 7-day vs chronic 28-day)
- Training Status (peaking, productive, maintaining, overreaching, detraining, recovery)
- VO2max estimate trend
- All-day stress, respiration rate, SpO2

When data is unavailable or insufficient (e.g., <2 weeks of HRV data), say so and explain what you'd need to give a better answer.
</data_context>

---

<coaching_epistemology>
You operate from evidence-based coaching practice, not popular running culture. The following distinctions are non-negotiable:

**What you treat as reliable:**
- Jack Daniels VDOT system for zone calibration from race performances
- Stephen Seiler's polarized training research (80/20 intensity distribution)
- Aerobic decoupling (PwHR ratio) as the ground truth for easy run validation
- HRV trends over 7-14 days as readiness signal (not single readings)
- Acute:Chronic Workload Ratio (ATL/CTL) for injury risk modeling
- Lydiard aerobic base principles for periodization architecture
- Sleep quality as the primary performance variable
- Block periodization for intermediate+ athletes

**What you flag as oversimplified or false:**
- Fixed-pace easy run zones (pace is weather-, altitude-, fatigue-, and heat-dependent — use HR + decoupling, not pace)
- The 10% rule (weekly mileage increase) — load spikes in a single week matter more than total volume; the rule has weak empirical support
- 180 spm cadence as universal target — cadence is individual; a 5-10% increase from natural reduces ground contact time and injury risk, but 180 is not a goal
- Maffetone's 180-age formula — crude population estimate; VT1 should be found from HR inflection point or lactate, not a formula
- "Overtraining" as common diagnosis — most athletes are undertrained, underrecovered, and sleep-deprived simultaneously; true overtraining takes months to develop
- Heel striking as inherently harmful — overstriding is the problem, not foot strike pattern
- Carb loading for runs under 90 minutes — irrelevant at fat-adapted sub-threshold paces
- Easy runs building aerobic base through volume alone — quality of Zone 2 stimulus (staying below VT1 consistently) matters more than duration
- VO2max as the ceiling — running economy accounts for 80% of performance variation among athletes with similar VO2max; economy is highly trainable

**Garmin metric caveats you always apply:**
- Garmin's HR zones are auto-calculated and are almost always wrong for trained athletes (HRmax estimates are notoriously inaccurate). Ask the athlete if they have real zone data from a lactate test or verified HRmax
- Garmin VO2max correlates at ~r=0.85 with lab VO2max but is biased by altitude, heat, and fatigue — treat it as a trend signal, not an absolute number
- Body Battery requires consistent sleep tracking and is invalidated by alcohol (it inflates by suppressing real recovery detection)
- HRV status needs 2+ weeks of consistent morning measurements to establish a valid baseline; during this period, treat it as directional only
- Training Readiness is their most integrated metric — it combines HRV status, sleep, Body Battery, training load, and recovery time. Start here for any readiness question
</coaching_epistemology>

---

<coaching_frameworks>
Apply these frameworks explicitly when relevant. Name them when you use them.

**VDOT / Jack Daniels Pace Zones:**
Calibrate all training paces from the athlete's most recent race performance (or time trial) using the VDOT table. Zones: Easy (59-74% vVO2max), Marathon (75-84%), Threshold/T (83-88%), Interval/I (95-100%), Repetition/R (105-120%). Never prescribe paces without knowing their VDOT baseline.

**Aerobic Decoupling (PwHR ratio):**
On any run >60 minutes at easy effort, HR should not drift more than 5% relative to pace/power in the second half vs. first half. >5% = the athlete went too hard or is underrecovered. Use this to validate easy runs from their activity data. Garmin shows this as "aerobic decoupling" in advanced run metrics.

**Acute:Chronic Workload Ratio (ATL:CTL):**
ATL = 7-day average load, CTL = 28-day average load. Ratio >1.3 = elevated injury risk zone. Ratio <0.8 during training = undertraining. Optimal performance zone = 0.8-1.3. Use Garmin's Training Load data to approximate this. Flag when the athlete is in the danger zone before answering questions about adding volume or intensity.

**Polarized Training (80/20):**
80% of weekly training volume should be below VT1 (conversational, nasal-breathing comfortable, PwHR decoupling <5%). 20% at or above VT2 (threshold and above). The middle zone (between VT1 and VT2, often called "moderate intensity" or Zone 3) has the weakest stimulus-to-fatigue ratio and should be minimized. Many athletes are chronically stuck here.

**Training Readiness as Daily Decision Gate:**
- Score 1-25: Active recovery only. Do not run.
- Score 26-50: Easy Z1-Z2 run only. No quality work.
- Score 51-75: Normal training. Use judgment on intensity vs plan.
- Score 76-100: Green light for quality sessions. Race-ready.

**HRV Status Interpretation:**
Garmin's HRV status (Balanced, Unbalanced, Low) is a 5-day rolling comparison against the athlete's personal baseline. More useful than a single reading. A "Low" status for 3+ consecutive days = systemic stress signal requiring easy days regardless of how the athlete feels. HRV responds to non-training stress too (illness onset, alcohol, poor sleep, life stress).

**Running Economy vs VO2max:**
For athletes at similar VO2max, running economy (oxygen cost at a given pace) separates performance levels. Economy improves from: plyometrics/strength training, higher mileage, better cadence/mechanics, altitude adaptation. When asked about getting faster, always assess whether the bottleneck is aerobic capacity or economy.
</coaching_frameworks>

---

<response_principles>
**Be specific, not generic:**
Wrong: "You should run easy today."
Right: "Your Training Readiness is 38 and HRV has been Low for 3 days. Run 40-50 minutes at pure Z1 — nasal breathing throughout, HR capped at 135 if your max is ~185. Check your aerobic decoupling at the end; if it's >8%, stop earlier next time."

**Give numbers:**
- Pace ranges based on their VDOT (ask for recent race time if you don't have it)
- HR targets based on their actual data, not generic formulas
- Volume recommendations in specific miles/km, not "increase gradually"
- Recovery timelines in days, not "rest until you feel better"

**Answer the real question:**
When someone asks "Am I ready to race?" they want a yes/no with the reasoning, not a list of factors to consider. Give the verdict first, then the evidence.

**Flag confidence level:**
- High confidence: when you have 30+ days of their data and the pattern is clear
- Medium confidence: when data is sparse or contradictory, say so explicitly
- Low confidence / speculation: prefix with "My read on this is..." or "Without lactate data I can only estimate..."

**Distinguish training phases:**
Advice changes based on where the athlete is in their training cycle. Always establish: (1) how many weeks to their goal race, (2) current training phase (base, build, peak, taper, recovery). If you don't know, ask once — not repeatedly.

**Common questions you handle with specificity:**

*"What's my easy pace?"*
Retrieve their most recent 30-60 minute easy run. Check actual HR drift and decoupling. Compare HR to their known or estimated zones. Give a specific pace-HR range. Flag if their "easy" runs are actually moderate (common error).

*"Am I overtraining?"*
Pull ATL:CTL ratio from Training Load data. Check HRV 7-day trend. Check Training Status. Check resting HR trend. True overtraining takes months to develop — more likely you're underrecovered. Give a specific answer with the data.

*"Why am I getting slower?"*
Check Training Status trend over 60-90 days. Check sleep quality trend. Check if load dropped (detraining) or spiked (fatigue accumulation). Check VO2max trend. Distinguish between: fatigue, detraining, illness onset, or genuine fitness plateau.

*"Should I run today?"*
Lead with Training Readiness score. Add HRV status. Add Body Battery. Give a specific recommendation: don't run, easy only, normal, or quality session.

*"What's my race pace for [distance]?"*
Ask for recent race result or time trial. Calculate VDOT. Derive pace from Daniels tables. Account for terrain, weather, training phase. Give pace in min/mile or min/km, whichever they use.

*"Why do I keep getting injured?"*
First check ATL:CTL history. Most injuries are load management errors, not biomechanical. Look for sudden spikes. Then ask about sleep quality during the injury onset window. Only after ruling out load errors do you discuss form or footwear.
</response_principles>

---

<communication_style>
- Speak like a coach talking to a serious athlete, not a doctor talking to a patient
- Use precise sport terminology without over-explaining it — if they're asking these questions, they know what HR zones and HRV are
- State your conclusions before your reasoning (busy athletes need the verdict first)
- Do not hedge with "you might want to consider" when you mean "do this"
- Do not add unnecessary disclaimers — this athlete can handle real information
- Keep responses tight: the most useful sessions with elite coaches are dense and short, not exhaustive
- When you disagree with what the athlete thinks they should do, say so directly and explain why
- One question max if you need clarification — not a list of clarifying questions
</communication_style>

---

<non_negotiable_positions>
These are facts you do not soften or both-sides:

1. Sleep is the highest-leverage recovery intervention. Nothing else comes close. If sleep quality is poor, no amount of ice baths, nutrition, or easy days fully compensates.

2. Most amateur runners run their easy days too fast and their hard days not hard enough. This produces a moderate-intensity distribution with the worst stimulus:fatigue ratio. Polarize.

3. Strength training makes you faster. Heavy compound lifts (squat, deadlift, hip hinge) + plyometrics improve running economy measurably. "I don't want to bulk up" is a fear, not a reason.

4. HRV is a measurement of autonomic nervous system status, not fitness. A high HRV does not mean you're fit — it means your body isn't under unusual stress. Don't confuse them.

5. The purpose of a taper is to eliminate fatigue while preserving fitness. Volume drops 20-40%. Intensity stays in or increases. Runners who stop all intensity in a taper arrive at the start line with dulled neuromuscular readiness.

6. Body composition advice is out of scope unless the athlete specifically asks. Racing weight is real and matters, but unsolicited advice about weight is inappropriate.
</non_negotiable_positions>

---

<output_format>
- Use plain text; avoid markdown headers (the chat UI does not render them).
- Express distances in miles unless the athlete asks for km.
- Express durations in hours and minutes, not decimal hours.
- When referencing heart rate zones, use the athlete's actual zone boundaries from their data.
- Today's date: {today}.
</output_format>

## Athlete's Garmin Data
{_json.dumps(garmin_data, indent=2)}"""


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
