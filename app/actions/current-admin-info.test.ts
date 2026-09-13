import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentAdminInfo } from "./current-admin-info";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findUnique: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getCurrentAdminInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    expect(await getCurrentAdminInfo()).toBeNull();
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the admin record no longer exists", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null as never);

    expect(await getCurrentAdminInfo()).toBeNull();
  });

  it("returns the admin's own name, role, and store names", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      name: "山田花子",
      role: "manager",
      stores: [{ store: { name: "渋谷店" } }, { store: { name: "新宿店" } }],
    } as never);

    const result = await getCurrentAdminInfo();

    expect(result).toEqual({
      name: "山田花子",
      role: "manager",
      storeNames: ["渋谷店", "新宿店"],
    });
    expect(prisma.admin.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      include: { stores: { include: { store: true } } },
    });
  });

  it("returns an empty storeNames array for an hq admin with no AdminStore rows", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      name: "本部太郎",
      role: "hq",
      stores: [],
    } as never);

    const result = await getCurrentAdminInfo();

    expect(result).toEqual({ name: "本部太郎", role: "hq", storeNames: [] });
  });
});
