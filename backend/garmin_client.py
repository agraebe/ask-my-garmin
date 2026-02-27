"""
Garmin Connect data fetching via garth.

All functions call garth.connectapi(), which makes authenticated requests to
Garmin Connect. garth handles token refresh automatically.
"""

from datetime import date, timedelta
from typing import Any


def _today() -> str:
    return date.today().isoformat()


def _date_str(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def get_profile() -> dict[str, Any]:
    import garth

    return garth.connectapi("/userprofile-service/userprofile/personal-information")


def get_recent_activities(limit: int = 10) -> list[dict[str, Any]]:
    import garth

    result = garth.connectapi(
        "/activitylist-service/activity/search/activities",
        params={"start": 0, "limit": limit},
    )
    return result if isinstance(result, list) else []


def get_daily_summary(display_name: str, date_str: str) -> dict[str, Any]:
    import garth

    return garth.connectapi(
        f"/usersummary-service/usersummary/daily/{display_name}",
        params={"calendarDate": date_str},
    )


def get_sleep_data(display_name: str, date_str: str) -> dict[str, Any]:
    import garth

    return garth.connectapi(
        f"/wellness-service/wellness/dailySleepData/{display_name}",
        params={"date": date_str},
    )


def get_user_settings() -> dict[str, Any]:
    import garth

    return garth.connectapi("/userprofile-service/userprofile/user-settings")


def get_all_data() -> dict[str, Any]:
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
        profile = get_profile()
        display_name = profile.get("displayName", "")
        data["profile"] = {
            "displayName": display_name,
            "email": profile.get("emailAddress", ""),
        }
    except Exception as e:
        data["profile"] = {"error": str(e)}

    # Recent activities
    try:
        activities = get_recent_activities(10)
        data["recentActivities"] = [_format_activity(a) for a in activities]
    except Exception as e:
        data["recentActivities"] = {"error": str(e)}

    # Today's daily summary (steps, calories, floors, HR)
    try:
        data["todayStats"] = get_daily_summary(display_name, today)
    except Exception as e:
        data["todayStats"] = {"error": str(e)}

    # Last night's sleep
    try:
        yesterday = _date_str(1)
        data["lastNightSleep"] = get_sleep_data(display_name, yesterday)
    except Exception as e:
        data["lastNightSleep"] = {"error": str(e)}

    # Heart rate zones derived from user settings
    try:
        settings = get_user_settings()
        user_data = settings.get("userData", {}) if isinstance(settings, dict) else {}
        max_hr = user_data.get("maxHeartRate", 185)
        resting_hr = user_data.get("restingHeartRate", 60)
        data["heartRateZones"] = _compute_hr_zones(max_hr, resting_hr)
    except Exception as e:
        data["heartRateZones"] = {"error": str(e)}

    # Training load: ATL/CTL/TSB from last 90 activities
    try:
        all_activities = get_recent_activities(90)
        data["trainingLoad"] = _compute_training_load(all_activities)
    except Exception as e:
        data["trainingLoad"] = {"error": str(e)}

    data["fetchedAt"] = today
    return data


def _format_activity(a: dict[str, Any]) -> dict[str, Any]:
    dist_m = a.get("distance", 0) or 0
    dur_s = a.get("duration", 0) or 0
    return {
        **a,
        "distanceMiles": round(dist_m / 1609.344, 2),
        "durationFormatted": _format_duration(dur_s),
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


def _compute_training_load(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute 30-day ATL/CTL/TSB from activities."""
    from collections import defaultdict

    tss_by_date: dict[str, float] = defaultdict(float)
    for a in activities:
        start = a.get("startTimeLocal", "") or a.get("startTimeGMT", "")
        if start:
            day = start[:10].replace(" ", "-")
            tss_by_date[day] += a.get("trainingStressScore") or 0

    # Build 42-day window (oldest → newest) for CTL calculation
    window = [_date_str(41 - i) for i in range(42)]
    result = []
    for i, d in enumerate(window):
        atl_slice = window[max(0, i - 6) : i + 1]
        ctl_slice = window[: i + 1]
        atl = sum(tss_by_date[x] for x in atl_slice) / len(atl_slice)
        ctl = sum(tss_by_date[x] for x in ctl_slice) / len(ctl_slice)
        prev_slice = window[max(0, i - 13) : max(0, i - 6)]
        prev_atl = (
            sum(tss_by_date[x] for x in prev_slice) / len(prev_slice)
            if prev_slice
            else atl
        )
        ramp = round(((atl - prev_atl) / prev_atl) * 100) if prev_atl else 0
        result.append(
            {
                "date": d,
                "acuteTrainingLoad": round(atl),
                "chronicTrainingLoad": round(ctl),
                "trainingStressBalance": round(ctl - atl),
                "rampRate": ramp,
            }
        )

    return result[-30:]  # last 30 days only
