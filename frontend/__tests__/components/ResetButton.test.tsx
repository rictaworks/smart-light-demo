import { render, screen, fireEvent } from "@testing-library/react";
import ResetButton from "@/components/ResetButton";

describe("ResetButton", () => {
  it("押しただけではリセットせず、確認を出す", () => {
    const onConfirm = jest.fn();
    render(<ResetButton onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("リセット"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/よろしいですか/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("キャンセルすると確認を閉じ、リセットしない", () => {
    const onConfirm = jest.fn();
    render(<ResetButton onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("リセット"));
    fireEvent.click(screen.getByText("キャンセル"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("リセット")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("確認を押したときだけ onConfirm を一度呼ぶ", () => {
    const onConfirm = jest.fn();
    render(<ResetButton onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("リセット"));
    fireEvent.click(screen.getByText("はい、リセットする"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
