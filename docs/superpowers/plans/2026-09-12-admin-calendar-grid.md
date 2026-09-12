# 管理画面 予約カレンダー グリッド化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面の予約カレンダー（`/admin/calendar`）を、スタッフごとの縦リスト表示からスタッフ×時刻のグリッド表示に置き換える。

**Architecture:** 既存のサーバーアクション（`getCalendarReservations`, `listStaffForStore`）はそのまま再利用し、`app/admin/(dashboard)/calendar/page.tsx`のクライアントコンポーネント側でグリッド用のデータ整形（行・列・セルの計算）を行う。新規サーバーロジックはないため、サーバーアクションのテストは変更不要。

**Tech Stack:** Next.js (App Router) / React / TypeScript / Tailwind CSS v4 / lucide-react

---

## 前提知識（実装者向け）

- 対象ページは`"use client"`コンポーネント（`app/admin/(dashboard)/calendar/page.tsx`）。既存の`getCalendarReservations(storeId, date)`（`app/actions/calendar-reservations.ts`）と`listStaffForStore(storeId)`（`app/actions/staff.ts`）は**どちらも変更不要**。
- 設計書は`docs/superpowers/specs/2026-09-12-admin-calendar-grid-design.md`（読まなくても以下のタスク内容で完結する）。
- 日付フォーマットは`lib/reservation/date-format.ts`の`formatJapaneseDate(dateStr: string): string`を使う（`"YYYY-MM-DD"`→`"2026年9月3日（木）"`）。
- このタスクは新規サーバーロジックを追加しない表示のみの変更のため、TDDの新規テストは書かない（既存のプロジェクト内の他のUI専用ページ変更と同じ方針）。
- 各ステップの最後に`npx tsc --noEmit -p tsconfig.json`を実行し、新規の型エラーが出ていないことを確認すること（既存の無関係な2件のエラーは無視してよい：`app/actions/current-admin-scope.test.ts(44,39)`と`app/actions/manage-permissions.ts(19,42)`）。このページには既存テストファイルがないため、テスト実行は不要。

---

### Task 1: `app/admin/(dashboard)/calendar/page.tsx`をグリッド表示に書き換える

**Files:**
- Modify: `app/admin/(dashboard)/calendar/page.tsx`（この1ファイルのみ）

- [ ] **Step 1: ファイル全体を次の内容に置き換える**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Store as StoreIcon } from "lucide-react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getCurrentAdminStoreScope, type AdminStoreScope } from "@/app/actions/current-admin-scope";
import {
  getCalendarReservations,
  type CalendarReservation,
} from "@/app/actions/calendar-reservations";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { minutesToLabel } from "@/lib/reservation/time";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

// カードの背景色をステータス別に固定するためのクラス定義。
// 「指名なし」列を含むレイアウト計算とは無関係な、表示専用の定数。
const STATUS_CARD_CLASS: Record<string, string> = {
  temp_hold: "border-l-4 border-warning bg-warning/15",
  confirmed: "border-l-4 border-success bg-success/15",
  completed: "border-l-4 border-disabled bg-disabled/20",
};

const UNASSIGNED_COLUMN_KEY = "unassigned";

interface CalendarColumn {
  key: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function AdminCalendarPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });

  useEffect(() => {
    Promise.all([listStores(), getCurrentAdminStoreScope()]).then(([list, s]) => {
      setStores(list);
      setScope(s);
      const visible = s.isUnrestricted
        ? list
        : list.filter((store) => s.storeIds.includes(store.id));
      if (visible.length > 0) setStoreId(visible[0].id);
    });
  }, []);

  useEffect(() => {
    if (storeId === null) return;
    getCalendarReservations(storeId, date).then(setReservations);
    listStaffForStore(storeId).then(setStaffList);
  }, [storeId, date]);

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));

  const hasUnassigned = reservations.some((r) => r.staffId === null);

  const columns: CalendarColumn[] = [
    ...staffList.map((s) => ({ key: String(s.id), label: s.name })),
    ...(hasUnassigned ? [{ key: UNASSIGNED_COLUMN_KEY, label: "指名なし" }] : []),
  ];

  const rows = Array.from(new Set(reservations.map((r) => r.startMinutes))).sort((a, b) => a - b);

  function findReservation(rowMinutes: number, columnKey: string): CalendarReservation | null {
    return (
      reservations.find((r) => {
        const matchesColumn =
          columnKey === UNASSIGNED_COLUMN_KEY
            ? r.staffId === null
            : r.staffId === Number(columnKey);
        return matchesColumn && r.startMinutes === rowMinutes;
      }) ?? null
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, -1))}
            aria-label="前日"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium text-neutral-800">{formatJapaneseDate(date)}</p>
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, 1))}
            aria-label="翌日"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <StoreIcon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <select
            value={storeId ?? ""}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
          >
            {visibleStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">この日の予約はありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-16 p-2" />
                {columns.map((c) => (
                  <th key={c.key} className="p-2 text-left font-medium text-neutral-700">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((rowMinutes) => (
                <tr key={rowMinutes} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 align-top text-xs text-neutral-500">
                    {minutesToLabel(rowMinutes)}
                  </td>
                  {columns.map((c) => {
                    const r = findReservation(rowMinutes, c.key);
                    return (
                      <td key={c.key} className="p-2 align-top">
                        {r && (
                          <Link
                            href={`/admin/reservations/${r.id}`}
                            className={`block rounded-md p-2 ${STATUS_CARD_CLASS[r.status] ?? "border-l-4 border-neutral-300 bg-neutral-50"}`}
                          >
                            <p className="text-xs font-medium text-neutral-800">
                              {minutesToLabel(r.startMinutes)} {r.memberName ?? "（未確定）"}様
                            </p>
                            <p className="text-xs text-neutral-600">
                              {r.courseName || "（明細なし）"}
                            </p>
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 新規エラーなし（既存の無関係な2件のみ残存）

- [ ] **Step 3: コミット**

```bash
git add "app/admin/(dashboard)/calendar/page.tsx"
git commit -m "feat: redesign admin calendar as a staff x time grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016CqpJcM6Tc8NSycFDc5yJq"
```

---

### Task 2: 最終確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 型チェックを再確認する**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 前提知識に記載した既存2件以外のエラーなし

- [ ] **Step 2: ユーザーに動作確認を依頼する**

サンドボックスの制約上、実際のdevサーバー起動・DB接続を伴う画面確認はユーザー自身の環境で行ってもらう（`npm run dev`起動後、`/admin/calendar`でスタッフ列・時刻行・ステータス別カード色・日付ナビゲーション・店舗選択（右寄せ）を確認）。Claude in Chromeが接続できる場合はスクリーンショットで先に確認してもよい。
