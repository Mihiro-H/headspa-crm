import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInviteDetails, acceptAdminInvite } from "./accept-admin-invite";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("getInviteDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the invited admin's name and email when the token is valid", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      name: "招待中 太郎",
      email: "pending@foresupa.jp",
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await getInviteDetails("valid-token");

    expect(result).toEqual({
      status: "valid",
      admin: { name: "招待中 太郎", email: "pending@foresupa.jp" },
    });
  });

  it("returns invalid when no admin matches the token", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await getInviteDetails("unknown-token");

    expect(result).toEqual({ status: "invalid" });
  });

  it("returns expired when the token's expiry has passed", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      name: "招待中 太郎",
      email: "pending@foresupa.jp",
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await getInviteDetails("expired-token");

    expect(result).toEqual({ status: "expired" });
  });
});

describe("acceptAdminInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the password and clears the invite token when the token is valid", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    const result = await acceptAdminInvite("valid-token", "new-password-123");

    expect(result).toEqual({ status: "accepted" });
    expect(prisma.admin.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        inviteToken: null,
        inviteTokenExpiresAt: null,
      }),
    });
  });

  it("returns invalid when no admin matches the token", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await acceptAdminInvite("unknown-token", "new-password-123");

    expect(result).toEqual({ status: "invalid" });
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });

  it("returns expired when the token's expiry has passed", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await acceptAdminInvite("expired-token", "new-password-123");

    expect(result).toEqual({ status: "expired" });
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });
});
