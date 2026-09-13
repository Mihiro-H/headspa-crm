import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateShiftDraftForStore } from "./generate-shift-draft";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findUnique: vi.fn() },
    staff: { findMany: vi.fn() },
    staffShiftRequest: { findMany: vi.fn() },
    staffShiftDraft: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

const STORE = {
  id: 1,
  weekdayOpen: new Date("1970-01-01T11:00:00.000Z"),
  weekdayClose: new Date("1970-01-01T18:30:00.000Z"),
  weekendOpen: new Date("1970-01-01T10:00:00.000Z"),
  weekendClose: new Date("1970-01-01T17:30:00.000Z"),
};

describe("generateShiftDraftForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    // $transactionはPromise配列をまとめて実行するモック実装（実DBのトランザクションは張らない）
    vi.mocked(prisma.$transaction).mockImplementation(((ops: Promise<unknown>[]) =>
      Promise.all(ops)) as never);
  });

  it("returns unauthorized for a staff-role caller", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized when the store does not exist", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(null as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("fetches only active staff for the store", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    await generateShiftDraftForStore(1, "2026-10");

    expect(prisma.staff.findMany).toHaveBeenCalledWith({ where: { storeId: 1, isActive: true } });
  });

  it("generates one draft row per staff per day of the month, using each day's request", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    // 2026年10月は31日。全ての日で希望なし（休み扱いになる想定）。
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "generated", count: 31 });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledTimes(31);
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
        },
        create: expect.objectContaining({
          staffId: 42,
          workDate: new Date("2026-10-01T00:00:00.000Z"),
          isDayOff: true,
          startTime: null,
          endTime: null,
        }),
      }),
    );
  });

  it("reflects a submitted time-range request, clamped to store hours", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    await generateShiftDraftForStore(1, "2026-10");

    // 10/1は平日想定（木曜）：weekdayOpen 11:00なので希望開始10:00は11:00にクランプされる
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
        },
        create: expect.objectContaining({
          isDayOff: false,
          startTime: new Date("1970-01-01T11:00:00.000Z"),
          endTime: new Date("1970-01-01T15:00:00.000Z"),
        }),
      }),
    );
  });

  it("aggregates the count across multiple staff members", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 42, storeId: 1 },
      { id: 43, storeId: 1 },
    ] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await generateShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "generated", count: 62 });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledTimes(62);
  });

  it("wraps all upserts in a single transaction so a mid-loop failure cannot leave a partially-applied month", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(STORE as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42, storeId: 1 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    await generateShiftDraftForStore(1, "2026-10");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
