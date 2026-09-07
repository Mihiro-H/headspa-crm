import { describe, it, expect, vi, beforeEach } from "vitest";
import { addUsedStore } from "./add-used-store";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    memberStore: { upsert: vi.fn() },
  },
}));

describe("addUsedStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a MemberStore row for the given member and store", async () => {
    vi.mocked(prisma.memberStore.upsert).mockResolvedValue({} as never);

    await addUsedStore(5, 2);

    expect(prisma.memberStore.upsert).toHaveBeenCalledWith({
      where: { memberId_storeId: { memberId: 5, storeId: 2 } },
      create: { memberId: 5, storeId: 2 },
      update: {},
    });
  });
});
