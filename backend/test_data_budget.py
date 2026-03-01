"""Tests for Garmin data size budget.

These tests ensure that the data passed to Claude stays within the 200K token
context window.  They mock the garth client so no real Garmin credentials are
needed, but they exercise the real _format_activity and get_all_data logic.

Rule of thumb: 1 token ≈ 4 characters.  We conservatively allow 80K tokens
(320 KB of JSON) for Garmin data, leaving plenty of room for the system prompt
and conversation history.

Run with:
    cd backend && pytest test_data_budget.py -v
"""

import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from garmin_client import _format_activity, get_all_data, get_recent_activities

# ── Constants ─────────────────────────────────────────────────────────────────

# 80 000 tokens × 4 chars/token = 320 000 chars.  Stay well within 200K limit.
MAX_GARMIN_DATA_CHARS = 320_000

# Max activities fetched in a single /ask call.
MAX_ACTIVITIES = 20

# Max fields we expect _format_activity to return (essential fields only).
MAX_ACTIVITY_FIELDS = 25


# ── Helpers ───────────────────────────────────────────────────────────────────


def _fake_raw_activity(index: int = 0) -> dict[str, Any]:
    """Return a realistic raw Garmin activity object with many fields (as the API returns)."""
    return {
        "activityId": 1234567890 + index,
        "activityName": f"Morning Run {index}",
        "startTimeLocal": "2024-03-01 06:30:00",
        "startTimeGMT": "2024-03-01 11:30:00",
        "activityType": {"typeId": 1, "typeKey": "running", "parentTypeId": 17},
        "distance": 8046.72,  # 5 miles in metres
        "duration": 2400.0,
        "elapsedDuration": 2450.0,
        "movingDuration": 2400.0,
        "elevationGain": 45.0,
        "elevationLoss": 42.0,
        "averageSpeed": 3.352,
        "maxSpeed": 4.5,
        "calories": 520,
        "averageHR": 155,
        "maxHR": 178,
        "averageRunCadence": 172.0,
        "maxRunCadence": 190.0,
        "avgStrideLength": 1.15,
        "avgVerticalOscillation": 8.2,
        "avgGroundContactTime": 245.0,
        "aerobicTrainingEffect": 3.5,
        "anaerobicTrainingEffect": 0.5,
        "trainingStressScore": 55.2,
        "vO2MaxValue": 54.0,
        "description": "Easy recovery run",
        # These extra raw fields simulate what Garmin's API actually returns
        # and would bloat the prompt if we used {**a, ...} directly.
        "locationName": "Central Park",
        "timezone": "America/New_York",
        "startLatitude": 40.785091,
        "startLongitude": -73.968285,
        "endLatitude": 40.785000,
        "endLongitude": -73.968000,
        "hasPolyline": True,
        "hasImages": False,
        "sportTypeId": 1,
        "ownerId": 9876543,
        "ownerDisplayName": "athlete",
        "ownerFullName": "Test Athlete",
        "ownerProfileImageUrlMedium": "https://example.com/avatar.jpg",
        "deviceId": 111222333,
        "lapCount": 5,
        "endTimeGMT": "2024-03-01 12:10:00",
        "purposeful": True,
        "autoCalcCalories": False,
        "favorite": False,
        "pr": False,
        "personalRecord": False,
        "decoDive": False,
        "summarizedDiveInfo": {},
        "steps": 3200,
        "avgPower": None,
        "maxPower": None,
        "normPower": None,
        "leftBalance": None,
        "rightBalance": None,
        "userDefined": False,
        "visibility": "public",
        "splitSummaries": [],
        "hasSplits": True,
        "moderateIntensityMinutes": 30,
        "vigorousIntensityMinutes": 10,
    }


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestFormatActivityFieldCount:
    def test_returns_only_essential_fields(self):
        """_format_activity must not dump raw API fields — only the essential subset."""
        raw = _fake_raw_activity()
        formatted = _format_activity(raw)

        assert len(formatted) <= MAX_ACTIVITY_FIELDS, (
            f"_format_activity returned {len(formatted)} fields; expected ≤ {MAX_ACTIVITY_FIELDS}. "
            "Adding raw API fields balloons the prompt. Only return essential keys."
        )

    def test_does_not_include_raw_location_fields(self):
        raw = _fake_raw_activity()
        formatted = _format_activity(raw)

        raw_only_fields = {"startLatitude", "startLongitude", "locationName", "hasPolyline"}
        leaked = raw_only_fields & set(formatted.keys())
        assert not leaked, f"Raw API fields leaked into formatted activity: {leaked}"

    def test_includes_required_fields(self):
        raw = _fake_raw_activity()
        formatted = _format_activity(raw)

        required = {"activityId", "activityType", "startTimeLocal", "distanceMiles", "durationFormatted"}
        missing = required - set(formatted.keys())
        assert not missing, f"Essential fields missing from formatted activity: {missing}"

    def test_distance_converted_to_miles(self):
        raw = _fake_raw_activity()
        raw["distance"] = 8046.72  # exactly 5.00 miles
        formatted = _format_activity(raw)
        assert abs(formatted["distanceMiles"] - 5.0) < 0.01

    def test_duration_formatted_as_string(self):
        raw = _fake_raw_activity()
        raw["duration"] = 3661.0  # 1h 1m 1s
        formatted = _format_activity(raw)
        assert formatted["durationFormatted"] == "1h 1m 1s"


class TestActivityBatchSize:
    def test_twenty_activities_fit_within_token_budget(self):
        """20 formatted activities must stay within the Garmin data character budget."""
        activities = [_format_activity(_fake_raw_activity(i)) for i in range(MAX_ACTIVITIES)]
        serialized = json.dumps(activities)
        char_count = len(serialized)

        assert char_count <= MAX_GARMIN_DATA_CHARS, (
            f"20 formatted activities = {char_count:,} chars "
            f"(~{char_count // 4:,} tokens); limit is {MAX_GARMIN_DATA_CHARS:,} chars. "
            "Trim _format_activity fields."
        )

    def test_trimming_reduces_size_significantly(self):
        """Regression: _format_activity must discard most raw fields.

        If someone reverts to {**a, ...} the formatted size would equal the raw
        size and this test would fail, catching the regression early.
        """
        raw = _fake_raw_activity()
        formatted = _format_activity(raw)

        raw_size = len(json.dumps(raw))
        formatted_size = len(json.dumps(formatted))

        assert formatted_size < raw_size * 0.6, (
            f"Formatted activity ({formatted_size} chars) should be < 60% of raw "
            f"({raw_size} chars). Likely cause: _format_activity leaking raw fields "
            "via {{**a, ...}}."
        )


class TestGetRecentActivitiesLimit:
    def test_limit_respected_on_single_page(self):
        """get_recent_activities must not fetch more than the requested limit."""
        fake_client = MagicMock()
        batch_of_5 = [_fake_raw_activity(i) for i in range(5)]
        fake_client.connectapi.return_value = batch_of_5

        result = get_recent_activities(fake_client, limit=20)

        # With a batch of 5 returned, only one API call should be needed.
        assert len(result) == 5
        assert fake_client.connectapi.call_count == 1

    def test_pagination_stops_at_limit(self):
        """get_recent_activities must stop paginating once limit is reached."""
        fake_client = MagicMock()
        # Each page returns 10 items
        fake_client.connectapi.return_value = [_fake_raw_activity(i) for i in range(10)]

        result = get_recent_activities(fake_client, limit=20, page_size=10)

        assert len(result) == 20
        assert fake_client.connectapi.call_count == 2  # 2 pages of 10
