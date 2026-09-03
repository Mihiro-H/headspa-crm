import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStaffForStore } from "./staff";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
  },
}));

describe("listStaffForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active staff for the given store", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 1, name: "田中 花子", photoUrl: null, bio: "得意メニュー：頭皮ケア", nominationFee: 1000 },
    ] as never);

    const result = await listStaffForStore(2);

    expect(result).toEqual([
      { id: 1, name: "田中 花子", photoUrl: null, bio: "得意メニュー：頭皮ケア", nominationFee: 1000 },
    ]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { storeId: 2, isActive: true },
      orderBy: { id: "asc" },
    });
  });
});
