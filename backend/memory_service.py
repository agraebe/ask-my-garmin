"""
Memory service for Ask My Garmin.

Provides:
 - User ID hashing (SHA-256 of Garmin user ID)
 - CRUD operations for memories
 - Autonomous memory detection via Claude Haiku
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import anthropic
import garth
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


def get_user_id_hash(client: garth.Client) -> str:
    """Return SHA-256 of the Garmin user's numeric user ID."""
    try:
        profile = client.connectapi("/userprofile-service/userprofile/personal-information")
        user_id = str((profile or {}).get("userId", ""))
        if not user_id:
            raise ValueError("No userId in Garmin profile")
        return hashlib.sha256(user_id.encode()).hexdigest()
    except Exception as exc:
        raise ValueError(f"Could not derive user identity: {exc}") from exc


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
            memories = (
                db.query(Memory)
                .filter(Memory.user_id == user_id, Memory.deleted_at.is_(None))
                .all()
            )
            key_lower = key.lower().strip()
            for m in memories:
                if m.key.lower().strip() == key_lower:
                    return m
            return None
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
    if not database.is_available():
        return None
    if not ANTHROPIC_API_KEY:
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
        result: dict[str, Any] = json.loads(raw)
    except Exception:
        logger.exception("Memory detection failed")
        return None

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
        updated = update_memory(existing.id, user_id, key=key, content=content, category=category)
        if updated:
            return {
                "id": updated.id,
                "key": updated.key,
                "content": updated.content,
                "updated": True,
            }
        return None

    memory = create_memory(
        user_id=user_id,
        key=key,
        content=content,
        category=category,
        source_context=question[:200],
    )
    if memory:
        return {
            "id": memory.id,
            "key": memory.key,
            "content": memory.content,
            "updated": False,
        }
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
