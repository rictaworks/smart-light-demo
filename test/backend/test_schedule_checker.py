from unittest.mock import patch
from datetime import datetime, time
from backend.services.schedule_checker import ScheduleChecker


def _at(hour: int, minute: int):
    return datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)


def test_no_blackout_when_not_set():
    sc = ScheduleChecker(None, None)
    assert sc.is_blackout_now() is False


def test_blackout_same_day_inside():
    sc = ScheduleChecker("00:00", "06:00")
    with patch("backend.services.schedule_checker.datetime") as m:
        m.now.return_value = _at(3, 0)
        assert sc.is_blackout_now() is True


def test_blackout_same_day_outside():
    sc = ScheduleChecker("00:00", "06:00")
    with patch("backend.services.schedule_checker.datetime") as m:
        m.now.return_value = _at(10, 0)
        assert sc.is_blackout_now() is False


def test_blackout_overnight_inside_after():
    sc = ScheduleChecker("22:00", "07:00")
    with patch("backend.services.schedule_checker.datetime") as m:
        m.now.return_value = _at(23, 30)
        assert sc.is_blackout_now() is True


def test_blackout_overnight_inside_before():
    sc = ScheduleChecker("22:00", "07:00")
    with patch("backend.services.schedule_checker.datetime") as m:
        m.now.return_value = _at(4, 0)
        assert sc.is_blackout_now() is True


def test_blackout_overnight_outside():
    sc = ScheduleChecker("22:00", "07:00")
    with patch("backend.services.schedule_checker.datetime") as m:
        m.now.return_value = _at(12, 0)
        assert sc.is_blackout_now() is False
