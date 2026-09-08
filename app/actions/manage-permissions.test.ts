import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPermissions, setPermission } from "./manage-permissions";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    rolePagePermission: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listPermissions()).rejects.toThrow("unauthorized");
    expect(prisma.rolePagePermission.findMany).not.toHaveBeenCalled();
  });

  it("returns all stored role/page permission rows", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.rolePagePermission.findMany).mockResolvedValue([
      { role: "staff", pageKey: "/admin/campaigns", level: "hidden" },
      { role: "manager", pageKey: "/admin/reports", level: "view" },
    ] as never);

    const result = await listPermissions();

    expect(result).toEqual([
      { role: "staff", pageKey: "/admin/campaigns", level: "hidden" },
      { role: "manager", pageKey: "/admin/reports", level: "view" },
    ]);
  });
});

describe("setPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(setPermission("staff", "/admin/campaigns", "hidden")).rejects.toThrow(
      "unauthorized",
    );
    expect(prisma.rolePagePermission.upsert).not.toHaveBeenCalled();
  });

  it("rejects a manager-role session (only hq may set permissions)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", role: "manager" } } as never);

    await expect(setPermission("staff", "/admin/campaigns", "hidden")).rejects.toThrow(
      "unauthorized",
    );
    expect(prisma.rolePagePermission.upsert).not.toHaveBeenCalled();
  });

  it("upserts the permission level for a role/page combination", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.rolePagePermission.upsert).mockResolvedValue({} as never);

    await setPermission("staff", "/admin/campaigns", "hidden");

    expect(prisma.rolePagePermission.upsert).toHaveBeenCalledWith({
      where: { role_pageKey: { role: "staff", pageKey: "/admin/campaigns" } },
      create: { role: "staff", pageKey: "/admin/campaigns", level: "hidden" },
      update: { level: "hidden" },
    });
  });
});
