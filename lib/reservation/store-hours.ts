import { dbTimeToMinutes } from "./time";

export interface StoreHoursInput {
  weekdayOpen: Date;
  weekdayClose: Date;
  weekendOpen: Date;
  weekendClose: Date;
}

export interface OpenHours {
  openMinutes: number;
  closeMinutes: number;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function getStoreOpenHours(store: StoreHoursInput, date: Date): OpenHours {
  const weekend = isWeekend(date);
  return {
    openMinutes: dbTimeToMinutes(weekend ? store.weekendOpen : store.weekdayOpen),
    closeMinutes: dbTimeToMinutes(weekend ? store.weekendClose : store.weekdayClose),
  };
}

export function isStoreHoliday(date: Date, holidayDates: Date[]): boolean {
  return holidayDates.some(
    (h) =>
      h.getUTCFullYear() === date.getUTCFullYear() &&
      h.getUTCMonth() === date.getUTCMonth() &&
      h.getUTCDate() === date.getUTCDate(),
  );
}
