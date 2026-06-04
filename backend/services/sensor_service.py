NUM_SENSORS = 3


class SensorService:
    def __init__(self):
        self._detected: list[bool] = [False] * NUM_SENSORS
        self._lux: list[int] = [0] * NUM_SENSORS

    def update(self, index: int, detected: bool, lux: int) -> None:
        if not 0 <= index < NUM_SENSORS:
            raise ValueError(f"sensor_index は 0〜{NUM_SENSORS - 1} の範囲で指定してください")
        self._detected[index] = detected
        self._lux[index] = max(0, min(1000, lux))

    def is_any_detected(self) -> bool:
        return any(self._detected)

    def get_average_lux(self) -> int:
        active = [self._lux[i] for i in range(NUM_SENSORS) if self._detected[i]]
        return int(sum(active) / len(active)) if active else 0

    def get_states(self) -> list[dict]:
        return [
            {"sensor_index": i, "detected": self._detected[i], "lux": self._lux[i]}
            for i in range(NUM_SENSORS)
        ]
