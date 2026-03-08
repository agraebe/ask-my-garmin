"""
Memory service for Ask My Garmin.

Provides:
 - User ID hashing (SHA-256 of Garmin user ID)
 - CRUD operations for memories
 - Autonomous memory detection via Claude Haiku
"""

import base64
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import anthropic
import garth
from sqlalchemy import func
from sqlalchemy.orm import Session

import database
from models import Memory, MemoryCategory

logger = logging.getLogger("ask-my-garmin.memory_service")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

_DETECTION_SYSTEM = """\
You are a memory extraction assistant for a running coach AI. Identify information in an \
athlete's message that a coach would want to remember across future sessions.

Information worth remembering (explicit statements only — not hypothetical or general):
- Upcoming race events (name, date, distance)
- Training goals (target finish time, target event)
- Injuries or health issues the athlete mentions
- Athlete-supplied context not in Garmin data (training plan, coach instructions, etc.)
- Personal context relevant to training (schedule, travel, life stress, etc.)

Do NOT store:
- Questions or hypotheticals ("what if I...")
- Information already available in Garmin data (current pace, HRV, etc.)
- Vague statements ("I want to run more")
- Coach advice or AI responses (only athlete-supplied information)

Respond with a JSON object only (no markdown):
{
  "should_store": true | false,
  "key": "Short label, 2-5 words (e.g. 'Next Marathon', 'Injury History')",
  "content": "Full detail as the athlete stated it",
  "category": "race_event" | "goal" | "injury" | "training_context" | "personal"
}
If should_store is false, set key, content, and category to empty strings."""


def _jwt_sub(access_token: str) -> str:
    """Decode a JWT payload (no signature verification) and return the sub claim."""
    parts = access_token.split(".")
    if len(parts) < 2:
        raise ValueError("Not a valid JWT")
    payload = parts[1]
    padding = 4 - len(payload) % 4
    if padding != 4:
        payload += "=" * padding
    data = json.loads(base64.b64decode(payload))
    sub = str(data.get("sub", ""))
    if not sub:
        raise ValueError("JWT has no sub claim")
    return sub


def get_user_id_hash(client: garth.Client) -> str:
    """Return SHA-256 of the Garmin user's numeric user ID.

    Tries multiple sources in order so memory operations stay available even
    when the Garmin API is flaky or tokens are opaque (non-JWT):
      1. Garmin profile API (network call, returns stable numeric userId)
      2. JWT sub claim from OAuth2 access token (no network, only works for JWT tokens)
      3. OAuth1 oauth_token (stable per Garmin account, always available, no network)
    """
    # Primary: Garmin profile API
    try:
        profile = client.connectapi("/userprofile-service/userprofile/personal-information")
        user_id = str((profile or {}).get("userId", ""))
        if user_id:
            return hashlib.sha256(user_id.encode()).hexdigest()
        logger.warning("Garmin profile returned no userId; trying JWT sub")
    except Exception as exc:
        logger.warning("Profile API failed, trying JWT sub: %s", exc)

    # Second fallback: JWT sub claim from OAuth2 access token (no network call)
    try:
        sub = _jwt_sub(client.oauth2_token.access_token)
        return hashlib.sha256(sub.encode()).hexdigest()
    except Exception as exc:
        logger.warning("JWT sub fallback failed, trying OAuth1 token: %s", exc)

    # Third fallback: OAuth1 oauth_token — stable per Garmin account, always present
    try:
        oauth1 = getattr(client, "oauth1_token", None)
        if oauth1:
            token = getattr(oauth1, "oauth_token", "") or ""
            if token:
                return hashlib.sha256(token.encode()).hexdigest()
        logger.warning("OAuth1 fallback: no oauth_token found on client")
    except Exception as exc:
        logger.warning("OAuth1 token fallback failed: %s", exc)

    raise ValueError(
        "Could not derive user identity from profile API, JWT, or OAuth1 token"
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────


def list_memories(user_id: str) -> list[Memory]:
    """Return all active (non-deleted) memories for a user."""
    if not database.is_available():
        return []
    try:
        db: Session = database.get_session()
        try:
            return (
                db.query(Memory)
                .filter(Memory.user_id == user_id, Memory.deleted_at.is_(None))
                .order_by(Memory.created_at.asc())
                .all()
            )
        finally:
            db.close()
    except Exception:
        logger.exception("list_memories failed for user %s…", user_id[:8])
        return []


def create_memory(
    user_id: str,
    key: str,
    content: str,
    category: str,
    source_context: str = "",
) -> Memory | None:
    """Create and persist a new memory. Returns None on failure."""
    if not database.is_available():
        return None
    try:
        cat = MemoryCategory(category)
    except ValueError:
        cat = MemoryCategory.personal

    memory = Memory(
        user_id=user_id,
        key=key,
        content=content,
        category=cat,
        source_context=source_context[:500],
    )
    try:
        db: Session = database.get_session()
        try:
            db.add(memory)
            db.commit()
            db.refresh(memory)
            return memory
        finally:
            db.close()
    except Exception:
        logger.exception("create_memory failed for user %s…", user_id[:8])
        return None


def update_memory(
    memory_id: str,
    user_id: str,
    key: str | None = None,
    content: str | None = None,
    category: str | None = None,
) -> Memory | None:
    """Update an existing memory. Returns updated memory or None."""
    if not database.is_available():
        return None
    try:
        db: Session = database.get_session()
        try:
            memory = (
                db.query(Memory)
                .filter(
                    Memory.id == memory_id,
                    Memory.user_id == user_id,
                    Memory.deleted_at.is_(None),
                )
                .first()
            )
            if not memory:
                return None
            if key is not None:
                memory.key = key
            if content is not None:
                memory.content = content
            if category is not None:
                try:
                    memory.category = MemoryCategory(category)
                except ValueError:
                    pass
            memory.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(memory)
            return memory
        finally:
            db.close()
    except Exception:
        logger.exception("update_memory failed for %s", memory_id)
        return None


def delete_memory(memory_id: str, user_id: str) -> bool:
    """Soft-delete a memory. Returns True on success."""
    if not database.is_available():
        return False
    try:
        db: Session = database.get_session()
        try:
            memory = (
                db.query(Memory)
                .filter(
                    Memory.id == memory_id,
                    Memory.user_id == user_id,
                    Memory.deleted_at.is_(None),
                )
                .first()
            )
            if not memory:
                return False
            memory.deleted_at = datetime.now(timezone.utc)
            db.commit()
            return True
        finally:
            db.close()
    except Exception:
        logger.exception("delete_memory failed for %s", memory_id)
        return False


def find_similar_key(user_id: str, key: str) -> Memory | None:
    """Check if an active memory with the same key (case-insensitive) already exists."""
    if not database.is_available():
        return None
    try:
        db: Session = database.get_session()
        try:
            return (
                db.query(Memory)
                .filter(
                    Memory.user_id == user_id,
                    func.lower(Memory.key) == key.lower().strip(),
                    Memory.deleted_at.is_(None),
                )
                .first()
            )
        finally:
            db.close()
    except Exception:
        logger.exception("find_similar_key failed for user %s…", user_id[:8])
        return None


# ── Detection ─────────────────────────────────────────────────────────────────


def detect_and_store_memory(
    question: str,
    user_id: str,
) -> dict[str, Any] | None:
    """
    Run a lightweight Claude Haiku call to detect if the user message contains
    information worth persisting as a memory. If found, store it and return
    a dict with the created memory data.

    Designed to run in a background thread concurrently with the main stream.
    """
    logger.info("detect_and_store_memory: start for user %s…", user_id[:8])
    if not database.is_available():
        logger.warning("detect_and_store_memory: DB not available — skipping")
        return None
    if not ANTHROPIC_API_KEY:
        logger.warning("detect_and_store_memory: no ANTHROPIC_API_KEY — skipping")
        return None

    try:
        claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=_DETECTION_SYSTEM,
            messages=[{"role": "user", "content": question}],
        )
        raw = response.content[0].text.strip() if response.content else ""
        logger.info("detect_and_store_memory: Haiku raw response: %s", raw)
        result: dict[str, Any] = json.loads(raw)
    except Exception:
        logger.exception("Memory detection failed (Haiku call or JSON parse)")
        return None

    logger.info("detect_and_store_memory: should_store=%s key=%r", result.get("should_store"), result.get("key"))
    if not result.get("should_store"):
        return None

    key = result.get("key", "").strip()
    content = result.get("content", "").strip()
    category = result.get("category", "personal")

    if not key or not content:
        return None

    # Deduplicate: if a memory with the same key exists, update it
    existing = find_similar_key(user_id, key)
    if existing:
        logger.info("detect_and_store_memory: updating existing memory id=%s key=%r", existing.id, key)
        updated = update_memory(existing.id, user_id, key=key, content=content, category=category)
        if updated:
            return {
                "id": updated.id,
                "key": updated.key,
                "content": updated.content,
                "updated": True,
            }
        logger.error("detect_and_store_memory: update_memory returned None for id=%s", existing.id)
        return None

    memory = create_memory(
        user_id=user_id,
        key=key,
        content=content,
        category=category,
        source_context=question[:200],
    )
    if memory:
        logger.info("detect_and_store_memory: created memory id=%s key=%r", memory.id, memory.key)
        return {
            "id": memory.id,
            "key": memory.key,
            "content": memory.content,
            "updated": False,
        }
    logger.error("detect_and_store_memory: create_memory returned None for key=%r", key)
    return None


def format_memories_for_prompt(memories: list[Memory]) -> str:
    """Format memories for injection into the Claude system prompt."""
    if not memories:
        return ""
    lines = [
        "## Athlete's Persistent Memory (coach notes across sessions)",
        "The following information was shared by the athlete in previous sessions.",
        "Use it to answer questions, but do not re-state it unless directly relevant.",
        "",
    ]
    for m in memories:
        date_str = m.created_at.strftime("%Y-%m-%d")
        lines.append(f"[{date_str}] {m.key}: {m.content} (category: {m.category.value})")
    return "\n".join(lines)
