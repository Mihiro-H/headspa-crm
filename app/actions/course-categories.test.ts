import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCourseCategories } from "./course-categories";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    courseCategory: { findMany: vi.fn() },
  },
}));

describe("listCourseCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only published categories, ordered by sortOrder", async () => {
    vi.mocked(prisma.courseCategory.findMany).mockResolvedValue([
      { id: 1, name: "頭皮ケア重点", description: "こんな方へ..." },
    ] as never);

    const result = await listCourseCategories();

    expect(result).toEqual([{ id: 1, name: "頭皮ケア重点", description: "こんな方へ..." }]);
    expect(prisma.courseCategory.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
    });
  });
});
