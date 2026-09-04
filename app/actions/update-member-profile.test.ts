import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMemberProfile,
  updateMemberProfile,
  changeMemberPassword,
} from "./update-member-profile";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { hashPassword } from "@/lib/auth/password";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getMemberProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberProfile();

    expect(result).toBeNull();
  });

  it("maps the member's profile, including hasPassword and lineLinked flags", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      phone: "090-1111-2222",
      birthMonth: 5,
      gender: "female",
      passwordHash: "some-hash",
      lineUserId: null,
      emailNotificationEnabled: true,
      lineNotificationEnabled: false,
    } as never);

    const result = await getMemberProfile();

    expect(result).toEqual({
      name: "田中 花子",
      phone: "090-1111-2222",
      birthMonth: 5,
      gender: "female",
      hasPassword: true,
      lineLinked: false,
      emailNotificationEnabled: true,
      lineNotificationEnabled: false,
    });
  });

  it("reports hasPassword false for a LINE-only member with no password set", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      name: "田中 花子",
      phone: "090-1111-2222",
      birthMonth: 5,
      gender: "female",
      passwordHash: null,
      lineUserId: "line-user-1",
      emailNotificationEnabled: true,
      lineNotificationEnabled: true,
    } as never);

    const result = await getMemberProfile();

    expect(result?.hasPassword).toBe(false);
    expect(result?.lineLinked).toBe(true);
  });
});

describe("updateMemberProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await updateMemberProfile({
      name: "田中 花子",
      phone: "090-1111-2222",
      birthMonth: 5,
      gender: "female",
      emailNotificationEnabled: true,
      lineNotificationEnabled: true,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("updates using the authenticated member's id from the session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    const result = await updateMemberProfile({
      name: "田中 花子",
      phone: "090-9999-8888",
      birthMonth: 5,
      gender: "female",
      emailNotificationEnabled: false,
      lineNotificationEnabled: true,
    });

    expect(result).toEqual({ status: "updated" });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        name: "田中 花子",
        phone: "090-9999-8888",
        birthMonth: 5,
        gender: "female",
        emailNotificationEnabled: false,
        lineNotificationEnabled: true,
      },
    });
  });
});

describe("changeMemberPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await changeMemberPassword({
      currentPassword: "old-pass",
      newPassword: "new-pass",
    });

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("rejects an incorrect current password when one is already set", async () => {
    const existingHash = await hashPassword("correct-password");
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      passwordHash: existingHash,
    } as never);

    const result = await changeMemberPassword({
      currentPassword: "wrong-password",
      newPassword: "new-password",
    });

    expect(result).toEqual({ status: "incorrect_current_password" });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  it("updates the password when the current password is correct", async () => {
    const existingHash = await hashPassword("correct-password");
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      passwordHash: existingHash,
    } as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    const result = await changeMemberPassword({
      currentPassword: "correct-password",
      newPassword: "brand-new-password",
    });

    expect(result).toEqual({ status: "updated" });
    const updateArgs = vi.mocked(prisma.member.update).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 7 });
    expect(updateArgs.data.passwordHash).not.toBe(existingHash);
    expect(updateArgs.data.passwordHash).not.toBe("brand-new-password");
  });

  it("sets a password without requiring a current one when the member has none yet (LINE-only)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 7,
      passwordHash: null,
    } as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    const result = await changeMemberPassword({
      currentPassword: null,
      newPassword: "first-password",
    });

    expect(result).toEqual({ status: "updated" });
    expect(prisma.member.update).toHaveBeenCalled();
  });
});
