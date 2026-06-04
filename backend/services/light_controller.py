KP = 0.1  # 比例制御ゲイン


class LightController:
    def __init__(self, brightness: int = 70):
        self._status = "off"
        self._brightness = brightness
        self._mode = "auto"

    def set_manual(self, status: str, brightness: int) -> None:
        self._mode = "manual"
        self._status = status
        self._brightness = max(0, min(100, brightness))

    def set_auto(self) -> None:
        self._mode = "auto"

    def turn_on(self) -> None:
        if self._mode == "auto":
            self._status = "on"

    def turn_off(self) -> None:
        if self._mode == "auto":
            self._status = "off"

    def adjust_brightness(self, current_lux: int, target_lux: int) -> None:
        if self._status != "on":
            return
        diff = target_lux - current_lux
        adjustment = int(diff * KP)
        self._brightness = max(1, min(100, self._brightness + adjustment))

    @property
    def status(self) -> str:
        return self._status

    @property
    def brightness(self) -> int:
        return self._brightness

    @property
    def mode(self) -> str:
        return self._mode

    def is_manual_mode(self) -> bool:
        return self._mode == "manual"

    def to_dict(self) -> dict:
        return {"status": self._status, "brightness": self._brightness, "mode": self._mode}
