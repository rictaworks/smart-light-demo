import { render, screen, fireEvent } from "@testing-library/react";
import ScheduleSettings from "@/components/ScheduleSettings";
import type { Settings } from "@/types";

const baseSettings: Settings = {
  debounce_sec: 2,
  wait_sec: 60,
  target_lux: 300,
  power_watt: 10,
  blackout_from: null,
  blackout_to: null,
};

describe("ScheduleSettings", () => {
  it("設定値を入力フィールドに表示する", () => {
    render(<ScheduleSettings settings={baseSettings} onUpdate={jest.fn()} />);
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("60")).toBeInTheDocument();
    expect(screen.getByDisplayValue("300")).toBeInTheDocument();
  });

  it("保存ボタンクリックで onUpdate を呼ぶ", () => {
    const onUpdate = jest.fn();
    render(<ScheduleSettings settings={baseSettings} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("保存"));
    expect(onUpdate).toHaveBeenCalled();
  });

  it("デバウンス値変更が反映される", () => {
    const onUpdate = jest.fn();
    render(<ScheduleSettings settings={baseSettings} onUpdate={onUpdate} />);
    const input = screen.getByLabelText("デバウンス秒");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByText("保存"));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ debounce_sec: 5 })
    );
  });
});
