import type { ShiftRequestType } from "./derive-shift-draft";

export interface ShiftRequestLike {
  requestType: ShiftRequestType;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

/**
 * スタッフのシフト希望画面で、その日の入力が「完了」しているかを判定する。
 *
 * 自動生成ロジック（deriveDraftShift）では「未提出＝出勤扱い」という安全側の
 * デフォルトを採用しているが、ここでの目的は入力の完了確認であり別軸の判定。
 * 未提出のまま何も入力しない状態を「完了」とはみなさない（スタッフに毎日
 * 明示的な選択を促すため）。同様に「時短希望」を選んでいるのに開始・終了
 * 時刻がどちらも未入力の場合も、まだ入力途中とみなし「不備」として扱う。
 */
export function isShiftRequestComplete(item: ShiftRequestLike | undefined): boolean {
  if (!item) return false;
  if (item.requestType === "reduced") {
    return item.preferredStartMinutes !== null || item.preferredEndMinutes !== null;
  }
  return true;
}
