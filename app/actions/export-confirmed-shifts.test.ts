import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportConfirmedShifts } from "./export-confirmed-shifts";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
    staffShift: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("exportConfirmedShifts", () => {
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

    const result = await exportConfirmedShifts(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShift.findMany).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await exportConfirmedShifts(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns confirmed shift rows joined with staff names, sorted by date", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 42, name: "山田花子" },
      { id: 43, name: "松本陸" },
    ] as never);
    vi.mocked(prisma.staffShift.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOff: false,
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      {
        staffId: 43,
        workDate: new Date("2026-10-02T00:00:00.000Z"),
        isDayOff: true,
        startTime: null,
        endTime: null,
      },
    ] as never);

    const result = await exportConfirmedShifts(1, "2026-10");

    expect(result).toEqual({
      status: "ok",
      rows: [
        {
          staffName: "山田花子",
          workDate: "2026-10-01",
          isDayOff: false,
          startMinutes: 660,
          endMinutes: 900,
        },
        {
          staffName: "松本陸",
          workDate: "2026-10-02",
          isDayOff: true,
          startMinutes: null,
          endMinutes: null,
        },
      ],
    });
    expect(prisma.staffShift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffId: { in: [42, 43] },
          workDate: {
            gte: new Date("2026-10-01T00:00:00.000Z"),
            lte: new Date("2026-10-31T00:00:00.000Z"),
          },
        },
      }),
    );
  });

  it("returns an empty rows array when the store has no active staff", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.staffShift.findMany).mockResolvedValue([] as never);

    const result = await exportConfirmedShifts(1, "2026-10");

    expect(result).toEqual({ status: "ok", rows: [] });
  });
});
