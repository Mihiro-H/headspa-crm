import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPendingLineSignup, completeLineRegistration } from "./line-registration";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), create: vi.fn() },
    customerStatus: { findFirstOrThrow: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getPendingLineSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pending with the LINE display name when the session needs profile completion", async () => {
    vi.mocked(auth).mockResolvedValue({
      needsProfileCompletion: true,
      pendingLineUserId: "line-123",
      pendingLineName: "山田太郎",
    } as never);

    const result = await getPendingLineSignup();

    expect(result).toEqual({ status: "pending", name: "山田太郎" });
  });

  it("returns pending with an empty name when LINE provided no display name", async () => {
    vi.mocked(auth).mockResolvedValue({
      needsProfileCompletion: true,
      pendingLineUserId: "line-123",
      pendingLineName: undefined,
    } as never);

    const result = await getPendingLineSignup();

    expect(result).toEqual({ status: "pending", name: "" });
  });

  it("returns none when there is nothing pending", async () => {
    vi.mocked(auth).mockResolvedValue({ needsProfileCompletion: false } as never);

    const result = await getPendingLineSignup();

    expect(result).toEqual({ status: "none" });
  });

  it("returns none when there is no session at all", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getPendingLineSignup();

    expect(result).toEqual({ status: "none" });
  });
});

describe("completeLineRegistration", () => {
  const params = {
    name: "山田太郎",
    email: "yamada@example.com",
    phone: "090-1234-5678",
    birthMonth: 4,
    gender: "male" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.customerStatus.findFirstOrThrow).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.member.create).mockResolvedValue({ id: 42 } as never);
  });

  it("rejects when the session has no pending LINE signup", async () => {
    vi.mocked(auth).mockResolvedValue({ needsProfileCompletion: false } as never);

    const result = await completeLineRegistration(params);

    expect(result).toEqual({ status: "no_pending_line_signup" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });

  it("rejects when the email is already taken by another member", async () => {
    vi.mocked(auth).mockResolvedValue({
      needsProfileCompletion: true,
      pendingLineUserId: "line-123",
    } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await completeLineRegistration(params);

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });

  it("creates a member using the pending LINE user id from the session, not from client input", async () => {
    vi.mocked(auth).mockResolvedValue({
      needsProfileCompletion: true,
      pendingLineUserId: "line-123",
    } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null as never);

    const result = await completeLineRegistration(params);

    expect(result).toEqual({ status: "created", memberId: 42 });
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        name: "山田太郎",
        email: "yamada@example.com",
        phone: "090-1234-5678",
        birthMonth: 4,
        gender: "male",
        lineUserId: "line-123",
        passwordHash: null,
        statusId: 1,
      },
    });
  });

  it("rejects when the session is missing entirely", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await completeLineRegistration(params);

    expect(result).toEqual({ status: "no_pending_line_signup" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });
});
