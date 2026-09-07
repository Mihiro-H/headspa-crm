# Phase C: メニュー・料金管理の拡張 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち3番目

## 背景・目的

現在`app/admin/(dashboard)/menu/page.tsx`は料金（`price`）のみインライン編集可能。コース名・所要時間（`durationEstimateMin`のみ、ユーザー確定事項）も編集可能にし、行右に公開状態（`isPublished`）を切り替えるステータス列を追加する。`isPublished`は既に会員側の`app/actions/courses.ts`（`listCoursesForCategory`等）で`where: { isPublished: true }`として使われているため、スキーマ変更は不要——新しいServer Actionとインラインの編集UIを追加するだけでよい。

## データモデル変更

なし。既存の`Course.name`・`Course.durationEstimateMin`・`Course.isPublished`をそのまま使う。

## サーバーアクション変更

`app/actions/manage-courses.ts`に以下2関数を追加する（`createCourse`・`updateCoursePrice`はそのまま維持）：

```ts
export interface UpdateCourseDetailsParams {
  courseId: number;
  name: string;
  durationEstimateMin: number;
}

export async function updateCourseDetails(params: UpdateCourseDetailsParams): Promise<void> {
  await prisma.course.update({
    where: { id: params.courseId },
    data: { name: params.name, durationEstimateMin: params.durationEstimateMin },
  });
}

export async function updateCoursePublished(courseId: number, isPublished: boolean): Promise<void> {
  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished },
  });
}
```

`ManagedCourse`インターフェースは既に`isPublished: boolean`を含んでいるため変更不要。

## UI変更

`app/admin/(dashboard)/menu/page.tsx`のテーブル：
- 「コース名」列を`<input type="text" defaultValue={c.name} onBlur={...}>`に変更（`onBlur`で`updateCourseDetails`を呼ぶ。所要時間と同時に送る必要があるため、`name`・`durationEstimateMin`をまとめて1つの`handleDetailsBlur(courseId, name, durationEstimateMin)`関数で扱う——Task 14で修正した「部分更新で競合を避ける」設計に倣い、コース名側の`onBlur`ではコース名のみ、所要時間側の`onBlur`では所要時間のみを送る2つの独立したハンドラに分ける）。
- 「所要時間」列の表示テキストを`<input type="number" defaultValue={c.durationEstimateMin} onBlur={...}>`に変更。
- 新しい「ステータス」列を追加し、`<select value={c.isPublished ? "published" : "unpublished"} onChange={...}>`（公開中／停止中の2択）で`updateCoursePublished`を呼ぶ。楽観的にローカル状態も更新する。

## テスト方針

- `updateCourseDetails`・`updateCoursePublished`はTDDで新規テストを書く。
- ページ自体はテスト対象外（既存踏襲）。

## 影響範囲

- 会員側の予約フロー（`app/actions/courses.ts`）は変更しない。`isPublished: false`にした瞬間、会員側のコース一覧に表示されなくなる（既存ロジックそのまま）。
