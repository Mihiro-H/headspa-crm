import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStaffFormRoster } from "./staff-form-roster";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("getStaffFormRoster", () => {
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

    const result = await getStaffFormRoster(1);

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await getStaffFormRoster(1);

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns '店舗名 - 氏名' labels for the store's active staff", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 42, name: "松本陸", store: { name: "渋谷店" } },
      { id: 43, name: "吉田麻衣", store: { name: "渋谷店" } },
    ] as never);

    const result = await getStaffFormRoster(1);

    expect(result).toEqual({
      status: "ok",
      labels: ["渋谷店 - 松本陸", "渋谷店 - 吉田麻衣"],
    });
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { storeId: 1, isActive: true },
      include: { store: true },
      orderBy: { id: "asc" },
    });
  });
});
