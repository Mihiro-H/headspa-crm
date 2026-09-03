export function calculateCancellationDeadline(reservationDate: Date): Date {
  return new Date(
    Date.UTC(
      reservationDate.getUTCFullYear(),
      reservationDate.getUTCMonth(),
      reservationDate.getUTCDate() - 1,
      23,
      59,
      59,
    ),
  );
}

export function isPastCancellationDeadline(deadline: Date, now: Date): boolean {
  return now.getTime() > deadline.getTime();
}
