// 会員がWEB予約フォームから予約できる期間の上限。
// これより先の日付は「表示はするが選択不可」としてUI側でグレーアウトする。
export const MAX_BOOKING_MONTHS_AHEAD = 3;

export function isWithinBookingWindow(date: Date, today: Date): boolean {
  const maxDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() + MAX_BOOKING_MONTHS_AHEAD,
      today.getUTCDate(),
    ),
  );
  return date <= maxDate;
}
