// 消灯時間帯の判定（旧 backend/services/schedule_checker.py の移植）。
// 時刻は JST（UTC+9）の時分で比べる。日をまたぐ時間帯（例: 22:00〜07:00）に対応する。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "HH:MM" を その日0時からの分に変換する。 */
export function toMinuteOfDay(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** エポックミリ秒を JST の「その日0時からの分」に変換する。 */
export function jstMinuteOfDay(nowMs: number): number {
  const jst = new Date(nowMs + JST_OFFSET_MS);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** 指定時刻が消灯時間帯に入っているかを判定する。両端のどちらかが未設定なら false。 */
export function isBlackout(
  blackoutFrom: string | null,
  blackoutTo: string | null,
  atMs: number
): boolean {
  if (!blackoutFrom || !blackoutTo) {
    return false;
  }
  const from = toMinuteOfDay(blackoutFrom);
  const to = toMinuteOfDay(blackoutTo);
  const now = jstMinuteOfDay(atMs);
  if (from <= to) {
    return from <= now && now < to;
  }
  // 日をまたぐ時間帯
  return now >= from || now < to;
}
