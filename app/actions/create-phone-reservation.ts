"use server";

import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { isSlotFree } from "@/lib/reservation/slot-conflict";
import { calculateReservationTotal } from "@/lib/reservation/total-price";
import { calculateCancellationDeadline } from "@/lib/reservation/cancellation-deadline";
import { resolveCourseCampaigns } from "./course-campaigns";

export interface CreatePhoneReservationParams {
  memberId: number;
  storeId: number;
  staffId: number | null;
  courseId: number;
  optionIds: number[];
  reservationDate: string;
  startMinutes: number;
}

export type CreatePhoneReservationResult =
  | { status: "created"; reservationId: number }
  | { status: "slot_unavailable" };

export async function createPhoneReservation(
  params: CreatePhoneReservationParams,
): Promise<CreatePhoneReservationResult> {
  const [course, options, staff] = await Promise.all([
    prisma.course.findUniqueOrThrow({
      where: { id: params.courseId },
      include: {
        campaignTargets: { include: { campaign: true } },
        category: { include: { campaignTargets: { include: { campaign: true } } } },
      },
    }),
    prisma.option.findMany({ where: { id: { in: params.optionIds } } }),
    params.staffId
      ? prisma.staff.findUniqueOrThrow({ where: { id: params.staffId } })
      : Promise.resolve(null),
  ]);

  const nominationFee = staff?.nominationFee ?? 0;

  const totalDuration =
    course.treatmentTimeMin + options.reduce((sum, o) => sum + o.durationMin, 0);
  const endMinutes = params.startMinutes + totalDuration;

  const targetDate = new Date(`${params.reservationDate}T00:00:00.000Z`);

  const existing = await prisma.reservation.findMany({
    where: {
      storeId: params.storeId,
      reservationDate: targetDate,
      status: { in: ["temp_hold", "confirmed"] },
      ...(params.staffId ? { staffId: params.staffId } : {}),
    },
  });

  const existingBookings = existing.map((r) => ({
    startMinutes: dbTimeToMinutes(r.startTime),
    endMinutes: dbTimeToMinutes(r.endTime),
  }));

  if (!isSlotFree(params.startMinutes, endMinutes, existingBookings)) {
    return { status: "slot_unavailable" };
  }

  const now = new Date();
  const activeCourseCampaigns = resolveCourseCampaigns(course, params.storeId, now);

  const pricing = calculateReservationTotal({
    course: { price: course.price, discountExempt: false, applicableCampaigns: activeCourseCampaigns },
    options: options.map((o) => ({
      price: o.price,
      discountExempt: o.discountExempt,
      applicableCampaigns: [],
    })),
    nominationFee,
  });

  const startLabel = minutesToLabel(params.startMinutes);
  const endLabel = minutesToLabel(endMinutes);

  const reservation = await prisma.reservation.create({
    data: {
      memberId: params.memberId,
      storeId: params.storeId,
      staffId: params.staffId,
      reservationDate: targetDate,
      startTime: new Date(`1970-01-01T${startLabel}:00.000Z`),
      endTime: new Date(`1970-01-01T${endLabel}:00.000Z`),
      status: "confirmed",
      source: "phone",
      nominationFeeApplied: nominationFee,
      totalPrice: pricing.totalPrice,
      tempHoldExpiresAt: null,
      cancellationDeadline: calculateCancellationDeadline(targetDate),
      items: {
        create: [
          {
            itemType: "course" as const,
            courseId: course.id,
            appliedCampaignId: pricing.course.appliedCampaignId,
            priceAtBooking: pricing.course.finalPrice,
          },
          ...pricing.options.map((o, idx) => ({
            itemType: "option" as const,
            optionId: options[idx].id,
            appliedCampaignId: o.appliedCampaignId,
            priceAtBooking: o.finalPrice,
          })),
        ],
      },
    },
  });

  return { status: "created", reservationId: reservation.id };
}
