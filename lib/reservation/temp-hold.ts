export const TEMP_HOLD_DURATION_MINUTES = 10;

export function calculateTempHoldExpiry(now: Date): Date {
  return new Date(now.getTime() + TEMP_HOLD_DURATION_MINUTES * 60 * 1000);
}

export function isTempHoldExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() > expiresAt.getTime();
}
