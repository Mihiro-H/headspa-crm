# Cronジョブ実行ログ・監視（A-13）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画面仕様書17節の7つの定期処理をすべて実装し、実行結果を`cron_job_logs`に記録、A-13画面で一覧確認できるようにする。実際の定時トリガーはVercel Cron（`vercel.json`）を使う前提で構成する。

**Architecture:** 各ジョブは「業務ロジックを実行し`{targetCount}`を返す関数」として実装し、共通ラッパー`runCronJob`が成功/失敗を`cron_job_logs`に記録する（例外を握りつぶさず必ずログが残る設計）。メール／LINE送信を伴うジョブ（前日リマインド・誕生月・未読再送）は共通ヘルパー`sendToMemberAndLog`でPhase 13の配信基盤（`resolveMemberChannel`・`renderTemplate`・`sendEmail`・`sendLineMessage`）を再利用する。7ジョブは1本の動的APIルート`app/api/cron/[jobName]/route.ts`から呼び分け、Vercelの`CRON_SECRET`によるBearer認証で保護する。

**Tech Stack:** Next.js 16 App Router / TypeScript / Prisma / Vitest / Vercel Cron

**参照元資料:** `02_screenspecification.md`（画面仕様書 A-13節、17節「Cronによる定期処理設計」）

---

## 実行環境に関する注記（継承）

- `.git`への書き込み（`git add`/`git commit`含む）は一切実行できない。ユーザーが自分のターミナルで実行する。
- `.env`/`.env.*`は読み取り・書き込みともに不可。
- `npm run build`・`npm run dev`はこのサンドボックスでは不安定なため実行しない。検証は`npx tsc --noEmit`・`npx eslint .`・`npx vitest run`で行う。
- **実際にVercel Cronが指定時刻にAPIルートを叩くかどうかは、このサンドボックスからは確認できない。** Vercelへのデプロイ後、ユーザーの環境（Vercelダッシュボードのcronログ）で確認していただく。
- **CRITICAL: 仕様にある関数・ロジックを自己判断で別実装に置き換えない。** 既存の`releaseExpiredTempHolds`・`resolveMemberChannel`・`renderTemplate`・`sendEmail`・`sendLineMessage`・`getSalesReport`は必ずそのまま再利用すること。もし仕様通りに実装できないと判断した場合は、黙って別実装にせず、範囲を絞った`// eslint-disable-next-line`＋理由コメント、またはDONE_WITH_CONCERNSとして報告すること。

---

## スコープ決定事項（このPhaseで意図的に簡略化した点）

1. **月報集計バッチは「事前集計キャッシュ」を持たない**：仕様書は「前月分の売上・レポートデータを事前集計」としているが、専用のキャッシュテーブルを新設するのは今回のスコープ外とする。Phase 12で実装済みの`getSalesReport`をそのまま前月分の期間で呼び出し、正常に集計できたことをログに残す「ヘルスチェック」的な位置づけとする（A-08レポート自体は元々リアルタイム集計のため、キャッシュがなくても機能上の支障はない）。
2. **誕生月メールは「誕生月の1日にまとめて送る」運用を前提とする**：`AutoDeliverySetting.sendTiming`は文字列（例：`month_start`）として保存するのみで、日付当日判定などのタイミング分岐ロジックは持たない。実行タイミングの制御は`vercel.json`のcronスケジュール（毎月1日9:00）が担う。
3. **前日リマインドの対象抽出は「予約日＝実行日の翌日」の単純な日付一致**とする。時刻は問わない。
4. **リマインド未読チェック（再送）は「当日中に失敗したリマインド配信ログ」を再送する**：仕様の「送信失敗分の再送・アラート」のうち再送のみ実装し、管理者へのアラート通知（メール等）は別スコープとする。
5. **CronのAPIルートは`CRON_SECRET`環境変数によるBearer認証で保護する**：Vercelは`CRON_SECRET`が設定されていると自動的に`Authorization: Bearer $CRON_SECRET`ヘッダーを付けてcronを実行する（Vercel公式の仕組み）。`.env`への追加はユーザーに依頼する。

---

## Task 1: Cronジョブ共通実行ラッパー（TDD）

**Files:**
- Create: `lib/cron/run-job.ts`
- Test: `lib/cron/run-job.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/cron/run-job.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCronJob } from "./run-job";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    cronJobLog: { create: vi.fn() },
  },
}));

describe("runCronJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs success with the task's target count", async () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const task = vi.fn().mockResolvedValue({ targetCount: 5 });

    await runCronJob("test_job", task, now);

    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "test_job", executedAt: now, status: "success", targetCount: 5 },
    });
  });

  it("logs failure with the error message when the task throws", async () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const task = vi.fn().mockRejectedValue(new Error("db down"));

    await runCronJob("test_job", task, now);

    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: {
        jobName: "test_job",
        executedAt: now,
        status: "failed",
        targetCount: 0,
        errorMessage: "db down",
      },
    });
  });

  it("logs a generic error message when a non-Error value is thrown", async () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const task = vi.fn().mockRejectedValue("string failure");

    await runCronJob("test_job", task, now);

    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: {
        jobName: "test_job",
        executedAt: now,
        status: "failed",
        targetCount: 0,
        errorMessage: "unknown error",
      },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/cron/run-job.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/cron/run-job.ts`:

```typescript
import { prisma } from "@/lib/db";

export interface CronJobResult {
  targetCount: number;
}

export async function runCronJob(
  jobName: string,
  task: () => Promise<CronJobResult>,
  now: Date = new Date(),
): Promise<void> {
  try {
    const result = await task();
    await prisma.cronJobLog.create({
      data: { jobName, executedAt: now, status: "success", targetCount: result.targetCount },
    });
  } catch (error) {
    await prisma.cronJobLog.create({
      data: {
        jobName,
        executedAt: now,
        status: "failed",
        targetCount: 0,
        errorMessage: error instanceof Error ? error.message : "unknown error",
      },
    });
  }
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/cron/run-job.test.ts
```

Expected: PASS（3 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 2: 会員への送信＋ログ記録の共通ヘルパー（TDD）

**Files:**
- Create: `lib/delivery/send-to-member.ts`
- Test: `lib/delivery/send-to-member.test.ts`

### 補足

Phase 13の`app/actions/segment-campaigns.ts`内にある「チャネル解決→本文レンダリング→送信→`email_line_logs`記録」のロジックと同じ処理を、新規Cronジョブ（Task 4）から呼べる形で共通化する。**`segment-campaigns.ts`自体は変更しない**（既に検証済みの動いているコードに手を入れない）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/delivery/send-to-member.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendToMemberAndLog } from "./send-to-member";
import { prisma } from "@/lib/db";
import { sendEmail } from "./send-email";
import { sendLineMessage } from "./send-line";

vi.mock("@/lib/db", () => ({
  prisma: {
    emailLineLog: { create: vi.fn() },
  },
}));

vi.mock("./send-email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("./send-line", () => ({
  sendLineMessage: vi.fn(),
}));

const now = new Date("2026-09-05T18:00:00.000Z");

describe("sendToMemberAndLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends via LINE and logs a null subject when the member is LINE-linked", async () => {
    vi.mocked(sendLineMessage).mockResolvedValue({ status: "sent" });
    vi.mocked(prisma.emailLineLog.create).mockResolvedValue({} as never);

    const status = await sendToMemberAndLog({
      member: { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: "line-1" },
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、前日リマインドです。", subject: "{{氏名}}様へ" },
      templateType: "reminder",
      tags: { 氏名: "山田太郎" },
      now,
    });

    expect(status).toBe("success");
    expect(sendLineMessage).toHaveBeenCalledWith({
      lineUserId: "line-1",
      body: "山田太郎様、前日リマインドです。",
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 1,
        channel: "line",
        templateType: "reminder",
        subject: null,
        sentAt: now,
        status: "success",
      },
    });
  });

  it("sends via email and logs the rendered subject when the member is not LINE-linked", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ status: "failed", error: "boom" });
    vi.mocked(prisma.emailLineLog.create).mockResolvedValue({} as never);

    const status = await sendToMemberAndLog({
      member: { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null },
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、前日リマインドです。", subject: "{{氏名}}様へ" },
      templateType: "reminder",
      tags: { 氏名: "鈴木花子" },
      now,
    });

    expect(status).toBe("failed");
    expect(sendEmail).toHaveBeenCalledWith({
      to: "suzuki@example.com",
      subject: "鈴木花子様へ",
      body: "鈴木花子様、前日リマインドです。",
    });
    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 2,
        channel: "email",
        templateType: "reminder",
        subject: "鈴木花子様へ",
        sentAt: now,
        status: "failed",
      },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/delivery/send-to-member.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/delivery/send-to-member.ts`:

```typescript
import { prisma } from "@/lib/db";
import { renderTemplate } from "./render-template";
import { resolveMemberChannel, type SegmentChannelMode } from "./resolve-channel";
import { sendEmail } from "./send-email";
import { sendLineMessage } from "./send-line";

export interface SendToMemberMember {
  id: number;
  name: string;
  email: string;
  lineUserId: string | null;
}

export interface SendToMemberTemplate {
  bodyText: string;
  subject: string | null;
}

export interface SendToMemberParams {
  member: SendToMemberMember;
  channelMode: SegmentChannelMode;
  template: SendToMemberTemplate;
  templateType: "birthday" | "reminder" | "segment";
  tags: Record<string, string>;
  now: Date;
}

export async function sendToMemberAndLog(
  params: SendToMemberParams,
): Promise<"success" | "failed"> {
  const channel = resolveMemberChannel(params.channelMode, params.member.lineUserId);
  const body = renderTemplate(params.template.bodyText, params.tags);

  let status: "success" | "failed";
  let logSubject: string | null = null;

  if (channel === "line") {
    const result = await sendLineMessage({
      lineUserId: params.member.lineUserId as string,
      body,
    });
    status = result.status === "sent" ? "success" : "failed";
  } else {
    const subject = params.template.subject
      ? renderTemplate(params.template.subject, params.tags)
      : "";
    logSubject = subject || null;
    const result = await sendEmail({ to: params.member.email, subject, body });
    status = result.status === "sent" ? "success" : "failed";
  }

  await prisma.emailLineLog.create({
    data: {
      memberId: params.member.id,
      channel,
      templateType: params.templateType,
      subject: logSubject,
      sentAt: params.now,
      status,
    },
  });

  return status;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/delivery/send-to-member.test.ts
```

Expected: PASS（2 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 3: 予約系ジョブ（仮予約解放・No-show検知）（TDD）

**Files:**
- Create: `lib/cron/reservation-jobs.ts`
- Test: `lib/cron/reservation-jobs.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/cron/reservation-jobs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTempHoldReleaseJob, runNoShowDetectionJob } from "./reservation-jobs";
import { prisma } from "@/lib/db";
import { releaseExpiredTempHolds } from "@/lib/reservation/release-expired-holds";

vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: { updateMany: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/reservation/release-expired-holds", () => ({
  releaseExpiredTempHolds: vi.fn(),
}));

const now = new Date("2026-09-05T23:00:00.000Z");

describe("runTempHoldReleaseJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to releaseExpiredTempHolds and logs the released count", async () => {
    vi.mocked(releaseExpiredTempHolds).mockResolvedValue({ releasedCount: 3 });
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);

    await runTempHoldReleaseJob(now);

    expect(releaseExpiredTempHolds).toHaveBeenCalledWith(now);
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "temp_hold_release", executedAt: now, status: "success", targetCount: 3 },
    });
  });
});

describe("runNoShowDetectionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks today's still-confirmed reservations as no_show and logs the count", async () => {
    vi.mocked(prisma.reservation.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);

    await runNoShowDetectionJob(now);

    expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
      where: { status: "confirmed", reservationDate: new Date("2026-09-05T00:00:00.000Z") },
      data: { status: "no_show" },
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "no_show_detection", executedAt: now, status: "success", targetCount: 2 },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/cron/reservation-jobs.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/cron/reservation-jobs.ts`:

```typescript
import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { releaseExpiredTempHolds } from "@/lib/reservation/release-expired-holds";

export async function runTempHoldReleaseJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "temp_hold_release",
    async () => {
      const result = await releaseExpiredTempHolds(now);
      return { targetCount: result.releasedCount };
    },
    now,
  );
}

export async function runNoShowDetectionJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "no_show_detection",
    async () => {
      const todayDateOnly = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const result = await prisma.reservation.updateMany({
        where: { status: "confirmed", reservationDate: todayDateOnly },
        data: { status: "no_show" },
      });
      return { targetCount: result.count };
    },
    now,
  );
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/cron/reservation-jobs.test.ts
```

Expected: PASS（2 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 4: 配信系ジョブ（前日リマインド・誕生月・未読再送）（TDD）

**Files:**
- Create: `lib/cron/delivery-jobs.ts`
- Test: `lib/cron/delivery-jobs.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/cron/delivery-jobs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runReminderJob, runBirthdayJob, runReminderRecheckJob } from "./delivery-jobs";
import { prisma } from "@/lib/db";
import { sendToMemberAndLog } from "@/lib/delivery/send-to-member";

vi.mock("@/lib/db", () => ({
  prisma: {
    autoDeliverySetting: { findFirst: vi.fn() },
    reservation: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
    emailLineLog: { findMany: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/delivery/send-to-member", () => ({
  sendToMemberAndLog: vi.fn(),
}));

const now = new Date("2026-09-05T18:00:00.000Z");

describe("runReminderJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("does nothing and logs zero targets when no active reminder setting exists", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue(null as never);

    await runReminderJob(now);

    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "reminder", executedAt: now, status: "success", targetCount: 0 },
    });
  });

  it("sends a reminder to every member with a confirmed reservation tomorrow", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: {
        bodyText: "{{氏名}}様、{{店舗名}}にて明日{{予約時刻}}よりお待ちしております。",
        subject: null,
      },
    } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        member: { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: null },
        store: { name: "フォレスパ 渋谷店" },
        startTime: new Date("1970-01-01T10:30:00.000Z"),
      },
    ] as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await runReminderJob(now);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: { status: "confirmed", reservationDate: new Date("2026-09-06T00:00:00.000Z") },
      include: { member: true, store: true },
    });
    expect(sendToMemberAndLog).toHaveBeenCalledWith({
      member: { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: null },
      channelMode: "auto",
      template: {
        bodyText: "{{氏名}}様、{{店舗名}}にて明日{{予約時刻}}よりお待ちしております。",
        subject: null,
      },
      templateType: "reminder",
      tags: { 氏名: "山田太郎", 店舗名: "フォレスパ 渋谷店", 予約時刻: "10:30" },
      now,
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "reminder", executedAt: now, status: "success", targetCount: 1 },
    });
  });
});

describe("runBirthdayJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("sends a birthday message only to members born in the current month", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、お誕生日おめでとうございます。", subject: null },
    } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      {
        id: 1,
        name: "山田太郎",
        email: "yamada@example.com",
        lineUserId: null,
        birthDate: new Date("1990-09-15T00:00:00.000Z"),
      },
      {
        id: 2,
        name: "鈴木花子",
        email: "suzuki@example.com",
        lineUserId: null,
        birthDate: new Date("1990-03-15T00:00:00.000Z"),
      },
    ] as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await runBirthdayJob(now);

    expect(sendToMemberAndLog).toHaveBeenCalledTimes(1);
    expect(sendToMemberAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ member: expect.objectContaining({ id: 1 }) }),
    );
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "birthday", executedAt: now, status: "success", targetCount: 1 },
    });
  });
});

describe("runReminderRecheckJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("retries sending to members whose reminder failed earlier today", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({
      channelMode: "auto",
      template: { bodyText: "{{氏名}}様、前日リマインドです。", subject: null },
    } as never);
    vi.mocked(prisma.emailLineLog.findMany).mockResolvedValue([
      { member: { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null } },
    ] as never);
    vi.mocked(sendToMemberAndLog).mockResolvedValue("success");

    await runReminderRecheckJob(now);

    expect(prisma.emailLineLog.findMany).toHaveBeenCalledWith({
      where: {
        templateType: "reminder",
        status: "failed",
        sentAt: { gte: new Date("2026-09-05T00:00:00.000Z") },
      },
      include: { member: true },
    });
    expect(sendToMemberAndLog).toHaveBeenCalledWith(
      expect.objectContaining({ member: expect.objectContaining({ id: 2 }) }),
    );
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "reminder_recheck", executedAt: now, status: "success", targetCount: 1 },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/cron/delivery-jobs.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/cron/delivery-jobs.ts`:

```typescript
import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { sendToMemberAndLog } from "@/lib/delivery/send-to-member";
import { minutesToLabel, dbTimeToMinutes } from "@/lib/reservation/time";

export async function runReminderJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "reminder",
    async () => {
      const setting = await prisma.autoDeliverySetting.findFirst({
        where: { type: "reminder", isActive: true },
        include: { template: true },
      });
      if (!setting) return { targetCount: 0 };

      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowDateOnly = new Date(
        Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()),
      );

      const reservations = await prisma.reservation.findMany({
        where: { status: "confirmed", reservationDate: tomorrowDateOnly },
        include: { member: true, store: true },
      });

      let count = 0;
      for (const r of reservations) {
        if (!r.member) continue;
        await sendToMemberAndLog({
          member: r.member,
          channelMode: setting.channelMode,
          template: setting.template,
          templateType: "reminder",
          tags: {
            氏名: r.member.name,
            店舗名: r.store.name,
            予約時刻: minutesToLabel(dbTimeToMinutes(r.startTime)),
          },
          now,
        });
        count++;
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runBirthdayJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "birthday",
    async () => {
      const setting = await prisma.autoDeliverySetting.findFirst({
        where: { type: "birthday", isActive: true },
        include: { template: true },
      });
      if (!setting) return { targetCount: 0 };

      const currentMonth = now.getUTCMonth() + 1;
      const members = await prisma.member.findMany();
      const targets = members.filter((m) => m.birthDate.getUTCMonth() + 1 === currentMonth);

      let count = 0;
      for (const member of targets) {
        await sendToMemberAndLog({
          member,
          channelMode: setting.channelMode,
          template: setting.template,
          templateType: "birthday",
          tags: { 氏名: member.name },
          now,
        });
        count++;
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runReminderRecheckJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "reminder_recheck",
    async () => {
      const setting = await prisma.autoDeliverySetting.findFirst({
        where: { type: "reminder", isActive: true },
        include: { template: true },
      });
      if (!setting) return { targetCount: 0 };

      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const failedLogs = await prisma.emailLineLog.findMany({
        where: { templateType: "reminder", status: "failed", sentAt: { gte: todayStart } },
        include: { member: true },
      });

      let count = 0;
      for (const log of failedLogs) {
        await sendToMemberAndLog({
          member: log.member,
          channelMode: setting.channelMode,
          template: setting.template,
          templateType: "reminder",
          tags: { 氏名: log.member.name },
          now,
        });
        count++;
      }
      return { targetCount: count };
    },
    now,
  );
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/cron/delivery-jobs.test.ts
```

Expected: PASS（4 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 5: 集計系ジョブ（ステータス自動更新・月報バッチ）（TDD）

**Files:**
- Create: `lib/cron/reporting-jobs.ts`
- Test: `lib/cron/reporting-jobs.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/cron/reporting-jobs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStatusUpdateJob, runMonthlyReportJob } from "./reporting-jobs";
import { prisma } from "@/lib/db";
import { getSalesReport } from "@/app/actions/sales-report";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerStatus: { findMany: vi.fn() },
    member: { findMany: vi.fn(), update: vi.fn() },
    cronJobLog: { create: vi.fn() },
  },
}));

vi.mock("@/app/actions/sales-report", () => ({
  getSalesReport: vi.fn(),
}));

const now = new Date("2026-10-01T03:00:00.000Z");

describe("runStatusUpdateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("promotes a member whose visit count now qualifies for a higher status", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0 },
      { id: 2, minVisitCount: 5 },
      { id: 3, minVisitCount: 10 },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 6, statusId: 1 },
      { id: 101, visitCount: 3, statusId: 1 },
    ] as never);
    vi.mocked(prisma.member.update).mockResolvedValue({} as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).toHaveBeenCalledTimes(1);
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { statusId: 2 },
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "status_update", executedAt: now, status: "success", targetCount: 1 },
    });
  });

  it("does not update a member who is already at the correct status", async () => {
    vi.mocked(prisma.customerStatus.findMany).mockResolvedValue([
      { id: 1, minVisitCount: 0 },
      { id: 2, minVisitCount: 5 },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 100, visitCount: 6, statusId: 2 },
    ] as never);

    await runStatusUpdateJob(now);

    expect(prisma.member.update).not.toHaveBeenCalled();
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "status_update", executedAt: now, status: "success", targetCount: 0 },
    });
  });
});

describe("runMonthlyReportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.cronJobLog.create).mockResolvedValue({} as never);
  });

  it("aggregates the previous month's sales report and logs the customer count", async () => {
    vi.mocked(getSalesReport).mockResolvedValue({
      summary: {
        salesTotal: 500000,
        customerCount: 42,
        averageSpend: 11904,
        newCustomerCount: 10,
        repeatCustomerCount: 32,
        nominationSalesRatio: 60,
      },
      dailySales: [],
      courseSales: [],
      staffSales: [],
      details: [],
    } as never);

    await runMonthlyReportJob(now);

    expect(getSalesReport).toHaveBeenCalledWith({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      storeId: null,
    });
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith({
      data: { jobName: "monthly_report", executedAt: now, status: "success", targetCount: 42 },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/cron/reporting-jobs.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/cron/reporting-jobs.ts`:

```typescript
import { prisma } from "@/lib/db";
import { runCronJob } from "./run-job";
import { getSalesReport } from "@/app/actions/sales-report";

export async function runStatusUpdateJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "status_update",
    async () => {
      const statuses = await prisma.customerStatus.findMany({
        orderBy: { minVisitCount: "asc" },
      });
      const members = await prisma.member.findMany();

      let count = 0;
      for (const member of members) {
        const qualifying = statuses.filter((s) => s.minVisitCount <= member.visitCount);
        const best = qualifying[qualifying.length - 1];
        if (best && best.id !== member.statusId) {
          await prisma.member.update({ where: { id: member.id }, data: { statusId: best.id } });
          count++;
        }
      }
      return { targetCount: count };
    },
    now,
  );
}

export async function runMonthlyReportJob(now: Date = new Date()): Promise<void> {
  await runCronJob(
    "monthly_report",
    async () => {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1);
      const lastMonthStart = new Date(
        Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1),
      );

      const report = await getSalesReport({
        startDate: lastMonthStart.toISOString().slice(0, 10),
        endDate: lastMonthEnd.toISOString().slice(0, 10),
        storeId: null,
      });

      return { targetCount: report.summary.customerCount };
    },
    now,
  );
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/cron/reporting-jobs.test.ts
```

Expected: PASS（3 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 6: Cron実行ログ取得Server Action（TDD）

**Files:**
- Create: `app/actions/cron-logs.ts`
- Test: `app/actions/cron-logs.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/cron-logs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCronJobLogs } from "./cron-logs";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    cronJobLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("listCronJobLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    await expect(listCronJobLogs()).rejects.toThrow("unauthorized");
    expect(prisma.cronJobLog.findMany).not.toHaveBeenCalled();
  });

  it("returns logs ordered by newest execution first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.cronJobLog.findMany).mockResolvedValue([
      {
        id: 1,
        jobName: "temp_hold_release",
        executedAt: new Date("2026-09-05T18:01:00.000Z"),
        status: "success",
        targetCount: 3,
        errorMessage: null,
      },
    ] as never);

    const result = await listCronJobLogs();

    expect(result).toEqual([
      {
        id: 1,
        jobName: "temp_hold_release",
        executedAt: "2026-09-05T18:01:00.000Z",
        status: "success",
        targetCount: 3,
        errorMessage: null,
      },
    ]);
    expect(prisma.cronJobLog.findMany).toHaveBeenCalledWith({
      orderBy: { executedAt: "desc" },
      take: 200,
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/cron-logs.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/cron-logs.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export interface CronJobLogItem {
  id: number;
  jobName: string;
  executedAt: string;
  status: "success" | "failed";
  targetCount: number;
  errorMessage: string | null;
}

export async function listCronJobLogs(): Promise<CronJobLogItem[]> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const logs = await prisma.cronJobLog.findMany({
    orderBy: { executedAt: "desc" },
    take: 200,
  });
  return logs.map((l) => ({
    id: l.id,
    jobName: l.jobName,
    executedAt: l.executedAt.toISOString(),
    status: l.status,
    targetCount: l.targetCount,
    errorMessage: l.errorMessage,
  }));
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/cron-logs.test.ts
```

Expected: PASS（2 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 7: Cron呼び出し用APIルート（軽量検証）

**Files:**
- Create: `app/api/cron/[jobName]/route.ts`

- [ ] **Step 1: 実装する**

`app/api/cron/[jobName]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { runTempHoldReleaseJob, runNoShowDetectionJob } from "@/lib/cron/reservation-jobs";
import { runReminderJob, runBirthdayJob, runReminderRecheckJob } from "@/lib/cron/delivery-jobs";
import { runStatusUpdateJob, runMonthlyReportJob } from "@/lib/cron/reporting-jobs";

const JOB_HANDLERS: Record<string, () => Promise<void>> = {
  "temp-hold-release": () => runTempHoldReleaseJob(),
  "no-show-detection": () => runNoShowDetectionJob(),
  reminder: () => runReminderJob(),
  birthday: () => runBirthdayJob(),
  "reminder-recheck": () => runReminderRecheckJob(),
  "status-update": () => runStatusUpdateJob(),
  "monthly-report": () => runMonthlyReportJob(),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobName: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobName } = await params;
  const handler = JOB_HANDLERS[jobName];
  if (!handler) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }

  await handler();
  return NextResponse.json({ status: "ok" });
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 8: Vercel Cronスケジュール設定（軽量検証）

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: 実装する**

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/temp-hold-release", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/reminder", "schedule": "0 18 * * *" },
    { "path": "/api/cron/birthday", "schedule": "0 9 1 * *" },
    { "path": "/api/cron/status-update", "schedule": "0 2 * * *" },
    { "path": "/api/cron/monthly-report", "schedule": "0 3 1 * *" },
    { "path": "/api/cron/reminder-recheck", "schedule": "0 20 * * *" },
    { "path": "/api/cron/no-show-detection", "schedule": "0 23 * * *" }
  ]
}
```

### 補足

仕様書は仮予約枠の自動解放を「毎分（または5分おき）」としているが、Vercel Cronの最短間隔はHobbyプランで1日1回、Proプランで1分単位のため、Proプラン前提で5分おき（`*/5 * * * *`）とした。より高頻度が必要な場合はユーザーの環境（Vercelのプラン）に応じて調整いただく。

- [ ] **Step 2: JSON構文を確認する**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf-8')); console.log('valid JSON')"
```

Expected: `valid JSON`

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

ユーザーには「Vercelプロジェクトの環境変数に`CRON_SECRET`を設定してください（任意の推測困難な文字列）」と伝える。

---

## Task 9: Cron実行ログ画面（軽量検証）＋サイドバーリンク追加

**Files:**
- Create: `app/admin/(dashboard)/cron-logs/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: 実装する**

`app/admin/(dashboard)/cron-logs/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { listCronJobLogs, type CronJobLogItem } from "@/app/actions/cron-logs";

const JOB_LABEL: Record<string, string> = {
  temp_hold_release: "仮予約枠の自動解放",
  reminder: "前日リマインド送信",
  birthday: "誕生月メール送信",
  status_update: "顧客ステータス自動更新",
  monthly_report: "月報集計バッチ",
  reminder_recheck: "リマインド未読チェック（再送）",
  no_show_detection: "No-show自動検知",
};

export default function CronLogsPage() {
  const [logs, setLogs] = useState<CronJobLogItem[]>([]);

  useEffect(() => {
    listCronJobLogs().then(setLogs);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">Cronジョブ実行ログ</h1>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ジョブ</th>
              <th className="p-3">実行日時</th>
              <th className="p-3">結果</th>
              <th className="p-3">対象件数</th>
              <th className="p-3">エラー内容</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{JOB_LABEL[l.jobName] ?? l.jobName}</td>
                <td className="p-3">{l.executedAt}</td>
                <td className="p-3">
                  <span
                    className={
                      l.status === "success"
                        ? "rounded-full bg-success/10 px-2 py-1 text-xs text-success"
                        : "rounded-full bg-error/10 px-2 py-1 text-xs text-error"
                    }
                  >
                    {l.status === "success" ? "成功" : "失敗"}
                  </span>
                </td>
                <td className="p-3">{l.targetCount}件</td>
                <td className="p-3 text-neutral-500">{l.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length === 0 && (
        <p className="text-sm text-neutral-500">
          まだ実行ログがありません。Vercel Cronの設定後、初回実行をお待ちください。
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: サイドバーにリンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「配信テンプレート管理」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/cron-logs"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            Cronジョブ実行ログ
          </Link>
```

- [ ] **Step 3: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 4: 全テストスイートを実行する**

```bash
npx vitest run
```

Expected: 既存213テスト＋新規16テスト（Task1:3, Task2:2, Task3:2, Task4:4, Task5:3, Task6:2）＝229テストがパスする

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [ ] `npx vitest run` の全テストがパスする（`lib/auth/`・`update-member-profile`のbcryptタイムアウトによる既知のフラーキーさを除く）
- [ ] `npx tsc --noEmit` がエラーなく通る
- [ ] `npx eslint .` がエラーなく通る
- [ ] `/admin/cron-logs`で実行ログ一覧が表示できることをユーザーがブラウザで確認する
- [ ] Vercelにデプロイし、環境変数`CRON_SECRET`を設定した上で、`vercel.json`のcronが実際に動作することをVercelダッシュボードで確認する（このサンドボックスでは確認不可）
- [ ] デプロイ前に、`curl -H "Authorization: Bearer <CRON_SECRET>" https://<デプロイ先>/api/cron/temp-hold-release`のように手動で1つ叩いてみて、`cron_job_logs`にレコードが作られることを確認するとより確実
