import pytest
from backend.services.light_controller import LightController


def test_initial_state():
    lc = LightController()
    assert lc.status == "off"
    assert lc.mode == "auto"
    assert lc.brightness == 70


def test_turn_on_auto():
    lc = LightController()
    lc.turn_on()
    assert lc.status == "on"


def test_turn_off_auto():
    lc = LightController()
    lc.turn_on()
    lc.turn_off()
    assert lc.status == "off"


def test_manual_mode_ignores_sensor_off():
    lc = LightController()
    lc.set_manual("on", 80)
    lc.turn_off()  # auto turn_off は手動モードでは無視
    assert lc.status == "on"


def test_manual_mode_ignores_sensor_on():
    lc = LightController()
    lc.set_manual("off", 0)
    lc.turn_on()  # auto turn_on は手動モードでは無視
    assert lc.status == "off"


def test_set_auto_restores_mode():
    lc = LightController()
    lc.set_manual("on", 80)
    lc.set_auto()
    assert lc.mode == "auto"


def test_adjust_brightness_up():
    lc = LightController(brightness=50)
    lc.turn_on()
    lc.adjust_brightness(current_lux=100, target_lux=300)
    assert lc.brightness > 50


def test_adjust_brightness_down():
    lc = LightController(brightness=80)
    lc.turn_on()
    lc.adjust_brightness(current_lux=800, target_lux=300)
    assert lc.brightness < 80


def test_brightness_clamp_min():
    lc = LightController(brightness=1)
    lc.turn_on()
    lc.adjust_brightness(current_lux=1000, target_lux=0)
    assert lc.brightness >= 1


def test_brightness_clamp_max():
    lc = LightController(brightness=99)
    lc.turn_on()
    lc.adjust_brightness(current_lux=0, target_lux=1000)
    assert lc.brightness <= 100


def test_adjust_brightness_no_change_when_off():
    lc = LightController(brightness=50)
    lc.adjust_brightness(current_lux=0, target_lux=300)
    assert lc.brightness == 50


def test_to_dict():
    lc = LightController(brightness=60)
    lc.turn_on()
    d = lc.to_dict()
    assert d["status"] == "on"
    assert d["brightness"] == 60
    assert d["mode"] == "auto"
