"""Unit tests for garth client session serialization / deserialization.

Run with:
    cd backend && pytest test_session.py -v
"""

import json

import garth
import pytest
from garth.auth_tokens import OAuth1Token, OAuth2Token

from main import _deserialize_garth_client, _serialize_garth_client


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_fake_client() -> garth.Client:
    """Return a garth Client pre-loaded with fake but structurally valid tokens."""
    oauth1 = OAuth1Token(
        oauth_token="fake_oauth_token",
        oauth_token_secret="fake_oauth_secret",
        mfa_token=None,
        mfa_expiration_timestamp=None,
        domain="garmin.com",
    )
    oauth2 = OAuth2Token(
        scope="CONNECT_READ CONNECT_WRITE",
        jti="fake-jti-1234",
        token_type="Bearer",
        access_token="fake_access_token",
        refresh_token="fake_refresh_token",
        expires_in=3600,
        expires_at=9_999_999_999,
        refresh_token_expires_in=7_776_000,
        refresh_token_expires_at=9_999_999_999,
    )
    client = garth.Client()
    client.configure(oauth1_token=oauth1, oauth2_token=oauth2, domain="garmin.com")
    return client


# ── Tests ──────────────────────────────────────────────────────────────────────


class TestSerializeDeserializeRoundTrip:
    def test_oauth1_token_not_none_after_round_trip(self):
        client = _make_fake_client()
        token_json = _serialize_garth_client(client)
        restored = _deserialize_garth_client(token_json)

        assert restored.oauth1_token is not None, "oauth1_token must survive the round-trip"

    def test_oauth2_token_not_none_after_round_trip(self):
        client = _make_fake_client()
        token_json = _serialize_garth_client(client)
        restored = _deserialize_garth_client(token_json)

        assert restored.oauth2_token is not None, "oauth2_token must survive the round-trip"

    def test_oauth1_token_fields_match(self):
        client = _make_fake_client()
        token_json = _serialize_garth_client(client)
        restored = _deserialize_garth_client(token_json)

        assert restored.oauth1_token.oauth_token == "fake_oauth_token"
        assert restored.oauth1_token.oauth_token_secret == "fake_oauth_secret"
        assert restored.oauth1_token.domain == "garmin.com"

    def test_oauth2_token_fields_match(self):
        client = _make_fake_client()
        token_json = _serialize_garth_client(client)
        restored = _deserialize_garth_client(token_json)

        assert restored.oauth2_token.access_token == "fake_access_token"
        assert restored.oauth2_token.refresh_token == "fake_refresh_token"
        assert restored.oauth2_token.scope == "CONNECT_READ CONNECT_WRITE"
        assert restored.oauth2_token.token_type == "Bearer"

    def test_serialized_format_is_valid_json(self):
        client = _make_fake_client()
        token_json = _serialize_garth_client(client)

        parsed = json.loads(token_json)
        assert "dumps_b64" in parsed, "New format must use 'dumps_b64' key"

    def test_multiple_round_trips_are_stable(self):
        """Serialize → deserialize twice; tokens must be identical each time."""
        client = _make_fake_client()

        token_json_1 = _serialize_garth_client(client)
        restored_1 = _deserialize_garth_client(token_json_1)

        token_json_2 = _serialize_garth_client(restored_1)
        restored_2 = _deserialize_garth_client(token_json_2)

        assert restored_2.oauth1_token is not None
        assert restored_2.oauth1_token.oauth_token == "fake_oauth_token"
        assert restored_2.oauth2_token.access_token == "fake_access_token"


class TestLegacyFormatBackwardCompat:
    """Verify the deserializer handles the old file-based format (keys with .json suffix)."""

    def _make_legacy_token_json(self, use_json_suffix: bool = True) -> str:
        """Produce a v1 serialized token as the old server code would have written it."""
        import dataclasses

        client = _make_fake_client()
        suffix = ".json" if use_json_suffix else ""
        legacy: dict[str, str] = {
            f"oauth1_token{suffix}": json.dumps(dataclasses.asdict(client.oauth1_token)),
            f"oauth2_token{suffix}": json.dumps(dataclasses.asdict(client.oauth2_token)),
        }
        return json.dumps(legacy)

    def test_legacy_format_with_json_suffix(self):
        token_json = self._make_legacy_token_json(use_json_suffix=True)
        restored = _deserialize_garth_client(token_json)

        assert restored.oauth1_token is not None
        assert restored.oauth1_token.oauth_token == "fake_oauth_token"

    def test_legacy_format_without_json_suffix(self):
        token_json = self._make_legacy_token_json(use_json_suffix=False)
        restored = _deserialize_garth_client(token_json)

        assert restored.oauth1_token is not None
        assert restored.oauth1_token.oauth_token == "fake_oauth_token"


class TestDeserializeErrors:
    def test_invalid_json_raises_value_error(self):
        with pytest.raises(ValueError, match="not valid JSON"):
            _deserialize_garth_client("not-json-at-all")

    def test_corrupted_dumps_b64_raises_value_error(self):
        bad = json.dumps({"dumps_b64": "this-is-not-valid-base64-garth-data!!!"})
        with pytest.raises(ValueError, match="Could not restore garth client"):
            _deserialize_garth_client(bad)
