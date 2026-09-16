import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentAdminStoreScope } from "./current-admin-scope";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    adminStore: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getCurrentAdminStoreScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unrestricted for an hq admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);

    const result = await getCurrentAdminStoreScope();

    expect(result).toEqual({ isUnrestricted: true, storeIds: [] });
    expect(prisma.adminStore.findMany).not.toHaveBeenCalled();
  });

  it("returns the admin's assigned store ids for a manager", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.adminStore.findMany).mockResolvedValue([
      { storeId: 2 },
      { storeId: 5 },
    ] as never);

    const result = await getCurrentAdminStoreScope();

    expect(result).toEqual({ isUnrestricted: false, storeIds: [2, 5] });
    expect(prisma.adminStore.findMany).toHaveBeenCalledWith({ where: { adminId: 3 } });
  });

  it("returns a restricted empty scope when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getCurrentAdminStoreScope();

    expect(result).toEqual({ isUnrestricted: false, storeIds: [] });
  });
});
