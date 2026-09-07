# Phase E: スタッフ管理の再設計 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち5番目

## 背景・目的

現在`app/admin/(dashboard)/staff/page.tsx`は店舗別グループ表示（見出しでグループ化）で、店舗を絞り込む手段がない。予約カレンダー（`calendar/page.tsx`）と同じ単一`<select>`のドロップダウン店舗フィルターに変更し、「全店舗」表示時はどの店舗のスタッフかが分かるよう店舗列を追加する。また、スタッフの他店舗への異動に対応するため、所属店舗を編集可能にする。「編集」（氏名・紹介文・所属店舗）と「アーカイブ」（在籍中/退職の切り替え、Trash2/RotateCcwアイコン）の行アイコンを追加する。

## データモデル変更

なし。`Staff.storeId`（単一FK、既存）・`Staff.isActive`（既存）・`Staff.bio`（既存、nullable）をそのまま使う。スタッフは1人1店舗所属のまま（顧客の「利用店舗」のような複数化はしない——異動時に付け替える運用のため）。

## サーバーアクション変更（`app/actions/manage-staff.ts`）

`createStaff`・`updateStaff`（指名料金・在籍フラグの部分更新は既存のまま）に加えて、以下2関数を追加する：

```ts
export interface UpdateStaffProfileParams {
  staffId: number;
  name: string;
  bio: string | null;
  storeId: number;
}

export async function updateStaffProfile(params: UpdateStaffProfileParams): Promise<void> {
  await prisma.staff.update({
    where: { id: params.staffId },
    data: { name: params.name, bio: params.bio, storeId: params.storeId },
  });
}
```

既存の`updateStaff({staffId, nominationFee, isActive})`は指名料金のインライン編集と在籍状態の切り替えの両方に引き続き使う（アーカイブアイコンからは`isActive`だけを渡す形で呼び出す。既存の在籍チェックボックスは廃止する——ユーザー確定事項）。

`listAllStaff`は変更しないが、呼び出し側で`storeId`によるクライアントサイドの絞り込みを行う（件数が少ないため、サーバー側絞り込みは追加しない）。

## UI変更（`app/admin/(dashboard)/staff/page.tsx`）

- 店舗別`grouped`表示（`Object.entries(grouped).map(...)`による複数テーブル）を廃止し、1つのテーブルにする。
- ページ上部に`calendar/page.tsx`と同じ`<select value={storeId ?? ""} onChange={...}><option value="">全店舗</option>{stores.map(...)}</select>`を設置する。
- テーブルに「所属店舗」列を追加する（`storeId === null`＝全店舗表示時のみ表示、特定店舗を選んでいる時は非表示——列が冗長になるため）。
- 既存の在籍チェックボックス列を、`customers/page.tsx`と同じ形の編集（Pencil）・アーカイブ（Trash2/RotateCcw）アイコン列に置き換える。編集アイコンは氏名・紹介文・所属店舗を編集するモーダルを開く（`customers/page.tsx`の編集モーダルと同じ構造。所属店舗は単一`<select>`）。
- 「＋新規登録」モーダルにも紹介文入力は既存のまま。所属店舗は既存の単一`<select>`のまま変更なし（新規登録時は複数化しない）。

## テスト方針

- `updateStaffProfile`はTDDで新規テストを書く。
- ページ自体はテスト対象外（既存踏襲）。

## 影響範囲

- なし（`Staff`モデルは変更しないため、予約フロー等への影響はない）。
