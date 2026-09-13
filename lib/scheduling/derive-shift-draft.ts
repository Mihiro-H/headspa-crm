import type { OpenHours } from "@/lib/reservation/store-hours";

export interface ShiftRequestInput {
  isDayOffRequested: boolean;
  preferredStartMinutes: number | null;
  preferredEndMinutes: number | null;
}

export interface DraftShiftResult {
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

const DAY_OFF: DraftShiftResult = { isDayOff: true, startMinutes: null, endMinutes: null };

/**
 * スタッフの希望（StaffShiftRequest相当）から、店舗の営業時間に収まる
 * ドラフトシフトを機械的に導出する（ルールベース、外部API呼び出しなし）。
 * 複数スタッフ間の必要人数調整は行わない（各人の希望を独立に変換するだけ）。
 * 店舗営業時間の型は既存の`getStoreOpenHours`の戻り値（`OpenHours`）をそのまま使う
 * （同じ形の型をここで再定義しない）。
 */
export function deriveDraftShift(
  request: ShiftRequestInput | null,
  storeHours: OpenHours,
): DraftShiftResult {
  if (!request || request.isDayOffRequested) {
    return DAY_OFF;
  }
  if (request.preferredStartMinutes === null || request.preferredEndMinutes === null) {
    return DAY_OFF;
  }

  const start = Math.max(request.preferredStartMinutes, storeHours.openMinutes);
  const end = Math.min(request.preferredEndMinutes, storeHours.closeMinutes);
  if (start >= end) {
    return DAY_OFF;
  }

  return { isDayOff: false, startMinutes: start, endMinutes: end };
}
