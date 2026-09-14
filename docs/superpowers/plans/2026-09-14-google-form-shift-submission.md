# Googleフォームによるシフト希望提出フロー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面(`/admin/my-shift-requests`)からのシフト希望入力を維持したまま、Googleフォーム(Apps Script Webhook経由)からも提出できるようにする。

**Architecture:** 新規テーブルは追加しない(既存の`StaffShiftRequest`にそのまま書き込む)。自由記述のパース(`lib/scheduling/`の純粋関数)とDB書き込み(`lib/scheduling/`のもう1つの関数)を分離し、Route Handler(`app/api/shift-form-webhook/route.ts`)は認証チェック+JSONパース+この2関数の呼び出しだけを行う薄いグルーコードにする(既存の`lib/auth/line-member.ts`と`lib/auth/config.ts`の関係と同じ設計方針)。

**Tech Stack:** Next.js (App Router, Route Handler) / TypeScript / Prisma / Vitest

---

## 前提知識(実装者向け)

- 参照する設計書: `docs/superpowers/specs/2026-09-14-google-form-shift-submission-design.md`(読まなくても以下のタスクで完結する)。
- スキーマ変更は無い(マイグレーション不要)。`StaffShiftRequest`の`requestType`(`"full"|"day_off"|"reduced"`)、`preferredStartTime`/`preferredEndTime`は既存のまま使う。
- 既存の認証パターン: `app/api/cron/[jobName]/route.ts`が`Authorization: Bearer <secret>`ヘッダーを`process.env`の値と比較する方式を既に採用している。今回の新規Route Handlerも同じ方式を使う。
- 時刻変換は既存の`lib/reservation/time.ts`(`monthRange`/`minutesToLabel`)、店舗営業時間は`lib/reservation/store-hours.ts`(`getStoreOpenHours`)をそのまま使う。
- 各タスクの最後に`npx tsc --noEmit -p tsconfig.json`を実行し、新規の型エラーが出ていないことを確認すること(既存の無関係な2件のエラーは無視してよい：`app/actions/current-admin-scope.test.ts(44,39)`と`app/actions/manage-permissions.ts(19,42)`)。
- `npx vitest run <対象ファイル>`を実行すると、`.claude/worktrees/`配下の無関係な古いworktreeの重複ファイルまで一致してテストされ、それらだけが無関係な理由(bcryptのタイムアウト等)で失敗することがある。**実ファイル(`.claude/worktrees/`を含まないパス)の結果だけを見て判断すること。**

---

### Task 1: `lib/scheduling/parse-reduced-free-text.ts`を実装する(TDD)

**Files:**
- Create: `lib/scheduling/parse-reduced-free-text.ts`
- Create: `lib/scheduling/parse-reduced-free-text.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/scheduling/parse-reduced-free-text.test.ts`を新規作成：

```ts
import { describe, it, expect } from "vitest";
import { parseReducedFreeText } from "./parse-reduced-free-text";

describe("parseReducedFreeText", () => {
  it("parses a simple half-width line", () => {
    const result = parseReducedFreeText("10/5 11:00-15:00", "2026-10");
    expect(result).toEqual({
      lines: [
        {
          workDate: "2026-10-05",
          start: { type: "minutes", value: 660 },
          end: { type: "minutes", value: 900 },
        },
      ],
      unparsedLines: [],
    });
  });

  it("parses 開店/閉店 keywords as store_open/store_close", () => {
    const result = parseReducedFreeText("10/12 開店〜14:00", "2026-10");
    expect(result).toEqual({
      lines: [
        {
          workDate: "2026-10-12",
          start: { type: "store_open" },
          end: { type: "minutes", value: 840 },
        },
      ],
      unparsedLines: [],
    });

    const result2 = parseReducedFreeText("10/12 11:00〜閉店", "2026-10");
    expect(result2).toEqual({
      lines: [
        {
          workDate: "2026-10-12",
          start: { type: "minutes", value: 660 },
          end: { type: "store_close" },
        },
      ],
      unparsedLines: [],
    });
  });

  it("normalizes full-width digits, slash, and colon", () => {
    const result = parseReducedFreeText("１０/５ １１:００-１５:００", "2026-10");
    expect(result).toEqual({
      lines: [
        {
          workDate: "2026-10-05",
          start: { type: "minutes", value: 660 },
          end: { type: "minutes", value: 900 },
        },
      ],
      unparsedLines: [],
    });
  });

  it("accepts -, 〜, and ~ as the separator between start and end", () => {
    expect(parseReducedFreeText("10/5 11:00~15:00", "2026-10").lines).toHaveLength(1);
    expect(parseReducedFreeText("10/5 11:00〜15:00", "2026-10").lines).toHaveLength(1);
    expect(parseReducedFreeText("10/5 11:00-15:00", "2026-10").lines).toHaveLength(1);
  });

  it("skips blank lines without adding them to unparsedLines", () => {
    const result = parseReducedFreeText("10/5 11:00-15:00\n\n\n10/12 開店〜14:00", "2026-10");
    expect(result.lines).toHaveLength(2);
    expect(result.unparsedLines).toEqual([]);
  });

  it("collects lines that do not match the expected format as unparsedLines", () => {
    const result = parseReducedFreeText("よろしくお願いします", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["よろしくお願いします"] });
  });

  it("collects a line with an out-of-range month or day as unparsedLines", () => {
    const result = parseReducedFreeText("13/40 11:00-15:00", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["13/40 11:00-15:00"] });
  });

  it("collects a line with an unparseable time token as unparsedLines", () => {
    const result = parseReducedFreeText("10/5 午前-午後", "2026-10");
    expect(result).toEqual({ lines: [], unparsedLines: ["10/5 午前-午後"] });
  });

  it("processes multiple lines independently, mixing valid and invalid ones", () => {
    const result = parseReducedFreeText(
      "10/5 11:00-15:00\nよろしくお願いします\n10/12 開店〜14:00",
      "2026-10",
    );
    expect(result.lines).toHaveLength(2);
    expect(result.unparsedLines).toEqual(["よろしくお願いします"]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run lib/scheduling/parse-reduced-free-text.test.ts`
Expected: FAIL(`./parse-reduced-free-text`が存在しない)

- [ ] **Step 3: `lib/scheduling/parse-reduced-free-text.ts`を実装する**

```ts
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
    .replace(/：/g, ":");
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

    const workDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    lines.push({ workDate, start, end });
  }

  return { lines, unparsedLines };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run lib/scheduling/parse-reduced-free-text.test.ts`
Expected: `Tests 10 passed (10)`

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 6: コミット**

```bash
git add lib/scheduling/parse-reduced-free-text.ts lib/scheduling/parse-reduced-free-text.test.ts
git commit -m "feat: add free-text parser for Google Form reduced-hours entries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 2: `lib/scheduling/process-shift-form-submission.ts`を実装する(TDD)

**Files:**
- Create: `lib/scheduling/process-shift-form-submission.ts`
- Create: `lib/scheduling/process-shift-form-submission.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/scheduling/process-shift-form-submission.test.ts`を新規作成：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { processShiftFormSubmission } from "./process-shift-form-submission";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
    staffShiftRequest: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const STORE = {
  id: 1,
  name: "渋谷店",
  weekdayOpen: new Date("1970-01-01T11:00:00.000Z"),
  weekdayClose: new Date("1970-01-01T18:30:00.000Z"),
  weekendOpen: new Date("1970-01-01T10:00:00.000Z"),
  weekendClose: new Date("1970-01-01T17:30:00.000Z"),
};

const STAFF = { id: 42, storeId: 1, name: "松本陸", store: STORE };

describe("processShiftFormSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.staff.findMany).mockResolvedValue([STAFF] as never);
    // $transactionはPromise配列をまとめて実行するモック実装（実DBのトランザクションは張らない）
    vi.mocked(prisma.$transaction).mockImplementation(((ops: Promise<unknown>[]) =>
      Promise.all(ops)) as never);
  });

  it("returns unmatched_staff when no active staff matches the label", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "存在しない店舗 - 存在しないスタッフ",
      yearMonth: "2026-10",
      dayOffDates: [],
      reducedFreeText: "",
    });

    expect(result).toEqual({ status: "unmatched_staff" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("matches staff by the exact '店舗名 - 氏名' label", async () => {
    await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: [],
      reducedFreeText: "",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes all existing requests in the target month before inserting new ones", async () => {
    await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "",
    });

    expect(prisma.staffShiftRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        staffId: 42,
        workDate: { gte: new Date("2026-10-01T00:00:00.000Z"), lte: new Date("2026-10-31T00:00:00.000Z") },
      },
    });
  });

  it("creates a day_off request for each day-off date", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05", "2026-10-12"],
      reducedFreeText: "",
    });

    expect(result).toEqual({ status: "ok", dayOffCount: 2, reducedCount: 0, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-05T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-12T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });

  it("creates a reduced request with times resolved against the store's hours for that date", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: [],
      reducedFreeText: "10/1 開店〜14:00",
    });

    // 2026-10-01は木曜（平日）: weekdayOpen 11:00
    expect(result).toEqual({ status: "ok", dayOffCount: 0, reducedCount: 1, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        requestType: "reduced",
        preferredStartTime: new Date("1970-01-01T11:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T14:00:00.000Z"),
      },
    });
  });

  it("surfaces unparsed lines from the free text in the result without failing the whole submission", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "10/1 11:00-15:00\nよくわからない行",
    });

    expect(result).toEqual({
      status: "ok",
      dayOffCount: 1,
      reducedCount: 1,
      unparsedLines: ["よくわからない行"],
    });
  });

  it("ignores day-off dates and reduced entries outside the target month", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-11-01"],
      reducedFreeText: "11/2 11:00-15:00",
    });

    expect(result).toEqual({ status: "ok", dayOffCount: 0, reducedCount: 0, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).not.toHaveBeenCalled();
  });

  it("prefers a day-off over a reduced entry when the same date appears in both", async () => {
    const result = await processShiftFormSubmission({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "10/5 11:00-15:00",
    });

    expect(result).toEqual({ status: "ok", dayOffCount: 1, reducedCount: 0, unparsedLines: [] });
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.staffShiftRequest.create).toHaveBeenCalledWith({
      data: {
        staffId: 42,
        workDate: new Date("2026-10-05T00:00:00.000Z"),
        requestType: "day_off",
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run lib/scheduling/process-shift-form-submission.test.ts`
Expected: FAIL(`./process-shift-form-submission`が存在しない)

- [ ] **Step 3: `lib/scheduling/process-shift-form-submission.ts`を実装する**

```ts
import { prisma } from "@/lib/db";
import { getStoreOpenHours } from "@/lib/reservation/store-hours";
import { minutesToLabel, monthRange } from "@/lib/reservation/time";
import { parseReducedFreeText, type TimeSpec } from "./parse-reduced-free-text";

export interface ShiftFormSubmission {
  staffLabel: string;
  yearMonth: string;
  dayOffDates: string[];
  reducedFreeText: string;
}

export type ProcessShiftFormSubmissionResult =
  | { status: "unmatched_staff" }
  | { status: "ok"; dayOffCount: number; reducedCount: number; unparsedLines: string[] };

function resolveTimeSpec(
  spec: TimeSpec,
  storeHours: { openMinutes: number; closeMinutes: number },
): number {
  if (spec.type === "minutes") return spec.value;
  if (spec.type === "store_open") return storeHours.openMinutes;
  return storeHours.closeMinutes;
}

function timeOrNull(minutes: number | null): Date | null {
  return minutes !== null ? new Date(`1970-01-01T${minutesToLabel(minutes)}:00.000Z`) : null;
}

interface PendingEntry {
  requestType: "day_off" | "reduced";
  preferredStartTime: Date | null;
  preferredEndTime: Date | null;
}

/**
 * Googleフォーム（Apps Script Webhook経由）から届いたシフト希望を、該当スタッフ・
 * 該当月のStaffShiftRequestに反映する。既存の例外日は全件削除してから新しい内容を
 * 書き込む（部分マージはしない。詳細はdocs/superpowers/specs/2026-09-14-google-form-
 * shift-submission-design.mdを参照）。
 */
export async function processShiftFormSubmission(
  submission: ShiftFormSubmission,
): Promise<ProcessShiftFormSubmissionResult> {
  const staffList = await prisma.staff.findMany({
    where: { isActive: true },
    include: { store: true },
  });
  const staff = staffList.find((s) => `${s.store.name} - ${s.name}` === submission.staffLabel);
  if (!staff) {
    return { status: "unmatched_staff" };
  }

  const { start, end } = monthRange(submission.yearMonth);
  const { lines, unparsedLines } = parseReducedFreeText(
    submission.reducedFreeText,
    submission.yearMonth,
  );

  // 同じ日付が休み希望・時短希望の両方に含まれていた場合は休み希望を優先する
  // （時短希望を先にMapへ積み、休み希望を後から積んで上書きする）。
  const entriesByDate = new Map<string, PendingEntry>();

  for (const line of lines) {
    const workDateObj = new Date(`${line.workDate}T00:00:00.000Z`);
    if (workDateObj < start || workDateObj > end) continue;
    const storeHours = getStoreOpenHours(staff.store, workDateObj);
    entriesByDate.set(line.workDate, {
      requestType: "reduced",
      preferredStartTime: timeOrNull(resolveTimeSpec(line.start, storeHours)),
      preferredEndTime: timeOrNull(resolveTimeSpec(line.end, storeHours)),
    });
  }

  let dayOffCount = 0;
  for (const dateStr of submission.dayOffDates) {
    const workDateObj = new Date(`${dateStr}T00:00:00.000Z`);
    if (workDateObj < start || workDateObj > end) continue;
    entriesByDate.set(dateStr, {
      requestType: "day_off",
      preferredStartTime: null,
      preferredEndTime: null,
    });
    dayOffCount++;
  }

  const reducedCount = Array.from(entriesByDate.values()).filter(
    (v) => v.requestType === "reduced",
  ).length;

  await prisma.$transaction([
    prisma.staffShiftRequest.deleteMany({
      where: { staffId: staff.id, workDate: { gte: start, lte: end } },
    }),
    ...Array.from(entriesByDate.entries()).map(([dateStr, data]) =>
      prisma.staffShiftRequest.create({
        data: {
          staffId: staff.id,
          workDate: new Date(`${dateStr}T00:00:00.000Z`),
          ...data,
        },
      }),
    ),
  ]);

  return { status: "ok", dayOffCount, reducedCount, unparsedLines };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run lib/scheduling/process-shift-form-submission.test.ts`
Expected: 全テスト passed(9件)

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 6: コミット**

```bash
git add lib/scheduling/process-shift-form-submission.ts lib/scheduling/process-shift-form-submission.test.ts
git commit -m "feat: add core processing logic for Google Form shift submissions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 3: `app/api/shift-form-webhook/route.ts`を実装する(TDD)

**Files:**
- Create: `app/api/shift-form-webhook/route.ts`
- Create: `app/api/shift-form-webhook/route.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/api/shift-form-webhook/route.test.ts`を新規作成：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { processShiftFormSubmission } from "@/lib/scheduling/process-shift-form-submission";

vi.mock("@/lib/scheduling/process-shift-form-submission", () => ({
  processShiftFormSubmission: vi.fn(),
}));

function makeRequest(body: unknown, authHeader?: string): Request {
  return new Request("http://localhost/api/shift-form-webhook", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/shift-form-webhook", () => {
  const originalSecret = process.env.SHIFT_FORM_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHIFT_FORM_WEBHOOK_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SHIFT_FORM_WEBHOOK_SECRET;
    } else {
      process.env.SHIFT_FORM_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("returns 401 when the bearer token does not match", async () => {
    const request = makeRequest({}, "Bearer wrong-secret");

    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(processShiftFormSubmission).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header is present", async () => {
    const request = makeRequest({});

    const response = await POST(request as never);

    expect(response.status).toBe(401);
  });

  it("processes the submission and returns its result when authorized", async () => {
    vi.mocked(processShiftFormSubmission).mockResolvedValue({
      status: "ok",
      dayOffCount: 2,
      reducedCount: 1,
      unparsedLines: [],
    });

    const request = makeRequest(
      {
        staffLabel: "渋谷店 - 松本陸",
        yearMonth: "2026-10",
        dayOffDates: ["2026-10-05"],
        reducedFreeText: "10/1 11:00-15:00",
      },
      "Bearer test-secret",
    );

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: "ok", dayOffCount: 2, reducedCount: 1, unparsedLines: [] });
    expect(processShiftFormSubmission).toHaveBeenCalledWith({
      staffLabel: "渋谷店 - 松本陸",
      yearMonth: "2026-10",
      dayOffDates: ["2026-10-05"],
      reducedFreeText: "10/1 11:00-15:00",
    });
  });

  it("returns 400 when the staff label does not match any active staff", async () => {
    vi.mocked(processShiftFormSubmission).mockResolvedValue({ status: "unmatched_staff" });

    const request = makeRequest(
      {
        staffLabel: "存在しない店舗 - 存在しないスタッフ",
        yearMonth: "2026-10",
        dayOffDates: [],
        reducedFreeText: "",
      },
      "Bearer test-secret",
    );

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ status: "unmatched_staff" });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/api/shift-form-webhook/route.test.ts`
Expected: FAIL(`./route`が存在しない)

- [ ] **Step 3: `app/api/shift-form-webhook/route.ts`を実装する**

```ts
import { NextResponse } from "next/server";
import {
  processShiftFormSubmission,
  type ShiftFormSubmission,
} from "@/lib/scheduling/process-shift-form-submission";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SHIFT_FORM_WEBHOOK_SECRET}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const submission = (await request.json()) as ShiftFormSubmission;
  const result = await processShiftFormSubmission(submission);

  if (result.status === "unmatched_staff") {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/api/shift-form-webhook/route.test.ts`
Expected: 全テスト passed(4件)

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 6: コミット**

```bash
git add app/api/shift-form-webhook/route.ts app/api/shift-form-webhook/route.test.ts
git commit -m "feat: add authenticated webhook endpoint for Google Form shift submissions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 4: 「フォーム用スタッフ一覧をコピー」機能を`/admin/staff-shifts`に追加する(TDD、アクション部分のみ)

**Files:**
- Create: `app/actions/staff-form-roster.ts`
- Create: `app/actions/staff-form-roster.test.ts`
- Modify: `app/admin/(dashboard)/staff-shifts/page.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/staff-form-roster.test.ts`を新規作成：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStaffFormRoster } from "./staff-form-roster";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    staff: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("getStaffFormRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await getStaffFormRoster(1);

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await getStaffFormRoster(1);

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns '店舗名 - 氏名' labels for the store's active staff", async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 42, name: "松本陸", store: { name: "渋谷店" } },
      { id: 43, name: "吉田麻衣", store: { name: "渋谷店" } },
    ] as never);

    const result = await getStaffFormRoster(1);

    expect(result).toEqual({
      status: "ok",
      labels: ["渋谷店 - 松本陸", "渋谷店 - 吉田麻衣"],
    });
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { storeId: 1, isActive: true },
      include: { store: true },
      orderBy: { id: "asc" },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/staff-form-roster.test.ts`
Expected: FAIL(`./staff-form-roster`が存在しない)

- [ ] **Step 3: `app/actions/staff-form-roster.ts`を実装する**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

export type StaffFormRosterResult = { status: "ok"; labels: string[] } | { status: "unauthorized" };

// Googleフォームの「お名前」選択肢欄に貼り付ける「店舗名 - 氏名」形式の一覧を生成する。
// 同姓同名の兼任スタッフ（例: 渋谷店と新宿店を兼任する松本陸さん）を区別するため、
// フォーム側は常に店舗名を併記した表記に統一する（設計書参照）。
export async function getStaffFormRoster(storeId: number): Promise<StaffFormRosterResult> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "hq" && session.user.role !== "manager")) {
    return { status: "unauthorized" };
  }
  const scope = await getCurrentAdminStoreScope();
  if (!scope.isUnrestricted && !scope.storeIds.includes(storeId)) {
    return { status: "unauthorized" };
  }

  const staffList = await prisma.staff.findMany({
    where: { storeId, isActive: true },
    include: { store: true },
    orderBy: { id: "asc" },
  });

  return { status: "ok", labels: staffList.map((s) => `${s.store.name} - ${s.name}`) };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/staff-form-roster.test.ts`
Expected: 全テスト passed(3件)

- [ ] **Step 5: `/admin/staff-shifts`ページにコピー用ボタンを追加する**

`app/admin/(dashboard)/staff-shifts/page.tsx`の冒頭のimportに以下を追加する:

```ts
import { getStaffFormRoster } from "@/app/actions/staff-form-roster";
```

`handleExport`関数の直後に以下を追加する:

```tsx
  async function handleCopyFormRoster() {
    if (storeId === null) return;
    const result = await getStaffFormRoster(storeId);
    if (result.status === "ok") {
      await navigator.clipboard.writeText(result.labels.join("\n"));
      setMessage(`${result.labels.length}件をクリップボードにコピーしました。`);
    } else {
      setMessage("コピーに失敗しました。");
    }
  }
```

`確定済みシフトをダウンロード（CSV）`ボタンの直後に、以下のボタンを追加する:

```tsx
        <button
          type="button"
          onClick={handleCopyFormRoster}
          className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          フォーム用スタッフ一覧をコピー
        </button>
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 7: ESLintチェック**

Run: `npx eslint app/actions/staff-form-roster.ts "app/admin/(dashboard)/staff-shifts/page.tsx"`
Expected: エラー・警告なし

- [ ] **Step 8: コミット**

```bash
git add app/actions/staff-form-roster.ts app/actions/staff-form-roster.test.ts "app/admin/(dashboard)/staff-shifts/page.tsx"
git commit -m "feat: add a button to copy the Google Form staff roster labels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 5: `/admin/my-shift-requests`に上書き注意書きを追加する

**Files:**
- Modify: `app/admin/(dashboard)/my-shift-requests/page.tsx`

このタスクは表示のみの変更のため、新規のアクションテストは書かない。

- [ ] **Step 1: 注意書きを追加する**

`app/admin/(dashboard)/my-shift-requests/page.tsx`の、月選択の`<select>`の直後・完了/不備サマリーの直前に、以下を追加する:

```tsx
      <p className="text-xs text-neutral-500">
        ※Googleフォームからも希望を提出できる場合、後から提出された方の内容がこの月の希望として優先されます（この画面とフォームの両方で入力すると、後者が上書きします）。
      </p>
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 3: ESLintチェック**

Run: `npx eslint "app/admin/(dashboard)/my-shift-requests/page.tsx"`
Expected: エラー・警告なし

- [ ] **Step 4: コミット**

```bash
git add "app/admin/(dashboard)/my-shift-requests/page.tsx"
git commit -m "docs: warn staff that a Google Form submission overwrites this screen's input

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 6: 最終確認とユーザー向けセットアップ手順書の作成

**Files:**
- Create: `docs/superpowers/specs/2026-09-14-google-form-shift-submission-setup.md`

- [ ] **Step 1: このplanで変更した範囲のテストを実行する**

Run: `npx vitest run lib/scheduling/parse-reduced-free-text.test.ts lib/scheduling/process-shift-form-submission.test.ts app/api/shift-form-webhook/route.test.ts app/actions/staff-form-roster.test.ts`
Expected: 全て passed(実ファイル分。`.claude/worktrees/`配下の重複ファイルの失敗は無視する)

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 3: セットアップ手順書を作成する**

`docs/superpowers/specs/2026-09-14-google-form-shift-submission-setup.md`を新規作成し、以下を含める(実装者は実際のGoogleフォームを作成できないため、この手順書はユーザーが自分でフォームを作成しApps Scriptを設定するための完全な案内になっている必要がある):

1. Googleフォームの作成手順(質問文言は設計書`docs/superpowers/specs/2026-09-14-google-form-shift-submission-design.md`の「フォーム構成」セクションをそのまま使う。「お名前」の選択肢は`/admin/staff-shifts`の「フォーム用スタッフ一覧をコピー」ボタンでコピーした内容を貼り付ける)
2. フォームの「拡張機能 > Apps Script」に貼り付けるコード全文(以下をそのまま使う。`WEBHOOK_URL`と`WEBHOOK_SECRET`の2箇所だけ実際の値に書き換えればよいことを明記する):

```js
// ===== 書き換えが必要な設定 =====
const WEBHOOK_URL = "https://<あなたのドメイン>/api/shift-form-webhook";
const WEBHOOK_SECRET = "<.envのSHIFT_FORM_WEBHOOK_SECRETと同じ値>";
// ================================

// フォームの質問タイトルと完全一致させること
const QUESTION_TITLES = {
  yearMonth: "対象年月",
  staffLabel: "お名前",
  dayOff: "休み希望の日",
  reduced: "時短希望の日と時間",
};

function onFormSubmit(e) {
  const responses = e.response.getItemResponses();
  const answers = {};
  responses.forEach((r) => {
    answers[r.getItem().getTitle()] = r.getResponse();
  });

  const dayOffRaw = answers[QUESTION_TITLES.dayOff];
  // 日付の複数選択項目は配列で返ってくる場合と文字列（カンマ区切り）で
  // 返ってくる場合があるため両対応する
  const dayOffDates = Array.isArray(dayOffRaw)
    ? dayOffRaw
    : (dayOffRaw || "").split(",").map((s) => s.trim()).filter((s) => s !== "");

  const payload = {
    yearMonth: answers[QUESTION_TITLES.yearMonth],
    staffLabel: answers[QUESTION_TITLES.staffLabel],
    dayOffDates: dayOffDates,
    reducedFreeText: answers[QUESTION_TITLES.reduced] || "",
  };

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
```

3. トリガーの設定手順(Apps Scriptエディタの時計アイコン→トリガーを追加→実行する関数`onFormSubmit`、イベントの種類「フォーム送信時」)
4. `.env`に`SHIFT_FORM_WEBHOOK_SECRET=<ランダムな文字列>`を追加してもらう案内(この値をApps Scriptの`WEBHOOK_SECRET`にも同じものを設定する)
5. 日付の複数選択項目（休み希望の日）で、Googleフォームの標準の質問形式では日付ごとの個別選択肢を用意する必要がある点（自由入力の日付ピッカーではなく、日付そのものを選択肢としたチェックボックス形式にする）を明記する
6. 動作確認手順(テスト送信→`npm run dev`のターミナルでエラーが出ていないか確認→`/admin/staff-shifts`でその月の「提出済みの希望」に反映されているか確認)

- [ ] **Step 4: コミット**

```bash
git add docs/superpowers/specs/2026-09-14-google-form-shift-submission-setup.md
git commit -m "docs: add user setup guide for the Google Form shift submission webhook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

- [ ] **Step 5: ユーザーへの引き継ぎ**

以下を案内する:
1. `.env`に`SHIFT_FORM_WEBHOOK_SECRET`(ランダムな文字列、例えば`openssl rand -hex 32`で生成)を追加し、`npm run dev`を再起動する。
2. `docs/superpowers/specs/2026-09-14-google-form-shift-submission-setup.md`の手順に従い、Googleフォームの作成・Apps Scriptの設定を行う。
3. `/admin/staff-shifts`の「フォーム用スタッフ一覧をコピー」ボタンで、フォームの「お名前」選択肢用のテキストを取得する。
4. テスト送信を行い、`/admin/staff-shifts`の「提出済みの希望」に反映されるか確認する。
