import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStoresForManagement, updateStoreDetails } from "./manage-stores";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("listAllStoresForManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all stores ordered by id", async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValue([
      {
        id: 1,
        name: "フォレスパ 東京丸の内本店",
        address: "東京都千代田区...",
        phone: "03-0000-0001",
        nearestStation: "東京駅 徒歩5分",
      },
    ] as never);

    const result = await listAllStoresForManagement();

    expect(result).toEqual([
      {
        id: 1,
        name: "フォレスパ 東京丸の内本店",
        address: "東京都千代田区...",
        phone: "03-0000-0001",
        nearestStation: "東京駅 徒歩5分",
      },
    ]);
    expect(prisma.store.findMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
  });
});

describe("updateStoreDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates address and phone", async () => {
    vi.mocked(prisma.store.update).mockResolvedValue({} as never);

    await updateStoreDetails({ storeId: 1, address: "新住所", phone: "03-1111-1111" });

    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { address: "新住所", phone: "03-1111-1111" },
    });
  });
});
