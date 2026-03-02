"""
Database setup for Ask My Garmin.

Uses SQLAlchemy with a synchronous PostgreSQL engine. When DATABASE_URL is not
set, all memory operations silently fail rather than crashing the server.
"""

import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger("ask-my-garmin.database")

_DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Railway and some cloud providers use postgres:// — SQLAlchemy requires postgresql://
if _DATABASE_URL.startswith("postgres://"):
    _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)


class Base(DeclarativeBase):
    pass


_db_available = False
engine = None
SessionLocal = None

if _DATABASE_URL:
    try:
        engine = create_engine(
            _DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=1800,
            connect_args={"connect_timeout": 10},
        )
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        _db_available = True
    except Exception:
        logger.exception("Failed to create database engine")
else:
    logger.warning("DATABASE_URL not set — memory features are disabled")


def is_available() -> bool:
    return _db_available


def get_session():
    """Return a new SQLAlchemy session. Caller is responsible for closing it."""
    if SessionLocal is None:
        raise RuntimeError("Database not configured (DATABASE_URL missing)")
    return SessionLocal()


def init_db() -> None:
    """Create all tables if they don't exist. No-op if DB is unavailable."""
    if engine is None:
        logger.info("Skipping DB init — DATABASE_URL not configured")
        return
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialised")
    except Exception:
        logger.exception("Failed to initialise database tables")
