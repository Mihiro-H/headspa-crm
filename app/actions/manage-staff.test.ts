import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStaff, updateStaff, createStaff, updateStaffProfile } from "./manage-staff";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    adminStore: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listAllStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all staff with store name, ordered by store then id, for an unrestricted (hq) admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);
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
      where: undefined,
      include: { store: true },
      orderBy: [{ storeId: "asc" }, { id: "asc" }],
    });
  });

  it("filters to the restricted admin's own store ids", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.adminStore.findMany).mockResolvedValue([
      { storeId: 2 },
      { storeId: 5 },
    ] as never);
    vi.mocked(prisma.staff.findMany).mockResolvedValue([] as never);

    await listAllStaff();

    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { storeId: { in: [2, 5] } },
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

describe("updateStaffProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name, bio, and storeId", async () => {
    vi.mocked(prisma.staff.update).mockResolvedValue({} as never);

    await updateStaffProfile({ staffId: 1, name: "山田花子", bio: "頭皮ケア歴10年", storeId: 2 });

    expect(prisma.staff.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "山田花子", bio: "頭皮ケア歴10年", storeId: 2 },
    });
  });

  it("allows clearing bio to null", async () => {
    vi.mocked(prisma.staff.update).mockResolvedValue({} as never);

    await updateStaffProfile({ staffId: 1, name: "山田花子", bio: null, storeId: 2 });

    expect(prisma.staff.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "山田花子", bio: null, storeId: 2 },
    });
  });
});
