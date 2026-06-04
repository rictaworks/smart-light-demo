import { render, screen, fireEvent } from "@testing-library/react";
import BrightnessSlider from "../../../../frontend/components/BrightnessSlider";

describe("BrightnessSlider", () => {
  const autoLight = { status: "on" as const, brightness: 60, mode: "auto" as const };
  const manualLight = { status: "on" as const, brightness: 80, mode: "manual" as const };

  it("現在の輝度値を表示する", () => {
    render(<BrightnessSlider light={autoLight} onBrightnessChange={jest.fn()} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("自動モード時はスライダーが無効", () => {
    render(<BrightnessSlider light={autoLight} onBrightnessChange={jest.fn()} />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeDisabled();
  });

  it("手動モード時はスライダーが有効", () => {
    render(<BrightnessSlider light={manualLight} onBrightnessChange={jest.fn()} />);
    const slider = screen.getByRole("slider");
    expect(slider).not.toBeDisabled();
  });

  it("スライダー変更で onBrightnessChange を呼ぶ", () => {
    const onChange = jest.fn();
    render(<BrightnessSlider light={manualLight} onBrightnessChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "90" } });
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it("自動モード時に「自動制御中」メッセージを表示する", () => {
    render(<BrightnessSlider light={autoLight} onBrightnessChange={jest.fn()} />);
    expect(screen.getByText("自動制御中（スライダー無効）")).toBeInTheDocument();
  });
});
