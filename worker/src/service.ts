// リクエスト1回分の処理の枠（読む → 期限を進める → 操作する → 保存する）。
// 保存は楽観ロックで行い、他のリクエストと競合したら読み直して操作をやり直す。

import { HttpError } from "./errors";
import { SessionMachine } from "./domain/machine";
import type { SessionRepository } from "./repository";

const MAX_ATTEMPTS = 8;
/** 再試行の待ち時間の基準（ミリ秒）。同時に競合した者同士がぶつからないよう、回数に応じて伸ばし、乱数で揺らす。 */
const RETRY_BASE_MS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newVersionToken(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const token = buffer[0];
  if (token === undefined) {
    throw new Error("乱数の生成に失敗しました");
  }
  return token;
}

/**
 * セッションの状態を読み、期限切れの処理を適用してから operation を実行する。
 * 状態が変わっていれば保存する。operation の戻り値（JSON化できる値）を返す。
 */
export async function withSessionMachine<T>(
  repo: SessionRepository,
  sessionId: string,
  nowMs: number,
  operation: (machine: SessionMachine) => T
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const loaded = await repo.load(sessionId);
    if (loaded === null) {
      throw new HttpError(404, "セッションが見つかりません");
    }
    const machine = new SessionMachine(loaded.settings, loaded.runtime, loaded.light);
    machine.advance(nowMs);
    const result = operation(machine);
    if (!machine.dirty) {
      return result;
    }
    if (await repo.commit(sessionId, loaded.version, newVersionToken(), machine)) {
      return result;
    }
    // 他のリクエストが先に保存した。少し待ってから読み直す。
    await sleep(RETRY_BASE_MS * (attempt + 1) * (0.5 + Math.random()));
  }
  throw new HttpError(409, "同時に操作されたため保存できませんでした。もう一度お試しください。");
}
