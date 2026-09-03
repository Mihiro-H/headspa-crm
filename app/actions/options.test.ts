import { describe, it, expect, vi, beforeEach } from "vitest";
import { listOptions } from "./options";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    option: { findMany: vi.fn() },
  },
}));

describe("listOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps options to the list item shape", async () => {
    vi.mocked(prisma.option.findMany).mockResolvedValue([
      {
        id: 1,
        name: "デコルテ・マッサージ",
        price: 1500,
        genderRestriction: "male",
        requiresAdvanceBooking: true,
        discountExempt: true,
      },
    ] as never);

    const result = await listOptions();

    expect(result).toEqual([
      {
        id: 1,
        name: "デコルテ・マッサージ",
        price: 1500,
        genderRestriction: "male",
        requiresAdvanceBooking: true,
        discountExempt: true,
      },
    ]);
  });
});
