import { describe, it, expect, vi, beforeEach } from "vitest";
import { listShiftDraftsForStore, updateShiftDraft, confirmShiftDraftForStore } from "./shift-drafts";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn(), findUnique: vi.fn() },
    staffShiftDraft: { findMany: vi.fn(), upsert: vi.fn() },
    staffShift: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("listShiftDraftsForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await listShiftDraftsForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns drafts grouped by staffId", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42 }] as never);
    vi.mocked(prisma.staffShiftDraft.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await listShiftDraftsForStore(1, "2026-10");

    expect(result).toEqual({
      status: "ok",
      draftsByStaffId: {
        42: [
          {
            workDate: "2026-10-01",
            isDayOff: false,
            startMinutes: 660,
            endMinutes: 900,
          },
        ],
      },
    });
  });
});

describe("updateShiftDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await updateShiftDraft({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOff: true,
      startMinutes: null,
      endMinutes: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the staff's store is outside the manager's scope", async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 2 } as never);

    const result = await updateShiftDraft({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOff: true,
      startMinutes: null,
      endMinutes: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftDraft.upsert).not.toHaveBeenCalled();
  });

  it("upserts the draft when authorized", async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);

    const result = await updateShiftDraft({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOff: false,
      startMinutes: 660,
      endMinutes: 900,
    });

    expect(result).toEqual({ status: "updated" });
    expect(prisma.staffShiftDraft.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    });
  });
});

describe("confirmShiftDraftForStore", () => {
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

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await confirmShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShift.upsert).not.toHaveBeenCalled();
  });

  it("copies every draft row for the store's staff into StaffShift", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42 }] as never);
    vi.mocked(prisma.staffShiftDraft.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await confirmShiftDraftForStore(1, "2026-10");

    expect(result).toEqual({ status: "confirmed", count: 1 });
    expect(prisma.staffShift.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
