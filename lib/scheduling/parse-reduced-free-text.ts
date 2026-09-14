export type TimeSpec =
  | { type: "minutes"; value: number }
  | { type: "store_open" }
  | { type: "store_close" };

export interface ParsedReducedLine {
  workDate: string; // "2026-10-05"
  start: TimeSpec;
  end: TimeSpec;
}

export interface ParseReducedFreeTextResult {
  lines: ParsedReducedLine[];
  unparsedLines: string[];
}

// 全角数字・全角スラッシュ・全角コロンを半角に正規化する
// （Googleフォームの自由記述は日本語入力で全角になりがちなため）。
function toHalfWidth(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/／/g, "/")
    .replace(/：/g, ":")
    .replace(/～/g, "~")
    .replace(/－/g, "-");
}

const LINE_PATTERN = /^([0-9]{1,2})\s*\/\s*([0-9]{1,2})\s+(.+?)\s*[-〜~]\s*(.+)$/;
const TIME_PATTERN = /^([0-9]{1,2}):([0-9]{2})$/;

function parseTimeSpec(token: string): TimeSpec | null {
  const trimmed = token.trim();
  if (trimmed === "開店") return { type: "store_open" };
  if (trimmed === "閉店") return { type: "store_close" };
  const m = TIME_PATTERN.exec(trimmed);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { type: "minutes", value: hours * 60 + minutes };
}

/**
 * Googleフォームの「時短希望の日と時間」自由記述欄を1行ずつパースする。
 * 「M/D 開始-終了」の形式（区切りは-/〜/~のいずれか、開始・終了は
 * HH:MM または 開店/閉店キーワード）を期待する。パースできない行は
 * 黙って無視せずunparsedLinesに集める（呼び出し元がWebhookレスポンス経由で
 * 店長に伝えられるようにするため）。開始≧終了になるような矛盾した時刻は
 * ここでは弾かない（既存のderiveDraftShiftが安全側で休み扱いにフォール
 * バックする既存ロジックにそのまま委ねる）。
 */
export function parseReducedFreeText(
  freeText: string,
  yearMonth: string,
): ParseReducedFreeTextResult {
  const [yearStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const lines: ParsedReducedLine[] = [];
  const unparsedLines: string[] = [];

  for (const rawLine of freeText.split("\n")) {
    const trimmedRaw = rawLine.trim();
    if (trimmedRaw === "") continue;

    const normalized = toHalfWidth(trimmedRaw);
    const match = LINE_PATTERN.exec(normalized);
    if (!match) {
      unparsedLines.push(trimmedRaw);
      continue;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const start = parseTimeSpec(match[3]);
    const end = parseTimeSpec(match[4]);

    if (!start || !end || month < 1 || month > 12 || day < 1 || day > 31) {
      unparsedLines.push(trimmedRaw);
      continue;
    }

    // 2/30や4/31のような暦として存在しない日付は、Date構築時にサイレントに
    // 別の日へロールオーバーしてしまう（例: new Date("2026-02-30")は2026-03-02
    // になる）ため、構築後の年月日が入力と一致するかを確認して弾く。
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      unparsedLines.push(trimmedRaw);
      continue;
    }

    const workDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    lines.push({ workDate, start, end });
  }

  return { lines, unparsedLines };
}
