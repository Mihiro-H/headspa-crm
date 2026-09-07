# Phase F: 配信管理のタブ統合 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち6番目

## 背景・目的

現在「メール／LINE配信管理」（`/admin/segment-campaigns`）・「自動配信設定」（`/admin/auto-delivery`）・「配信テンプレート管理」（`/admin/templates`）はサイドバーの独立した3項目・3ページ。これを`/admin/segment-campaigns`1ページの中に「セグメント配信設定」「自動配信設定」「テンプレート管理」の3タブとして統合する。タブ切り替えはURLを伴わないクライアント状態のみ（リロードで最初のタブに戻る、ユーザー確定事項）。

## データモデル変更

なし。

## サーバーアクション変更

なし。3ページが呼んでいたServer Action（`segment-campaigns.ts`・`app/actions/auto-delivery-settings.ts`・`manage-templates.ts`）はそのまま。

## UI変更

### 新規共通コンポーネント `components/ui/tabs.tsx`

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

（`customers/[id]/page.tsx`の基本情報／来店履歴タブと似た配色・構造だが、あちらはページ内ローカルなタブ実装のため、今回新設する共通版は他ページでも再利用できるよう`components/ui/`に置く。）

### `app/admin/(dashboard)/segment-campaigns/page.tsx`

- コンポーネント名は`SegmentCampaignsPage`のまま、中身を3つの内部コンポーネントに分割する：
  - `SegmentSettingsTab`（現在の`segment-campaigns/page.tsx`の中身——配信履歴テーブル＋配信設定モーダル。Phase Aで追加したページネーションもそのまま維持）
  - `AutoDeliveryTab`（現在の`app/admin/(dashboard)/auto-delivery/page.tsx`の中身をそのまま移植）
  - `TemplatesTab`（現在の`app/admin/(dashboard)/templates/page.tsx`の中身をそのまま移植）
- これら3つを`components/admin/segment-settings-tab.tsx`・`components/admin/auto-delivery-tab.tsx`・`components/admin/templates-tab.tsx`として切り出し、`segment-campaigns/page.tsx`は`<Tabs tabs={[{key:"segment", label:"セグメント配信設定", content: <SegmentSettingsTab/>}, {key:"auto", label:"自動配信設定", content: <AutoDeliveryTab/>}, {key:"templates", label:"テンプレート管理", content: <TemplatesTab/>}]} />`を返すだけの薄いラッパーにする。

### 削除するファイル・ルート

- `app/admin/(dashboard)/auto-delivery/page.tsx`（中身を`components/admin/auto-delivery-tab.tsx`に移植後、削除）
- `app/admin/(dashboard)/templates/page.tsx`（中身を`components/admin/templates-tab.tsx`に移植後、削除）
- これに伴い、`app/admin/(dashboard)/layout.tsx`の`NAV_ITEMS`から「自動配信設定」「配信テンプレート管理」の2項目を削除し、`components/admin/admin-header.tsx`の`PAGE_TITLES`からも該当エントリを削除する。

## テスト方針

- `Tabs`コンポーネントはプレゼンテーション専用のためテスト対象外。
- 3つのタブコンポーネントはページ相当のためテスト対象外（既存のServer Actionのテストは変更しないため影響なし）。

## 影響範囲

- `/admin/auto-delivery`・`/admin/templates`への直接リンクが404になる。`segment-campaigns/page.tsx`内の「＋新しいテンプレートを作成する」リンク（`<a href="/admin/templates">`）は、タブ切り替え（`setActiveTab("templates")`相当）に置き換える必要がある。
