import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  updateCustomerStores,
  deactivateCustomer,
  reactivateCustomer,
} from "./manage-customers";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerStatus: { findFirstOrThrow: vi.fn() },
  },
}));

describe("createCustomerByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a member with the lowest-ranked status and given used stores", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.customerStatus.findFirstOrThrow).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.member.create).mockResolvedValue({ id: 42 } as never);

    const result = await createCustomerByAdmin({
      name: "山田 太郎",
      email: "yamada@example.com",
      phone: "090-1234-5678",
      gender: "male",
      birthMonth: 4,
      storeIds: [2, 3],
    });

    expect(result).toEqual({ status: "created", memberId: 42 });
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        name: "山田 太郎",
        email: "yamada@example.com",
        phone: "090-1234-5678",
        gender: "male",
        birthMonth: 4,
        statusId: 1,
        usedStores: { create: [{ storeId: 2 }, { storeId: 3 }] },
      },
    });
  });

  it("returns email_taken without creating a member when the email already exists", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await createCustomerByAdmin({
      name: "山田 太郎",
      email: "taken@example.com",
      phone: "090-1234-5678",
      gender: "male",
      birthMonth: 4,
      storeIds: [],
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });
});

describe("updateCustomerByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name and phone only", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await updateCustomerByAdmin({ memberId: 1, name: "新氏名", phone: "090-0000-0000" });

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "新氏名", phone: "090-0000-0000" },
    });
  });
});

describe("updateCustomerStores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the member's used stores", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await updateCustomerStores(1, [2, 4]);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        usedStores: { deleteMany: {}, create: [{ storeId: 2 }, { storeId: 4 }] },
      },
    });
  });
});

describe("deactivateCustomer / reactivateCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivateCustomer sets isActive to false", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await deactivateCustomer(1);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
  });

  it("reactivateCustomer sets isActive to true", async () => {
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await reactivateCustomer(1);

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: true },
    });
  });
});
