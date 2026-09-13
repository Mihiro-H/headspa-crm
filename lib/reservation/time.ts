export function dbTimeToMinutes(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(startMinutes: number, duration: number): number {
  return startMinutes + duration;
}

export function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

export function timeOrNull(minutes: number | null): Date | null {
  return minutes !== null ? new Date(`1970-01-01T${minutesToLabel(minutes)}:00.000Z`) : null;
}
