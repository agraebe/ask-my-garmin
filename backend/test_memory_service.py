"""Unit tests for memory_service.get_user_id_hash.

Run with:
    cd backend && pytest test_memory_service.py -v
"""

import base64
import hashlib
import json
from unittest.mock import MagicMock

import pytest

from memory_service import get_user_id_hash


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_jwt(sub: str) -> str:
    """Create a minimal fake JWT with a sub claim (not cryptographically valid)."""
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode()
    return f"header.{payload}.sig"


def _make_client(*, di_token: str | None = None) -> MagicMock:
    """Return a mock garminconnect Client."""
    client = MagicMock()
    client.di_token = di_token
    return client


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ── Tests ──────────────────────────────────────────────────────────────────────


class TestGetUserIdHashPrimaryPath:
    def test_returns_hash_of_user_id_from_profile(self):
        client = _make_client()
        client.connectapi = MagicMock(return_value={"userId": 12345678})

        result = get_user_id_hash(client)

        assert result == _sha256("12345678")

    def test_profile_with_string_user_id(self):
        client = _make_client()
        client.connectapi = MagicMock(return_value={"userId": "99999999"})

        result = get_user_id_hash(client)

        assert result == _sha256("99999999")


class TestGetUserIdHashDiTokenFallback:
    def test_falls_back_to_di_token_jwt_sub_when_profile_fails(self):
        di_tok = _make_jwt("user-sub-abc123")
        client = _make_client(di_token=di_tok)
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        result = get_user_id_hash(client)

        assert result == _sha256("user-sub-abc123")

    def test_falls_back_to_di_token_jwt_sub_when_profile_returns_no_user_id(self):
        di_tok = _make_jwt("user-sub-xyz")
        client = _make_client(di_token=di_tok)
        client.connectapi = MagicMock(return_value={"emailAddress": "runner@example.com"})

        result = get_user_id_hash(client)

        assert result == _sha256("user-sub-xyz")

    def test_di_token_hash_is_stable(self):
        di_tok = _make_jwt("my-garmin-sub")
        client = _make_client(di_token=di_tok)
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        assert get_user_id_hash(client) == get_user_id_hash(client)

    def test_different_di_tokens_produce_different_hashes(self):
        client_a = _make_client(di_token=_make_jwt("sub-user-a"))
        client_b = _make_client(di_token=_make_jwt("sub-user-b"))
        client_a.connectapi = MagicMock(side_effect=Exception("error"))
        client_b.connectapi = MagicMock(side_effect=Exception("error"))

        assert get_user_id_hash(client_a) != get_user_id_hash(client_b)


class TestGetUserIdHashAlternateProfileEndpoint:
    def test_falls_back_to_userprofile_endpoint(self):
        """If personal-information has no userId, try /userprofile."""
        client = _make_client()
        client.connectapi = MagicMock(side_effect=[
            {"displayName": "runner"},  # personal-information — no userId
            {"userId": 55555555},       # /userprofile — has userId
        ])

        result = get_user_id_hash(client)

        assert result == _sha256("55555555")


class TestGetUserIdHashOpaqueTokenFallback:
    def test_hashes_di_token_directly_when_not_a_jwt(self):
        """Opaque di_token (no dots) should be hashed directly as last resort."""
        opaque = "opaque_di_token_no_dots"
        client = _make_client(di_token=opaque)
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        result = get_user_id_hash(client)

        assert result == _sha256(opaque)

    def test_opaque_token_hash_is_stable(self):
        opaque = "stable_opaque_token"
        client = _make_client(di_token=opaque)
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        assert get_user_id_hash(client) == get_user_id_hash(client)


class TestGetUserIdHashErrors:
    def test_raises_when_all_sources_fail(self):
        client = _make_client(di_token=None)
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        with pytest.raises(ValueError, match="Could not derive user identity"):
            get_user_id_hash(client)
