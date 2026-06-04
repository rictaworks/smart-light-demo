import { render, screen, fireEvent } from "@testing-library/react";
import LightControl from "@/components/LightControl";

describe("LightControl", () => {
  const autoOff = { status: "off" as const, brightness: 70, mode: "auto" as const };
  const autoOn = { status: "on" as const, brightness: 80, mode: "auto" as const };
  const manualOn = { status: "on" as const, brightness: 90, mode: "manual" as const };

  it("自動モード OFF で「消灯中」を表示する", () => {
    render(<LightControl light={autoOff} onManual={jest.fn()} onAuto={jest.fn()} />);
    expect(screen.getByText("消灯中")).toBeInTheDocument();
  });

  it("自動モード ON で「点灯中」を表示する", () => {
    render(<LightControl light={autoOn} onManual={jest.fn()} onAuto={jest.fn()} />);
    expect(screen.getByText("点灯中")).toBeInTheDocument();
  });

  it("手動モード切替ボタンで onManual を呼ぶ", () => {
    const onManual = jest.fn();
    render(<LightControl light={autoOff} onManual={onManual} onAuto={jest.fn()} />);
    fireEvent.click(screen.getByText("手動モードに切り替え"));
    expect(onManual).toHaveBeenCalled();
  });

  it("手動モード中に「自動に戻す」ボタンで onAuto を呼ぶ", () => {
    const onAuto = jest.fn();
    render(<LightControl light={manualOn} onManual={jest.fn()} onAuto={onAuto} />);
    fireEvent.click(screen.getByText("自動に戻す"));
    expect(onAuto).toHaveBeenCalled();
  });

  it("手動モード中に「手動 OFF」ボタンを表示する", () => {
    render(<LightControl light={manualOn} onManual={jest.fn()} onAuto={jest.fn()} />);
    expect(screen.getByText("手動 OFF")).toBeInTheDocument();
  });
});
