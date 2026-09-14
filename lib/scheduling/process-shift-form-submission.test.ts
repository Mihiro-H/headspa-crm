import { describe, it, expect, vi, beforeEach } from "vitest";
import { processShiftFormSubmission } from "./process-shift-form-submission";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
    staffShiftRequest: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const STORE = {
  id: 1,
  name: "渋谷店",
  weekdayOpen: new Date("1970-01-01T11:00:00.000Z"),
  weekdayClose: new Date("1970-01-01T18:30:00.000Z"),
  weekendOpen: new Date("1970-01-01T10:00:00.000Z"),
  weekendClose: new Date("1970-01-01T17:30:00.000Z"),
};

const STAFF = { id: 42, storeId: 1, name: "松本陸", store: STORE };

describe("processShiftFormSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.staff.findMany).mockResolvedValue([STAFF] as never);
    // $transactionはPromise配列をまとめて実行するモック実装（実DBのトランザクションは張らない）
    vi.mocked(prisma.$transaction).mockImplementation(((ops: Promise<unknown>[]) =>
      Promise.all(ops)) as never);
  });

  it("returns unmatched_staff when no active staff matches the label", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "存在しない店舗 - 存在しないスタッフ",
      yearMonth: "2026-10",
      dayOffDates: [],
      reducedFreeText: "",
    });

    expect(result).toEqual({ status: "unmatched_staff" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("matches staff by the exact '店舗名 - 氏名' label", async () => {
    await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: [],
      reducedFreeText: "",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes all existing requests in the target month before inserting new ones", async () => {
    await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "",
    });

    expect(prisma.staffShiftRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        staffId: 42,
        workDate: { gte: new Date("2026-10-01T00:00:00.000Z"), lte: new Date("2026-10-31T00:00:00.000Z") },
      },
    });
  });

  it("creates a day_off request for each day-off date", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05", "2026-10-12"],
      reducedFreeText: "",
    });

    expect(result).toEqual({ status: "ok", dayOffCount: 2, reducedCount: 0, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-05T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-12T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });

  it("creates a reduced request with times resolved against the store's hours for that date", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: [],
      reducedFreeText: "10/1 開店〜14:00",
    });

    // 2026-10-01は木曜（平日）: weekdayOpen 11:00
    expect(result).toEqual({ status: "ok", dayOffCount: 0, reducedCount: 1, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T11:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T14:00:00.000Z"),
      },
    });
  });

  it("surfaces unparsed lines from the free text in the result without failing the whole submission", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "10/1 11:00-15:00\nよくわからない行",
    });

    expect(result).toEqual({
      status: "ok",
      dayOffCount: 1,
      reducedCount: 1,
      unparsedLines: ["よくわからない行"],
    });
  });

  it("ignores day-off dates and reduced entries outside the target month", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-11-01"],
      reducedFreeText: "11/2 11:00-15:00",
    });

    expect(result).toEqual({ status: "ok", dayOffCount: 0, reducedCount: 0, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).not.toHaveBeenCalled();
  });

  it("prefers a day-off over a reduced entry when the same date appears in both", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "10/5 11:00-15:00",
    });

    expect(result).toEqual({ status: "ok", dayOffCount: 1, reducedCount: 0, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-05T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });
});
