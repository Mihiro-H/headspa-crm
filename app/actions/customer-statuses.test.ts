import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCustomerStatuses, updateStatusThreshold } from "./customer-statuses";
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

  it("returns all 5 statuses ordered by sortOrder", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, name: "ビジター", minVisitCount: 1, colorCode: "#A9A08D", sortOrder: 1 },
    ] as never);

    const result = await listCustomerStatuses();

    expect(result).toEqual([
      { id: 1, name: "ビジター", minVisitCount: 1, colorCode: "#A9A08D", sortOrder: 1 },
    ]);
    expect(prisma.customerStatus.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("updateStatusThreshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the minVisitCount for the given status", async () => {
    vi.mocked(prisma.customerStatus.update).mockResolvedValue({} as never);

    await updateStatusThreshold({ statusId: 2, minVisitCount: 3 });

    expect(prisma.customerStatus.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { minVisitCount: 3 },
    });
  });
});
