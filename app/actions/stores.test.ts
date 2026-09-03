import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStores } from "./stores";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findMany: vi.fn() },
  },
}));

describe("listStores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps stores to the list item shape, ordered by id", async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValue([
      { id: 1, name: "フォレスパ 東京丸の内本店", address: "東京都千代田区...", phone: "03-0000-0001", nearestStation: "東京駅 徒歩5分" },
    ] as never);

    const result = await listStores();

    expect(result).toEqual([
      { id: 1, name: "フォレスパ 東京丸の内本店", address: "東京都千代田区...", phone: "03-0000-0001", nearestStation: "東京駅 徒歩5分" },
    ]);
    expect(prisma.store.findMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
  });
});
