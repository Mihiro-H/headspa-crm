"use server";

import { prisma } from "@/lib/db";
import type { GenderRestriction } from "@/lib/reservation/gender-restriction";

export interface ManagedCourse {
  id: number;
  name: string;
  price: number;
  durationEstimateMin: number;
  genderRestriction: GenderRestriction;
  isPublished: boolean;
  categoryId: number;
  categoryName: string;
}

export async function listAllCoursesForManagement(): Promise<ManagedCourse[]> {
  const courses = await prisma.course.findMany({
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  return courses.map((c) => ({
    id: c.id,
    name: c.name,
    price: c.price,
    durationEstimateMin: c.durationEstimateMin,
    genderRestriction: c.genderRestriction,
    isPublished: c.isPublished,
    categoryId: c.category.id,
    categoryName: c.category.name,
  }));
}

export interface UpdateCoursePriceParams {
  courseId: number;
  price: number;
}

export async function updateCoursePrice(params: UpdateCoursePriceParams): Promise<void> {
  await prisma.course.update({
    where: { id: params.courseId },
    data: { price: params.price },
  });
}
