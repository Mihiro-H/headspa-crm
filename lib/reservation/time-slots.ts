import { getStoreOpenHours, isStoreHoliday, type StoreHoursInput } from "./store-hours";
import { isWithinLuxuryCutoff, type LuxuryCutoffInput } from "./luxury-cutoff";
import { isStaffAvailableForSlot, type StaffShiftInput } from "./staff-availability";
import { isSlotFree, type ExistingBooking } from "./slot-conflict";

export interface GenerateSlotsInput {
  store: StoreHoursInput & LuxuryCutoffInput;
  date: Date;
  holidayDates: Date[];
  totalDurationMinutes: number;
  isLuxuryCategory: boolean;
  slotIntervalMinutes: number;
  staffShift?: StaffShiftInput;
  existingBookings: ExistingBooking[];
}

export function generateAvailableSlots(input: GenerateSlotsInput): number[] {
  if (isStoreHoliday(input.date, input.holidayDates)) {
    return [];
  }

  const { openMinutes, closeMinutes } = getStoreOpenHours(input.store, input.date);
  const slots: number[] = [];

  for (
    let start = openMinutes;
    start + input.totalDurationMinutes <= closeMinutes;
    start += input.slotIntervalMinutes
  ) {
    const end = start + input.totalDurationMinutes;

    if (input.isLuxuryCategory && !isWithinLuxuryCutoff(input.store, input.date, start)) {
      continue;
    }

    if (input.staffShift && !isStaffAvailableForSlot(input.staffShift, start, end)) {
      continue;
    }

    if (!isSlotFree(start, end, input.existingBookings)) {
      continue;
    }

    slots.push(start);
  }

  return slots;
}
