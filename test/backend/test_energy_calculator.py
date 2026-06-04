from datetime import datetime, timedelta
from backend.services.energy_calculator import EnergyCalculator


def test_initial_zero():
    ec = EnergyCalculator(power_watt=10.0)
    now = datetime.now()
    assert ec.current_on_minutes(now) == 0.0
    assert ec.calc_kwh_used(now) == 0.0


def test_on_time_accumulated():
    ec = EnergyCalculator(power_watt=10.0)
    t0 = datetime.now()
    ec.record_on(t0)
    t1 = t0 + timedelta(minutes=60)
    ec.record_off(t1)
    assert abs(ec.current_on_minutes(t1) - 60.0) < 0.01


def test_kwh_used():
    ec = EnergyCalculator(power_watt=100.0)
    t0 = datetime.now()
    ec.record_on(t0)
    t1 = t0 + timedelta(hours=1)
    ec.record_off(t1)
    # 100W × 1h = 0.1 kWh
    assert abs(ec.calc_kwh_used(t1) - 0.1) < 0.0001


def test_kwh_saved():
    ec = EnergyCalculator(power_watt=10.0)
    t0 = datetime.now()
    ec.record_on(t0)
    t1 = t0 + timedelta(hours=1)
    ec.record_off(t1)
    # 常時ON = 10W × 24h / 1000 = 0.24 kWh
    # 使用 = 10W × 1h / 1000 = 0.01 kWh
    # 節約 ≈ 0.23 kWh
    assert ec.calc_kwh_saved(t1) > 0


def test_current_on_minutes_live():
    ec = EnergyCalculator(power_watt=10.0)
    t0 = datetime.now()
    ec.record_on(t0)
    t1 = t0 + timedelta(minutes=30)
    assert abs(ec.current_on_minutes(t1) - 30.0) < 0.01


def test_no_negative_saved():
    ec = EnergyCalculator(power_watt=10.0)
    t0 = datetime.now()
    ec.record_on(t0)
    t1 = t0 + timedelta(hours=48)  # 24時間以上ON
    ec.record_off(t1)
    assert ec.calc_kwh_saved(t1) >= 0.0


def test_multiple_on_off_cycles():
    ec = EnergyCalculator(power_watt=60.0)
    t0 = datetime.now()
    ec.record_on(t0)
    ec.record_off(t0 + timedelta(minutes=30))
    ec.record_on(t0 + timedelta(minutes=60))
    ec.record_off(t0 + timedelta(minutes=90))
    # 合計60分ON
    t_end = t0 + timedelta(minutes=90)
    assert abs(ec.current_on_minutes(t_end) - 60.0) < 0.01
