# 管理画面：ヘッダー統合・ページネーション（Phase A） 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面 `/admin/...`
- 位置づけ: 2026-09-06の管理画面UI改修に続く、9つのサブプロジェクトのうち最初の1つ（Phase A: 全体UI基盤）
- スコープ外（今回）: サイドバーロゴの拡大（ユーザーが後日ロゴ素材を提供予定のため保留）。それ以外の8サブプロジェクト（B〜I）も別サイクルで扱う。

## 背景・目的

- 各ページ本文内の見出し（`<h1>`）とヘッダーバーが分離しており、ページ名の表示場所が一元化されていない
- 顧客管理・キャンペーン管理・配信履歴・テンプレート管理の一覧が全件表示で、件数が増えると視認性・パフォーマンスが低下する
- 一覧を下にスクロールすると検索欄やボタンなどの操作要素も一緒に流れてしまい、操作性が悪い

## 1. ヘッダーへのページ名集約

- `app/admin/(dashboard)/layout.tsx` のヘッダー部分を新規クライアントコンポーネント `components/admin/admin-header.tsx` に切り出す
- `usePathname()`（Next.js App Router）で現在のパスを取得し、パス→ページ名のマップから見出しを解決してヘッダー内に表示する（通知ベルと同じ行、左側に配置）
- マップは既存のサイドバー14項目のラベルをそのまま流用する。加えて以下の2つの動的ルートには固定文言を割り当てる：
  - `/admin/customers/[id]` → 「顧客詳細」
  - `/admin/reservations/[id]` → 「予約詳細」
  （実データに応じた動的タイトルは対象外）
- 対象各ページ本文の `<h1>` 見出しは削除する（`customers`, `customer-statuses`, `campaigns`, `menu`, `staff`, `stores`, `segment-campaigns`, `templates`, `dashboard`, `calendar`, `reservations/new`, `reservations/[id]`, `customers/[id]`, `reports`, `auto-delivery`, `cron-logs` の各 `page.tsx`）

## 2. ページネーション＋スクロール固定（顧客・キャンペーン・配信履歴・テンプレートの4画面）

対象は以下の4画面のみ（メニュー・スタッフ管理はカテゴリ／店舗別グループ化されており対象外）：
- `app/admin/(dashboard)/customers/page.tsx`
- `app/admin/(dashboard)/campaigns/page.tsx`
- `app/admin/(dashboard)/segment-campaigns/page.tsx`（配信履歴テーブル）
- `app/admin/(dashboard)/templates/page.tsx`

### サーバーアクション側
各アクションに `page`（1始まり、省略時1）引数を追加し、サーバー側で20件（`PAGE_SIZE = 20`定数）ずつ切り出して返す。戻り値を `{ items: T[]; totalCount: number }` の形に変更する：
- `searchCustomers(params)` → `CustomerSearchParams` に `page?: number` を追加、戻り値 `Promise<{ items: CustomerListItem[]; totalCount: number }>`
- `listCampaigns(params)` → `ListCampaignsParams` に `page?: number` を追加、戻り値を同様に変更
- `listSegmentCampaigns(page？: number)` → 新規に `page` 引数を追加、戻り値を同様に変更
- `listTemplates(page?: number)` → 新規に `page` 引数を追加、戻り値を同様に変更

Prismaクエリには `take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE` を追加し、`totalCount` は同条件での `count()` を別途取得する。

### UI側
- 共通コンポーネント `components/ui/pagination.tsx` を新規作成。props: `{ page: number; totalPages: number; onPageChange: (page: number) => void }`。「前へ」（`page <= 1`で無効化）／「`X / Y` ページ」表示／「次へ」（`page >= totalPages`で無効化）
- 各対象ページに `page` state（初期値1）を追加し、`reload()` 系関数に反映。検索条件・絞り込み・並び替えを変更したら `page` を1にリセットする
- 一覧テーブルの外側ラッパー（既存の `overflow-x-auto rounded-lg border ...` div）に `max-h-[60vh] overflow-y-auto` を追加し、`<thead>` に `sticky top-0 bg-neutral-0 z-10` を追加する。検索欄・フィルターチップ・「新規登録」ボタンなどテーブルより上の要素は現状のまま（スクロールに巻き込まれない）
- テーブル外・ラッパーの下に `Pagination` コンポーネントを配置する

## テスト方針

- 各サーバーアクションのページネーション追加部分（`take`/`skip`/`totalCount`計算）はTDDでテストを追加する
- `components/ui/pagination.tsx` と `components/admin/admin-header.tsx` はプレゼンテーション専用コンポーネントのため、既存の`components/ui/button.tsx`・`components/ui/modal.tsx`と同様にユニットテスト対象外とする
- 各ページ（`page.tsx`）自体も既存踏襲でテスト対象外

## 影響範囲

- 既存の呼び出し元（`reservations/new/page.tsx`の`searchCustomers({ name: memberQuery })`呼び出しなど）は、戻り値の形が `CustomerListItem[]` から `{ items, totalCount }` に変わるため、全呼び出し元を洗い出して更新する必要がある
