import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCustomerStatuses, updateStatusCondition } from "./customer-statuses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerStatus: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listCustomerStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all statuses ordered by sortOrder, including spend threshold and condition mode", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      {
        id: 1,
        name: "ビジター",
        minVisitCount: 1,
        minTotalSpent: 0,
        conditionMode: "or",
        colorCode: "#A9A08D",
        sortOrder: 1,
      },
    ] as never);

    const result = await listCustomerStatuses();

    expect(result).toEqual([
      {
        id: 1,
        name: "ビジター",
        minVisitCount: 1,
        minTotalSpent: 0,
        conditionMode: "or",
        colorCode: "#A9A08D",
        sortOrder: 1,
      },
    ]);
    expect(prisma.customerStatus.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("updateStatusCondition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates minVisitCount, minTotalSpent, and conditionMode when all are provided", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({
      statusId: 2,
      minVisitCount: 3,
      minTotalSpent: 30000,
      conditionMode: "and",
    });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 3, minTotalSpent: 30000, conditionMode: "and" },
    });
  });

  it("updates only minVisitCount when only that field is provided", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({ statusId: 2, minVisitCount: 5 });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 5 },
    });
  });

  it("updates only conditionMode when only that field is provided", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusCondition({ statusId: 2, conditionMode: "or" });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { conditionMode: "or" },
    });
  });
});
