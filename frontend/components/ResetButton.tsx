import { useState } from "react";

interface ResetButtonProps {
  /** 利用者が確認を押したときに一度だけ呼ばれる。 */
  onConfirm: () => void;
}

/**
 * リセットボタン。押しただけでは消去せず、画面内の確認を挟む（alert / confirm は使わない）。
 * 消えるのはこのセッションのデータだけ。
 */
export default function ResetButton({ onConfirm }: ResetButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setConfirming(true)}
        style={{ fontSize: "0.75rem" }}
      >
        <i className="fas fa-trash-restore" />
        リセット
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="reset-confirm-message"
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      <span id="reset-confirm-message" style={{ fontSize: "0.75rem", color: "var(--red)" }}>
        このセッションの設定と記録を消去します。よろしいですか？
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setConfirming(false)}
        style={{ fontSize: "0.75rem" }}
      >
        キャンセル
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        style={{ fontSize: "0.75rem", color: "var(--red)" }}
      >
        <i className="fas fa-check" />
        はい、リセットする
      </button>
    </div>
  );
}
