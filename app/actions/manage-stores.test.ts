import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllStoresForManagement, updateStoreDetails, createStore } from "./manage-stores";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
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

describe("createStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a store, converting HH:mm time strings to Date values", async () => {
    vi.mocked(prisma.store.create).mockResolvedValue({ id: 5 } as never);

    const result = await createStore({
      name: "フォレスパ 新宿店",
      address: "東京都新宿区...",
      phone: "03-2222-2222",
      nearestStation: "新宿駅 徒歩3分",
      weekdayOpen: "11:00",
      weekdayClose: "20:00",
      weekendOpen: "10:00",
      weekendClose: "18:00",
      luxuryLastOrderWeekday: "19:30",
      luxuryLastOrderWeekend: "17:30",
    });

    expect(result).toEqual({ storeId: 5 });
    expect(prisma.store.create).toHaveBeenCalledWith({
      data: {
        name: "フォレスパ 新宿店",
        address: "東京都新宿区...",
        phone: "03-2222-2222",
        nearestStation: "新宿駅 徒歩3分",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T20:00:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
      },
    });
  });
});
