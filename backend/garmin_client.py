"""
Garmin Connect data fetching via garth.

All functions accept a garth.Client instance so each user's session is
isolated — no shared global state.
"""

import logging
from datetime import date, timedelta
from typing import Any

import garth

logger = logging.getLogger("ask-my-garmin.garmin_client")


def _today() -> str:
    return date.today().isoformat()


def _date_str(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def get_profile(client: garth.Client) -> dict[str, Any]:
    return client.connectapi("/userprofile-service/userprofile/personal-information")


def get_recent_activities(client: garth.Client, limit: int = 200, page_size: int = 100) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    start = 0
    while len(results) < limit:
        batch = client.connectapi(
            "/activitylist-service/activities/search/activities",
            params={"start": str(start), "limit": str(min(page_size, limit - len(results)))},
        )
        if not batch or not isinstance(batch, list):
            break
        results.extend(batch)
        if len(batch) < page_size:
            break
        start += len(batch)
    return results


def get_daily_summary(client: garth.Client, display_name: str, date_str: str) -> dict[str, Any]:
    return client.connectapi(
        f"/usersummary-service/usersummary/daily/{display_name}",
        params={"calendarDate": date_str},
    )


def get_training_status(client: garth.Client, date_str: str) -> dict[str, Any]:
    return client.connectapi(
        f"/metrics-service/metrics/trainingstatus/aggregated/{date_str}"
    )


def get_sleep_data(client: garth.Client, display_name: str, date_str: str) -> dict[str, Any]:
    return client.connectapi(
        f"/wellness-service/wellness/dailySleepData/{display_name}",
        params={"date": date_str},
    )


def get_user_settings(client: garth.Client) -> dict[str, Any]:
    return client.connectapi("/userprofile-service/userprofile/user-settings")


def get_all_data(client: garth.Client) -> dict[str, Any]:
    """
    Fetch all Garmin data used to build the Claude system prompt.
    Each fetch is independent — failures return an error object rather than
    crashing the whole response.
    """
    today = _today()

    data: dict[str, Any] = {}

    # Profile (needed for display_name used in several endpoints)
    display_name = ""
    try:
        profile = get_profile(client)
        display_name = (
            profile.get("displayName", "")
            or profile.get("userName", "")
            or getattr(client, "username", "")
        )
        data["profile"] = {
            "displayName": display_name,
            "email": profile.get("emailAddress", ""),
        }
    except Exception as e:
        logger.error("Garmin profile fetch failed: %s", e, exc_info=True)
        data["profile"] = {"error": str(e)}

    # Recent activities (limit to 20 to stay within Claude's context window)
    try:
        activities = get_recent_activities(client, 20)
        data["recentActivities"] = [_format_activity(a) for a in activities]
    except Exception as e:
        logger.error("Garmin activities fetch failed: %s", e, exc_info=True)
        data["recentActivities"] = {"error": str(e)}

    # Today's daily summary (steps, calories, floors, HR)
    try:
        data["todayStats"] = get_daily_summary(client, display_name, today)
    except Exception as e:
        logger.error("Garmin todayStats fetch failed (display_name=%r): %s", display_name, e, exc_info=True)
        data["todayStats"] = {"error": str(e)}

    # Last night's sleep
    try:
        yesterday = _date_str(1)
        data["lastNightSleep"] = get_sleep_data(client, display_name, yesterday)
    except Exception as e:
        logger.error("Garmin sleep fetch failed (display_name=%r): %s", display_name, e, exc_info=True)
        data["lastNightSleep"] = {"error": str(e)}

    # Heart rate zones derived from user settings
    try:
        settings = get_user_settings(client)
        user_data = settings.get("userData", {}) if isinstance(settings, dict) else {}
        max_hr = user_data.get("maxHeartRate", 185)
        resting_hr = user_data.get("restingHeartRate", 60)
        data["heartRateZones"] = _compute_hr_zones(max_hr, resting_hr)
    except Exception as e:
        logger.error("Garmin heartRateZones fetch failed: %s", e, exc_info=True)
        data["heartRateZones"] = {"error": str(e)}

    # Training status: load, recovery, VO2 max from Garmin's metrics service
    try:
        data["trainingStatus"] = get_training_status(client, today)
    except Exception as e:
        logger.error("Garmin trainingStatus fetch failed: %s", e, exc_info=True)
        data["trainingStatus"] = {"error": str(e)}

    data["fetchedAt"] = today
    return data


def _format_activity(a: dict[str, Any]) -> dict[str, Any]:
    dist_m = a.get("distance", 0) or 0
    dur_s = a.get("duration", 0) or 0
    avg_pace_s = (dur_s / (dist_m / 1609.344)) if dist_m > 0 else None
    return {
        "activityId": a.get("activityId"),
        "activityName": a.get("activityName"),
        "activityType": (a.get("activityType") or {}).get("typeKey"),
        "startTimeLocal": a.get("startTimeLocal"),
        "distanceMiles": round(dist_m / 1609.344, 2),
        "durationFormatted": _format_duration(dur_s),
        "durationSeconds": dur_s,
        "averagePaceMinPerMile": round(avg_pace_s / 60, 2) if avg_pace_s else None,
        "averageHR": a.get("averageHR"),
        "maxHR": a.get("maxHR"),
        "calories": a.get("calories"),
        "averageSpeed": a.get("averageSpeed"),
        "elevationGain": a.get("elevationGain"),
        "aerobicTrainingEffect": a.get("aerobicTrainingEffect"),
        "anaerobicTrainingEffect": a.get("anaerobicTrainingEffect"),
        "vo2MaxValue": a.get("vO2MaxValue"),
        "avgStrideLength": a.get("avgStrideLength"),
        "avgVerticalOscillation": a.get("avgVerticalOscillation"),
        "avgGroundContactTime": a.get("avgGroundContactTime"),
        "avgRunCadence": a.get("avgRunCadence"),
        "trainingStressScore": a.get("trainingStressScore"),
        "description": a.get("description"),
    }


def _format_duration(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    parts = []
    if h:
        parts.append(f"{h}h")
    if m:
        parts.append(f"{m}m")
    if sec or not parts:
        parts.append(f"{sec}s")
    return " ".join(parts)


def _compute_hr_zones(max_hr: int, resting_hr: int) -> dict[str, Any]:
    return {
        "zone1Min": resting_hr,
        "zone1Max": round(max_hr * 0.6),
        "zone2Min": round(max_hr * 0.6),
        "zone2Max": round(max_hr * 0.7),
        "zone3Min": round(max_hr * 0.7),
        "zone3Max": round(max_hr * 0.8),
        "zone4Min": round(max_hr * 0.8),
        "zone4Max": round(max_hr * 0.9),
        "zone5Min": round(max_hr * 0.9),
        "zone5Max": max_hr,
        "lactateThreshold": round(max_hr * 0.87),
        "maxHeartRate": max_hr,
    }
