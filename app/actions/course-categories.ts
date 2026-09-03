"use server";

import { prisma } from "@/lib/db";

export interface CourseCategoryListItem {
  id: number;
  name: string;
  description: string | null;
}

export async function listCourseCategories(): Promise<CourseCategoryListItem[]> {
  const categories = await prisma.courseCategory.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, description: c.description }));
}
