// 認証まわりの小さなヘルパー。

/**
 * 2つの文字列を、内容の一致位置によらず同じ時間で比べる（トークンの総当たりでタイミング差を使われないように）。
 * 長さが違う場合は即座に false（長さは秘密にしない前提）。
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < left.length; i++) {
    const x = left[i];
    const y = right[i];
    if (x === undefined || y === undefined) {
      throw new Error("比較中に範囲外の添字を参照しました");
    }
    difference |= x ^ y;
  }
  return difference === 0;
}
