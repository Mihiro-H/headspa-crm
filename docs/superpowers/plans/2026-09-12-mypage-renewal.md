# マイページ／ログイン画面リニューアル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログイン画面とマイページ（`/mypage/*`）のUIを、承認済み設計書（`docs/superpowers/specs/2026-09-12-mypage-renewal-design.md`）に沿って刷新する。

**Architecture:** 既存のNext.js App Router構成（クライアントコンポーネントのページ＋`"use server"`サーバーアクション）をそのまま踏襲する。新規ロジックはサーバーアクション層に置き、ページコンポーネントは表示とアクション呼び出しに専念させる。既存の`cancelMemberReservation`等のアクションはそのまま再利用し、重複実装しない。

**Tech Stack:** Next.js (App Router) / React / TypeScript / Tailwind CSS v4 / Prisma / NextAuth v5 beta / Vitest + @testing-library/react

---

## 前提知識（実装者向け）

- サーバーアクションのテストは`vi.mock("@/lib/db", ...)`と`vi.mock("@/auth", ...)`でモックする既存パターンに従うこと（`app/actions/member-reservation-history.test.ts`等を参照）。
- 認可パターンは全て共通：`const session = await auth(); if (!session?.user || session.user.role !== "member") return null;`
- 日付は`YYYY-MM-DD`文字列でやり取りし、表示時は`lib/reservation/date-format.ts`の`formatJapaneseDate`を使う。
- 時刻は`lib/reservation/time.ts`の`dbTimeToMinutes` / `minutesToLabel`を使う。
- ロゴ画像は`public/logo/foresupa_logo_tight.png`（1206x600px）。既存の使用例：`app/admin/(dashboard)/layout.tsx`。
- 各タスックの最後に`npx tsc --noEmit -p tsconfig.json`を実行し、新規の型エラーが出ていないことを確認すること（既存の無関係な2件のエラーは無視してよい：`app/actions/current-admin-scope.test.ts(44,39)`と`app/actions/manage-permissions.ts(19,42)`）。

---

### Task 1: ログイン画面（会員／管理者）のレイアウトとロゴ変更

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/admin/login/page.tsx`
- Test: `app/login/page.test.tsx`（既存、変更不要・再実行のみ）
- Test: `app/admin/login/page.test.tsx`（既存、変更不要・再実行のみ）

このタスクは新しいロジックを追加しないため（レイアウト変更のみ）、TDDの新規テストは書かない。既存テストがレイアウト変更後も通ることを確認する。

- [ ] **Step 1: `app/login/page.tsx`を編集する**

`"use client";`の直後のimport群に`Image`を追加する：

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
```

返り値のルート`<div>`とその直下の見出しを次のように置き換える（`justify-center`→`justify-start`＋上部余白、見出しをロゴ画像に）：

```tsx
  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-start gap-4 p-4 pt-16">
      <Image
        src="/logo/foresupa_logo_tight.png"
        alt="フォレスパ"
        width={1206}
        height={600}
        className="h-auto w-40"
        priority
      />
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
```

（この後の`LINEで連携ログイン`ボタン以降は変更しない。）

- [ ] **Step 2: `app/admin/login/page.tsx`を編集する**

importに`Image`を追加：

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
```

返り値のルート`<div>`と見出しを次のように置き換える。ロゴ単体だと会員ログイン画面と見分けがつかなくなるため、ロゴの下に小さく「管理画面」ラベルを残す：

```tsx
  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-start gap-4 p-4 pt-16">
      <div className="flex flex-col gap-1">
        <Image
          src="/logo/foresupa_logo_tight.png"
          alt="フォレスパ"
          width={1206}
          height={600}
          className="h-auto w-40"
          priority
        />
        <p className="text-sm text-neutral-500">管理画面</p>
      </div>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
```

（この後の入力欄・ボタンは変更しない。）

- [ ] **Step 3: 既存テストを実行して壊れていないことを確認する**

Run: `npx vitest run app/login/page.test.tsx app/admin/login/page.test.tsx`
Expected: `Test Files 2 passed (2)` / `Tests 4 passed (4)`

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーが出ないこと

- [ ] **Step 5: コミット**

```bash
git add app/login/page.tsx app/admin/login/page.tsx
git commit -m "feat: top-align login pages and use brand logo image

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 2: マイページ共通ヘッダー＋下部ナビ再構成

**Files:**
- Modify: `app/mypage/layout.tsx`

- [ ] **Step 1: `app/mypage/layout.tsx`を全面的に書き換える**

現在の内容全体を次の内容に置き換える：

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Bell, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/mypage", label: "ホーム", icon: Home },
  { href: "/mypage/history", label: "来店履歴", icon: Clock },
  { href: "/mypage/notifications", label: "お知らせ", icon: Bell },
  { href: "/mypage/profile", label: "設定", icon: Settings },
];

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full min-h-dvh max-w-md flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/*
        固定ヘッダー。ロゴのみを左揃えで表示する。
        pt-[env(safe-area-inset-top)]でノッチ等との重なりを避ける。
      */}
      <header className="fixed top-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-b border-neutral-200 bg-neutral-0 px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center">
          <Image
            src="/logo/foresupa_logo_tight.png"
            alt="フォレスパ"
            width={1206}
            height={600}
            className="h-auto w-28"
            priority
          />
        </div>
      </header>

      <main className="flex-1 p-4 pt-[calc(3.5rem+env(safe-area-inset-top)+1rem)]">
        {children}
      </main>

      {/*
        min-h-screen(=100vh)はモバイルブラウザのアドレスバー分の高さ変動を
        考慮できず、fixed要素がツールバーの裏に隠れる/ビューポート外に
        押し出されることがあるためmin-h-dvhを使用。
        navにもsafe-area-inset-bottom分の余白とz-indexを明示し、
        ホームインジケーターとの重なりや他要素による被覆を防ぐ。
      */}
      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-neutral-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
                  isActive ? "text-primary-600" : "text-neutral-400"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className={isActive ? "font-medium" : undefined}>{item.label}</span>
                <span
                  className={`h-1 w-1 rounded-full ${isActive ? "bg-primary-600" : "bg-transparent"}`}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/mypage/layout.tsx
git commit -m "feat: add fixed mypage header with logo, restructure bottom nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 3: `getMypageSummary`に進捗バー用フィールドを追加（TDD）

**Files:**
- Modify: `app/actions/mypage-summary.ts`
- Test: `app/actions/mypage-summary.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/mypage-summary.test.ts`の`it("computes the next status and remaining visit count", ...)`内の`expect(result).toEqual({...})`を次のように置き換える（`currentStatusMinVisitCount`と`nextStatusMinVisitCount`を追加）：

```ts
    expect(result).toEqual({
      name: "田中 花子",
      statusName: "ブロンズ",
      statusColor: "#CD7F32",
      visitCount: 3,
      nextStatusName: "シルバー",
      visitsToNextStatus: 2,
      currentStatusMinVisitCount: 0,
      nextStatusMinVisitCount: 5,
      nextReservation: null,
    });
```

さらに`it("returns null next status when already at the top tier", ...)`の末尾に次のアサーションを追加する：

```ts
    expect(result?.nextStatusMinVisitCount).toBeNull();
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/mypage-summary.test.ts`
Expected: FAIL（`currentStatusMinVisitCount`等が`undefined`のため`toEqual`が失敗する）

- [ ] **Step 3: `app/actions/mypage-summary.ts`を実装する**

`MypageSummary`インターフェースを次のように変更する：

```ts
export interface MypageSummary {
  name: string;
  statusName: string;
  statusColor: string;
  visitCount: number;
  nextStatusName: string | null;
  visitsToNextStatus: number | null;
  currentStatusMinVisitCount: number;
  nextStatusMinVisitCount: number | null;
  nextReservation: NextReservationSummary | null;
}
```

関数本体の`return`文を次のように変更する（`currentStatusMinVisitCount`と`nextStatusMinVisitCount`を追加するだけで、他のロジックは変更しない）：

```ts
  return {
    name: member.name,
    statusName: member.status.name,
    statusColor: member.status.colorCode,
    visitCount: member.visitCount,
    nextStatusName: nextStatus?.name ?? null,
    visitsToNextStatus: nextStatus ? nextStatus.minVisitCount - member.visitCount : null,
    currentStatusMinVisitCount: member.status.minVisitCount,
    nextStatusMinVisitCount: nextStatus?.minVisitCount ?? null,
    nextReservation: nextReservation
      ? {
          id: nextReservation.id,
          reservationDate: nextReservation.reservationDate.toISOString().slice(0, 10),
          startTimeLabel: minutesToLabel(dbTimeToMinutes(nextReservation.startTime)),
          storeName: nextReservation.store.name,
          courseName:
            nextReservation.items.find((i) => i.itemType === "course")?.course?.name ?? "",
          staffName: nextReservation.staff?.name ?? null,
        }
      : null,
  };
```

`member.status.minVisitCount`を使うため、`prisma.member.findUnique`の`include: { status: true }`はそのままでよい（`CustomerStatus`モデルは既に`minVisitCount`を持つ）。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/mypage-summary.test.ts`
Expected: `Tests 5 passed (5)`

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add app/actions/mypage-summary.ts app/actions/mypage-summary.test.ts
git commit -m "feat: add status progress fields to getMypageSummary

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 4: ホーム画面（`/mypage`）をリニューアルする

**Files:**
- Modify: `app/mypage/page.tsx`

このタスクは表示のみの変更（新規サーバーロジックなし）のため、TDDの新規テストは書かない。

- [ ] **Step 1: `app/mypage/page.tsx`を全面的に書き換える**

現在の内容全体を次の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { getMypageSummary, type MypageSummary } from "@/app/actions/mypage-summary";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

export default function MypageTopPage() {
  const [summary, setSummary] = useState<MypageSummary | null>(null);

  useEffect(() => {
    getMypageSummary().then(setSummary);
  }, []);

  if (!summary) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  const progressRatio =
    summary.nextStatusMinVisitCount !== null
      ? Math.min(
          1,
          Math.max(
            0,
            (summary.visitCount - summary.currentStatusMinVisitCount) /
              (summary.nextStatusMinVisitCount - summary.currentStatusMinVisitCount),
          ),
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">こんにちは</p>
        <p className="text-lg font-medium text-neutral-800">{summary.name} 様</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-secondary-200 bg-secondary-50 p-4">
        <p className="text-center text-xs text-neutral-500">現在のステータス</p>
        <p
          className="text-center text-lg font-medium"
          style={{ color: summary.statusColor }}
        >
          {summary.statusName}会員
        </p>
        {progressRatio !== null ? (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full"
                style={{ width: `${progressRatio * 100}%`, backgroundColor: summary.statusColor }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-600">
              <span>来店{summary.visitCount}回</span>
              <span>{summary.nextStatusName}まであと{summary.visitsToNextStatus}回</span>
            </div>
          </>
        ) : (
          <p className="text-center text-xs text-neutral-600">来店{summary.visitCount}回</p>
        )}
      </div>

      {summary.nextReservation ? (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
          <p className="text-xs text-primary-600">次回のご予約</p>
          <p className="font-medium text-neutral-800">
            {formatJapaneseDate(summary.nextReservation.reservationDate)}{" "}
            {summary.nextReservation.startTimeLabel}〜
          </p>
          <p className="text-sm text-neutral-600">
            {summary.nextReservation.storeName} / {summary.nextReservation.courseName}
          </p>
          {summary.nextReservation.staffName && (
            <p className="text-sm text-neutral-600">担当：{summary.nextReservation.staffName}</p>
          )}
          <div className="mt-2 flex gap-3">
            <Link
              href="/mypage/reservation"
              className="h-10 flex-1 rounded-lg border border-primary-500 text-center text-sm font-medium leading-10 text-primary-600"
            >
              変更
            </Link>
            <Link
              href="/mypage/reservation"
              className="h-10 flex-1 rounded-lg border border-error text-center text-sm leading-10 text-error"
            >
              キャンセル
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500">
          次回のご予約はありません。
        </div>
      )}

      <Link
        href="/reserve"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-accent-500 text-base font-medium text-white"
      >
        <CalendarPlus className="h-5 w-5" aria-hidden="true" />
        新しく予約する
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし（`lucide-react`に`CalendarPlus`が存在することは確認済み）

- [ ] **Step 3: コミット**

```bash
git add app/mypage/page.tsx
git commit -m "feat: redesign mypage home with status progress and reservation card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 5: お知らせ機能のサーバーアクションを新規実装する（TDD）

**Files:**
- Create: `app/actions/member-notifications.ts`
- Test: `app/actions/member-notifications.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/member-notifications.test.ts`を新規作成：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMemberNotifications } from "./member-notifications";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({
  prisma: {
    emailLineLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("getMemberNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getMemberNotifications();

    expect(result).toBeNull();
    expect(prisma.emailLineLog.findMany).not.toHaveBeenCalled();
  });

  it("returns null for a non-member session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "hq" } } as never);

    const result = await getMemberNotifications();

    expect(result).toBeNull();
  });

  it("returns only successful deliveries for the authenticated member, newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.emailLineLog.findMany).mockResolvedValue([
      {
        id: 101,
        templateType: "birthday",
        channel: "email",
        subject: "お誕生日おめでとうございます",
        sentAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      {
        id: 100,
        templateType: "reminder",
        channel: "line",
        subject: null,
        sentAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ] as never);

    const result = await getMemberNotifications();

    expect(result).toEqual([
      {
        id: 101,
        templateType: "birthday",
        channel: "email",
        subject: "お誕生日おめでとうございます",
        sentAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: 100,
        templateType: "reminder",
        channel: "line",
        subject: null,
        sentAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
    expect(prisma.emailLineLog.findMany).toHaveBeenCalledWith({
      where: { memberId: 7, status: "success" },
      orderBy: { sentAt: "desc" },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/member-notifications.test.ts`
Expected: FAIL（`./member-notifications`が存在しない）

- [ ] **Step 3: `app/actions/member-notifications.ts`を実装する**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface MemberNotificationItem {
  id: number;
  templateType: "birthday" | "reminder" | "segment";
  channel: "email" | "line";
  subject: string | null;
  sentAt: string;
}

export async function getMemberNotifications(): Promise<MemberNotificationItem[] | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const logs = await prisma.emailLineLog.findMany({
    where: { memberId, status: "success" },
    orderBy: { sentAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    templateType: log.templateType,
    channel: log.channel,
    subject: log.subject,
    sentAt: log.sentAt.toISOString(),
  }));
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/member-notifications.test.ts`
Expected: `Tests 3 passed (3)`

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 6: コミット**

```bash
git add app/actions/member-notifications.ts app/actions/member-notifications.test.ts
git commit -m "feat: add getMemberNotifications server action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 6: お知らせページを新規作成する

**Files:**
- Create: `app/mypage/notifications/page.tsx`

- [ ] **Step 1: `app/mypage/notifications/page.tsx`を新規作成する**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getMemberNotifications,
  type MemberNotificationItem,
} from "@/app/actions/member-notifications";

const TEMPLATE_TYPE_LABEL: Record<MemberNotificationItem["templateType"], string> = {
  birthday: "誕生日メッセージ",
  reminder: "来店リマインド",
  segment: "キャンペーンのお知らせ",
};

function formatSentAt(sentAt: string): string {
  const date = new Date(sentAt);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

export default function MemberNotificationsPage() {
  const [notifications, setNotifications] = useState<MemberNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMemberNotifications().then((n) => {
      setNotifications(n ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl text-primary-700">お知らせ</h1>

      {notifications.length === 0 ? (
        <p className="text-sm text-neutral-500">お知らせはまだありません。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary-600">
                  {TEMPLATE_TYPE_LABEL[n.templateType]}
                </span>
                <span className="text-xs text-neutral-500">{formatSentAt(n.sentAt)}</span>
              </div>
              {n.subject && <p className="mt-1 text-sm text-neutral-800">{n.subject}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

見出し`<h1>`に`font-heading`クラスを付けていない点に注意（Task 9でグローバルの見出しフォントを統一するため、明示的にNoto Sans JPのままでよい）。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/mypage/notifications/page.tsx
git commit -m "feat: add member notifications page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 7: `getMemberReservationHistory`に`canModify`を追加する（TDD）

**Files:**
- Modify: `app/actions/member-reservation-history.ts`
- Test: `app/actions/member-reservation-history.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`app/actions/member-reservation-history.test.ts`の既存の`it("returns the authenticated member's reservation history, newest first", ...)`を、`cancellationDeadline`をモックデータに含め、`canModify`を期待値に含めるよう次のように書き換える：

```ts
  it("returns the authenticated member's reservation history, newest first", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 40,
        reservationDate: new Date("2026-08-01T00:00:00.000Z"),
        totalPrice: 9000,
        status: "completed",
        cancellationDeadline: new Date("2026-07-31T23:59:59.000Z"),
        store: { name: "フォレスパ 渋谷店" },
        staff: { name: "佐藤 由紀" },
        items: [{ itemType: "course", course: { name: "頭皮ケアプレミアム" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory(new Date("2026-08-05T00:00:00.000Z"));

    expect(result).toEqual([
      {
        id: 40,
        date: "2026-08-01",
        storeName: "フォレスパ 渋谷店",
        courseName: "頭皮ケアプレミアム",
        staffName: "佐藤 由紀",
        totalPrice: 9000,
        status: "completed",
        canModify: false,
      },
    ]);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: { memberId: 7, status: { in: ["completed", "confirmed", "cancelled", "no_show"] } },
      orderBy: { reservationDate: "desc" },
      include: { store: true, staff: true, items: { include: { course: true } } },
    });
  });

  it("marks canModify true for a confirmed reservation before its cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 41,
        reservationDate: new Date("2026-09-10T00:00:00.000Z"),
        totalPrice: 8000,
        status: "confirmed",
        cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
        store: { name: "フォレスパ 渋谷店" },
        staff: null,
        items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory(new Date("2026-09-01T00:00:00.000Z"));

    expect(result?.[0].canModify).toBe(true);
  });

  it("marks canModify false for a confirmed reservation past its cancellation deadline", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "member" } } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: 42,
        reservationDate: new Date("2026-09-10T00:00:00.000Z"),
        totalPrice: 8000,
        status: "confirmed",
        cancellationDeadline: new Date("2026-09-09T23:59:59.000Z"),
        store: { name: "フォレスパ 渋谷店" },
        staff: null,
        items: [{ itemType: "course", course: { name: "頭皮ケアスタンダード" } }],
      },
    ] as never);

    const result = await getMemberReservationHistory(new Date("2026-09-10T00:00:00.000Z"));

    expect(result?.[0].canModify).toBe(false);
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run app/actions/member-reservation-history.test.ts`
Expected: FAIL（`canModify`が`undefined`、また`getMemberReservationHistory`が引数を受け取らないため型エラー）

- [ ] **Step 3: `app/actions/member-reservation-history.ts`を実装する**

ファイル全体を次の内容に置き換える：

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface MemberReservationHistoryItem {
  id: number;
  date: string;
  storeName: string;
  courseName: string;
  staffName: string | null;
  totalPrice: number;
  status: string;
  canModify: boolean;
}

export async function getMemberReservationHistory(
  today: Date = new Date(),
): Promise<MemberReservationHistoryItem[] | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "member") {
    return null;
  }
  const memberId = Number(session.user.id);

  const reservations = await prisma.reservation.findMany({
    where: { memberId, status: { in: ["completed", "confirmed", "cancelled", "no_show"] } },
    orderBy: { reservationDate: "desc" },
    include: { store: true, staff: true, items: { include: { course: true } } },
  });

  return reservations.map((r) => ({
    id: r.id,
    date: r.reservationDate.toISOString().slice(0, 10),
    storeName: r.store.name,
    courseName: r.items.find((i) => i.itemType === "course")?.course?.name ?? "",
    staffName: r.staff?.name ?? null,
    totalPrice: r.totalPrice,
    status: r.status,
    canModify: r.status === "confirmed" && today < r.cancellationDeadline,
  }));
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run app/actions/member-reservation-history.test.ts`
Expected: `Tests 4 passed (4)`

- [ ] **Step 5: `app/mypage/history/page.tsx`の呼び出し元を確認する**

`getMemberReservationHistory()`は引数省略時デフォルトで`new Date()`が使われるため、Task 8で書き換える`app/mypage/history/page.tsx`側の呼び出しコード`getMemberReservationHistory().then(...)`は変更不要（Task 8で対応）。

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 7: コミット**

```bash
git add app/actions/member-reservation-history.ts app/actions/member-reservation-history.test.ts
git commit -m "feat: add canModify to member reservation history items

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 8: 来店履歴ページからステータス確認を削除し、変更/キャンセルボタンを追加する

**Files:**
- Modify: `app/mypage/history/page.tsx`

このタスクは表示のみの変更（Task 7で用意したデータと、既存の`cancelMemberReservation`アクションを使うのみ）のため、新規のアクションテストは書かない。

- [ ] **Step 1: `app/mypage/history/page.tsx`を全面的に書き換える**

現在の内容全体を次の内容に置き換える：

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMemberReservationHistory,
  type MemberReservationHistoryItem,
} from "@/app/actions/member-reservation-history";
import { cancelMemberReservation } from "@/app/actions/member-reservation-detail";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

const STATUS_LABEL: Record<string, string> = {
  completed: "来店済み",
  confirmed: "予約確定",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

export default function MemberHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<MemberReservationHistoryItem[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getMemberReservationHistory().then((h) => setHistory(h ?? []));
  }, []);

  async function handleCancel(reservationId: number) {
    if (!window.confirm("ご予約をキャンセルします。よろしいですか？")) return;

    setProcessingId(reservationId);
    const result = await cancelMemberReservation({ reservationId });
    setProcessingId(null);

    if (result.status === "cancelled") {
      setMessage("ご予約をキャンセルしました。");
      setHistory((prev) =>
        prev.map((h) => (h.id === reservationId ? { ...h, status: "cancelled", canModify: false } : h)),
      );
    } else if (result.status === "deadline_passed") {
      setMessage("キャンセル期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("キャンセルに失敗しました。");
    }
  }

  async function handleChange(reservationId: number) {
    if (
      !window.confirm(
        "変更のため、現在のご予約を一度キャンセルして新しいご予約に進みます。よろしいですか？",
      )
    ) {
      return;
    }

    setProcessingId(reservationId);
    const result = await cancelMemberReservation({ reservationId });
    setProcessingId(null);

    if (result.status === "cancelled") {
      router.push("/reserve");
    } else if (result.status === "deadline_passed") {
      setMessage("変更期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("変更に失敗しました。");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl text-primary-700">来店履歴</h1>
      {message && <p className="text-sm text-neutral-600">{message}</p>}

      {history.length === 0 ? (
        <p className="text-sm text-neutral-500">来店履歴はまだありません。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-neutral-800">{formatJapaneseDate(h.date)}</p>
                <span className="text-xs text-neutral-500">{STATUS_LABEL[h.status] ?? h.status}</span>
              </div>
              <p className="text-sm text-neutral-600">
                {h.storeName} / {h.courseName}
              </p>
              {h.staffName && <p className="text-sm text-neutral-600">担当：{h.staffName}</p>}
              <p className="text-sm font-medium text-neutral-800">
                {h.totalPrice.toLocaleString()}円
              </p>
              {h.canModify && (
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={processingId === h.id}
                    onClick={() => handleChange(h.id)}
                    className="h-9 flex-1 rounded-lg border border-primary-500 text-sm font-medium text-primary-600 disabled:opacity-50"
                  >
                    変更する
                  </button>
                  <button
                    type="button"
                    disabled={processingId === h.id}
                    onClick={() => handleCancel(h.id)}
                    className="h-9 flex-1 rounded-lg border border-error text-sm text-error disabled:opacity-50"
                  >
                    キャンセルする
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

見出し`<h1>`から`font-heading`クラスを外している点、「ステータス条件」テーブル（`listCustomerStatuses`呼び出し含む）を丸ごと削除している点に注意。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/mypage/history/page.tsx
git commit -m "feat: remove status check from history page, add change/cancel per card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 9: 見出しフォントをサイト全体で統一する

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: `app/globals.css`の該当箇所を確認する**

`body { ... }`ルールの直後にある以下のブロックを探す（157〜169行目付近）：

```css
body {
  font-family: var(--font-body);
  background-color: var(--color-neutral-50);
  color: var(--color-neutral-600);
}

h1,
h2,
h3,
h4 {
  font-family: var(--font-heading);
}
```

- [ ] **Step 2: `h1, h2, h3, h4`のルールを削除する**

上記ブロックを次のように置き換える（`h1,h2,h3,h4`ルールを削除するのみ）：

```css
body {
  font-family: var(--font-body);
  background-color: var(--color-neutral-50);
  color: var(--color-neutral-600);
}
```

- [ ] **Step 3: 全体テストと型チェックを実行する**

Run: `npx vitest run app/login/page.test.tsx app/admin/login/page.test.tsx`
Expected: 引き続き全て通る（これらのページの見出しは`font-heading`クラスを明示しているため影響を受けない）

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし

- [ ] **Step 4: ブラウザで目視確認する（Claude in Chromeが使える場合）**

`/mypage`, `/mypage/history`, `/mypage/profile`, `/mypage/notifications`の見出しがゴシック体（Noto Sans JP）になっていること、`/login`, `/admin/login`, `/terms`等の`font-heading`クラス付き見出しが引き続き明朝体（Noto Serif JP）のままであることをスクリーンショットで確認する。

- [ ] **Step 5: コミット**

```bash
git add app/globals.css
git commit -m "style: remove global serif font default from h1-h4

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 10: 通しでの最終確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全体テストを実行する**

Run: `npx vitest run app/login/page.test.tsx app/admin/login/page.test.tsx app/actions/mypage-summary.test.ts app/actions/member-notifications.test.ts app/actions/member-reservation-history.test.ts app/actions/member-reservation-detail.test.ts`
Expected: 全て`passed`

（`npx vitest run`をディレクトリ指定なしで実行すると`.claude/worktrees/`配下の重複コピーも含めて非常に時間がかかる上、既知の無関係なbcryptタイムアウト失敗（`update-member-profile.test.ts > changeMemberPassword`系）が混ざるため、上記のように対象ファイルを明示して実行すること。）

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 3: ユーザーに動作確認を依頼する**

サンドボックスの制約上、実際のdevサーバー起動・DB接続を伴う画面確認はユーザー自身の環境で行ってもらう（`npm run dev`起動後、`/login`, `/mypage`, `/mypage/history`, `/mypage/notifications`, `/mypage/profile`, `/admin/login`を確認）。Claude in Chromeが接続できる場合はスクリーンショットで先に確認してもよい。
