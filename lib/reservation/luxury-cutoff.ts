import { dbTimeToMinutes } from "./time";

export interface LuxuryCutoffInput {
  luxuryLastOrderWeekday: Date;
  luxuryLastOrderWeekend: Date;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function getLuxuryLastOrderMinutes(store: LuxuryCutoffInput, date: Date): number {
  return dbTimeToMinutes(
    isWeekend(date) ? store.luxuryLastOrderWeekend : store.luxuryLastOrderWeekday,
  );
}

export function isWithinLuxuryCutoff(
  store: LuxuryCutoffInput,
  date: Date,
  startMinutes: number,
): boolean {
  return startMinutes <= getLuxuryLastOrderMinutes(store, date);
}
