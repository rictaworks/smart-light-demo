from datetime import datetime, time


class ScheduleChecker:
    def __init__(self, blackout_from: str | None, blackout_to: str | None):
        self._from = self._parse(blackout_from)
        self._to = self._parse(blackout_to)

    def _parse(self, t: str | None) -> time | None:
        if not t:
            return None
        h, m = t.split(":")
        return time(int(h), int(m))

    def is_blackout_now(self) -> bool:
        if not self._from or not self._to:
            return False
        now = datetime.now().time().replace(second=0, microsecond=0)
        if self._from <= self._to:
            return self._from <= now < self._to
        # 日をまたぐ（例: 22:00〜07:00）
        return now >= self._from or now < self._to
