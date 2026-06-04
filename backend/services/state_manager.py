import asyncio
import logging
from datetime import datetime
from typing import Callable, Optional
from .sensor_service import SensorService
from .light_controller import LightController
from .energy_calculator import EnergyCalculator
from .schedule_checker import ScheduleChecker

logger = logging.getLogger(__name__)


class SessionState:
    def __init__(self, session_id: str, settings: dict, light: dict):
        self.sid = session_id
        self.sensor = SensorService()
        self.light = LightController(brightness=light.get("brightness", 70))
        self.light._status = light.get("status", "off")
        self.light._mode = light.get("mode", "auto")
        self.energy = EnergyCalculator(power_watt=settings.get("power_watt", 10.0))
        self.confirmed_any: bool = False
        self.debounce_task: Optional[asyncio.Task] = None
        self.wait_task: Optional[asyncio.Task] = None
        self._debounce_sec: int = settings.get("debounce_sec", 2)
        self._wait_sec: int = settings.get("wait_sec", 60)
        self._target_lux: int = settings.get("target_lux", 300)
        self._power_watt: float = settings.get("power_watt", 10.0)
        self._blackout_from: Optional[str] = settings.get("blackout_from")
        self._blackout_to: Optional[str] = settings.get("blackout_to")
        self._on_light_change: Optional[Callable] = None
        self._on_energy_log: Optional[Callable] = None

    def set_callbacks(
        self,
        on_light_change: Callable[[str, int, str], None],
        on_energy_log: Callable[[float, float, float], None],
    ) -> None:
        self._on_light_change = on_light_change
        self._on_energy_log = on_energy_log

    def update_settings(self, settings: dict) -> None:
        self._debounce_sec = settings.get("debounce_sec", self._debounce_sec)
        self._wait_sec = settings.get("wait_sec", self._wait_sec)
        self._target_lux = settings.get("target_lux", self._target_lux)
        if settings.get("power_watt") and settings["power_watt"] != self._power_watt:
            self._power_watt = settings["power_watt"]
            self.energy = EnergyCalculator(power_watt=self._power_watt)
        self._blackout_from = settings.get("blackout_from", self._blackout_from)
        self._blackout_to = settings.get("blackout_to", self._blackout_to)

    # ── センサー更新 ─────────────────────────────────────────────
    async def process_sensor_update(self, sensor_index: int, detected: bool, lux: int) -> None:
        self.sensor.update(sensor_index, detected, lux)
        new_any = self.sensor.is_any_detected()

        if new_any == self.confirmed_any:
            # 状態変化なし → 未確定のデバウンスをキャンセル
            if self.debounce_task and not self.debounce_task.done():
                self.debounce_task.cancel()
                self.debounce_task = None
            return

        # 状態変化 → デバウンス開始
        if self.debounce_task and not self.debounce_task.done():
            self.debounce_task.cancel()

        self.debounce_task = asyncio.create_task(
            self._debounce_then_apply(new_any)
        )

    async def _debounce_then_apply(self, new_any: bool) -> None:
        try:
            await asyncio.sleep(self._debounce_sec)
        except asyncio.CancelledError:
            return
        self.confirmed_any = new_any
        await self._apply_light_control()

    # ── 照明制御ロジック ─────────────────────────────────────────
    async def _apply_light_control(self) -> None:
        if self.light.is_manual_mode():
            return

        checker = ScheduleChecker(self._blackout_from, self._blackout_to)
        if checker.is_blackout_now():
            await self._do_turn_off()
            return

        if self.confirmed_any:
            if self.wait_task and not self.wait_task.done():
                self.wait_task.cancel()
                self.wait_task = None
            await self._do_turn_on()
        else:
            if self.wait_task and not self.wait_task.done():
                return
            self.wait_task = asyncio.create_task(self._wait_then_off())

    async def _wait_then_off(self) -> None:
        try:
            await asyncio.sleep(self._wait_sec)
        except asyncio.CancelledError:
            return
        await self._do_turn_off()

    async def _do_turn_on(self) -> None:
        was_off = self.light.status == "off"
        avg_lux = self.sensor.get_average_lux()
        self.light.turn_on()
        self.light.adjust_brightness(avg_lux, self._target_lux)
        if was_off:
            self.energy.record_on(datetime.now())
        await self._persist_light()

    async def _do_turn_off(self) -> None:
        was_on = self.light.status == "on"
        self.light.turn_off()
        now = datetime.now()
        if was_on:
            self.energy.record_off(now)
            await self._save_energy_log(now)
        await self._persist_light()

    async def _persist_light(self) -> None:
        if not self._on_light_change:
            return
        s = self.light.to_dict()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._on_light_change, s["status"], s["brightness"], s["mode"])

    async def _save_energy_log(self, now: datetime) -> None:
        if not self._on_energy_log:
            return
        on_min = self.energy.current_on_minutes(now)
        kwh_used = self.energy.calc_kwh_used(now)
        kwh_saved = self.energy.calc_kwh_saved(now)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._on_energy_log, on_min, kwh_used, kwh_saved)

    # ── 手動制御 ─────────────────────────────────────────────────
    async def set_manual(self, status: str, brightness: int) -> None:
        if self.debounce_task and not self.debounce_task.done():
            self.debounce_task.cancel()
        if self.wait_task and not self.wait_task.done():
            self.wait_task.cancel()

        now = datetime.now()
        if status == "off" and self.light.status == "on":
            self.energy.record_off(now)
            await self._save_energy_log(now)
        elif status == "on" and self.light.status == "off":
            self.energy.record_on(now)

        self.light.set_manual(status, brightness)
        await self._persist_light()

    async def set_auto(self) -> None:
        self.light.set_auto()
        await self._apply_light_control()
        await self._persist_light()

    # ── スナップショット ─────────────────────────────────────────
    def get_energy_snapshot(self) -> dict:
        now = datetime.now()
        return {
            "on_minutes": round(self.energy.current_on_minutes(now), 2),
            "kwh_used": self.energy.calc_kwh_used(now),
            "kwh_saved": self.energy.calc_kwh_saved(now),
        }

    def cancel_tasks(self) -> None:
        if self.debounce_task and not self.debounce_task.done():
            self.debounce_task.cancel()
        if self.wait_task and not self.wait_task.done():
            self.wait_task.cancel()


class StateManager:
    def __init__(self):
        self._states: dict[str, SessionState] = {}

    def get_or_create(self, session_id: str, settings: dict, light: dict) -> SessionState:
        if session_id not in self._states:
            self._states[session_id] = SessionState(session_id, settings, light)
        return self._states[session_id]

    def get(self, session_id: str) -> Optional[SessionState]:
        return self._states.get(session_id)

    def remove(self, session_id: str) -> None:
        state = self._states.pop(session_id, None)
        if state:
            state.cancel_tasks()

    def clear_all(self) -> None:
        for sid in list(self._states.keys()):
            self.remove(sid)


state_manager = StateManager()
