# Phase F: 配信管理のタブ統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「メール／LINE配信管理」「自動配信設定」「配信テンプレート管理」の3つの独立ページを、`/admin/segment-campaigns`1ページ内の3タブ（セグメント配信設定／自動配信設定／テンプレート管理）に統合する。

**Architecture:** 新規共通コンポーネント`components/ui/tabs.tsx`（クライアント状態のみ、URL非連動）を作り、3ページの中身をそれぞれ`components/admin/segment-settings-tab.tsx`・`components/admin/auto-delivery-tab.tsx`・`components/admin/templates-tab.tsx`に移植する。`segment-campaigns/page.tsx`はこの3タブを`<Tabs>`に渡すだけの薄いラッパーにする。`auto-delivery/page.tsx`・`templates/page.tsx`のルートは削除し、サイドバーのナビ項目からも該当2項目を除く。

**Tech Stack:** Next.js (App Router) / TypeScript / Prisma (PostgreSQL) / Tailwind CSS v4 / Vitest

**関連ドキュメント:** `docs/superpowers/specs/2026-09-07-phase-f-delivery-tabs-design.md`

**前提:** Phase A（実装順序上先に完了。`segment-campaigns/page.tsx`はページネーション対応済み、`templates/page.tsx`もページネーション対応済み、`auto-delivery/page.tsx`は`<h1>`削除済み、`admin-header.tsx`の`PAGE_TITLES`と`layout.tsx`の`NAV_ITEMS`が存在する状態が本Planの出発点）。

---

### Task 1: `components/ui/tabs.tsx`（新規）

**Files:**
- Create: `components/ui/tabs.tsx`

- [ ] **Step 1: コンポーネントを作成する**

`components/ui/tabs.tsx`を以下の内容で新規作成する：

```tsx
"use client";

import { useState } from "react";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTabKey?: string;
}

export function Tabs({ tabs, defaultTabKey }: TabsProps) {
  const [activeKey, setActiveKey] = useState(defaultTabKey ?? tabs[0]?.key);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveKey(tab.key)}
            aria-current={activeKey === tab.key ? "page" : undefined}
            className={`px-4 py-2 text-sm ${
              activeKey === tab.key
                ? "border-b-2 border-primary-500 font-medium text-primary-700"
                : "text-neutral-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.key === activeKey)?.content}
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`Tabs`はまだどこからも使われていないため未使用警告は出ない）

- [ ] **Step 3: Commit**

```bash
git add components/ui/tabs.tsx
git commit -m "feat: add reusable client-side Tabs component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 2: `components/admin/templates-tab.tsx`（`templates/page.tsx`の中身を移植）

**Files:**
- Create: `components/admin/templates-tab.tsx`
- Delete: `app/admin/(dashboard)/templates/page.tsx`

- [ ] **Step 1: `templates-tab.tsx`を作成する**

`components/admin/templates-tab.tsx`を以下の内容で新規作成する（Phase Aで`templates/page.tsx`に追加されたページネーション・スクロール固定の中身をそのまま移植し、コンポーネント名を`TemplatesTab`に、外側の`<div>`から`h-10 items-center gap-1`の新規作成ボタン行のみ残して構造はそのまま維持する）：

```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  listTemplatesPage,
  createTemplate,
  updateTemplate,
  type TemplateListItem,
  type DeliveryTemplateType,
} from "@/app/actions/manage-templates";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

const TYPE_LABEL: Record<DeliveryTemplateType, string> = {
  birthday: "誕生月メール",
  reminder: "前日リマインド",
  segment: "セグメント配信",
};

const PAGE_SIZE = 20;

const EMPTY_FORM = { type: "segment" as DeliveryTemplateType, name: "", subject: "", bodyText: "" };

export function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function refresh() {
    listTemplatesPage(page).then((result) => {
      setTemplates(result.items);
      setTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(t: TemplateListItem) {
    setEditingId(t.id);
    setForm({ type: t.type, name: t.name, subject: t.subject ?? "", bodyText: t.bodyText });
    setModalOpen(true);
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
    setModalOpen(false);
    refresh();
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規テンプレート作成
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
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
                    onClick={() => openEdit(t)}
                    className="text-neutral-500 hover:text-primary-600"
                    aria-label="編集"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">テンプレートがありません。</p>
        )}
      </div>

      <p className="text-center text-xs text-neutral-500">{totalCount}件中 {templates.length}件を表示</p>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "テンプレートを編集" : "新規テンプレートを作成"}
      >
        <div className="flex flex-col gap-3">
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
          <button
            type="button"
            disabled={saving || !form.name || !form.bodyText}
            onClick={handleSave}
            className="h-10 rounded-lg bg-primary-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "作成する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: `app/admin/(dashboard)/templates/page.tsx`を削除する**

```bash
git rm "app/admin/(dashboard)/templates/page.tsx"
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（`TemplatesTab`はまだどこからも使われていないため未使用警告は出ない。`/admin/templates`ルートが消えることで発生する参照エラーはTask 5で解消する）

- [ ] **Step 4: Commit**

```bash
git add components/admin/templates-tab.tsx
git commit -m "feat: extract templates page into TemplatesTab component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 3: `components/admin/auto-delivery-tab.tsx`（`auto-delivery/page.tsx`の中身を移植）

**Files:**
- Create: `components/admin/auto-delivery-tab.tsx`
- Delete: `app/admin/(dashboard)/auto-delivery/page.tsx`

- [ ] **Step 1: `auto-delivery-tab.tsx`を作成する**

`components/admin/auto-delivery-tab.tsx`を以下の内容で新規作成する（コンポーネント名を`AutoDeliveryTab`に変更し、`<h1>`見出しを削除、`<a href="/admin/templates">`をタブ切り替え用の`onNavigateToTemplates`コールバックに置き換える。それ以外のロジックは`auto-delivery/page.tsx`と完全に同一）：

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

export interface AutoDeliveryTabProps {
  onNavigateToTemplates: () => void;
}

export function AutoDeliveryTab({ onNavigateToTemplates }: AutoDeliveryTabProps) {
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
        <button
          type="button"
          onClick={onNavigateToTemplates}
          className="text-left text-sm text-primary-600 underline"
        >
          ＋新しいテンプレートを作成する
        </button>
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

- [ ] **Step 2: `app/admin/(dashboard)/auto-delivery/page.tsx`を削除する**

```bash
git rm "app/admin/(dashboard)/auto-delivery/page.tsx"
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add components/admin/auto-delivery-tab.tsx
git commit -m "feat: extract auto-delivery settings page into AutoDeliveryTab component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 4: `components/admin/segment-settings-tab.tsx`（`segment-campaigns/page.tsx`の中身を移植）＋`segment-campaigns/page.tsx`をタブラッパー化

**Files:**
- Create: `components/admin/segment-settings-tab.tsx`
- Modify: `app/admin/(dashboard)/segment-campaigns/page.tsx`

- [ ] **Step 1: `segment-settings-tab.tsx`を作成する**

`components/admin/segment-settings-tab.tsx`を以下の内容で新規作成する（コンポーネント名を`SegmentSettingsTab`に変更し、`<a href="/admin/templates">`を`onNavigateToTemplates`コールバックに置き換える。それ以外のロジックはPhase A適用後の`segment-campaigns/page.tsx`と完全に同一）：

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

const CHANNEL_LABEL: Record<SegmentChannelMode, string> = {
  email: "メール",
  line: "LINE",
  auto: "両方（自動振り分け）",
};

const PAGE_SIZE = 20;

export interface SegmentSettingsTabProps {
  onNavigateToTemplates: () => void;
}

export function SegmentSettingsTab({ onNavigateToTemplates }: SegmentSettingsTabProps) {
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [history, setHistory] = useState<SegmentCampaignListItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
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
    listSegmentCampaigns(page).then((result) => {
      setHistory(result.items);
      setHistoryTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
    listTemplates().then((all) => setTemplates(all.filter((t) => t.type === "segment")));
  }, []);

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
      setModalOpen(false);
    } else {
      setResultMessage(
        `配信完了：成功${result.sentCount}件／失敗${result.failedCount}件（対象${result.targetCount}件）`,
      );
      setModalOpen(false);
    }
    refreshHistory();
  }

  function openModal() {
    setName("");
    setStatusId(null);
    setStoreId(null);
    setChannelMode("auto");
    setTemplateId(null);
    setCampaignName("");
    setScheduledAt("");
    setPreview(null);
    setResultMessage(null);
    setModalOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(historyTotalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openModal}
          className="flex h-10 items-center gap-1 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          配信設定
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">配信履歴</h2>
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
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
          {history.length === 0 && (
            <p className="p-6 text-center text-sm text-neutral-500">配信履歴がありません。</p>
          )}
        </div>
        <p className="text-center text-xs text-neutral-500">{historyTotalCount}件中 {history.length}件を表示</p>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="配信設定">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-neutral-600">配信対象の条件</h3>
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

          <h3 className="text-sm font-medium text-neutral-600">配信チャネル</h3>
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

          <h3 className="text-sm font-medium text-neutral-600">配信内容</h3>
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
          <button
            type="button"
            onClick={onNavigateToTemplates}
            className="text-left text-sm text-primary-600 underline"
          >
            ＋新しいテンプレートを作成する
          </button>
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

          {resultMessage && (
            <p role="status" aria-live="polite" className="text-sm text-neutral-700">
              {resultMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !templateId || !campaignName}
            className="h-12 rounded-lg bg-accent-500 px-4 font-medium text-white disabled:opacity-50"
          >
            {scheduledAt ? "配信を予約する" : "今すぐ配信する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: `segment-campaigns/page.tsx`をタブラッパーに書き換える**

`app/admin/(dashboard)/segment-campaigns/page.tsx`を以下の内容に置き換える：

```tsx
"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { SegmentSettingsTab } from "@/components/admin/segment-settings-tab";
import { AutoDeliveryTab } from "@/components/admin/auto-delivery-tab";
import { TemplatesTab } from "@/components/admin/templates-tab";

export default function SegmentCampaignsPage() {
  const [activeKey, setActiveKey] = useState("segment");

  return (
    <Tabs
      tabs={[
        {
          key: "segment",
          label: "セグメント配信設定",
          content: <SegmentSettingsTab onNavigateToTemplates={() => setActiveKey("templates")} />,
        },
        {
          key: "auto",
          label: "自動配信設定",
          content: <AutoDeliveryTab onNavigateToTemplates={() => setActiveKey("templates")} />,
        },
        { key: "templates", label: "テンプレート管理", content: <TemplatesTab /> },
      ]}
      defaultTabKey={activeKey}
    />
  );
}
```

（`Tabs`は内部で独自の`activeKey`状態を持つため、親の`activeKey`はタブの初期値としてのみ機能し、タブ切り替えボタン自体のクリックには使われない。「＋新しいテンプレートを作成する」から遷移した場合に選択タブを変えるには`Tabs`側の状態を親から制御する必要があるため、Step 3で`Tabs`を制御可能にする。）

- [ ] **Step 3: `Tabs`コンポーネントを制御可能にする**

Step 2の`defaultTabKey`だけでは、`Tabs`が一度マウントされた後に親の`activeKey`が変わってもタブ表示に反映されない（`useState`の初期値にしか使われないため）。`components/ui/tabs.tsx`の`TabsProps`と`Tabs`本体を以下に置き換える：

```tsx
export interface TabsProps {
  tabs: TabItem[];
  activeKey?: string;
  defaultTabKey?: string;
  onActiveKeyChange?: (key: string) => void;
}

export function Tabs({ tabs, activeKey, defaultTabKey, onActiveKeyChange }: TabsProps) {
  const [internalKey, setInternalKey] = useState(defaultTabKey ?? tabs[0]?.key);
  const currentKey = activeKey ?? internalKey;

  function selectKey(key: string) {
    setInternalKey(key);
    onActiveKeyChange?.(key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectKey(tab.key)}
            aria-current={currentKey === tab.key ? "page" : undefined}
            className={`px-4 py-2 text-sm ${
              currentKey === tab.key
                ? "border-b-2 border-primary-500 font-medium text-primary-700"
                : "text-neutral-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.key === currentKey)?.content}
    </div>
  );
}
```

（`activeKey`を渡さない他の将来の利用箇所では、これまで通り非制御コンポーネントとして動作する。）

- [ ] **Step 4: `segment-campaigns/page.tsx`を`Tabs`の制御プロパティを使うよう更新する**

Step 2で書いた`<Tabs ... defaultTabKey={activeKey} />`の行を以下に置き換える：

```tsx
      activeKey={activeKey}
      onActiveKeyChange={setActiveKey}
```

（`tabs={[...]}`の直後、`defaultTabKey={activeKey}`の行を削除してこの2行に置き換える形。最終的な`<Tabs>`呼び出しは`tabs`・`activeKey`・`onActiveKeyChange`の3プロパティを渡す形になる。）

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add components/admin/segment-settings-tab.tsx components/ui/tabs.tsx "app/admin/(dashboard)/segment-campaigns/page.tsx"
git commit -m "feat: merge delivery management pages into tabbed segment-campaigns page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 5: サイドバーナビ・ヘッダータイトルから統合済みの2項目を削除する

**Files:**
- Modify: `app/admin/(dashboard)/layout.tsx`
- Modify: `components/admin/admin-header.tsx`

- [ ] **Step 1: `layout.tsx`の`NAV_ITEMS`から2項目を削除する**

`app/admin/(dashboard)/layout.tsx`の以下の2行：
```tsx
  { href: "/admin/auto-delivery", label: "自動配信設定", icon: Repeat },
  { href: "/admin/templates", label: "配信テンプレート管理", icon: FileText },
```
を削除する。

- [ ] **Step 2: 未使用になったアイコンimportを削除する**

同ファイルの`lucide-react`からのimportブロック内、以下の2行：
```tsx
  Repeat,
  FileText,
```
を削除する（`Repeat`・`FileText`はNAV_ITEMSの他のどのエントリにも使われていないため、Step 1の変更後は完全に未使用になる）。

- [ ] **Step 3: `admin-header.tsx`の`PAGE_TITLES`から2エントリを削除する**

`components/admin/admin-header.tsx`の以下の2行：
```tsx
  "/admin/auto-delivery": "自動配信設定",
  "/admin/templates": "配信テンプレート管理",
```
を削除する。

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Lint**

Run: `npx eslint .`
Expected: エラーなし（未使用importが残っていないことを確認）

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(dashboard)/layout.tsx" components/admin/admin-header.tsx
git commit -m "feat: remove merged delivery pages from sidebar nav and header titles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XpRhLMg71GDycF8WcpBjRJ"
```

---

### Task 6: 最終検証

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: エラーなし

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 既存テストを含め全件PASS（`auto-delivery-settings.test.ts`・`manage-templates.test.ts`・`segment-campaigns.test.ts`・`segment-audience.test.ts`はServer Action自体を変更していないため無影響のはず）

- [ ] **Step 4: `/admin/auto-delivery`・`/admin/templates`への直接リンクが残っていないか確認する**

Run: `grep -rn "admin/auto-delivery\|admin/templates" app/ components/ --include="*.tsx" --include="*.ts"`
Expected: `app/actions/manage-templates.ts`など、URLパスではなくimportパス（`@/app/actions/manage-templates`）としてのマッチのみが残る。`href="/admin/auto-delivery"`や`href="/admin/templates"`のようなリンクが残っていた場合は該当箇所を`onNavigateToTemplates`コールバックまたは削除に置き換える。

## 完了条件

- Task 1〜5のコミットが完了している
- `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` がすべてエラーなしで通る
- `/admin/auto-delivery`・`/admin/templates`への直接リンクが残っていない
