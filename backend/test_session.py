"""Unit tests for garminconnect client session serialization / deserialization.

Run with:
    cd backend && pytest test_session.py -v
"""

import json

import pytest
from garminconnect.client import Client as GarminClient

from main import _deserialize_client, _serialize_client


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_fake_client() -> GarminClient:
    """Return a GarminClient pre-loaded with fake but structurally valid tokens."""
    client = GarminClient()
    client.di_token = "fake.di.token"
    client.di_refresh_token = "fake_di_refresh"
    client.di_client_id = "fake_client_id"
    client.it_token = None
    client.it_refresh_token = None
    client.it_client_id = None
    client.jwt_web = None
    client.csrf_token = None
    return client


# ── Tests ──────────────────────────────────────────────────────────────────────


class TestSerializeDeserializeRoundTrip:
    def test_di_token_survives_round_trip(self):
        client = _make_fake_client()
        token_json = _serialize_client(client)
        restored = _deserialize_client(token_json)
        assert restored.di_token == "fake.di.token"

    def test_di_refresh_token_survives_round_trip(self):
        client = _make_fake_client()
        token_json = _serialize_client(client)
        restored = _deserialize_client(token_json)
        assert restored.di_refresh_token == "fake_di_refresh"

    def test_serialized_format_is_valid_json(self):
        client = _make_fake_client()
        token_json = _serialize_client(client)
        parsed = json.loads(token_json)
        assert "di_token" in parsed

    def test_multiple_round_trips_are_stable(self):
        client = _make_fake_client()
        token_json_1 = _serialize_client(client)
        restored_1 = _deserialize_client(token_json_1)
        token_json_2 = _serialize_client(restored_1)
        restored_2 = _deserialize_client(token_json_2)
        assert restored_2.di_token == "fake.di.token"
        assert restored_2.di_refresh_token == "fake_di_refresh"

    def test_all_token_fields_preserved(self):
        client = _make_fake_client()
        client.jwt_web = "fake_jwt_web"
        client.csrf_token = "fake_csrf"
        token_json = _serialize_client(client)
        restored = _deserialize_client(token_json)
        assert restored.jwt_web == "fake_jwt_web"
        assert restored.csrf_token == "fake_csrf"


class TestDeserializeErrors:
    def test_invalid_json_raises_value_error(self):
        with pytest.raises(ValueError, match="Could not restore"):
            _deserialize_client("not-json-at-all")

    def test_empty_tokens_raises_value_error(self):
        # A JSON object with no tokens should fail is_authenticated check
        with pytest.raises(ValueError, match="Could not restore"):
            _deserialize_client(json.dumps({"di_token": None, "jwt_web": None}))
