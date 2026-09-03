export interface ExistingBooking {
  startMinutes: number;
  endMinutes: number;
}

export function hasOverlap(
  candidateStart: number,
  candidateEnd: number,
  existing: ExistingBooking,
): boolean {
  return candidateStart < existing.endMinutes && candidateEnd > existing.startMinutes;
}

export function isSlotFree(
  candidateStart: number,
  candidateEnd: number,
  existingBookings: ExistingBooking[],
): boolean {
  return !existingBookings.some((b) => hasOverlap(candidateStart, candidateEnd, b));
}
