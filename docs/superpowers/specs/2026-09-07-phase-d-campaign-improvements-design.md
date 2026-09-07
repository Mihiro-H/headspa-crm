# Phase D: キャンペーン管理の改善 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち4番目

## 背景・目的

1. 対象店舗が現在単一選択（`targetStoreId`、nullで全店舗）のため複数選択できるようにする。未選択＝全店舗対象というルールは維持する（ユーザー確定事項）。
2. 対象コースの選択UIが、全コースをカテゴリ問わず1列にフラット表示するチェックボックス群のため、どれがどのカテゴリのコースか分かりづらい。カテゴリごとにグループ化して表示する（`menu/page.tsx`が既にカテゴリ別グループ表示をしており、同じパターンを踏襲する）。

## データモデル変更

`Campaign.targetStoreId`（単一・nullable FK）を廃止し、既存の`CampaignCourseTarget`/`CampaignCategoryTarget`と同じ形の中間テーブル`CampaignStoreTarget`を新設する：

```prisma
model CampaignStoreTarget {
  id         Int @id @default(autoincrement())
  campaignId Int @map("campaign_id")
  storeId    Int @map("store_id")

  campaign Campaign @relation(fields: [campaignId], references: [id])
  store    Store    @relation(fields: [storeId], references: [id])

  @@map("campaign_store_targets")
}
```

`model Campaign`から`targetStoreId`・`targetStore`を削除し、`storeTargets CampaignStoreTarget[]`を追加する。`model Store`から`campaigns Campaign[]`（`targetStoreId`由来のリレーション）を削除し、`campaignStoreTargets CampaignStoreTarget[]`を追加する。

**移行:** 既存の`targetStoreId`が設定されているキャンペーンは、対応する`CampaignStoreTarget`行を1件作成してから`target_store_id`カラムを削除する（`INSERT INTO campaign_store_targets (campaign_id, store_id) SELECT campaign_id, target_store_id FROM campaigns WHERE target_store_id IS NOT NULL;`）。

**注意:** `app/actions/course-campaigns.ts`の`RawCampaign`インターフェース（`targetStoreId: number | null`）、`toActiveCampaignRow`（`targetStoreId: c.targetStoreId`のマッピング）、`resolveCourseCampaigns`内の`.filter((c) => c.targetStoreId === null || c.targetStoreId === storeId)`が`campaign.targetStoreId`を直接参照しているため、`storeTargets`を使った複数店舗チェック（`storeTargetIds.length === 0 || storeTargetIds.includes(storeId)`）に書き換える必要がある。Prismaクエリの`include`に`storeTargets: true`（または`{ select: { storeId: true } }`）を追加し、`toActiveCampaignRow`で`storeTargetIds: c.storeTargets.map(t => t.storeId)`に変換する。

## サーバーアクション変更（`app/actions/manage-campaigns.ts`）

- `CampaignListItem`の`targetStoreId: number | null` / `targetStoreName: string`を`storeIds: number[]` / `storeNames: string[]`に置き換える（`courseIds`/`categoryIds`と同じ形）。
- `CreateCampaignParams`/`UpdateCampaignParams`の`targetStoreId: number | null`を`storeIds: number[]`に変更する。
- `createCampaign`/`updateCampaign`内の`targetStoreId: params.targetStoreId`を、`courseTargets`/`categoryTargets`と全く同じ`storeTargets: { create: params.storeIds.map(storeId => ({ storeId })) }`（更新時は`deleteMany` + `create`）に変更する。
- `listCampaigns`の`include`に`storeTargets: { include: { store: true } }`を追加し、`targetStoreName: c.targetStore?.name ?? "全店舗"`を`storeNames: c.storeTargets.length > 0 ? c.storeTargets.map(t => t.store.name) : ["全店舗"]`に変更する。

## UI変更（`app/admin/(dashboard)/campaigns/page.tsx`）

- 「対象店舗」の単一`<select>`を、店舗一覧のチェックボックス群（対象カテゴリ・対象コースと同じ`flex flex-wrap gap-3`パターン）に置き換える。
- 一覧テーブルの「対象店舗」列を`c.storeNames.join("、")`に変更する。
- 対象コースのチェックボックス群を、`categories.map(category => ...)`で外側にループし、各カテゴリの見出し（`menu/page.tsx`の`<h2 className="text-sm font-medium text-neutral-600">{categoryName}</h2>`と同じスタイル）の下にそのカテゴリに属するコースのチェックボックスだけを並べる形にグループ化する（`courses.filter(c => c.categoryId === category.id)`で絞り込む）。

## テスト方針

- `manage-campaigns.ts`の`listCampaigns`/`createCampaign`/`updateCampaign`の既存テストを新しいデータ形状（`storeIds`/`storeNames`）に合わせて書き換える。
- ページ自体はテスト対象外（既存踏襲）。

## 影響範囲

- `active-campaigns.ts`等、予約時の割引適用ロジックの店舗判定部分の書き換えが必要（実装タスクで対象箇所を特定する）。
