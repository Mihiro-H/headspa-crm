import { dbTimeToMinutes } from "./time";

export interface StaffShiftInput {
  workDate: Date;
  startTime: Date | null;
  endTime: Date | null;
  isDayOff: boolean;
}

export interface StaffWorkingHours {
  startMinutes: number;
  endMinutes: number;
}

export function getStaffWorkingHours(
  shift: StaffShiftInput | undefined,
): StaffWorkingHours | null {
  if (!shift || shift.isDayOff || !shift.startTime || !shift.endTime) {
    return null;
  }
  return {
    startMinutes: dbTimeToMinutes(shift.startTime),
    endMinutes: dbTimeToMinutes(shift.endTime),
  };
}

export function isStaffAvailableForSlot(
  shift: StaffShiftInput | undefined,
  slotStartMinutes: number,
  slotEndMinutes: number,
): boolean {
  const hours = getStaffWorkingHours(shift);
  if (!hours) return false;
  return slotStartMinutes >= hours.startMinutes && slotEndMinutes <= hours.endMinutes;
}
