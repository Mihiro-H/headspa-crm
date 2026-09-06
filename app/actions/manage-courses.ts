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
  sortOrder: number;
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
    sortOrder: c.sortOrder,
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

export interface CreateCourseParams {
  categoryId: number;
  name: string;
  durationEstimateMin: number;
  treatmentTimeMin: number;
  price: number;
  genderRestriction: GenderRestriction;
  sortOrder: number;
}

export async function createCourse(params: CreateCourseParams): Promise<{ courseId: number }> {
  const course = await prisma.course.create({
    data: {
      categoryId: params.categoryId,
      name: params.name,
      durationEstimateMin: params.durationEstimateMin,
      treatmentTimeMin: params.treatmentTimeMin,
      price: params.price,
      genderRestriction: params.genderRestriction,
      sortOrder: params.sortOrder,
    },
  });
  return { courseId: course.id };
}
