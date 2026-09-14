import { prisma } from "@/lib/db";
import { getStoreOpenHours } from "@/lib/reservation/store-hours";
import { monthRange, timeOrNull } from "@/lib/reservation/time";
import { parseReducedFreeText, type TimeSpec } from "./parse-reduced-free-text";

export interface ShiftFormSubmission {
  staffLabel: string;
  yearMonth: string;
  dayOffDates: string[];
  reducedFreeText: string;
}

export type ProcessShiftFormSubmissionResult =
  | { status: "unmatched_staff" }
  | { status: "ok"; dayOffCount: number; reducedCount: number; unparsedLines: string[] };

function resolveTimeSpec(
  spec: TimeSpec,
  storeHours: { openMinutes: number; closeMinutes: number },
): number {
  if (spec.type === "minutes") return spec.value;
  if (spec.type === "store_open") return storeHours.openMinutes;
  return storeHours.closeMinutes;
}

interface PendingEntry {
  requestType: "day_off" | "reduced";
  preferredStartTime: Date | null;
  preferredEndTime: Date | null;
}

/**
 * Googleフォーム（Apps Script Webhook経由）から届いたシフト希望を、該当スタッフ・
 * 該当月のStaffShiftRequestに反映する。既存の例外日は全件削除してから新しい内容を
 * 書き込む（部分マージはしない。詳細はdocs/superpowers/specs/2026-09-14-google-form-
 * shift-submission-design.mdを参照）。
 */
export async function processShiftFormSubmission(
  submission: ShiftFormSubmission,
): Promise<ProcessShiftFormSubmissionResult> {
  const staffList = await prisma.staff.findMany({
    where: { isActive: true },
    include: { store: true },
  });
  const staff = staffList.find((s) => `${s.store.name} - ${s.name}` === submission.staffLabel);
  if (!staff) {
    return { status: "unmatched_staff" };
  }

  const { start, end } = monthRange(submission.yearMonth);
  const { lines, unparsedLines } = parseReducedFreeText(
    submission.reducedFreeText,
    submission.yearMonth,
  );

  // 同じ日付が休み希望・時短希望の両方に含まれていた場合は休み希望を優先する
  // （時短希望を先にMapへ積み、休み希望を後から積んで上書きする）。
  const entriesByDate = new Map<string, PendingEntry>();

  for (const line of lines) {
    const workDateObj = new Date(`${line.workDate}T00:00:00.000Z`);
    if (workDateObj < start || workDateObj > end) continue;
    const storeHours = getStoreOpenHours(staff.store, workDateObj);
    entriesByDate.set(line.workDate, {
      requestType: "reduced",
      preferredStartTime: timeOrNull(resolveTimeSpec(line.start, storeHours)),
      preferredEndTime: timeOrNull(resolveTimeSpec(line.end, storeHours)),
    });
  }

  let dayOffCount = 0;
  for (const dateStr of submission.dayOffDates) {
    const workDateObj = new Date(`${dateStr}T00:00:00.000Z`);
    if (workDateObj < start || workDateObj > end) continue;
    entriesByDate.set(dateStr, {
      requestType: "day_off",
      preferredStartTime: null,
      preferredEndTime: null,
    });
    dayOffCount++;
  }

  const reducedCount = Array.from(entriesByDate.values()).filter(
    (v) => v.requestType === "reduced",
  ).length;

  await prisma.$transaction([
    prisma.staffShiftRequest.deleteMany({
      where: { staffId: staff.id, workDate: { gte: start, lte: end } },
    }),
    ...Array.from(entriesByDate.entries()).map(([dateStr, data]) =>
      prisma.staffShiftRequest.create({
        data: {
          staffId: staff.id,
          workDate: new Date(`${dateStr}T00:00:00.000Z`),
          ...data,
        },
      }),
    ),
  ]);

  return { status: "ok", dayOffCount, reducedCount, unparsedLines };
}
