const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// "YYYY-MM-DD"形式の日付文字列を「2026年9月13日（日）」のような表示用文字列に変換する。
// 予約日はDBに@db.Dateで保存されているため、常にUTC真夜中として扱う。
export function formatJapaneseDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${WEEKDAY_LABELS[date.getUTCDay()]}）`;
}

// "YYYY-MM-DD"形式の日付文字列から、曜日1文字（月・火・水...）だけを返す。
// 日付一覧（テーブルの行など）で日付そのものは別の形式で表示済みで、
// 曜日だけ添えたい場合に使う。
export function weekdayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return WEEKDAY_LABELS[date.getUTCDay()];
}
