# Phase B: 顧客の利用店舗の多店舗化 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち2番目

## 背景・目的

現在`Member.primaryStoreId`は単一店舗（null可）のFKで、顧客が実際に利用した店舗を表すものではなく単なる「所属」ラベルとして使われている。これを「利用店舗」という複数選択可能な概念に変え、予約が入るたびに自動でその店舗が追加されるようにする。

## データモデル変更

`Member.primaryStoreId`（単一FK）を廃止し、多対多の中間テーブル`MemberStore`を新設する。代表店舗の概念は持たない（全店舗を対等に扱う、ユーザー確定事項）。

```prisma
model MemberStore {
  id       Int    @id @default(autoincrement())
  memberId Int    @map("member_id")
  storeId  Int    @map("store_id")

  member Member @relation(fields: [memberId], references: [id])
  store  Store  @relation(fields: [storeId], references: [id])

  @@unique([memberId, storeId])
  @@map("member_stores")
}
```

`model Member`から`primaryStoreId`フィールドと`primaryStore`リレーションを削除し、代わりに`usedStores MemberStore[]`を追加する。`model Store`から`primaryMembers Member[] @relation("MemberPrimaryStore")`を削除し、`memberStores MemberStore[]`を追加する。

**移行:** 既存の`primaryStoreId`が設定されている顧客は、マイグレーションと同時に対応する`MemberStore`行を1件作成する（`primaryStoreId`がnullの顧客は利用店舗0件のまま）。マイグレーションSQLに`INSERT INTO member_stores (member_id, store_id) SELECT member_id, primary_store_id FROM members WHERE primary_store_id IS NOT NULL;`を追加してから`primary_store_id`カラムを削除する。

## サーバーアクション変更

### `app/actions/search-customers.ts`
- `CustomerListItem`の`primaryStoreId: number | null` / `primaryStoreName: string | null`を`storeIds: number[]` / `storeNames: string[]`に置き換える。
- `CustomerSearchParams.storeId`（単一）は`storeIds?: number[]`に変更し、`{ usedStores: { some: { storeId: { in: storeIds } } } }`のような条件に変える。
- Prismaクエリの`include`を`primaryStore: true`から`usedStores: { include: { store: true } }`に変更し、マッピングで`m.usedStores.map(u => u.store.id)` / `.map(u => u.store.name)`を組み立てる。

### `app/actions/manage-customers.ts`
- `createCustomerByAdmin`/`updateCustomerByAdmin`の`primaryStoreId: number | null`パラメータを`storeIds: number[]`に変更する。作成時は`usedStores: { create: storeIds.map(storeId => ({ storeId })) }`、更新時は`updateCustomerByAdmin`専用の新規関数`updateCustomerStores(memberId, storeIds)`（`deleteMany` + `create`のreplace-allパターン、`manage-campaigns.ts`の`updateCampaign`と同じ手法）を追加する。

### 予約時の自動追加（新規ロジック）
`lib/customer/add-used-store.ts`を新設し、以下の関数を実装する：

```ts
export async function addUsedStore(memberId: number, storeId: number): Promise<void> {
  await prisma.memberStore.upsert({
    where: { memberId_storeId: { memberId, storeId } },
    create: { memberId, storeId },
    update: {},
  });
}
```

（`@@unique([memberId, storeId])`により、Prismaの複合ユニーク名は`memberId_storeId`になる。）

以下の2箇所の予約確定処理の最後にこの関数の呼び出しを追加する：
- `app/actions/confirm-reservation.ts`（会員自身の予約確定時）
- `app/actions/create-phone-reservation.ts`（管理者の電話予約登録時）

いずれも予約対象の`storeId`と`memberId`（ゲスト予約の場合は会員登録直後の`memberId`）が既に関数内で確定しているタイミングの直後に呼び出す。

## UI変更

### `app/admin/(dashboard)/customers/page.tsx`
- 一覧の「所属店舗」列を「利用店舗」に改称し、`primaryStoreName`単一表示から`storeNames.join("、")`（複数バッジまたはカンマ区切りテキスト）表示に変更する。
- 新規登録モーダル・編集モーダルの店舗`<select>`（単一選択）を、店舗一覧のチェックボックス群（複数選択、`campaigns/page.tsx`の対象カテゴリ・対象コースと同じUIパターン）に置き換える。

### `app/admin/(dashboard)/reservations/new/page.tsx`
- 顧客検索結果に店舗情報を表示している箇所があれば同様に複数表示に対応する（現状は氏名のみの検索結果表示のため、変更不要な可能性が高い。実装時に確認する）。

## 影響範囲

- `search-customers.ts`の戻り値の形が変わるため、Task 8（Phase Aで実装済み）の`customers/page.tsx`が今回また書き換えの対象になる。
- `manage-customers.test.ts`・`search-customers.test.ts`の既存テストを大幅に更新する必要がある。
- キャンペーンの対象店舗（`Campaign.targetStoreId`）・スタッフの所属店舗（`Staff.storeId`）はこのPhaseでは変更しない（それぞれPhase D・Phase Eで別途扱う）。

## テスト方針

- `addUsedStore`・`updateCustomerStores`はTDDで新規テストを書く。
- `search-customers.ts`・`manage-customers.ts`の既存テストは新しいデータ形状に合わせて書き換える。
