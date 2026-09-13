import type { OpenHours } from "@/lib/reservation/store-hours";

export type ShiftRequestType = "full" | "day_off" | "reduced";

export interface ShiftRequestInput {
  requestType: ShiftRequestType;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

export interface DraftShiftResult {
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

const DAY_OFF: DraftShiftResult = { isDayOff: true, startMinutes: null, endMinutes: null };

function fullAttendance(storeHours: OpenHours): DraftShiftResult {
  return { isDayOff: false, startMinutes: storeHours.openMinutes, endMinutes: storeHours.closeMinutes };
}

/**
 * スタッフの希望（StaffShiftRequest相当）から、店舗の営業時間に収まる
 * ドラフトシフトを機械的に導出する（ルールベース、外部API呼び出しなし）。
 * 複数スタッフ間の必要人数調整は行わない（各人の希望を独立に変換するだけ）。
 * 店舗営業時間の型は既存の`getStoreOpenHours`の戻り値（`OpenHours`）をそのまま使う
 * （同じ形の型をここで再定義しない）。
 *
 * 未提出（requestがnull）は「出勤」明示選択と同じ扱いにする（店舗の営業時間フル）。
 * これは自動生成における安全側のデフォルトであり、希望入力画面側の「完了/不備」
 * 判定（lib/scheduling/shift-request-completion.ts）とは別の目的・別のロジック。
 */
export function deriveDraftShift(
  request: ShiftRequestInput | null,
  storeHours: OpenHours,
): DraftShiftResult {
  if (!request || request.requestType === "full") {
    return fullAttendance(storeHours);
  }
  if (request.requestType === "day_off") {
    return DAY_OFF;
  }

  // requestType === "reduced"
  if (request.preferredStartMinutes === null && request.preferredEndMinutes === null) {
    return DAY_OFF;
  }

  const rawStart = request.preferredStartMinutes ?? storeHours.openMinutes;
  const rawEnd = request.preferredEndMinutes ?? storeHours.closeMinutes;
  const start = Math.max(rawStart, storeHours.openMinutes);
  const end = Math.min(rawEnd, storeHours.closeMinutes);
  if (start >= end) {
    return DAY_OFF;
  }

  return { isDayOff: false, startMinutes: start, endMinutes: end };
}
