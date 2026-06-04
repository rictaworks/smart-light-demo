import { render, screen, fireEvent } from "@testing-library/react";
import SensorPanel from "../../../../frontend/components/SensorPanel";

const mockSensors = [
  { sensor_index: 0, detected: false, lux: 0 },
  { sensor_index: 1, detected: true, lux: 300 },
  { sensor_index: 2, detected: false, lux: 0 },
];

describe("SensorPanel", () => {
  it("3つのセンサーを描画する", () => {
    render(
      <SensorPanel sensors={mockSensors} onToggle={jest.fn()} onLux={jest.fn()} />
    );
    expect(screen.getByText("センサー A")).toBeInTheDocument();
    expect(screen.getByText("センサー B")).toBeInTheDocument();
    expect(screen.getByText("センサー C")).toBeInTheDocument();
  });

  it("検知中のセンサーに「検知中」ラベルを表示する", () => {
    render(
      <SensorPanel sensors={mockSensors} onToggle={jest.fn()} onLux={jest.fn()} />
    );
    expect(screen.getByText("検知中")).toBeInTheDocument();
  });

  it("未検知のセンサーに「未検知」ラベルを表示する", () => {
    render(
      <SensorPanel sensors={mockSensors} onToggle={jest.fn()} onLux={jest.fn()} />
    );
    const labels = screen.getAllByText("未検知");
    expect(labels).toHaveLength(2);
  });

  it("トグルボタンクリックで onToggle を呼ぶ", () => {
    const onToggle = jest.fn();
    render(
      <SensorPanel sensors={mockSensors} onToggle={onToggle} onLux={jest.fn()} />
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onToggle).toHaveBeenCalledWith(0, true, 0);
  });

  it("照度スライダーで onLux を呼ぶ", () => {
    const onLux = jest.fn();
    render(
      <SensorPanel sensors={mockSensors} onToggle={jest.fn()} onLux={onLux} />
    );
    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "500" } });
    expect(onLux).toHaveBeenCalledWith(0, 500);
  });
});
