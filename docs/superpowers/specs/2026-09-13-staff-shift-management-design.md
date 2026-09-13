# スタッフシフト管理機能 設計書

- 日付: 2026-09-13
- 対象: フォレスパ（headspa-crm）管理画面のスタッフシフト管理（新規機能）
- 位置づけ: 新規サブプロジェクト。既存の予約可能時間判定ロジック（`lib/reservation/time-slots.ts`の`generateAvailableSlots`、`StaffShift`を読む）には手を加えず、その入力元となるシフトデータをどう作るかの仕組みを追加する。

## 背景・目的

現状、`StaffShift`（確定シフト）は作成する手段がなく、常に空。今回、以下の3段階フローでシフトデータを作れるようにする：

```
①スタッフ本人が希望を入力 → StaffShiftRequest（新規）
②店長が「AIで自動作成」を押す（ルールベース自動割当） → StaffShiftDraft（新規、ドラフト）
③店長がドラフトを確認・必要なら手直しして「確定する」 → StaffShift（既存、確定シフト）
```

`StaffShift`に書き込むのは③の確定操作のみ。①②の段階では既存の予約可能時間判定に一切影響しない。

**希望の提出方法（Googleフォーム等への置き換え）は今回のスコープ外。** 今回はスタッフが管理画面に自分でログインして入力する暫定UIを用意し、将来的に別の提出経路に差し替える場合も`StaffShiftRequest`テーブルへのデータ投入という同じ接続点を使えばよい設計にする。

**複数スタッフ間の必要人数調整（最低出勤人数の担保等）は今回のスコープ外。** 自動生成は「各スタッフの希望をそのまま反映する」だけの単純な変換であり、店舗全体の人員配置最適化は行わない。

## 前提となる制約の確認

- `Staff`（施術者、カレンダーに表示される）と`Admin`（ログインアカウント）は現状**紐付いていない別テーブル**。スタッフ本人がログインして自分の希望を入力するには、ログイン中の`Admin`が「自分がどの`Staff`か」を特定できる必要がある。
- `Admin.role`は`hq`/`manager`/`staff`の3種類（既存のRolePagePermissionシステムが権限管理に使用）。今回の「スタッフ」は`role: "staff"`のAdminアカウントを指す。

## データモデル変更

### 1. `Admin`に`staffId`（任意）を追加

```prisma
model Admin {
  // ...既存フィールド
  staffId Int? @map("staff_id")

  staff Staff? @relation(fields: [staffId], references: [id])
  // ...既存のリレーション
}
```

`role: "staff"`のAdminアカウントを、招待・アカウント編集の際にどの`Staff`（施術者）に対応するか紐付けるために使う。`hq`/`manager`は`null`のままでよい。

### 2. `StaffShiftRequest`（新規）

```prisma
model StaffShiftRequest {
  id                 Int       @id @default(autoincrement()) @map("request_id")
  staffId            Int       @map("staff_id")
  workDate           DateTime  @map("work_date") @db.Date
  isDayOffRequested  Boolean   @default(false) @map("is_day_off_requested")
  preferredStartTime DateTime? @map("preferred_start_time") @db.Time()
  preferredEndTime   DateTime? @map("preferred_end_time") @db.Time()
  updatedAt          DateTime  @updatedAt @map("updated_at")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shift_requests")
}
```

`isDayOffRequested: true`の場合、`preferredStartTime`/`preferredEndTime`は`null`。

### 3. `StaffShiftDraft`（新規）

`StaffShift`と同じ形。確定前の一時データなので別テーブルにし、既存の予約可能時間判定（`StaffShift`のみを読む）に一切影響させない。

```prisma
model StaffShiftDraft {
  id          Int       @id @default(autoincrement()) @map("draft_id")
  staffId     Int       @map("staff_id")
  workDate    DateTime  @map("work_date") @db.Date
  startTime   DateTime? @map("start_time") @db.Time()
  endTime     DateTime? @map("end_time") @db.Time()
  isDayOff    Boolean   @default(false) @map("is_day_off")
  generatedAt DateTime  @default(now()) @map("generated_at")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shift_drafts")
}
```

### `Staff`モデルへの追記（逆リレーション）

```prisma
model Staff {
  // ...既存フィールド・リレーション
  admins        Admin[]
  shiftRequests StaffShiftRequest[]
  shiftDrafts   StaffShiftDraft[]
}
```

### マイグレーション運用

これまでの事故（[[headspa-crm-prisma-migration-safety]]）を踏まえ、Claudeが`migration.sql`を新規作成し、ユーザーが`npx prisma migrate deploy`（リセット確認プロンプトの出ない安全なコマンド）で適用する運用を継続する。全て新規テーブル＋既存テーブルへの任意カラム追加のみで、データ移行は不要。

## 自動生成ルール（ルールベース、外部API呼び出しなし）

`lib/scheduling/derive-shift-draft.ts`（新規、純粋関数・単体テスト対象）に以下のロジックを実装する：

```ts
export interface ShiftRequestInput {
  isDayOffRequested: boolean;
  preferredStartMinutes: number | null; // nullなら時間指定なし
  preferredEndMinutes: number | null;
}

export interface StoreHoursInput {
  openMinutes: number;
  closeMinutes: number;
}

export interface DraftShiftResult {
  isDayOff: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}

export function deriveDraftShift(
  request: ShiftRequestInput | null,
  storeHours: StoreHoursInput,
): DraftShiftResult {
  // 1. 希望の提出が無い日 → 安全側で休みにする
  if (!request) return { isDayOff: true, startMinutes: null, endMinutes: null };
  // 2. 休み希望 → 休み
  if (request.isDayOffRequested) return { isDayOff: true, startMinutes: null, endMinutes: null };
  // 3. 時間指定なしで休み希望でもない（不正な入力）→ 休み扱いにフォールバック
  if (request.preferredStartMinutes === null || request.preferredEndMinutes === null) {
    return { isDayOff: true, startMinutes: null, endMinutes: null };
  }
  // 4. 希望時間帯を店舗の営業時間内にクランプする
  const start = Math.max(request.preferredStartMinutes, storeHours.openMinutes);
  const end = Math.min(request.preferredEndMinutes, storeHours.closeMinutes);
  // 5. クランプの結果、開始>=終了になってしまったら休み扱い
  if (start >= end) return { isDayOff: true, startMinutes: null, endMinutes: null };

  return { isDayOff: false, startMinutes: start, endMinutes: end };
}
```

店舗の営業時間（平日/週末）は既存の`lib/reservation/store-hours.ts`の`getStoreOpenHours`を流用する。

## サーバーアクション

### `app/actions/staff-shift-requests.ts`（新規）

- `getMyStaffId(): Promise<number | null>` — ログイン中のAdminに紐付く`staffId`を返す（`role !== "staff"`または`staffId`未設定なら`null`）。
- `getStaffShiftRequests(staffId: number, yearMonth: string): Promise<StaffShiftRequestItem[]>` — 呼び出し元が「本人（`getMyStaffId()`が一致）」または「manager/hqでその店舗のスコープ内」であることを確認してから返す。それ以外は空配列。
- `saveStaffShiftRequest(params: { staffId: number; workDate: string; isDayOffRequested: boolean; preferredStartMinutes: number | null; preferredEndMinutes: number | null }): Promise<{status: "saved" | "unauthorized"}>` — 呼び出し元が本人であることを確認してからupsert（manager/hqによる代理入力は今回のスコープ外＝許可しない。本人以外は`unauthorized`）。

### `lib/scheduling/derive-shift-draft.ts`（新規、上記の純粋関数）

### `app/actions/generate-shift-draft.ts`（新規）

- `generateShiftDraftForStore(storeId: number, yearMonth: string): Promise<{status: "generated" | "unauthorized"; count: number}>` — manager/hqのみ（`getCurrentAdminStoreScope`で店舗スコープ確認）。対象店舗の在籍スタッフ×対象月の全日について、その日の`StaffShiftRequest`（あれば）と店舗営業時間から`deriveDraftShift`でドラフトを計算し、`StaffShiftDraft`をupsertする（何度でも再実行可能＝冪等）。

### `app/actions/confirm-shift-draft.ts`（新規）

- `updateShiftDraft(params: { staffId: number; workDate: string; isDayOff: boolean; startMinutes: number | null; endMinutes: number | null }): Promise<{status: "updated" | "unauthorized"}>` — manager/hqが確定前にドラフトを個別に手直しする。
- `confirmShiftDraftForStore(storeId: number, yearMonth: string): Promise<{status: "confirmed" | "unauthorized"; count: number}>` — manager/hqのみ。対象月の`StaffShiftDraft`を`StaffShift`へupsertする（実際の予約可能時間判定に反映される瞬間はここだけ）。

## 画面

### `/admin/my-shift-requests`（新規、スタッフ本人向け）

- `getMyStaffId()`が`null`の場合（hq/managerでStaff未紐付けの場合含む）は「スタッフとして紐付けられていません」と表示するのみ。
- 月選択（デフォルトは翌月）。
- 選択月の日ごとに1行：休み希望チェックボックス／希望開始・終了時刻（`<input type="time">`）。変更のたびに`saveStaffShiftRequest`で保存（自動保存、明示的な一括保存ボタンは設けない＝入力の取りこぼしを防ぐ）。

### `/admin/staff-shifts`（新規、店長向け）

- 店舗・月選択（既存の店舗スコープ絞り込みパターンを流用）。
- 上段：全スタッフ×日のグリッドで、提出済みの希望を**閲覧専用**で表示（休み希望／希望時間帯／未提出）。
- 「AIで自動作成」ボタン：`generateShiftDraftForStore`を呼び、下段のドラフトグリッドを再取得・再描画する。
- 下段：ドラフトグリッド（全スタッフ×日）。各セルをクリックすると休み／時間帯を編集でき、`updateShiftDraft`で個別保存する。
- 「確定する」ボタン：`confirmShiftDraftForStore`を呼ぶ。確定後は成功件数をメッセージ表示する。

いずれの画面もナビゲーションへの追加により、既存の`RolePagePermission`（ロール別のedit/view/hidden設定）がそのまま適用される。

## テスト方針

- `lib/scheduling/derive-shift-draft.ts`：純粋関数なので単体テストを手厚く書く（希望なし／休み希望／時間指定／営業時間外にはみ出す／クランプの結果start>=endになる、の各分岐）。
- 各サーバーアクションはTDDで、認可（本人／店舗スコープ外）の分岐を含めてテストする。

## スコープ外（今回やらないこと）

- スタッフ希望のGoogleフォーム／スプレッドシート等への提出経路の統合（後日検討）。
- 複数スタッフ間の必要人数調整・シフトの公平性最適化。
- 店長による希望データ自体の代理入力・編集（ドラフト段階での手直しのみ可能）。
- シフト確定後の変更履歴・通知（スタッフへの確定シフト通知メール等）。
