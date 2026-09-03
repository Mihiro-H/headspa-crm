# メール／LINE配信管理（A-09）・自動配信設定（A-10）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面にセグメント条件配信（A-09）と自動配信設定（A-10）を実装する。文面（テンプレート）はこのアプリ側のDBで管理し、Brevo（メール）・LINE Messaging API（LINE）は実際の送信を行う「配送業者」としてのみ利用する。

**Architecture:** 既存の顧客検索ロジック（顧客管理一覧）と同じ条件で対象会員を抽出する共通ヘルパーを`lib/customer/filter.ts`に切り出し、対象人数プレビュー（`segment-audience.ts`）と実際の配信（`segment-campaigns.ts`）の両方から同じロジックを参照することで、プレビュー人数と実際の送信対象がズレるバグを防ぐ。文面の差し込みタグ置換（`render-template.ts`）とチャネル自動振り分け（`resolve-channel.ts`）は純粋関数として`lib/delivery/`に切り出す。実際の外部送信（Brevo・LINE）は`lib/delivery/send-email.ts`・`send-line.ts`にラップし、APIキー未設定時は安全に`not_configured`を返す設計にする。

**Tech Stack:** Next.js 16 App Router / TypeScript / Prisma / Vitest

**参照元資料:** `02_screenspecification.md`（画面仕様書 A-09・A-10節）、`04_table-design.md`（segment_campaigns・auto_delivery_settings・email_line_logsテーブル）

---

## 実行環境に関する注記（継承）

- `.git`への書き込み（`git add`/`git commit`含む）は一切実行できない。ユーザーが自分のターミナルで実行する。
- `.env`/`.env.*`は読み取り・書き込みともに不可。
- `npm run build`・`npm run dev`はこのサンドボックスでは不安定なため実行しない。検証は`npx tsc --noEmit`・`npx eslint .`・`npx vitest run`で行う。
- **サンドボックスからは外部通信（curl/wget/nc等）が禁止されている。** `send-email.ts`・`send-line.ts`が実際にBrevo/LINEのAPIを呼び出すコードは書くが、テストでは`fetch`をモックし、実際のAPIには一切アクセスしない。本物の送信テストは、ユーザーが自分の`.env`にAPIキーを設定した上でご自身の環境で行う。
- **CRITICAL: 仕様にある関数・ロジックを自己判断で別実装に置き換えない。** もし仕様通りに実装できないと判断した場合は、黙って別実装にせず、範囲を絞った`// eslint-disable-next-line`＋理由コメント、またはDONE_WITH_CONCERNSとして報告すること。

---

## スコープ決定事項（このPhaseで意図的に簡略化した点）

1. **DeliveryTemplateテーブルを新規追加する**：既存スキーマの`SegmentCampaign.templateId`・`AutoDeliverySetting.templateId`は実は参照先のテーブルが存在しない列だった。今回、実体を持つテーブルとして新規追加し、正式な外部キーに変更する。
2. **「日時指定配信」はレコード作成のみ**：`SegmentCampaign`に`scheduledAt`付きでレコードを作るところまでは実装するが、指定日時に実際に送信を実行する仕組み（Cron）はA-13の範囲のため、今回は実装しない。「今すぐ配信」（`scheduledAt`未指定）のみ、その場で実際の送信処理まで行う。
3. **セグメント条件は既存の顧客検索（A-05）と同じ4項目（氏名・電話番号・ステータス・店舗）のみ**：来店回数・最終来店日・誕生月による絞り込みは、既存のA-05実装（`searchCustomers`）にも現状ない機能のため、今回もスコープ外とする。
4. **開封率は対象外**：外部サービスのAPI依存のため、配信履歴には送信数・成功/失敗数のみ表示する。
5. **A-10の実行ログ一覧はA-13の範囲**：Cronジョブ実行ログ（`cron_job_logs`）の閲覧画面はA-13で実装する。今回のA-10は設定の保存のみ。
6. **A-10は初回は空の状態からスタートする**：`AutoDeliverySetting`に初期データを自動投入する仕組みは作らず、管理画面から「テンプレートを選択して保存」した時点で初めてレコードが作られる（`type`ごとに存在すれば更新、なければ新規作成）。

---

## Task 1: DeliveryTemplateテーブルの追加とSegmentCampaign/AutoDeliverySettingの外部キー化

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260904010000_add_delivery_templates/migration.sql`

- [ ] **Step 1: スキーマを変更する**

`prisma/schema.prisma`の`EmailLineLog`モデルの直後、`CronJobLog`モデルの手前に以下を追加する：

```prisma
model DeliveryTemplate {
  id        Int                  @id @default(autoincrement()) @map("template_id")
  type      DeliveryTemplateType
  name      String               @db.VarChar(100)
  subject   String?              @db.VarChar(255)
  bodyText  String               @map("body_text")
  createdAt DateTime             @default(now()) @map("created_at")
  updatedAt DateTime             @updatedAt @map("updated_at")

  segmentCampaigns     SegmentCampaign[]
  autoDeliverySettings AutoDeliverySetting[]

  @@map("delivery_templates")
}
```

`SegmentCampaign`モデルの`createdByAdmin`行の直後に`template`リレーションを追加する（変更前後）：

変更前:
```prisma
  createdByAdmin Admin          @relation(fields: [createdByAdminId], references: [id])
  emailLineLogs  EmailLineLog[]
```

変更後:
```prisma
  createdByAdmin Admin            @relation(fields: [createdByAdminId], references: [id])
  template       DeliveryTemplate @relation(fields: [templateId], references: [id])
  emailLineLogs  EmailLineLog[]
```

`AutoDeliverySetting`モデルに`template`リレーションを追加する（変更前後）：

変更前:
```prisma
model AutoDeliverySetting {
  id          Int              @id @default(autoincrement()) @map("setting_id")
  type        AutoDeliveryType
  channelMode ChannelMode      @map("channel_mode")
  sendTiming  String           @map("send_timing") @db.VarChar(50)
  templateId  Int              @map("template_id")
  isActive    Boolean          @default(true) @map("is_active")

  @@map("auto_delivery_settings")
}
```

変更後:
```prisma
model AutoDeliverySetting {
  id          Int              @id @default(autoincrement()) @map("setting_id")
  type        AutoDeliveryType
  channelMode ChannelMode      @map("channel_mode")
  sendTiming  String           @map("send_timing") @db.VarChar(50)
  templateId  Int              @map("template_id")
  isActive    Boolean          @default(true) @map("is_active")

  template DeliveryTemplate @relation(fields: [templateId], references: [id])

  @@map("auto_delivery_settings")
}
```

- [ ] **Step 2: マイグレーションSQLを手動作成する**

`prisma/migrations/20260904010000_add_delivery_templates/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "delivery_templates" (
    "template_id" SERIAL NOT NULL,
    "type" "delivery_template_type" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255),
    "body_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_templates_pkey" PRIMARY KEY ("template_id")
);

-- AddForeignKey
ALTER TABLE "segment_campaigns" ADD CONSTRAINT "segment_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "delivery_templates"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_delivery_settings" ADD CONSTRAINT "auto_delivery_settings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "delivery_templates"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: スキーマ構文を検証する**

```bash
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Prisma Clientの型を再生成する**

```bash
npx prisma generate
```

- [ ] **Step 5: 変更ファイルを報告する（コミット・マイグレーション実行はしない）**

ユーザーには「`npx prisma migrate dev`を実行してください」と伝える。

---

## Task 2: 差し込みタグ置換（TDD）

**Files:**
- Create: `lib/delivery/render-template.ts`
- Test: `lib/delivery/render-template.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/delivery/render-template.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderTemplate } from "./render-template";

describe("renderTemplate", () => {
  it("replaces a known merge tag with its value", () => {
    expect(renderTemplate("{{氏名}}様、ご予約ありがとうございます。", { 氏名: "山田太郎" })).toBe(
      "山田太郎様、ご予約ありがとうございます。",
    );
  });

  it("replaces multiple occurrences of the same tag", () => {
    expect(renderTemplate("{{氏名}}さん、{{氏名}}さん", { 氏名: "鈴木花子" })).toBe(
      "鈴木花子さん、鈴木花子さん",
    );
  });

  it("replaces multiple different tags", () => {
    expect(
      renderTemplate("{{氏名}}様、{{店舗名}}にてお待ちしております。", {
        氏名: "山田太郎",
        店舗名: "フォレスパ 渋谷店",
      }),
    ).toBe("山田太郎様、フォレスパ 渋谷店にてお待ちしております。");
  });

  it("leaves an unknown tag untouched", () => {
    expect(renderTemplate("{{氏名}}様、{{未定義タグ}}", { 氏名: "山田太郎" })).toBe(
      "山田太郎様、{{未定義タグ}}",
    );
  });

  it("returns the text unchanged when it contains no tags", () => {
    expect(renderTemplate("いつもありがとうございます。", { 氏名: "山田太郎" })).toBe(
      "いつもありがとうございます。",
    );
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/delivery/render-template.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/delivery/render-template.ts`:

```typescript
const MERGE_TAG_PATTERN = /\{\{(.+?)\}\}/g;

export function renderTemplate(text: string, tags: Record<string, string>): string {
  return text.replace(MERGE_TAG_PATTERN, (match, key: string) => {
    const trimmedKey = key.trim();
    return trimmedKey in tags ? tags[trimmedKey] : match;
  });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/delivery/render-template.test.ts
```

Expected: PASS（5 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 3: 配信チャネル解決（TDD）

**Files:**
- Create: `lib/delivery/resolve-channel.ts`
- Test: `lib/delivery/resolve-channel.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/delivery/resolve-channel.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isMemberEligibleForChannel, resolveMemberChannel } from "./resolve-channel";

describe("isMemberEligibleForChannel", () => {
  it("is eligible for email mode regardless of LINE link", () => {
    expect(isMemberEligibleForChannel("email", null)).toBe(true);
    expect(isMemberEligibleForChannel("email", "line-user-1")).toBe(true);
  });

  it("is eligible for line mode only when LINE-linked", () => {
    expect(isMemberEligibleForChannel("line", "line-user-1")).toBe(true);
    expect(isMemberEligibleForChannel("line", null)).toBe(false);
  });

  it("is eligible for auto mode regardless of LINE link", () => {
    expect(isMemberEligibleForChannel("auto", null)).toBe(true);
    expect(isMemberEligibleForChannel("auto", "line-user-1")).toBe(true);
  });
});

describe("resolveMemberChannel", () => {
  it("resolves to email when mode is email, regardless of LINE link", () => {
    expect(resolveMemberChannel("email", "line-user-1")).toBe("email");
    expect(resolveMemberChannel("email", null)).toBe("email");
  });

  it("resolves to line when mode is line", () => {
    expect(resolveMemberChannel("line", "line-user-1")).toBe("line");
  });

  it("resolves to line when mode is auto and the member is LINE-linked", () => {
    expect(resolveMemberChannel("auto", "line-user-1")).toBe("line");
  });

  it("resolves to email when mode is auto and the member is not LINE-linked", () => {
    expect(resolveMemberChannel("auto", null)).toBe("email");
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/delivery/resolve-channel.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/delivery/resolve-channel.ts`:

```typescript
export type SegmentChannelMode = "email" | "line" | "auto";

export function isMemberEligibleForChannel(
  channelMode: SegmentChannelMode,
  lineUserId: string | null,
): boolean {
  if (channelMode === "line") return lineUserId !== null;
  return true;
}

export function resolveMemberChannel(
  channelMode: SegmentChannelMode,
  lineUserId: string | null,
): "email" | "line" {
  if (channelMode === "email") return "email";
  if (channelMode === "line") return "line";
  return lineUserId !== null ? "line" : "email";
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/delivery/resolve-channel.test.ts
```

Expected: PASS（7 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 4: 会員絞り込み条件の共通化（TDD）

**Files:**
- Create: `lib/customer/filter.ts`
- Test: `lib/customer/filter.test.ts`

### 補足

顧客管理一覧（A-05, `app/actions/search-customers.ts`）で使われている絞り込みロジックと同じ条件（氏名・電話番号・ステータス・店舗）を、対象人数プレビューと実際の配信対象抽出の両方で使う。既存の`search-customers.ts`自体は変更しない（動いているコードに手を入れない）。今回新規作成する2つのファイル（Task 8・Task 9）がこの共通ヘルパーを使うことで、プレビュー人数と実際の送信対象がズレるバグを防ぐ。

- [ ] **Step 1: 失敗するテストを書く**

`lib/customer/filter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildMemberWhereClause } from "./filter";

describe("buildMemberWhereClause", () => {
  it("returns an empty object when no condition fields are given", () => {
    expect(buildMemberWhereClause({})).toEqual({});
  });

  it("includes a case-insensitive name filter when name is given", () => {
    expect(buildMemberWhereClause({ name: "田中" })).toEqual({
      name: { contains: "田中", mode: "insensitive" },
    });
  });

  it("includes a phone filter when phone is given", () => {
    expect(buildMemberWhereClause({ phone: "090" })).toEqual({
      phone: { contains: "090" },
    });
  });

  it("includes statusId and primaryStoreId filters when given", () => {
    expect(buildMemberWhereClause({ statusId: 2, storeId: 1 })).toEqual({
      statusId: 2,
      primaryStoreId: 1,
    });
  });

  it("combines all given filters together", () => {
    expect(
      buildMemberWhereClause({ name: "田中", phone: "090", statusId: 2, storeId: 1 }),
    ).toEqual({
      name: { contains: "田中", mode: "insensitive" },
      phone: { contains: "090" },
      statusId: 2,
      primaryStoreId: 1,
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/customer/filter.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/customer/filter.ts`:

```typescript
export interface CustomerFilterCondition {
  name?: string;
  phone?: string;
  statusId?: number;
  storeId?: number;
}

export function buildMemberWhereClause(condition: CustomerFilterCondition) {
  return {
    ...(condition.name
      ? { name: { contains: condition.name, mode: "insensitive" as const } }
      : {}),
    ...(condition.phone ? { phone: { contains: condition.phone } } : {}),
    ...(condition.statusId ? { statusId: condition.statusId } : {}),
    ...(condition.storeId ? { primaryStoreId: condition.storeId } : {}),
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/customer/filter.test.ts
```

Expected: PASS（5 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 5: メール送信（Brevo API）ラッパー（TDD）

**Files:**
- Create: `lib/delivery/send-email.ts`
- Test: `lib/delivery/send-email.test.ts`

### 補足

`BREVO_API_KEY`環境変数が未設定の場合は`fetch`を呼ばず`not_configured`を返す。テストでは`fetch`をグローバルにモックし、実際のネットワーク通信は一切行わない。

- [ ] **Step 1: 失敗するテストを書く**

`lib/delivery/send-email.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "./send-email";

describe("sendEmail", () => {
  const originalApiKey = process.env.BREVO_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = originalApiKey;
    }
  });

  it("returns not_configured and does not call fetch when BREVO_API_KEY is missing", async () => {
    delete process.env.BREVO_API_KEY;

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns sent when the Brevo API responds ok", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "sent" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "api-key": "test-api-key" }),
      }),
    );
  });

  it("returns failed when the Brevo API responds with an error status", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "Brevo API error: 401" });
  });

  it("returns failed when fetch throws", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await sendEmail({ to: "a@example.com", subject: "件名", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "network error" });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/delivery/send-email.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/delivery/send-email.ts`:

```typescript
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export type SendEmailResult =
  | { status: "sent" }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = "no-reply@foresupa.example.com";
const SENDER_NAME = "フォレスパ";

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.body,
      }),
    });

    if (!response.ok) {
      return { status: "failed", error: `Brevo API error: ${response.status}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "unknown error" };
  }
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/delivery/send-email.test.ts
```

Expected: PASS（4 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 6: LINEメッセージ送信（LINE Messaging API）ラッパー（TDD）

**Files:**
- Create: `lib/delivery/send-line.ts`
- Test: `lib/delivery/send-line.test.ts`

### 補足

`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`環境変数（LINEログイン用の`LINE_CLIENT_ID`/`LINE_CLIENT_SECRET`とは別物。LINE公式アカウントのMessaging APIチャネルアクセストークン）が未設定の場合は`fetch`を呼ばず`not_configured`を返す。

- [ ] **Step 1: 失敗するテストを書く**

`lib/delivery/send-line.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendLineMessage } from "./send-line";

describe("sendLineMessage", () => {
  const originalToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) {
      delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
    } else {
      process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = originalToken;
    }
  });

  it("returns not_configured and does not call fetch when the channel access token is missing", async () => {
    delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns sent when the LINE API responds ok", async () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "sent" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("returns failed when the LINE API responds with an error status", async () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "LINE API error: 400" });
  });

  it("returns failed when fetch throws", async () => {
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await sendLineMessage({ lineUserId: "line-user-1", body: "本文" });

    expect(result).toEqual({ status: "failed", error: "network error" });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run lib/delivery/send-line.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`lib/delivery/send-line.ts`:

```typescript
export interface SendLineMessageParams {
  lineUserId: string;
  body: string;
}

export type SendLineMessageResult =
  | { status: "sent" }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function sendLineMessage(
  params: SendLineMessageParams,
): Promise<SendLineMessageResult> {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: params.lineUserId,
        messages: [{ type: "text", text: params.body }],
      }),
    });

    if (!response.ok) {
      return { status: "failed", error: `LINE API error: ${response.status}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "unknown error" };
  }
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run lib/delivery/send-line.test.ts
```

Expected: PASS（4 tests）

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## Task 7: テンプレート管理Server Action（TDD）

**Files:**
- Create: `app/actions/manage-templates.ts`
- Test: `app/actions/manage-templates.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/manage-templates.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listTemplates, createTemplate, updateTemplate } from "./manage-templates";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryTemplate: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe("listTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all templates ordered by newest first", async () => {
    vi.mocked(prisma.deliveryTemplate.findMany).mockResolvedValue([
      {
        id: 2,
        type: "segment",
        name: "夏季キャンペーン",
        subject: "夏の特別クーポン",
        bodyText: "{{氏名}}様へ",
      },
    ] as never);

    const result = await listTemplates();

    expect(result).toEqual([
      {
        id: 2,
        type: "segment",
        name: "夏季キャンペーン",
        subject: "夏の特別クーポン",
        bodyText: "{{氏名}}様へ",
      },
    ]);
    expect(prisma.deliveryTemplate.findMany).toHaveBeenCalledWith({ orderBy: { id: "desc" } });
  });
});

describe("createTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new template and returns its id", async () => {
    vi.mocked(prisma.deliveryTemplate.create).mockResolvedValue({ id: 10 } as never);

    const result = await createTemplate({
      type: "segment",
      name: "新テンプレート",
      subject: "件名",
      bodyText: "{{氏名}}様",
    });

    expect(result).toEqual({ templateId: 10 });
    expect(prisma.deliveryTemplate.create).toHaveBeenCalledWith({
      data: { type: "segment", name: "新テンプレート", subject: "件名", bodyText: "{{氏名}}様" },
    });
  });
});

describe("updateTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates name, subject, and bodyText", async () => {
    vi.mocked(prisma.deliveryTemplate.update).mockResolvedValue({} as never);

    await updateTemplate({
      templateId: 10,
      name: "更新後の名前",
      subject: "更新後の件名",
      bodyText: "更新後の本文",
    });

    expect(prisma.deliveryTemplate.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { name: "更新後の名前", subject: "更新後の件名", bodyText: "更新後の本文" },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/manage-templates.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/manage-templates.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export type DeliveryTemplateType = "birthday" | "reminder" | "segment";

export interface TemplateListItem {
  id: number;
  type: DeliveryTemplateType;
  name: string;
  subject: string | null;
  bodyText: string;
}

export async function listTemplates(): Promise<TemplateListItem[]> {
  const templates = await prisma.deliveryTemplate.findMany({ orderBy: { id: "desc" } });
  return templates.map((t) => ({
    id: t.id,
    type: t.type,
    name: t.name,
    subject: t.subject,
    bodyText: t.bodyText,
  }));
}

export interface CreateTemplateParams {
  type: DeliveryTemplateType;
  name: string;
  subject: string | null;
  bodyText: string;
}

export async function createTemplate(
  params: CreateTemplateParams,
): Promise<{ templateId: number }> {
  const template = await prisma.deliveryTemplate.create({
    data: {
      type: params.type,
      name: params.name,
      subject: params.subject,
      bodyText: params.bodyText,
    },
  });
  return { templateId: template.id };
}

export interface UpdateTemplateParams {
  templateId: number;
  name: string;
  subject: string | null;
  bodyText: string;
}

export async function updateTemplate(params: UpdateTemplateParams): Promise<void> {
  await prisma.deliveryTemplate.update({
    where: { id: params.templateId },
    data: { name: params.name, subject: params.subject, bodyText: params.bodyText },
  });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/manage-templates.test.ts
```

Expected: PASS（3 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 8: 配信対象人数プレビューServer Action（TDD）

**Files:**
- Create: `app/actions/segment-audience.ts`
- Test: `app/actions/segment-audience.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/segment-audience.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { previewSegmentAudience } from "./segment-audience";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
  },
}));

const MEMBERS = [{ lineUserId: "line-1" }, { lineUserId: "line-2" }, { lineUserId: null }];

describe("previewSegmentAudience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("splits into line/email counts for auto mode", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue(MEMBERS as never);

    const result = await previewSegmentAudience({}, "auto");

    expect(result).toEqual({ totalCount: 3, lineCount: 2, emailCount: 1 });
  });

  it("counts everyone as email for email mode", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue(MEMBERS as never);

    const result = await previewSegmentAudience({}, "email");

    expect(result).toEqual({ totalCount: 3, lineCount: 0, emailCount: 3 });
  });

  it("excludes non-LINE-linked members entirely for line mode", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue(MEMBERS as never);

    const result = await previewSegmentAudience({}, "line");

    expect(result).toEqual({ totalCount: 2, lineCount: 2, emailCount: 0 });
  });

  it("passes the condition through to the where clause", async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);

    await previewSegmentAudience({ name: "田中", statusId: 2, storeId: 1 }, "auto");

    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: "田中", mode: "insensitive" },
        statusId: 2,
        primaryStoreId: 1,
      },
      select: { lineUserId: true },
    });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/segment-audience.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/segment-audience.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";
import { buildMemberWhereClause, type CustomerFilterCondition } from "@/lib/customer/filter";

export type SegmentChannelMode = "email" | "line" | "auto";
export type SegmentCondition = CustomerFilterCondition;

export interface AudiencePreview {
  totalCount: number;
  lineCount: number;
  emailCount: number;
}

export async function previewSegmentAudience(
  condition: SegmentCondition,
  channelMode: SegmentChannelMode,
): Promise<AudiencePreview> {
  const members = await prisma.member.findMany({
    where: buildMemberWhereClause(condition),
    select: { lineUserId: true },
  });

  const eligible =
    channelMode === "line" ? members.filter((m) => m.lineUserId !== null) : members;

  const lineCount =
    channelMode === "email" ? 0 : eligible.filter((m) => m.lineUserId !== null).length;
  const emailCount = channelMode === "line" ? 0 : eligible.length - lineCount;

  return {
    totalCount: eligible.length,
    lineCount,
    emailCount,
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/segment-audience.test.ts
```

Expected: PASS（4 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 9: セグメント配信作成・履歴Server Action（TDD）

**Files:**
- Create: `app/actions/segment-campaigns.ts`
- Test: `app/actions/segment-campaigns.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/segment-campaigns.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSegmentCampaign, listSegmentCampaigns } from "./segment-campaigns";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/delivery/send-email";
import { sendLineMessage } from "@/lib/delivery/send-line";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findMany: vi.fn() },
    segmentCampaign: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    deliveryTemplate: { findUniqueOrThrow: vi.fn() },
    emailLineLog: { create: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/delivery/send-email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/delivery/send-line", () => ({
  sendLineMessage: vi.fn(),
}));

describe("createSegmentCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await createSegmentCampaign({
      name: "テスト配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("rejects a non-admin session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "member" } } as never);

    const result = await createSegmentCampaign({
      name: "テスト配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: null,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it("creates a record without sending when scheduledAt is given", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: null },
    ] as never);
    vi.mocked(prisma.segmentCampaign.create).mockResolvedValue({ id: 100 } as never);

    const result = await createSegmentCampaign({
      name: "予約配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: "2026-10-01T09:00:00.000Z",
    });

    expect(result).toEqual({ status: "scheduled", campaignId: 100, targetCount: 1 });
    expect(prisma.segmentCampaign.create).toHaveBeenCalledWith({
      data: {
        name: "予約配信",
        conditionJson: {},
        channelMode: "auto",
        templateId: 1,
        scheduledAt: new Date("2026-10-01T09:00:00.000Z"),
        targetCount: 1,
        createdByAdminId: 9,
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendLineMessage).not.toHaveBeenCalled();
    expect(prisma.emailLineLog.create).not.toHaveBeenCalled();
  });

  it("sends immediately and logs success/failure per member when scheduledAt is null", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: "line-1" },
      { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null },
    ] as never);
    vi.mocked(prisma.segmentCampaign.create).mockResolvedValue({ id: 101 } as never);
    vi.mocked(prisma.deliveryTemplate.findUniqueOrThrow).mockResolvedValue({
      id: 1,
      subject: "{{氏名}}様への大切なお知らせ",
      bodyText: "{{氏名}}様、いつもありがとうございます。",
    } as never);
    vi.mocked(sendLineMessage).mockResolvedValue({ status: "sent" });
    vi.mocked(sendEmail).mockResolvedValue({ status: "failed", error: "boom" });
    vi.mocked(prisma.emailLineLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.segmentCampaign.update).mockResolvedValue({} as never);

    const result = await createSegmentCampaign({
      name: "即時配信",
      condition: {},
      channelMode: "auto",
      templateId: 1,
      scheduledAt: null,
    });

    expect(result).toEqual({
      status: "sent",
      campaignId: 101,
      targetCount: 2,
      sentCount: 1,
      failedCount: 1,
    });

    expect(sendLineMessage).toHaveBeenCalledWith({
      lineUserId: "line-1",
      body: "山田太郎様、いつもありがとうございます。",
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "suzuki@example.com",
      subject: "鈴木花子様への大切なお知らせ",
      body: "鈴木花子様、いつもありがとうございます。",
    });

    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 1,
        channel: "line",
        templateType: "segment",
        segmentCampaignId: 101,
        subject: null,
        sentAt: expect.any(Date),
        status: "success",
      },
    });
    expect(prisma.emailLineLog.create).toHaveBeenCalledWith({
      data: {
        memberId: 2,
        channel: "email",
        templateType: "segment",
        segmentCampaignId: 101,
        subject: "鈴木花子様への大切なお知らせ",
        sentAt: expect.any(Date),
        status: "failed",
      },
    });

    expect(prisma.segmentCampaign.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { sentAt: expect.any(Date) },
    });
  });

  it("excludes non-LINE-linked members from the target list in line-only mode", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "hq" } } as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([
      { id: 1, name: "山田太郎", email: "yamada@example.com", lineUserId: "line-1" },
      { id: 2, name: "鈴木花子", email: "suzuki@example.com", lineUserId: null },
    ] as never);
    vi.mocked(prisma.segmentCampaign.create).mockResolvedValue({ id: 102 } as never);

    const result = await createSegmentCampaign({
      name: "LINE限定配信",
      condition: {},
      channelMode: "line",
      templateId: 1,
      scheduledAt: "2026-10-01T09:00:00.000Z",
    });

    expect(result).toEqual({ status: "scheduled", campaignId: 102, targetCount: 1 });
  });
});

describe("listSegmentCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns campaign history with the template name", async () => {
    vi.mocked(prisma.segmentCampaign.findMany).mockResolvedValue([
      {
        id: 1,
        name: "夏季キャンペーン",
        channelMode: "auto",
        targetCount: 50,
        scheduledAt: null,
        sentAt: new Date("2026-09-01T09:00:00.000Z"),
        template: { name: "夏の特別クーポン" },
      },
    ] as never);

    const result = await listSegmentCampaigns();

    expect(result).toEqual([
      {
        id: 1,
        name: "夏季キャンペーン",
        channelMode: "auto",
        templateName: "夏の特別クーポン",
        targetCount: 50,
        scheduledAt: null,
        sentAt: "2026-09-01T09:00:00.000Z",
      },
    ]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/segment-campaigns.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/segment-campaigns.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildMemberWhereClause, type CustomerFilterCondition } from "@/lib/customer/filter";
import { renderTemplate } from "@/lib/delivery/render-template";
import { resolveMemberChannel } from "@/lib/delivery/resolve-channel";
import { sendEmail } from "@/lib/delivery/send-email";
import { sendLineMessage } from "@/lib/delivery/send-line";

export type SegmentChannelMode = "email" | "line" | "auto";
export type SegmentCondition = CustomerFilterCondition;

export interface CreateSegmentCampaignParams {
  name: string;
  condition: SegmentCondition;
  channelMode: SegmentChannelMode;
  templateId: number;
  scheduledAt: string | null;
}

export type CreateSegmentCampaignResult =
  | { status: "unauthorized" }
  | { status: "scheduled"; campaignId: number; targetCount: number }
  | {
      status: "sent";
      campaignId: number;
      targetCount: number;
      sentCount: number;
      failedCount: number;
    };

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export async function createSegmentCampaign(
  params: CreateSegmentCampaignParams,
): Promise<CreateSegmentCampaignResult> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    return { status: "unauthorized" };
  }
  const adminId = Number(session.user.id);

  const members = await prisma.member.findMany({
    where: buildMemberWhereClause(params.condition),
  });
  const targets =
    params.channelMode === "line" ? members.filter((m) => m.lineUserId !== null) : members;

  const campaign = await prisma.segmentCampaign.create({
    data: {
      name: params.name,
      conditionJson: params.condition,
      channelMode: params.channelMode,
      templateId: params.templateId,
      scheduledAt: params.scheduledAt ? new Date(params.scheduledAt) : null,
      targetCount: targets.length,
      createdByAdminId: adminId,
    },
  });

  if (params.scheduledAt) {
    return { status: "scheduled", campaignId: campaign.id, targetCount: targets.length };
  }

  const template = await prisma.deliveryTemplate.findUniqueOrThrow({
    where: { id: params.templateId },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const member of targets) {
    const channel = resolveMemberChannel(params.channelMode, member.lineUserId);
    const body = renderTemplate(template.bodyText, { 氏名: member.name });

    let success: boolean;
    let logSubject: string | null = null;

    if (channel === "line") {
      const sendResult = await sendLineMessage({
        lineUserId: member.lineUserId as string,
        body,
      });
      success = sendResult.status === "sent";
    } else {
      const subject = template.subject
        ? renderTemplate(template.subject, { 氏名: member.name })
        : "";
      logSubject = subject || null;
      const sendResult = await sendEmail({ to: member.email, subject, body });
      success = sendResult.status === "sent";
    }

    if (success) sentCount += 1;
    else failedCount += 1;

    await prisma.emailLineLog.create({
      data: {
        memberId: member.id,
        channel,
        templateType: "segment",
        segmentCampaignId: campaign.id,
        subject: logSubject,
        sentAt: new Date(),
        status: success ? "success" : "failed",
      },
    });
  }

  await prisma.segmentCampaign.update({
    where: { id: campaign.id },
    data: { sentAt: new Date() },
  });

  return {
    status: "sent",
    campaignId: campaign.id,
    targetCount: targets.length,
    sentCount,
    failedCount,
  };
}

export interface SegmentCampaignListItem {
  id: number;
  name: string;
  channelMode: SegmentChannelMode;
  templateName: string;
  targetCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
}

export async function listSegmentCampaigns(): Promise<SegmentCampaignListItem[]> {
  const campaigns = await prisma.segmentCampaign.findMany({
    include: { template: true },
    orderBy: { createdAt: "desc" },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    channelMode: c.channelMode,
    templateName: c.template.name,
    targetCount: c.targetCount,
    scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
    sentAt: c.sentAt ? c.sentAt.toISOString() : null,
  }));
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/segment-campaigns.test.ts
```

Expected: PASS（6 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 10: 自動配信設定Server Action（TDD）

**Files:**
- Create: `app/actions/auto-delivery-settings.ts`
- Test: `app/actions/auto-delivery-settings.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/auto-delivery-settings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAutoDeliverySettings, upsertAutoDeliverySetting } from "./auto-delivery-settings";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    autoDeliverySetting: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("listAutoDeliverySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all settings with the template name", async () => {
    vi.mocked(prisma.autoDeliverySetting.findMany).mockResolvedValue([
      {
        id: 1,
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        isActive: true,
        template: { name: "誕生月クーポン" },
      },
    ] as never);

    const result = await listAutoDeliverySettings();

    expect(result).toEqual([
      {
        id: 1,
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        templateName: "誕生月クーポン",
        isActive: true,
      },
    ]);
    expect(prisma.autoDeliverySetting.findMany).toHaveBeenCalledWith({
      include: { template: true },
      orderBy: { id: "asc" },
    });
  });
});

describe("upsertAutoDeliverySetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new setting when none exists for the type", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.autoDeliverySetting.create).mockResolvedValue({} as never);

    await upsertAutoDeliverySetting({
      type: "birthday",
      channelMode: "auto",
      sendTiming: "month_start",
      templateId: 5,
      isActive: true,
    });

    expect(prisma.autoDeliverySetting.create).toHaveBeenCalledWith({
      data: {
        type: "birthday",
        channelMode: "auto",
        sendTiming: "month_start",
        templateId: 5,
        isActive: true,
      },
    });
  });

  it("updates the existing setting when one already exists for the type", async () => {
    vi.mocked(prisma.autoDeliverySetting.findFirst).mockResolvedValue({ id: 3 } as never);
    vi.mocked(prisma.autoDeliverySetting.update).mockResolvedValue({} as never);

    await upsertAutoDeliverySetting({
      type: "reminder",
      channelMode: "email",
      sendTiming: "18:00_day_before",
      templateId: 6,
      isActive: false,
    });

    expect(prisma.autoDeliverySetting.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        channelMode: "email",
        sendTiming: "18:00_day_before",
        templateId: 6,
        isActive: false,
      },
    });
    expect(prisma.autoDeliverySetting.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

```bash
npx vitest run app/actions/auto-delivery-settings.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`app/actions/auto-delivery-settings.ts`:

```typescript
"use server";

import { prisma } from "@/lib/db";

export type AutoDeliveryType = "birthday" | "reminder";
export type ChannelMode = "email" | "line" | "auto";

export interface AutoDeliverySettingItem {
  id: number;
  type: AutoDeliveryType;
  channelMode: ChannelMode;
  sendTiming: string;
  templateId: number;
  templateName: string;
  isActive: boolean;
}

export async function listAutoDeliverySettings(): Promise<AutoDeliverySettingItem[]> {
  const settings = await prisma.autoDeliverySetting.findMany({
    include: { template: true },
    orderBy: { id: "asc" },
  });
  return settings.map((s) => ({
    id: s.id,
    type: s.type,
    channelMode: s.channelMode,
    sendTiming: s.sendTiming,
    templateId: s.templateId,
    templateName: s.template.name,
    isActive: s.isActive,
  }));
}

export interface UpsertAutoDeliverySettingParams {
  type: AutoDeliveryType;
  channelMode: ChannelMode;
  sendTiming: string;
  templateId: number;
  isActive: boolean;
}

export async function upsertAutoDeliverySetting(
  params: UpsertAutoDeliverySettingParams,
): Promise<void> {
  const existing = await prisma.autoDeliverySetting.findFirst({ where: { type: params.type } });

  if (existing) {
    await prisma.autoDeliverySetting.update({
      where: { id: existing.id },
      data: {
        channelMode: params.channelMode,
        sendTiming: params.sendTiming,
        templateId: params.templateId,
        isActive: params.isActive,
      },
    });
  } else {
    await prisma.autoDeliverySetting.create({
      data: {
        type: params.type,
        channelMode: params.channelMode,
        sendTiming: params.sendTiming,
        templateId: params.templateId,
        isActive: params.isActive,
      },
    });
  }
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

```bash
npx vitest run app/actions/auto-delivery-settings.test.ts
```

Expected: PASS（3 tests）

- [ ] **Step 5: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 変更ファイルを報告する（コミットしない）**

---

## Task 11: 配信テンプレート管理画面（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/templates/page.tsx`

- [ ] **Step 1: 実装する**

`app/admin/(dashboard)/templates/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  type TemplateListItem,
  type DeliveryTemplateType,
} from "@/app/actions/manage-templates";

const TYPE_LABEL: Record<DeliveryTemplateType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
  segment: "セグメント配信",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    type: "segment" as DeliveryTemplateType,
    name: "",
    subject: "",
    bodyText: "",
  });
  const [saving, setSaving] = useState(false);

  function refresh() {
    listTemplates().then(setTemplates);
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(t: TemplateListItem) {
    setEditingId(t.id);
    setForm({ type: t.type, name: t.name, subject: t.subject ?? "", bodyText: t.bodyText });
  }

  function startCreate() {
    setEditingId(null);
    setForm({ type: "segment", name: "", subject: "", bodyText: "" });
  }

  async function handleSave() {
    setSaving(true);
    if (editingId) {
      await updateTemplate({
        templateId: editingId,
        name: form.name,
        subject: form.subject || null,
        bodyText: form.bodyText,
      });
    } else {
      await createTemplate({
        type: form.type,
        name: form.name,
        subject: form.subject || null,
        bodyText: form.bodyText,
      });
    }
    setSaving(false);
    startCreate();
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">配信テンプレート管理</h1>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
        <h2 className="text-sm font-medium text-neutral-600">
          {editingId ? "テンプレートを編集" : "新規テンプレートを作成"}
        </h2>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as DeliveryTemplateType })}
          disabled={editingId !== null}
          className="h-10 rounded-md border border-neutral-300 px-2"
        >
          <option value="segment">セグメント配信</option>
          <option value="birthday">誕生月メール</option>
          <option value="reminder">前日リマインド</option>
        </select>
        <input
          type="text"
          placeholder="テンプレート名"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-10 rounded-md border border-neutral-300 px-2"
        />
        <input
          type="text"
          placeholder="件名（メール用。LINEのみの場合は空欄可）"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="h-10 rounded-md border border-neutral-300 px-2"
        />
        <textarea
          placeholder="本文（差し込みタグ：{{氏名}} が利用できます）"
          value={form.bodyText}
          onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
          rows={5}
          className="rounded-md border border-neutral-300 px-2 py-2"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || !form.name || !form.bodyText}
            onClick={handleSave}
            className="h-10 rounded-lg bg-primary-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "作成する"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="h-10 rounded-lg border border-neutral-300 px-4 text-neutral-600"
            >
              新規作成に戻る
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">種別</th>
              <th className="p-3">名称</th>
              <th className="p-3">件名</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{TYPE_LABEL[t.type]}</td>
                <td className="p-3">{t.name}</td>
                <td className="p-3 text-neutral-500">{t.subject ?? "—"}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    className="text-primary-600 underline"
                  >
                    編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 12: メール／LINE配信管理画面 A-09（軽量検証）

**Files:**
- Create: `app/admin/(dashboard)/segment-campaigns/page.tsx`

- [ ] **Step 1: 実装する**

`app/admin/(dashboard)/segment-campaigns/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  previewSegmentAudience,
  type SegmentChannelMode,
  type AudiencePreview,
} from "@/app/actions/segment-audience";
import {
  createSegmentCampaign,
  listSegmentCampaigns,
  type SegmentCampaignListItem,
} from "@/app/actions/segment-campaigns";
import { listTemplates, type TemplateListItem } from "@/app/actions/manage-templates";
import { listCustomerStatuses, type CustomerStatusItem } from "@/app/actions/customer-statuses";
import { listStores, type StoreListItem } from "@/app/actions/stores";

const CHANNEL_LABEL: Record<SegmentChannelMode, string> = {
  email: "メール",
  line: "LINE",
  auto: "両方（自動振り分け）",
};

export default function SegmentCampaignsPage() {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [history, setHistory] = useState<SegmentCampaignListItem[]>([]);

  const [name, setName] = useState("");
  const [statusId, setStatusId] = useState<number | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [channelMode, setChannelMode] = useState<SegmentChannelMode>("auto");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function refreshHistory() {
    listSegmentCampaigns().then(setHistory);
  }

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
    listTemplates().then((all) => setTemplates(all.filter((t) => t.type === "segment")));
    refreshHistory();
  }, []);

  async function handlePreview() {
    setPreviewing(true);
    const result = await previewSegmentAudience(
      { name: name || undefined, statusId: statusId ?? undefined, storeId: storeId ?? undefined },
      channelMode,
    );
    setPreview(result);
    setPreviewing(false);
  }

  async function handleSend() {
    if (!templateId) return;
    setSending(true);
    setResultMessage(null);
    const result = await createSegmentCampaign({
      name: campaignName,
      condition: {
        name: name || undefined,
        statusId: statusId ?? undefined,
        storeId: storeId ?? undefined,
      },
      channelMode,
      templateId,
      scheduledAt: scheduledAt || null,
    });
    setSending(false);

    if (result.status === "unauthorized") {
      setResultMessage("権限がありません。");
    } else if (result.status === "scheduled") {
      setResultMessage(`${result.targetCount}名への配信を予約しました。`);
    } else {
      setResultMessage(
        `配信完了：成功${result.sentCount}件／失敗${result.failedCount}件（対象${result.targetCount}件）`,
      );
    }
    refreshHistory();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">メール／LINE配信管理</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
        <h2 className="text-sm font-medium text-neutral-600">配信対象の条件</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="氏名で絞り込み"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <select
            value={statusId ?? ""}
            onChange={(e) => setStatusId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">すべてのステータス</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={storeId ?? ""}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">全店舗</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-sm font-medium text-neutral-600">配信チャネル</h2>
        <select
          value={channelMode}
          onChange={(e) => setChannelMode(e.target.value as SegmentChannelMode)}
          className="h-10 w-60 rounded-md border border-neutral-300 px-2"
        >
          <option value="auto">両方（自動振り分け）</option>
          <option value="email">メール</option>
          <option value="line">LINE</option>
        </select>

        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing}
          className="h-10 w-40 rounded-lg border border-primary-500 text-primary-600 disabled:opacity-50"
        >
          対象人数を確認
        </button>
        {preview && (
          <p className="text-sm text-neutral-700">
            {preview.totalCount}名に配信されます（うちLINE {preview.lineCount}名／メール{" "}
            {preview.emailCount}名）
          </p>
        )}

        <h2 className="text-sm font-medium text-neutral-600">配信内容</h2>
        <select
          value={templateId ?? ""}
          onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-2"
        >
          <option value="">テンプレートを選択</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <a href="/admin/templates" className="text-sm text-primary-600 underline">
          ＋新しいテンプレートを作成する
        </a>
        <input
          type="text"
          placeholder="配信名（管理用）"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-2"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">配信日時（空欄の場合は即時配信）</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="h-10 w-64 rounded-md border border-neutral-300 px-2"
          />
        </div>

        {resultMessage && <p className="text-sm text-neutral-700">{resultMessage}</p>}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !templateId || !campaignName}
          className="h-12 rounded-lg bg-accent-500 px-4 font-medium text-white disabled:opacity-50"
        >
          {scheduledAt ? "配信を予約する" : "今すぐ配信する"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">配信履歴</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">配信名</th>
                <th className="p-3">チャネル</th>
                <th className="p-3">テンプレート</th>
                <th className="p-3">対象人数</th>
                <th className="p-3">予約日時</th>
                <th className="p-3">送信日時</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">{h.name}</td>
                  <td className="p-3">{CHANNEL_LABEL[h.channelMode]}</td>
                  <td className="p-3">{h.templateName}</td>
                  <td className="p-3">{h.targetCount}名</td>
                  <td className="p-3">{h.scheduledAt ?? "—"}</td>
                  <td className="p-3">{h.sentAt ?? "未送信"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェックとLintを実行する**

```bash
npx tsc --noEmit
npx eslint .
```

- [ ] **Step 3: 変更ファイルを報告する（コミットしない）**

---

## Task 13: 自動配信設定画面 A-10（軽量検証）＋サイドバーリンク追加

**Files:**
- Create: `app/admin/(dashboard)/auto-delivery/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: 実装する**

`app/admin/(dashboard)/auto-delivery/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  listAutoDeliverySettings,
  upsertAutoDeliverySetting,
  type AutoDeliveryType,
  type ChannelMode,
  type AutoDeliverySettingItem,
} from "@/app/actions/auto-delivery-settings";
import { listTemplates, type TemplateListItem } from "@/app/actions/manage-templates";

const TYPE_LABEL: Record<AutoDeliveryType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
};

interface SectionState {
  channelMode: ChannelMode;
  sendTiming: string;
  templateId: number | null;
  isActive: boolean;
}

function toSectionState(
  setting: AutoDeliverySettingItem | undefined,
  defaultTiming: string,
): SectionState {
  return {
    channelMode: setting?.channelMode ?? "auto",
    sendTiming: setting?.sendTiming ?? defaultTiming,
    templateId: setting?.templateId ?? null,
    isActive: setting?.isActive ?? true,
  };
}

export default function AutoDeliveryPage() {
  const [settings, setSettings] = useState<AutoDeliverySettingItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [birthday, setBirthday] = useState<SectionState>(toSectionState(undefined, "month_start"));
  const [reminder, setReminder] = useState<SectionState>(
    toSectionState(undefined, "18:00_day_before"),
  );
  const [saving, setSaving] = useState<AutoDeliveryType | null>(null);

  function refresh() {
    listAutoDeliverySettings().then((all) => {
      setSettings(all);
      setBirthday(toSectionState(all.find((s) => s.type === "birthday"), "month_start"));
      setReminder(toSectionState(all.find((s) => s.type === "reminder"), "18:00_day_before"));
    });
  }

  useEffect(() => {
    refresh();
    listTemplates().then((all) =>
      setTemplates(all.filter((t) => t.type === "birthday" || t.type === "reminder")),
    );
  }, []);

  async function handleSave(type: AutoDeliveryType, state: SectionState) {
    if (!state.templateId) return;
    setSaving(type);
    await upsertAutoDeliverySetting({
      type,
      channelMode: state.channelMode,
      sendTiming: state.sendTiming,
      templateId: state.templateId,
      isActive: state.isActive,
    });
    setSaving(null);
    refresh();
  }

  function renderSection(
    type: AutoDeliveryType,
    state: SectionState,
    setState: (s: SectionState) => void,
    timingPlaceholder: string,
  ) {
    const relevantTemplates = templates.filter((t) => t.type === type);
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
        <h2 className="text-sm font-medium text-neutral-600">{TYPE_LABEL[type]}</h2>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={state.isActive}
            onChange={(e) => setState({ ...state, isActive: e.target.checked })}
          />
          有効にする
        </label>
        <select
          value={state.channelMode}
          onChange={(e) => setState({ ...state, channelMode: e.target.value as ChannelMode })}
          className="h-10 rounded-md border border-neutral-300 px-2"
        >
          <option value="auto">両方（自動振り分け）</option>
          <option value="email">メール</option>
          <option value="line">LINE</option>
        </select>
        <input
          type="text"
          placeholder={timingPlaceholder}
          value={state.sendTiming}
          onChange={(e) => setState({ ...state, sendTiming: e.target.value })}
          className="h-10 rounded-md border border-neutral-300 px-2"
        />
        <select
          value={state.templateId ?? ""}
          onChange={(e) =>
            setState({ ...state, templateId: e.target.value ? Number(e.target.value) : null })
          }
          className="h-10 rounded-md border border-neutral-300 px-2"
        >
          <option value="">テンプレートを選択</option>
          {relevantTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <a href="/admin/templates" className="text-sm text-primary-600 underline">
          ＋新しいテンプレートを作成する
        </a>
        <button
          type="button"
          disabled={saving === type || !state.templateId}
          onClick={() => handleSave(type, state)}
          className="h-10 w-32 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
        >
          保存する
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">自動配信設定</h1>
      <p className="text-sm text-neutral-500">
        実際の送信はCronジョブ（A-13）による定期実行が必要です。ここでは設定の保存のみ行います。
      </p>
      {renderSection("birthday", birthday, setBirthday, "例：month_start")}
      {renderSection("reminder", reminder, setReminder, "例：18:00_day_before")}
      {settings.length === 0 && (
        <p className="text-sm text-neutral-500">
          まだ設定がありません。テンプレートを選択して保存してください。
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: サイドバーにリンクを追加する**

`app/admin/(dashboard)/layout.tsx`の`<nav>`内、「売上・月報レポート」リンクの後に以下を追加する:

```tsx
          <Link
            href="/admin/segment-campaigns"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            メール／LINE配信管理
          </Link>
          <Link
            href="/admin/auto-delivery"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            自動配信設定
          </Link>
          <Link
            href="/admin/templates"
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-primary-50"
          >
            配信テンプレート管理
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

Expected: 既存165テスト＋新規36テスト（Task2:5, Task3:7, Task4:5, Task5:4, Task6:4, Task7:3, Task8:4, Task9:6, Task10:3）＝201テストがパスする

- [ ] **Step 5: 変更ファイルを報告する（コミットしない）**

---

## 完了確認チェックリスト

- [ ] `npx vitest run` の全テストがパスする（`lib/auth/`・`update-member-profile`のbcryptタイムアウトによる既知のフラーキーさを除く）
- [ ] `npx tsc --noEmit` がエラーなく通る
- [ ] `npx eslint .` がエラーなく通る
- [ ] ユーザーのターミナルで`npx prisma migrate dev`を実行し、`delivery_templates`テーブルが追加されることを確認する
- [ ] `/admin/templates`でテンプレート作成・編集ができることをユーザーがブラウザで確認する
- [ ] `/admin/segment-campaigns`で対象人数プレビュー・即時配信（`BREVO_API_KEY`/`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`未設定時は`failed`ログが記録されることを含む）を確認する
- [ ] `/admin/auto-delivery`で誕生月・前日リマインド設定の保存ができることを確認する
- [ ] 実際にBrevo/LINEへ送信テストする場合は、`.env`に`BREVO_API_KEY`・`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`を追加し、ユーザーの環境で`npm run dev`を起動して確認する

---

## 実装後の修正（自動セキュリティレビューによる指摘への対応）

Task 1〜13完了後、自動セキュリティレビューで以下5件が指摘され、いずれも妥当と判断しその場で修正した：

1. **`manage-templates.ts`の`listTemplates`/`createTemplate`/`updateTemplate`に認可チェックがなかった**：Server Actionはページのミドルウェアガードとは独立して直接呼び出せるため、`createSegmentCampaign`と同じ管理者ロールチェック（`session.user.role`が`hq`/`manager`/`staff`のいずれか）を追加し、非該当時は`Error("unauthorized")`をthrowするようにした。対応するテストに非管理者セッションを拒否するケースを追加。
2. **`segment-audience.ts`の`previewSegmentAudience`に認可チェックがなかった**：会員の氏名・LINE連携有無を条件検索できてしまう情報漏洩リスクのため、同様に管理者チェックを追加。
3. **`segment-campaigns.ts`の`listSegmentCampaigns`に認可チェックがなかった**（`createSegmentCampaign`にはあったが兄弟関数に漏れていた）：同様に追加。
4. **`auto-delivery-settings.ts`の`listAutoDeliverySettings`/`upsertAutoDeliverySetting`に認可チェックがなかった**：同様に追加。
5. **`send-email.ts`がBrevoに`htmlContent`として本文を送信していた**：テンプレート本文は`<textarea>`によるプレーンテキスト編集のみで、HTML入力欄は用意していない。差し込みタグ（`{{氏名}}`等）に会員が自由入力した氏名がそのまま入るため、HTMLとして解釈されるとインジェクションのリスクがある。`textContent`に変更した。

**注意**：既存の管理系Server Action（`manage-campaigns.ts`・`manage-courses.ts`・`manage-staff.ts`・`manage-stores.ts`・`customer-statuses.ts`・`search-customers.ts`・`customer-detail.ts`・`dashboard-summary.ts`・`calendar-reservations.ts`・`sales-report.ts`等）にも同様に認可チェックがなく、`middleware.ts`のルートガードのみに依存している。これはこのPhaseより前から存在する設計上のギャップで、今回は指摘された新規4ファイルのみを修正し、既存ファイルへの遡及適用はスコープ外とした（別途まとめて対応するかはユーザーに確認が必要）。
