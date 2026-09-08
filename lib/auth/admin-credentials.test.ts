import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeAdmin } from "./admin-credentials";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: {
      findUnique: vi.fn(),
    },
  },
}));

describe("authorizeAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the admin with its role and store ids when credentials match", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      isActive: true,
      stores: [{ storeId: 2 }],
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "admin-password",
    });

    expect(result).toEqual({
      id: "1",
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      role: "manager",
      storeIds: [2],
    });
  });

  it("returns null when the admin does not exist", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await authorizeAdmin({
      email: "unknown@foresupa.jp",
      password: "anything",
    });

    expect(result).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      isActive: true,
      stores: [{ storeId: 2 }],
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  it("returns an empty storeIds array for HQ admins", async () => {
    const passwordHash = await hashPassword("hq-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 2,
      email: "hq@foresupa.jp",
      name: "本部 鈴木",
      passwordHash,
      role: "hq",
      isActive: true,
      stores: [],
    } as never);

    const result = await authorizeAdmin({
      email: "hq@foresupa.jp",
      password: "hq-password",
    });

    expect(result?.storeIds).toEqual([]);
    expect(result?.role).toBe("hq");
  });

  it("returns null when the admin has been archived", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      isActive: false,
      stores: [{ storeId: 2 }],
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "admin-password",
    });

    expect(result).toBeNull();
  });

  it("returns null when the invite has not been accepted yet (passwordHash is null)", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 3,
      email: "pending@foresupa.jp",
      name: "招待中 太郎",
      passwordHash: null,
      role: "staff",
      isActive: true,
      stores: [{ storeId: 1 }],
    } as never);

    const result = await authorizeAdmin({
      email: "pending@foresupa.jp",
      password: "anything",
    });

    expect(result).toBeNull();
  });
});
