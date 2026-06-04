import pytest
from backend.services.sensor_service import SensorService


def test_initial_state():
    svc = SensorService()
    assert svc.is_any_detected() is False
    assert svc.get_average_lux() == 0


def test_update_and_detect():
    svc = SensorService()
    svc.update(0, True, 200)
    assert svc.is_any_detected() is True


def test_all_sensors_off():
    svc = SensorService()
    svc.update(0, True, 300)
    svc.update(0, False, 0)
    assert svc.is_any_detected() is False


def test_any_detected_single():
    svc = SensorService()
    svc.update(1, True, 500)
    assert svc.is_any_detected() is True


def test_average_lux_multiple():
    svc = SensorService()
    svc.update(0, True, 400)
    svc.update(1, True, 600)
    assert svc.get_average_lux() == 500


def test_average_lux_only_active():
    svc = SensorService()
    svc.update(0, True, 300)
    svc.update(1, False, 999)  # 非検知センサーはlux計算に含めない
    assert svc.get_average_lux() == 300


def test_invalid_index_raises():
    svc = SensorService()
    with pytest.raises(ValueError):
        svc.update(3, True, 100)


def test_lux_clamped():
    svc = SensorService()
    svc.update(0, True, 9999)
    states = svc.get_states()
    assert states[0]["lux"] == 1000


def test_get_states_format():
    svc = SensorService()
    svc.update(2, True, 150)
    states = svc.get_states()
    assert len(states) == 3
    assert states[2]["detected"] is True
    assert states[2]["lux"] == 150
