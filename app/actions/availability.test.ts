import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailableSlots } from "./availability";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findUniqueOrThrow: vi.fn() },
    storeHoliday: { findMany: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
    staffShift: { findUnique: vi.fn() },
    reservation: { findMany: vi.fn() },
  },
}));

const store = {
  id: 1,
  weekdayOpen: new Date("1970-01-01T11:00:00Z"),
  weekdayClose: new Date("1970-01-01T13:00:00Z"),
  weekendOpen: new Date("1970-01-01T10:00:00Z"),
  weekendClose: new Date("1970-01-01T18:00:00Z"),
  luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
  luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
};

describe("getAvailableSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.store.findUniqueOrThrow).mockResolvedValue(store as never);
    vi.mocked(prisma.storeHoliday.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({
      id: 10,
      treatmentTimeMin: 60,
      category: { name: "頭皮ケア重点" },
    } as never);
    vi.mocked(prisma.option.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
  });

  it("returns generated slots based on store hours and course duration", async () => {
    const result = await getAvailableSlots({
      storeId: 1,
      staffId: null,
      date: "2026-09-02",
      courseId: 10,
      optionIds: [],
    });

    expect(result).toEqual([660, 690, 720]);
  });

  it("excludes slots overlapping an existing reservation", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { startTime: new Date("1970-01-01T11:30:00Z"), endTime: new Date("1970-01-01T12:30:00Z") },
    ] as never);

    const result = await getAvailableSlots({
      storeId: 1,
      staffId: null,
      date: "2026-09-02",
      courseId: 10,
      optionIds: [],
    });

    expect(result).toEqual([]);
  });
});
