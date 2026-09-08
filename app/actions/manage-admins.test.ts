import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAdmins,
  createAdmin,
  resendAdminInvite,
  updateAdmin,
  deactivateAdmin,
  reactivateAdmin,
} from "./manage-admins";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/delivery/send-email";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/delivery/send-email", () => ({
  sendEmail: vi.fn(),
}));

describe("listAdmins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admins with their store ids, names, and pending-invite status", async () => {
    vi.mocked(prisma.admin.findMany).mockResolvedValue([
      {
        id: 1,
        name: "店長 佐藤",
        email: "manager@foresupa.jp",
        role: "manager",
        isActive: true,
        passwordHash: "hashed",
        stores: [{ storeId: 2, store: { name: "フォレスパ 渋谷店" } }],
      },
      {
        id: 2,
        name: "招待中 太郎",
        email: "pending@foresupa.jp",
        role: "staff",
        isActive: true,
        passwordHash: null,
        stores: [],
      },
    ] as never);

    const result = await listAdmins();

    expect(result).toEqual([
      {
        id: 1,
        name: "店長 佐藤",
        email: "manager@foresupa.jp",
        role: "manager",
        isActive: true,
        isPending: false,
        storeIds: [2],
        storeNames: ["フォレスパ 渋谷店"],
      },
      {
        id: 2,
        name: "招待中 太郎",
        email: "pending@foresupa.jp",
        role: "staff",
        isActive: true,
        isPending: true,
        storeIds: [],
        storeNames: [],
      },
    ]);
  });
});

describe("createAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an admin with no password and sends an invite email", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.admin.create).mockResolvedValue({ id: 10 } as never);
    vi.mocked(sendEmail).mockResolvedValue({ status: "sent" });

    const result = await createAdmin({
      name: "店長 田中",
      email: "tanaka@foresupa.jp",
      role: "manager",
      storeIds: [1],
    });

    expect(result.status).toBe("invited");
    if (result.status === "invited") {
      expect(result.adminId).toBe(10);
      expect(result.emailStatus).toBe("sent");
      expect(result.inviteUrl).toContain("/admin/accept-invite?token=");
    }
    expect(prisma.admin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "店長 田中",
        email: "tanaka@foresupa.jp",
        role: "manager",
        passwordHash: null,
        stores: { create: [{ storeId: 1 }] },
      }),
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "tanaka@foresupa.jp" }),
    );
  });

  it("returns email_taken when the email is already registered", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await createAdmin({
      name: "店長 田中",
      email: "tanaka@foresupa.jp",
      role: "manager",
      storeIds: [1],
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.admin.create).not.toHaveBeenCalled();
  });

  it("still creates the admin and reports not_configured when Brevo is not set up", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.admin.create).mockResolvedValue({ id: 11 } as never);
    vi.mocked(sendEmail).mockResolvedValue({ status: "not_configured" });

    const result = await createAdmin({
      name: "店長 鈴木",
      email: "suzuki@foresupa.jp",
      role: "staff",
      storeIds: [1],
    });

    expect(result.status).toBe("invited");
    if (result.status === "invited") {
      expect(result.emailStatus).toBe("not_configured");
      expect(result.inviteUrl).toContain("/admin/accept-invite?token=");
    }
  });
});

describe("resendAdminInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a new token and resends the invite email for a pending admin", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 2,
      name: "招待中 太郎",
      email: "pending@foresupa.jp",
      passwordHash: null,
    } as never);
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);
    vi.mocked(sendEmail).mockResolvedValue({ status: "sent" });

    const result = await resendAdminInvite(2);

    expect(result.status).toBe("resent");
    if (result.status === "resent") {
      expect(result.emailStatus).toBe("sent");
      expect(result.inviteUrl).toContain("/admin/accept-invite?token=");
    }
    expect(prisma.admin.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: expect.objectContaining({
        inviteToken: expect.any(String),
        inviteTokenExpiresAt: expect.any(Date),
      }),
    });
  });

  it("returns already_active when the admin already has a password set", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      name: "店長 佐藤",
      email: "manager@foresupa.jp",
      passwordHash: "hashed",
    } as never);

    const result = await resendAdminInvite(1);

    expect(result).toEqual({ status: "already_active" });
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });

  it("returns not_found when the admin does not exist", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await resendAdminInvite(999);

    expect(result).toEqual({ status: "not_found" });
  });
});

describe("updateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name, role, and replaces store targets", async () => {
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    await updateAdmin({ adminId: 1, name: "店長 佐藤（改姓）", role: "manager", storeIds: [3] });

    expect(prisma.admin.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "店長 佐藤（改姓）",
        role: "manager",
        stores: { deleteMany: {}, create: [{ storeId: 3 }] },
      },
    });
  });
});

describe("deactivateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isActive to false", async () => {
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    await deactivateAdmin(1);

    expect(prisma.admin.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isActive: false } });
  });
});

describe("reactivateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isActive to true", async () => {
    vi.mocked(prisma.admin.update).mockResolvedValue({} as never);

    await reactivateAdmin(1);

    expect(prisma.admin.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isActive: true } });
  });
});
