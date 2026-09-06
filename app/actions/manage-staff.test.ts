import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStaff, updateStaff, createStaff } from "./manage-staff";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

describe("listAllStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all staff with store name, ordered by store then id", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      {
        id: 1,
        name: "田中 花子",
        bio: "得意メニュー：頭皮ケア",
        nominationFee: 1000,
        isActive: true,
        store: { id: 2, name: "フォレスパ 渋谷店" },
      },
    ] as never);

    const result = await listAllStaff();

    expect(result).toEqual([
      {
        id: 1,
        name: "田中 花子",
        bio: "得意メニュー：頭皮ケア",
        nominationFee: 1000,
        isActive: true,
        storeId: 2,
        storeName: "フォレスパ 渋谷店",
      },
    ]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      include: { store: true },
      orderBy: [{ storeId: "asc" }, { id: "asc" }],
    });
  });
});

describe("updateStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates nomination fee and active flag", async () => {
    vi.mocked(prisma.staff.update).mockResolvedValue({} as never);

    await updateStaff({ staffId: 1, nominationFee: 1500, isActive: false });

    expect(prisma.staff.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nominationFee: 1500, isActive: false },
    });
  });
});

describe("createStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a staff member at the given store", async () => {
    vi.mocked(prisma.staff.create).mockResolvedValue({ id: 9 } as never);

    const result = await createStaff({
      storeId: 2,
      name: "高橋 一郎",
      bio: "得意メニュー：アロマ",
      nominationFee: 1200,
    });

    expect(result).toEqual({ staffId: 9 });
    expect(prisma.staff.create).toHaveBeenCalledWith({
      data: {
        storeId: 2,
        name: "高橋 一郎",
        bio: "得意メニュー：アロマ",
        nominationFee: 1200,
      },
    });
  });
});
