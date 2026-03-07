"""Unit tests for memory_service.get_user_id_hash.

Run with:
    cd backend && pytest test_memory_service.py -v
"""

import hashlib
from unittest.mock import MagicMock, patch

import garth
import pytest
from garth.auth_tokens import OAuth1Token, OAuth2Token

from memory_service import get_user_id_hash


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_client(
    *,
    oauth1_token: str = "stable_oauth1_token",
    access_token: str = "opaque_access_token",  # not a JWT
) -> garth.Client:
    """Return a garth Client pre-loaded with fake tokens."""
    oauth1 = OAuth1Token(
        oauth_token=oauth1_token,
        oauth_token_secret="secret",
        mfa_token=None,
        mfa_expiration_timestamp=None,
        domain="garmin.com",
    )
    oauth2 = OAuth2Token(
        scope="CONNECT_READ",
        jti="jti-123",
        token_type="Bearer",
        access_token=access_token,
        refresh_token="refresh_token",
        expires_in=3600,
        expires_at=9_999_999_999,
        refresh_token_expires_in=7_776_000,
        refresh_token_expires_at=9_999_999_999,
    )
    client = garth.Client()
    client.configure(oauth1_token=oauth1, oauth2_token=oauth2, domain="garmin.com")
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


class TestGetUserIdHashJwtFallback:
    def _make_jwt_access_token(self, sub: str) -> str:
        """Create a minimal fake JWT with a sub claim (not cryptographically valid)."""
        import base64
        import json

        payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode()
        return f"header.{payload}.sig"

    def test_falls_back_to_jwt_sub_when_profile_fails(self):
        jwt_token = self._make_jwt_access_token("user-sub-abc123")
        client = _make_client(access_token=jwt_token)
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        result = get_user_id_hash(client)

        assert result == _sha256("user-sub-abc123")

    def test_falls_back_to_jwt_sub_when_profile_returns_no_user_id(self):
        jwt_token = self._make_jwt_access_token("user-sub-xyz")
        client = _make_client(access_token=jwt_token)
        client.connectapi = MagicMock(return_value={"emailAddress": "runner@example.com"})

        result = get_user_id_hash(client)

        assert result == _sha256("user-sub-xyz")


class TestGetUserIdHashOAuth1Fallback:
    def test_falls_back_to_oauth1_token_when_profile_and_jwt_fail(self):
        """This is the critical fix: opaque (non-JWT) access tokens must use OAuth1."""
        client = _make_client(
            oauth1_token="stable_oauth1_token_abc",
            access_token="opaque_no_dots_token",  # not a JWT — no dots
        )
        client.connectapi = MagicMock(side_effect=Exception("Garmin API down"))

        result = get_user_id_hash(client)

        assert result == _sha256("stable_oauth1_token_abc")

    def test_oauth1_hash_is_stable(self):
        """Same OAuth1 token must always produce the same hash."""
        client = _make_client(oauth1_token="my_garmin_oauth1")
        client.connectapi = MagicMock(side_effect=Exception("API error"))

        result1 = get_user_id_hash(client)
        result2 = get_user_id_hash(client)

        assert result1 == result2

    def test_different_oauth1_tokens_produce_different_hashes(self):
        client_a = _make_client(oauth1_token="token_user_a")
        client_b = _make_client(oauth1_token="token_user_b")
        client_a.connectapi = MagicMock(side_effect=Exception("error"))
        client_b.connectapi = MagicMock(side_effect=Exception("error"))

        result_a = get_user_id_hash(client_a)
        result_b = get_user_id_hash(client_b)

        assert result_a != result_b


class TestGetUserIdHashErrors:
    def test_raises_when_all_sources_fail(self):
        client = _make_client(oauth1_token="", access_token="no_dots")
        client.connectapi = MagicMock(side_effect=Exception("API error"))
        # Force oauth1_token.oauth_token to be empty
        client.oauth1_token.oauth_token = ""

        with pytest.raises(ValueError, match="Could not derive user identity"):
            get_user_id_hash(client)
