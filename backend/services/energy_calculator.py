from datetime import datetime

ASSUME_HOURS_PER_DAY = 24.0


class EnergyCalculator:
    def __init__(self, power_watt: float):
        self._power = power_watt
        self._on_since: datetime | None = None
        self._total_on_minutes: float = 0.0

    def record_on(self, ts: datetime) -> None:
        if self._on_since is None:
            self._on_since = ts

    def record_off(self, ts: datetime) -> None:
        if self._on_since is not None:
            elapsed = (ts - self._on_since).total_seconds() / 60.0
            self._total_on_minutes += max(0.0, elapsed)
            self._on_since = None

    def current_on_minutes(self, now: datetime) -> float:
        total = self._total_on_minutes
        if self._on_since is not None:
            total += max(0.0, (now - self._on_since).total_seconds() / 60.0)
        return total

    def calc_kwh_used(self, now: datetime) -> float:
        on_hours = self.current_on_minutes(now) / 60.0
        return round(self._power * on_hours / 1000.0, 6)

    def calc_kwh_saved(self, now: datetime) -> float:
        always_on = self._power * ASSUME_HOURS_PER_DAY / 1000.0
        return round(max(0.0, always_on - self.calc_kwh_used(now)), 6)
