import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAllCoursesForManagement, updateCoursePrice, createCourse } from "./manage-courses";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    course: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

describe("listAllCoursesForManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all courses with category name, ordered by category then course sort order", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      {
        id: 1,
        name: "スタンダード",
        price: 8000,
        durationEstimateMin: 60,
        genderRestriction: "none",
        isPublished: true,
        category: { id: 3, name: "頭皮ケア重点" },
      },
    ] as never);

    const result = await listAllCoursesForManagement();

    expect(result).toEqual([
      {
        id: 1,
        name: "スタンダード",
        price: 8000,
        durationEstimateMin: 60,
        genderRestriction: "none",
        isPublished: true,
        categoryId: 3,
        categoryName: "頭皮ケア重点",
      },
    ]);
    expect(prisma.course.findMany).toHaveBeenCalledWith({
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
  });
});

describe("updateCoursePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the course price", async () => {
    vi.mocked(prisma.course.update).mockResolvedValue({} as never);

    await updateCoursePrice({ courseId: 1, price: 9000 });

    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { price: 9000 },
    });
  });
});

describe("createCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a course under the given category", async () => {
    vi.mocked(prisma.course.create).mockResolvedValue({ id: 7 } as never);

    const result = await createCourse({
      categoryId: 3,
      name: "プレミアム",
      durationEstimateMin: 90,
      treatmentTimeMin: 75,
      price: 15000,
      genderRestriction: "none",
      sortOrder: 1,
    });

    expect(result).toEqual({ courseId: 7 });
    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        categoryId: 3,
        name: "プレミアム",
        durationEstimateMin: 90,
        treatmentTimeMin: 75,
        price: 15000,
        genderRestriction: "none",
        sortOrder: 1,
      },
    });
  });
});
