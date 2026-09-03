# フォレスパ Phase 2: 予約エンジン（ビジネスロジック + サーバーアクション） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** WEB予約フォーム（M-02）を支える予約エンジン ── 店舗営業時間・スタッフ空き判定・時間枠生成・性別制限・キャンペーン価格計算・仮予約（二重予約防止）・予約確定 ── を、UIなしでビジネスロジック層とサーバーアクション層として完成させる。

**Architecture:** `lib/reservation/`配下に純粋関数（DB非依存・TDDで完全にテスト可能）としてビジネスロジックを実装し、`app/actions/`配下のNext.js Server Actionsがそれらを組み合わせてPrisma経由でDBとやり取りする。純粋関数はモック不要でテストでき、Server Actionsはモック化したPrisma Clientでテストする（Phase 0+1のauth実装と同じパターン）。

**Tech Stack:** TypeScript / Prisma / Vitest（既存のPhase 0+1基盤を使用）

**参照元資料:** `02_screenspecification.md`（画面仕様書 M-02節）、`04_tabledesign.md`（テーブル設計書）

**このPhaseで作らないもの（Phase 3以降）:** WEB予約フォームのUI（9ステップウィザード画面）、会員登録/LINEログインとの実際の画面接続、メニュー一覧のシンプルなCRUD取得アクション（Phase 3でUI実装時に合わせて作る）、スタッフ指名一覧取得。

---

## Task 1: スキーマ修正（`reservations.member_id`をnullableに変更）

**背景:** テーブル設計書の業務ロジック対応表には「ゲスト予約→会員登録必須フロー: reservations（status=temp_hold） → members作成 → reservations.member_idを確定・status更新」とあり、仮予約（temp_hold）は会員登録（Step7）より前に作成される。しかし現在のスキーマでは`member_id`がNOT NULLになっており、会員が存在しない段階で仮予約を作成できない。ゲストの仮予約中は`member_id`をNULLにし、Step7で会員登録／ログインが完了した時点で確定させる設計に修正する。

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: `model Reservation`の`memberId`をOptionalに変更する**

`prisma/schema.prisma`の`model Reservation`内、以下の行を:

```prisma
  memberId             Int               @map("member_id")
```

以下に変更する:

```prisma
  memberId             Int?              @map("member_id")
```

同じモデル内のリレーション行も合わせて変更する。変更前:

```prisma
  member Member            @relation(fields: [memberId], references: [id])
```

変更後:

```prisma
  member Member?           @relation(fields: [memberId], references: [id])
```

- [x] **Step 2: フォーマットとスキーマ構文検証**

```bash
npx prisma format
DATABASE_URL="postgresql://user:pass@localhost:6543/mydb?pgbouncer=true" DIRECT_URL="postgresql://user:pass@localhost:5432/mydb" npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [x] **Step 3: マイグレーションを作成する（ユーザーのターミナルで実行）**

このサンドボックスは`.env`のDIRECT_URL読み込みに固有のバグがあるため、実DB接続を伴うマイグレーションはユーザーに依頼する。

```bash
cd /Users/mihirohirano/dev/crm/headspa-crm
npx prisma migrate dev --name make_reservation_member_id_optional
```

- [x] **Step 4: 型チェック**

```bash
npx tsc --noEmit
```

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 時刻ユーティリティ（TDD）

**Files:**
- Create: `lib/reservation/time.ts`
- Test: `lib/reservation/time.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/time.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { dbTimeToMinutes, minutesToLabel, addMinutes } from "./time";

describe("dbTimeToMinutes", () => {
  it("converts a DB time (UTC-anchored epoch date) to minutes since midnight", () => {
    expect(dbTimeToMinutes(new Date("1970-01-01T11:00:00Z"))).toBe(660);
  });

  it("handles midnight", () => {
    expect(dbTimeToMinutes(new Date("1970-01-01T00:00:00Z"))).toBe(0);
  });

  it("handles minutes within the hour", () => {
    expect(dbTimeToMinutes(new Date("1970-01-01T19:30:00Z"))).toBe(1170);
  });
});

describe("minutesToLabel", () => {
  it("formats minutes as HH:mm", () => {
    expect(minutesToLabel(90)).toBe("01:30");
  });

  it("pads single-digit hours and minutes", () => {
    expect(minutesToLabel(65)).toBe("01:05");
  });

  it("formats zero as 00:00", () => {
    expect(minutesToLabel(0)).toBe("00:00");
  });
});

describe("addMinutes", () => {
  it("adds a duration to a start time", () => {
    expect(addMinutes(660, 90)).toBe(750);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/time.test.ts
```

Expected: FAIL（`./time`モジュールが見つからない）

- [x] **Step 3: 実装する**

`lib/reservation/time.ts`:

```typescript
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
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/time.test.ts
```

Expected: PASS（7 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 3: 店舗営業時間判定（TDD）

**Files:**
- Create: `lib/reservation/store-hours.ts`
- Test: `lib/reservation/store-hours.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/store-hours.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getStoreOpenHours, isStoreHoliday, type StoreHoursInput } from "./store-hours";

const store: StoreHoursInput = {
  weekdayOpen: new Date("1970-01-01T11:00:00Z"),
  weekdayClose: new Date("1970-01-01T20:00:00Z"),
  weekendOpen: new Date("1970-01-01T10:00:00Z"),
  weekendClose: new Date("1970-01-01T18:00:00Z"),
};

describe("getStoreOpenHours", () => {
  it("returns weekday hours for a Wednesday", () => {
    // 2026-09-02 is a Wednesday
    const result = getStoreOpenHours(store, new Date("2026-09-02T00:00:00Z"));
    expect(result).toEqual({ openMinutes: 660, closeMinutes: 1200 });
  });

  it("returns weekend hours for a Saturday", () => {
    // 2026-09-05 is a Saturday
    const result = getStoreOpenHours(store, new Date("2026-09-05T00:00:00Z"));
    expect(result).toEqual({ openMinutes: 600, closeMinutes: 1080 });
  });

  it("returns weekend hours for a Sunday", () => {
    // 2026-09-06 is a Sunday
    const result = getStoreOpenHours(store, new Date("2026-09-06T00:00:00Z"));
    expect(result).toEqual({ openMinutes: 600, closeMinutes: 1080 });
  });
});

describe("isStoreHoliday", () => {
  it("returns true when the date matches a holiday", () => {
    const holidays = [new Date("2026-09-10T00:00:00Z")];
    expect(isStoreHoliday(new Date("2026-09-10T00:00:00Z"), holidays)).toBe(true);
  });

  it("returns false when the date does not match any holiday", () => {
    const holidays = [new Date("2026-09-10T00:00:00Z")];
    expect(isStoreHoliday(new Date("2026-09-11T00:00:00Z"), holidays)).toBe(false);
  });

  it("returns false for an empty holiday list", () => {
    expect(isStoreHoliday(new Date("2026-09-10T00:00:00Z"), [])).toBe(false);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/store-hours.test.ts
```

Expected: FAIL（モジュールが見つからない）

- [x] **Step 3: 実装する**

`lib/reservation/store-hours.ts`:

```typescript
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
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/store-hours.test.ts
```

Expected: PASS（6 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 4: ラグジュアリーコース最終受付時刻判定（TDD）

**Files:**
- Create: `lib/reservation/luxury-cutoff.ts`
- Test: `lib/reservation/luxury-cutoff.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/luxury-cutoff.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isWithinLuxuryCutoff, type LuxuryCutoffInput } from "./luxury-cutoff";

const store: LuxuryCutoffInput = {
  luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
  luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
};

describe("isWithinLuxuryCutoff", () => {
  it("allows a weekday slot at exactly the cutoff time", () => {
    // 2026-09-02 is a Wednesday; cutoff is 19:30 = 1170 minutes
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-02T00:00:00Z"), 1170)).toBe(true);
  });

  it("rejects a weekday slot after the cutoff time", () => {
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-02T00:00:00Z"), 1171)).toBe(false);
  });

  it("uses the weekend cutoff on Saturday", () => {
    // 2026-09-05 is a Saturday; cutoff is 17:30 = 1050 minutes
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-05T00:00:00Z"), 1050)).toBe(true);
    expect(isWithinLuxuryCutoff(store, new Date("2026-09-05T00:00:00Z"), 1051)).toBe(false);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/luxury-cutoff.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/luxury-cutoff.ts`:

```typescript
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
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/luxury-cutoff.test.ts
```

Expected: PASS（3 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 5: スタッフシフト空き判定（TDD）

**Files:**
- Create: `lib/reservation/staff-availability.ts`
- Test: `lib/reservation/staff-availability.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/staff-availability.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isStaffAvailableForSlot, type StaffShiftInput } from "./staff-availability";

describe("isStaffAvailableForSlot", () => {
  it("returns false when no shift is provided", () => {
    expect(isStaffAvailableForSlot(undefined, 660, 750)).toBe(false);
  });

  it("returns false when the staff is off that day", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: null,
      endTime: null,
      isDayOff: true,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(false);
  });

  it("returns true when the slot is fully within the shift", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: new Date("1970-01-01T10:00:00Z"),
      endTime: new Date("1970-01-01T19:00:00Z"),
      isDayOff: false,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(true);
  });

  it("returns false when the slot starts before the shift begins", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: new Date("1970-01-01T12:00:00Z"),
      endTime: new Date("1970-01-01T19:00:00Z"),
      isDayOff: false,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(false);
  });

  it("returns false when the slot ends after the shift ends", () => {
    const shift: StaffShiftInput = {
      workDate: new Date("2026-09-02T00:00:00Z"),
      startTime: new Date("1970-01-01T10:00:00Z"),
      endTime: new Date("1970-01-01T12:00:00Z"),
      isDayOff: false,
    };
    expect(isStaffAvailableForSlot(shift, 660, 750)).toBe(false);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/staff-availability.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/staff-availability.ts`:

```typescript
import { dbTimeToMinutes } from "./time";

export interface StaffShiftInput {
  workDate: Date;
  startTime: Date | null;
  endTime: Date | null;
  isDayOff: boolean;
}

export interface StaffWorkingHours {
  startMinutes: number;
  endMinutes: number;
}

export function getStaffWorkingHours(
  shift: StaffShiftInput | undefined,
): StaffWorkingHours | null {
  if (!shift || shift.isDayOff || !shift.startTime || !shift.endTime) {
    return null;
  }
  return {
    startMinutes: dbTimeToMinutes(shift.startTime),
    endMinutes: dbTimeToMinutes(shift.endTime),
  };
}

export function isStaffAvailableForSlot(
  shift: StaffShiftInput | undefined,
  slotStartMinutes: number,
  slotEndMinutes: number,
): boolean {
  const hours = getStaffWorkingHours(shift);
  if (!hours) return false;
  return slotStartMinutes >= hours.startMinutes && slotEndMinutes <= hours.endMinutes;
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/staff-availability.test.ts
```

Expected: PASS（5 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 6: 予約時間枠の重複判定（TDD）

**Files:**
- Create: `lib/reservation/slot-conflict.ts`
- Test: `lib/reservation/slot-conflict.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/slot-conflict.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hasOverlap, isSlotFree, type ExistingBooking } from "./slot-conflict";

describe("hasOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(hasOverlap(660, 750, { startMinutes: 700, endMinutes: 800 })).toBe(true);
  });

  it("detects identical ranges as overlapping", () => {
    expect(hasOverlap(660, 750, { startMinutes: 660, endMinutes: 750 })).toBe(true);
  });

  it("does not flag back-to-back ranges as overlapping", () => {
    expect(hasOverlap(660, 750, { startMinutes: 750, endMinutes: 840 })).toBe(false);
  });

  it("does not flag fully separate ranges", () => {
    expect(hasOverlap(660, 750, { startMinutes: 800, endMinutes: 900 })).toBe(false);
  });
});

describe("isSlotFree", () => {
  it("returns true when there are no existing bookings", () => {
    expect(isSlotFree(660, 750, [])).toBe(true);
  });

  it("returns false when any existing booking overlaps", () => {
    const existing: ExistingBooking[] = [
      { startMinutes: 500, endMinutes: 600 },
      { startMinutes: 700, endMinutes: 800 },
    ];
    expect(isSlotFree(660, 750, existing)).toBe(false);
  });

  it("returns true when no existing booking overlaps", () => {
    const existing: ExistingBooking[] = [
      { startMinutes: 500, endMinutes: 600 },
      { startMinutes: 800, endMinutes: 900 },
    ];
    expect(isSlotFree(660, 750, existing)).toBe(true);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/slot-conflict.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/slot-conflict.ts`:

```typescript
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
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/slot-conflict.test.ts
```

Expected: PASS（7 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 7: 時間枠グリッド生成（統合、TDD）

**Files:**
- Create: `lib/reservation/time-slots.ts`
- Test: `lib/reservation/time-slots.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/time-slots.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateAvailableSlots, type GenerateSlotsInput } from "./time-slots";

const baseStore = {
  weekdayOpen: new Date("1970-01-01T11:00:00Z"),
  weekdayClose: new Date("1970-01-01T13:00:00Z"),
  weekendOpen: new Date("1970-01-01T10:00:00Z"),
  weekendClose: new Date("1970-01-01T18:00:00Z"),
  luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
  luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
};

function baseInput(overrides: Partial<GenerateSlotsInput> = {}): GenerateSlotsInput {
  return {
    store: baseStore,
    date: new Date("2026-09-02T00:00:00Z"), // Wednesday, 11:00-13:00
    holidayDates: [],
    totalDurationMinutes: 60,
    isLuxuryCategory: false,
    slotIntervalMinutes: 30,
    staffShift: undefined,
    existingBookings: [],
    ...overrides,
  };
}

describe("generateAvailableSlots", () => {
  it("generates slots at the configured interval that fit before closing", () => {
    // 11:00-13:00 open, 60min duration, 30min interval
    // last possible start is 12:00 (ends 13:00)
    expect(generateAvailableSlots(baseInput())).toEqual([660, 690, 720]);
  });

  it("returns an empty array on a holiday", () => {
    expect(
      generateAvailableSlots(baseInput({ holidayDates: [new Date("2026-09-02T00:00:00Z")] })),
    ).toEqual([]);
  });

  it("excludes any candidate slot that overlaps an existing booking, including ones that start before it", () => {
    // Wider closing time so we get slots both overlapping and clear of the existing booking.
    const result = generateAvailableSlots(
      baseInput({
        store: { ...baseStore, weekdayClose: new Date("1970-01-01T14:30:00Z") },
        existingBookings: [{ startMinutes: 690, endMinutes: 750 }],
      }),
    );
    // Candidates: 660,690,720,750,780,810 (60min duration, close at 870).
    // 660-720, 690-750, 720-780 all overlap [690,750). 750-810 is back-to-back (not an overlap).
    expect(result).toEqual([750, 780, 810]);
  });

  it("excludes slots outside the nominated staff's shift", () => {
    const result = generateAvailableSlots(
      baseInput({
        staffShift: {
          workDate: new Date("2026-09-02T00:00:00Z"),
          startTime: new Date("1970-01-01T11:00:00Z"),
          endTime: new Date("1970-01-01T12:00:00Z"),
          isDayOff: false,
        },
      }),
    );
    expect(result).toEqual([660]);
  });

  it("excludes slots past the luxury cutoff for luxury-category courses", () => {
    const result = generateAvailableSlots(
      baseInput({
        isLuxuryCategory: true,
        store: { ...baseStore, luxuryLastOrderWeekday: new Date("1970-01-01T11:30:00Z") },
      }),
    );
    expect(result).toEqual([660, 690]);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/time-slots.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/time-slots.ts`:

```typescript
import { getStoreOpenHours, isStoreHoliday, type StoreHoursInput } from "./store-hours";
import { isWithinLuxuryCutoff, type LuxuryCutoffInput } from "./luxury-cutoff";
import { isStaffAvailableForSlot, type StaffShiftInput } from "./staff-availability";
import { isSlotFree, type ExistingBooking } from "./slot-conflict";

export interface GenerateSlotsInput {
  store: StoreHoursInput & LuxuryCutoffInput;
  date: Date;
  holidayDates: Date[];
  totalDurationMinutes: number;
  isLuxuryCategory: boolean;
  slotIntervalMinutes: number;
  staffShift?: StaffShiftInput;
  existingBookings: ExistingBooking[];
}

export function generateAvailableSlots(input: GenerateSlotsInput): number[] {
  if (isStoreHoliday(input.date, input.holidayDates)) {
    return [];
  }

  const { openMinutes, closeMinutes } = getStoreOpenHours(input.store, input.date);
  const slots: number[] = [];

  for (
    let start = openMinutes;
    start + input.totalDurationMinutes <= closeMinutes;
    start += input.slotIntervalMinutes
  ) {
    const end = start + input.totalDurationMinutes;

    if (input.isLuxuryCategory && !isWithinLuxuryCutoff(input.store, input.date, start)) {
      continue;
    }

    if (input.staffShift && !isStaffAvailableForSlot(input.staffShift, start, end)) {
      continue;
    }

    if (!isSlotFree(start, end, input.existingBookings)) {
      continue;
    }

    slots.push(start);
  }

  return slots;
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/time-slots.test.ts
```

Expected: PASS（5 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 8: 性別制限バリデーション（TDD）

**Files:**
- Create: `lib/reservation/gender-restriction.ts`
- Test: `lib/reservation/gender-restriction.test.ts`

**注記:** `gender_restriction`カラムは「対象外の性別」を表す（例：フォーメン＝対象外「female」＝女性は選択不可）。会員の性別が`other`の場合はブロックせず警告のみ（画面仕様書 M-02の確定事項）。

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/gender-restriction.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { checkGenderRestriction } from "./gender-restriction";

describe("checkGenderRestriction", () => {
  it("allows anyone when there is no restriction", () => {
    expect(checkGenderRestriction("none", "female")).toEqual({ allowed: true, warning: false });
    expect(checkGenderRestriction("none", "male")).toEqual({ allowed: true, warning: false });
    expect(checkGenderRestriction("none", "other")).toEqual({ allowed: true, warning: false });
  });

  it("blocks the excluded gender (e.g. フォーメン excludes female)", () => {
    expect(checkGenderRestriction("female", "female")).toEqual({
      allowed: false,
      warning: false,
    });
  });

  it("allows the non-excluded gender", () => {
    expect(checkGenderRestriction("female", "male")).toEqual({ allowed: true, warning: false });
  });

  it("allows 'other' gender members with a warning instead of blocking", () => {
    expect(checkGenderRestriction("female", "other")).toEqual({ allowed: true, warning: true });
    expect(checkGenderRestriction("male", "other")).toEqual({ allowed: true, warning: true });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/gender-restriction.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/gender-restriction.ts`:

```typescript
export type GenderRestriction = "none" | "female" | "male";
export type MemberGender = "female" | "male" | "other";

export interface GenderCheckResult {
  allowed: boolean;
  warning: boolean;
}

export function checkGenderRestriction(
  restriction: GenderRestriction,
  memberGender: MemberGender,
): GenderCheckResult {
  if (restriction === "none") {
    return { allowed: true, warning: false };
  }

  if (memberGender === "other") {
    return { allowed: true, warning: true };
  }

  if (memberGender === restriction) {
    return { allowed: false, warning: false };
  }

  return { allowed: true, warning: false };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/gender-restriction.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 9: キャンペーン単体割引計算（TDD）

**Files:**
- Create: `lib/reservation/campaign-discount.ts`
- Test: `lib/reservation/campaign-discount.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/campaign-discount.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateDiscountAmount, applyCampaignDiscount } from "./campaign-discount";

describe("calculateDiscountAmount", () => {
  it("calculates a percentage discount, rounding down", () => {
    expect(calculateDiscountAmount(10000, { discountType: "percentage", discountValue: 15 })).toBe(
      1500,
    );
    expect(calculateDiscountAmount(9999, { discountType: "percentage", discountValue: 10 })).toBe(
      999,
    );
  });

  it("calculates a fixed amount discount", () => {
    expect(
      calculateDiscountAmount(10000, { discountType: "fixed_amount", discountValue: 2000 }),
    ).toBe(2000);
  });

  it("caps a fixed amount discount at the item price", () => {
    expect(
      calculateDiscountAmount(1000, { discountType: "fixed_amount", discountValue: 2000 }),
    ).toBe(1000);
  });
});

describe("applyCampaignDiscount", () => {
  it("subtracts the discount from the price", () => {
    expect(applyCampaignDiscount(10000, { discountType: "percentage", discountValue: 15 })).toBe(
      8500,
    );
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/campaign-discount.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/campaign-discount.ts`:

```typescript
export type DiscountType = "percentage" | "fixed_amount";

export interface CampaignDiscountInput {
  discountType: DiscountType;
  discountValue: number;
}

export function calculateDiscountAmount(price: number, campaign: CampaignDiscountInput): number {
  if (campaign.discountType === "percentage") {
    return Math.floor((price * campaign.discountValue) / 100);
  }
  return Math.min(campaign.discountValue, price);
}

export function applyCampaignDiscount(price: number, campaign: CampaignDiscountInput): number {
  return price - calculateDiscountAmount(price, campaign);
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/campaign-discount.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 10: 複数キャンペーン競合解決（TDD）

**Files:**
- Create: `lib/reservation/campaign-resolution.ts`
- Test: `lib/reservation/campaign-resolution.test.ts`

**注記:** テーブル設計書の確定事項：「キャンペーンの優先順位：priorityが同値の場合は割引額が大きい方を自動採用する」。

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/campaign-resolution.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveBestCampaign, type CandidateCampaign } from "./campaign-resolution";

describe("resolveBestCampaign", () => {
  it("returns null when there are no candidates", () => {
    expect(resolveBestCampaign(10000, [])).toBeNull();
  });

  it("returns the only candidate when there is one", () => {
    const candidates: CandidateCampaign[] = [
      { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 10 },
    ];
    expect(resolveBestCampaign(10000, candidates)?.campaignId).toBe(1);
  });

  it("picks the higher-priority campaign regardless of discount size", () => {
    const candidates: CandidateCampaign[] = [
      { campaignId: 1, priority: 1, discountType: "percentage", discountValue: 50 },
      { campaignId: 2, priority: 2, discountType: "fixed_amount", discountValue: 100 },
    ];
    expect(resolveBestCampaign(10000, candidates)?.campaignId).toBe(2);
  });

  it("picks the campaign with the larger discount amount when priority ties", () => {
    const candidates: CandidateCampaign[] = [
      { campaignId: 1, priority: 1, discountType: "fixed_amount", discountValue: 1000 },
      { campaignId: 2, priority: 1, discountType: "percentage", discountValue: 20 },
    ];
    // price 10000: campaign1 = 1000 off, campaign2 = 2000 off -> campaign2 wins
    expect(resolveBestCampaign(10000, candidates)?.campaignId).toBe(2);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/campaign-resolution.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/campaign-resolution.ts`:

```typescript
import { calculateDiscountAmount, type CampaignDiscountInput } from "./campaign-discount";

export interface CandidateCampaign extends CampaignDiscountInput {
  campaignId: number;
  priority: number;
}

export function resolveBestCampaign(
  price: number,
  candidates: CandidateCampaign[],
): CandidateCampaign | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => {
    if (current.priority > best.priority) return current;
    if (current.priority < best.priority) return best;

    const bestDiscount = calculateDiscountAmount(price, best);
    const currentDiscount = calculateDiscountAmount(price, current);
    return currentDiscount > bestDiscount ? current : best;
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/campaign-resolution.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 11: 予約合計金額計算（統合、TDD）

**Files:**
- Create: `lib/reservation/total-price.ts`
- Test: `lib/reservation/total-price.test.ts`

**注記:** `discount_exempt = true`のオプションはキャンペーン計算から常に除外（テーブル設計書 optionsテーブル定義）。

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/total-price.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { priceLineItem, calculateReservationTotal, type LineItemInput } from "./total-price";

describe("priceLineItem", () => {
  it("returns the original price when no campaign applies", () => {
    const item: LineItemInput = { price: 10000, discountExempt: false, applicableCampaigns: [] };
    expect(priceLineItem(item)).toEqual({
      originalPrice: 10000,
      finalPrice: 10000,
      appliedCampaignId: null,
    });
  });

  it("applies the best campaign discount", () => {
    const item: LineItemInput = {
      price: 10000,
      discountExempt: false,
      applicableCampaigns: [
        { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 20 },
      ],
    };
    expect(priceLineItem(item)).toEqual({
      originalPrice: 10000,
      finalPrice: 8000,
      appliedCampaignId: 1,
    });
  });

  it("ignores campaigns when the item is discount-exempt", () => {
    const item: LineItemInput = {
      price: 3000,
      discountExempt: true,
      applicableCampaigns: [
        { campaignId: 1, priority: 0, discountType: "percentage", discountValue: 50 },
      ],
    };
    expect(priceLineItem(item)).toEqual({
      originalPrice: 3000,
      finalPrice: 3000,
      appliedCampaignId: null,
    });
  });
});

describe("calculateReservationTotal", () => {
  it("sums course + options + nomination fee after discounts", () => {
    const result = calculateReservationTotal({
      course: { price: 10000, discountExempt: false, applicableCampaigns: [] },
      options: [
        { price: 2000, discountExempt: false, applicableCampaigns: [] },
        { price: 1000, discountExempt: true, applicableCampaigns: [] },
      ],
      nominationFee: 500,
    });

    expect(result.totalPrice).toBe(13500);
    expect(result.course.finalPrice).toBe(10000);
    expect(result.options).toHaveLength(2);
    expect(result.nominationFee).toBe(500);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/total-price.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/total-price.ts`:

```typescript
import { applyCampaignDiscount } from "./campaign-discount";
import { resolveBestCampaign, type CandidateCampaign } from "./campaign-resolution";

export interface LineItemInput {
  price: number;
  discountExempt: boolean;
  applicableCampaigns: CandidateCampaign[];
}

export interface PricedLineItem {
  originalPrice: number;
  finalPrice: number;
  appliedCampaignId: number | null;
}

export function priceLineItem(item: LineItemInput): PricedLineItem {
  if (item.discountExempt) {
    return { originalPrice: item.price, finalPrice: item.price, appliedCampaignId: null };
  }

  const best = resolveBestCampaign(item.price, item.applicableCampaigns);
  if (!best) {
    return { originalPrice: item.price, finalPrice: item.price, appliedCampaignId: null };
  }

  return {
    originalPrice: item.price,
    finalPrice: applyCampaignDiscount(item.price, best),
    appliedCampaignId: best.campaignId,
  };
}

export interface ReservationPriceInput {
  course: LineItemInput;
  options: LineItemInput[];
  nominationFee: number;
}

export interface ReservationPriceResult {
  course: PricedLineItem;
  options: PricedLineItem[];
  nominationFee: number;
  totalPrice: number;
}

export function calculateReservationTotal(input: ReservationPriceInput): ReservationPriceResult {
  const course = priceLineItem(input.course);
  const options = input.options.map(priceLineItem);
  const optionsTotal = options.reduce((sum, o) => sum + o.finalPrice, 0);

  return {
    course,
    options,
    nominationFee: input.nominationFee,
    totalPrice: course.finalPrice + optionsTotal + input.nominationFee,
  };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/total-price.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 12: キャンセル期限計算（TDD）

**Files:**
- Create: `lib/reservation/cancellation-deadline.ts`
- Test: `lib/reservation/cancellation-deadline.test.ts`

**注記:** 画面仕様書の確定事項：「予約変更・キャンセルの締切：施術日前日 23:59まで」。

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/cancellation-deadline.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateCancellationDeadline,
  isPastCancellationDeadline,
} from "./cancellation-deadline";

describe("calculateCancellationDeadline", () => {
  it("returns 23:59:59 the day before the reservation date", () => {
    const deadline = calculateCancellationDeadline(new Date("2026-09-10T00:00:00Z"));
    expect(deadline.toISOString()).toBe("2026-09-09T23:59:59.000Z");
  });

  it("handles month boundaries correctly", () => {
    const deadline = calculateCancellationDeadline(new Date("2026-10-01T00:00:00Z"));
    expect(deadline.toISOString()).toBe("2026-09-30T23:59:59.000Z");
  });
});

describe("isPastCancellationDeadline", () => {
  it("returns false before the deadline", () => {
    const deadline = new Date("2026-09-09T23:59:59.000Z");
    expect(isPastCancellationDeadline(deadline, new Date("2026-09-09T12:00:00Z"))).toBe(false);
  });

  it("returns true after the deadline", () => {
    const deadline = new Date("2026-09-09T23:59:59.000Z");
    expect(isPastCancellationDeadline(deadline, new Date("2026-09-10T00:00:00Z"))).toBe(true);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/cancellation-deadline.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/cancellation-deadline.ts`:

```typescript
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
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/cancellation-deadline.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 13: 仮予約の有効期限判定（TDD）

**Files:**
- Create: `lib/reservation/temp-hold.ts`
- Test: `lib/reservation/temp-hold.test.ts`

**注記:** 画面仕様書の確定事項：「仮予約枠の自動解放：会員登録未完了のまま10分経過で自動解放」。

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/temp-hold.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  TEMP_HOLD_DURATION_MINUTES,
  calculateTempHoldExpiry,
  isTempHoldExpired,
} from "./temp-hold";

describe("calculateTempHoldExpiry", () => {
  it("adds 10 minutes to the current time", () => {
    const now = new Date("2026-09-02T10:00:00.000Z");
    const expiry = calculateTempHoldExpiry(now);
    expect(expiry.toISOString()).toBe("2026-09-02T10:10:00.000Z");
  });

  it("uses the exported duration constant", () => {
    expect(TEMP_HOLD_DURATION_MINUTES).toBe(10);
  });
});

describe("isTempHoldExpired", () => {
  it("returns false before expiry", () => {
    const expiresAt = new Date("2026-09-02T10:10:00.000Z");
    expect(isTempHoldExpired(expiresAt, new Date("2026-09-02T10:05:00.000Z"))).toBe(false);
  });

  it("returns true after expiry", () => {
    const expiresAt = new Date("2026-09-02T10:10:00.000Z");
    expect(isTempHoldExpired(expiresAt, new Date("2026-09-02T10:10:01.000Z"))).toBe(true);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/temp-hold.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/temp-hold.ts`:

```typescript
export const TEMP_HOLD_DURATION_MINUTES = 10;

export function calculateTempHoldExpiry(now: Date): Date {
  return new Date(now.getTime() + TEMP_HOLD_DURATION_MINUTES * 60 * 1000);
}

export function isTempHoldExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() > expiresAt.getTime();
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/temp-hold.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 14: 空き時間枠取得サーバーアクション（TDD）

**Files:**
- Create: `app/actions/availability.ts`
- Test: `app/actions/availability.test.ts`

- [x] **Step 1: 失敗するテストを書く**

`app/actions/availability.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailableSlots } from "./availability";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findUniqueOrThrow: vi.fn() },
    storeHoliday: { findMany: vi.fn() },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
    staffShift: { findUnique: vi.fn() },
    reservation: { findMany: vi.fn() },
  },
}));

const store = {
  id: 1,
  weekdayOpen: new Date("1970-01-01T11:00:00Z"),
  weekdayClose: new Date("1970-01-01T13:00:00Z"),
  weekendOpen: new Date("1970-01-01T10:00:00Z"),
  weekendClose: new Date("1970-01-01T18:00:00Z"),
  luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
  luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
};

describe("getAvailableSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.store.findUniqueOrThrow).mockResolvedValue(store as never);
    vi.mocked(prisma.storeHoliday.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({
      id: 10,
      treatmentTimeMin: 60,
      category: { name: "頭皮ケア重点" },
    } as never);
    vi.mocked(prisma.option.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
  });

  it("returns generated slots based on store hours and course duration", async () => {
    const result = await getAvailableSlots({
      storeId: 1,
      staffId: null,
      date: "2026-09-02",
      courseId: 10,
      optionIds: [],
    });

    // 11:00-13:00 open, 60min duration, 30min interval -> [660, 690, 720]
    expect(result).toEqual([660, 690, 720]);
  });

  it("excludes slots overlapping an existing reservation", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { startTime: new Date("1970-01-01T11:30:00Z"), endTime: new Date("1970-01-01T12:30:00Z") },
    ] as never);

    const result = await getAvailableSlots({
      storeId: 1,
      staffId: null,
      date: "2026-09-02",
      courseId: 10,
      optionIds: [],
    });

    // 11:30-12:30 (690-750) overlaps all three candidate slots (660-720, 690-750, 720-780),
    // so with correct overlap semantics every slot is excluded.
    expect(result).toEqual([]);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/availability.test.ts
```

Expected: FAIL（モジュールが見つからない）

- [x] **Step 3: 実装する**

`app/actions/availability.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { generateAvailableSlots } from "@/lib/reservation/time-slots";
import { dbTimeToMinutes } from "@/lib/reservation/time";

export interface GetAvailableSlotsParams {
  storeId: number;
  staffId: number | null;
  date: string;
  courseId: number;
  optionIds: number[];
}

export async function getAvailableSlots(params: GetAvailableSlotsParams): Promise<number[]> {
  const targetDate = new Date(`${params.date}T00:00:00.000Z`);

  const [store, holidays, course, options, staffShift, existingReservations] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: params.storeId } }),
    prisma.storeHoliday.findMany({ where: { storeId: params.storeId } }),
    prisma.course.findUniqueOrThrow({
      where: { id: params.courseId },
      include: { category: true },
    }),
    prisma.option.findMany({ where: { id: { in: params.optionIds } } }),
    params.staffId
      ? prisma.staffShift.findUnique({
          where: { staffId_workDate: { staffId: params.staffId, workDate: targetDate } },
        })
      : Promise.resolve(null),
    prisma.reservation.findMany({
      where: {
        storeId: params.storeId,
        reservationDate: targetDate,
        status: { in: ["temp_hold", "confirmed"] },
        ...(params.staffId ? { staffId: params.staffId } : {}),
      },
    }),
  ]);

  const totalDuration =
    course.treatmentTimeMin + options.reduce((sum, o) => sum + o.durationMin, 0);

  return generateAvailableSlots({
    store,
    date: targetDate,
    holidayDates: holidays.map((h) => h.holidayDate),
    totalDurationMinutes: totalDuration,
    isLuxuryCategory: course.category.name === "ラグジュアリー",
    slotIntervalMinutes: 30,
    staffShift: staffShift ?? undefined,
    existingBookings: existingReservations.map((r) => ({
      startMinutes: dbTimeToMinutes(r.startTime),
      endMinutes: dbTimeToMinutes(r.endTime),
    })),
  });
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/availability.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 15: 仮予約作成サーバーアクション（二重予約防止・価格計算統合、TDD）

**Files:**
- Create: `app/actions/create-temp-hold.ts`
- Test: `app/actions/create-temp-hold.test.ts`

**注記:** ゲスト（未ログイン）でもStep6までは進めるため、この時点では`memberId`は`null`のまま`temp_hold`として作成する（Task 1のスキーマ修正を前提）。同一枠への同時予約は、DB側の`reservations`の`(store_id, reservation_date, staff_id)`インデックスと、作成直前に空き枠を再確認する処理で防ぐ。完全な排他制御（DBレベルのロック）はPrismaのトランザクションで後続タスク（Phase 3以降の本番運用強化）にて追加検討する前提とし、本タスクでは「作成直前に再度空き判定を行い、埋まっていれば作成しない」という楽観的ロックのロジックを実装する。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/create-temp-hold.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTempHoldReservation } from "./create-temp-hold";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    course: { findUniqueOrThrow: vi.fn() },
    option: { findMany: vi.fn() },
  },
}));

const baseCourse = {
  id: 10,
  price: 10000,
  treatmentTimeMin: 60,
};

describe("createTempHoldReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue(baseCourse as never);
    vi.mocked(prisma.option.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reservation.create).mockResolvedValue({ id: 123 } as never);
  });

  it("creates a temp_hold reservation with no member yet, computed price and deadlines", async () => {
    const result = await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-10",
      startMinutes: 660,
      nominationFee: 0,
    });

    expect(result).toEqual({ status: "created", reservationId: 123 });
    expect(prisma.reservation.create).toHaveBeenCalledTimes(1);
    const createArgs = vi.mocked(prisma.reservation.create).mock.calls[0][0];
    expect(createArgs.data.status).toBe("temp_hold");
    expect(createArgs.data.memberId).toBeNull();
    expect(createArgs.data.totalPrice).toBe(10000);
    expect(createArgs.data.source).toBe("web");
  });

  it("refuses to create when the slot is no longer free", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { startTime: new Date("1970-01-01T11:00:00Z"), endTime: new Date("1970-01-01T12:00:00Z") },
    ] as never);

    const result = await createTempHoldReservation({
      storeId: 1,
      staffId: null,
      courseId: 10,
      optionIds: [],
      reservationDate: "2026-09-10",
      startMinutes: 660,
      nominationFee: 0,
    });

    expect(result).toEqual({ status: "slot_unavailable" });
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/create-temp-hold.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/create-temp-hold.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { dbTimeToMinutes, minutesToLabel } from "@/lib/reservation/time";
import { isSlotFree } from "@/lib/reservation/slot-conflict";
import { calculateReservationTotal } from "@/lib/reservation/total-price";
import { calculateCancellationDeadline } from "@/lib/reservation/cancellation-deadline";
import { calculateTempHoldExpiry } from "@/lib/reservation/temp-hold";

export interface CreateTempHoldParams {
  storeId: number;
  staffId: number | null;
  courseId: number;
  optionIds: number[];
  reservationDate: string;
  startMinutes: number;
  nominationFee: number;
}

export type CreateTempHoldResult =
  | { status: "created"; reservationId: number }
  | { status: "slot_unavailable" };

export async function createTempHoldReservation(
  params: CreateTempHoldParams,
): Promise<CreateTempHoldResult> {
  const [course, options] = await Promise.all([
    prisma.course.findUniqueOrThrow({ where: { id: params.courseId } }),
    prisma.option.findMany({ where: { id: { in: params.optionIds } } }),
  ]);

  const totalDuration =
    course.treatmentTimeMin + options.reduce((sum, o) => sum + o.durationMin, 0);
  const endMinutes = params.startMinutes + totalDuration;

  const targetDate = new Date(`${params.reservationDate}T00:00:00.000Z`);

  const existing = await prisma.reservation.findMany({
    where: {
      storeId: params.storeId,
      reservationDate: targetDate,
      status: { in: ["temp_hold", "confirmed"] },
      ...(params.staffId ? { staffId: params.staffId } : {}),
    },
  });

  const existingBookings = existing.map((r) => ({
    startMinutes: dbTimeToMinutes(r.startTime),
    endMinutes: dbTimeToMinutes(r.endTime),
  }));

  if (!isSlotFree(params.startMinutes, endMinutes, existingBookings)) {
    return { status: "slot_unavailable" };
  }

  const pricing = calculateReservationTotal({
    course: { price: course.price, discountExempt: false, applicableCampaigns: [] },
    options: options.map((o) => ({
      price: o.price,
      discountExempt: o.discountExempt,
      applicableCampaigns: [],
    })),
    nominationFee: params.nominationFee,
  });

  const now = new Date();
  const startLabel = minutesToLabel(params.startMinutes);
  const endLabel = minutesToLabel(endMinutes);

  const reservation = await prisma.reservation.create({
    data: {
      memberId: null,
      storeId: params.storeId,
      staffId: params.staffId,
      reservationDate: targetDate,
      startTime: new Date(`1970-01-01T${startLabel}:00.000Z`),
      endTime: new Date(`1970-01-01T${endLabel}:00.000Z`),
      status: "temp_hold",
      source: "web",
      nominationFeeApplied: params.nominationFee,
      totalPrice: pricing.totalPrice,
      tempHoldExpiresAt: calculateTempHoldExpiry(now),
      cancellationDeadline: calculateCancellationDeadline(targetDate),
    },
  });

  return { status: "created", reservationId: reservation.id };
}
```

**注記:** このタスクの時点では`Reservation.memberId`をnullableにするTask 1のスキーマ変更が前提。もしTask 1未実施のまま本タスクを実装しようとした場合は、`memberId: null`の行でPrismaの型エラーが出るはずなので、その場合はTask 1が完了しているか確認すること。

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/create-temp-hold.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

> **実装時の修正（セキュリティレビュー対応）:** 自動セキュリティレビューで、`nominationFee`（指名料）をクライアントから信頼して受け取っている点が指摘された（改ざんによる不正な安価予約が可能だったため）。`CreateTempHoldParams`から`nominationFee`を削除し、`staffId`が指定されている場合はサーバー側で`prisma.staff.findUniqueOrThrow`によりスタッフの`nominationFee`を取得して使用するよう修正した。テストも「スタッフ指名なし→指名料0」「スタッフ指名あり→DBの指名料を使用しクライアント値は無視される」の2ケースに更新済み。

---

## Task 16: 予約確定サーバーアクション（性別チェック・会員紐付け、TDD）

**Files:**
- Create: `app/actions/confirm-reservation.ts`
- Test: `app/actions/confirm-reservation.test.ts`

**注記:** Step7で会員登録／ログインが完了した後に呼ばれる。仮予約（`temp_hold`）が期限切れでないこと・性別制限に違反しないことを確認してから`confirmed`に更新し、`member_id`を確定する。

- [x] **Step 1: 失敗するテストを書く**

`app/actions/confirm-reservation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmReservation } from "./confirm-reservation";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("confirmReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.reservation.update).mockResolvedValue({ id: 99 } as never);
  });

  it("confirms a still-valid temp_hold reservation and attaches the member", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99, memberId: 5 });

    expect(result).toEqual({ status: "confirmed" });
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { memberId: 5, status: "confirmed", tempHoldExpiresAt: null },
    });
  });

  it("rejects when the temp_hold has already expired", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "temp_hold",
      tempHoldExpiresAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99, memberId: 5 });

    expect(result).toEqual({ status: "expired" });
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects when the reservation is not in temp_hold status", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: 99,
      status: "cancelled",
      tempHoldExpiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await confirmReservation({ reservationId: 99, memberId: 5 });

    expect(result).toEqual({ status: "not_found" });
  });

  it("rejects when the reservation does not exist", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null as never);

    const result = await confirmReservation({ reservationId: 999, memberId: 5 });

    expect(result).toEqual({ status: "not_found" });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run app/actions/confirm-reservation.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`app/actions/confirm-reservation.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { isTempHoldExpired } from "@/lib/reservation/temp-hold";

export interface ConfirmReservationParams {
  reservationId: number;
  memberId: number;
}

export type ConfirmReservationResult =
  | { status: "confirmed" }
  | { status: "expired" }
  | { status: "not_found" };

export async function confirmReservation(
  params: ConfirmReservationParams,
): Promise<ConfirmReservationResult> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId },
  });

  if (!reservation || reservation.status !== "temp_hold") {
    return { status: "not_found" };
  }

  if (
    reservation.tempHoldExpiresAt &&
    isTempHoldExpired(reservation.tempHoldExpiresAt, new Date())
  ) {
    return { status: "expired" };
  }

  await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { memberId: params.memberId, status: "confirmed", tempHoldExpiresAt: null },
  });

  return { status: "confirmed" };
}
```

**注記:** 性別制限の最終チェック（`checkGenderRestriction`）は、コース・オプションの`gender_restriction`情報を確認画面（Phase 3のUI）側で会員登録直後に呼び出す想定とし、本サーバーアクションは「仮予約の有効性確認＋会員紐付け」に責務を絞る。性別制限チェックを呼ぶ具体的な統合ポイントはPhase 3のStep7〜8実装時に決定する。

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run app/actions/confirm-reservation.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: 型チェックとテスト一式を実行する**

```bash
npx tsc --noEmit
npx vitest run
```

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

> **実装時の修正（セキュリティレビュー対応）:** 自動セキュリティレビューで、`memberId`をクライアントから信頼して受け取っている点が指摘された（誰でも任意の会員IDを指定して他人の仮予約を確定できてしまうIDOR脆弱性）。`ConfirmReservationParams`から`memberId`を削除し、`@/auth`の`auth()`で取得した認証済みセッションの`session.user.id`（role==="member"の場合のみ）を使うよう修正した。未認証・非会員セッションの場合は新しい`{ status: "unauthorized" }`を返す。テストも4件から6件に拡張（未認証・非会員セッションのケースを追加）。

---

## Task 17: 仮予約自動解放ロジック（Cron用、TDD）

**Files:**
- Create: `lib/reservation/release-expired-holds.ts`
- Test: `lib/reservation/release-expired-holds.test.ts`

**注記:** 実際のCronジョブ実行（Vercel Cron / pg_cron等での定期起動設定）はPhase以降（Cron・配信フェーズ）で行う。ここでは「期限切れのtemp_holdを検出してcancelledに更新する」ロジック本体だけを実装する。

- [x] **Step 1: 失敗するテストを書く**

`lib/reservation/release-expired-holds.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { releaseExpiredTempHolds } from "./release-expired-holds";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      updateMany: vi.fn(),
    },
  },
}));

describe("releaseExpiredTempHolds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels all temp_hold reservations past their expiry", async () => {
    vi.mocked(prisma.reservation.updateMany).mockResolvedValue({ count: 3 } as never);

    const result = await releaseExpiredTempHolds(new Date("2026-09-02T10:00:00.000Z"));

    expect(result).toEqual({ releasedCount: 3 });
    expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
      where: {
        status: "temp_hold",
        tempHoldExpiresAt: { lt: new Date("2026-09-02T10:00:00.000Z") },
      },
      data: { status: "cancelled" },
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/reservation/release-expired-holds.test.ts
```

Expected: FAIL

- [x] **Step 3: 実装する**

`lib/reservation/release-expired-holds.ts`:

```typescript
import { prisma } from "@/lib/db";

export interface ReleaseExpiredHoldsResult {
  releasedCount: number;
}

export async function releaseExpiredTempHolds(now: Date): Promise<ReleaseExpiredHoldsResult> {
  const result = await prisma.reservation.updateMany({
    where: {
      status: "temp_hold",
      tempHoldExpiresAt: { lt: now },
    },
    data: { status: "cancelled" },
  });

  return { releasedCount: result.count };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/reservation/release-expired-holds.test.ts
```

Expected: PASS（1 test）

- [x] **Step 5: 型チェックとテスト一式を実行する**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: 全テストがパスする（Task 2〜17累計で約60テスト）

- [x] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [x] `npx vitest run` の全テストがパスする
- [x] `npx tsc --noEmit` がエラーなく通る
- [x] `npx eslint .` がエラーなく通る
- [x] `prisma/schema.prisma`の`Reservation.memberId`がOptional (`Int?`)になっている
- [x] マイグレーションがユーザーのターミナルで適用済み（`npx prisma migrate dev --name make_reservation_member_id_optional`）
- [x] `npm run build`をユーザーのターミナルで最終確認する
