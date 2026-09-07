# Phase H: アカウント管理 設計書

- 日付: 2026-09-07
- 対象: フォレスパ（headspa-crm）管理画面
- 位置づけ: 9サブプロジェクト（A〜I）のうち8番目

## 背景・目的

`/admin/accounts`（Phase Gでプレースホルダーとして確保済み）に、管理者アカウント（`Admin`テーブル）の一覧・新規作成・編集機能を実装する。氏名・メールアドレス・所属店舗（複数選択）・ロール（既存3段階、ユーザー確定事項）・状態（アクティブ／アーカイブ）をテーブル表示し、編集ボタンで各項目を変更できるようにする。

**新規作成はメール招待制とする（2026-09-07 ユーザー方針変更、仮パスワード発行方式は採用しない）。** 作成時に仮パスワードを発行して画面に表示する方式は行わず、招待メール（`lib/delivery/send-email.ts`、Brevo経由）を送り、招待された本人がリンク先でパスワードを設定する。`sendEmail`は`BREVO_API_KEY`未設定時に例外を投げず`{status:"not_configured"}`を返す設計に既になっているため、Brevo未設定の現時点でも本機能自体は実装・動作可能（メール送信だけが実際には行われない）。Brevo設定前の運用に備え、招待リンクは作成直後の画面にも表示し、管理者が手動で共有できるようにする。

## データモデル変更

`Admin.storeId`（単一・nullable FK）を廃止し、多対多の中間テーブル`AdminStore`を新設する（Phase Bの`MemberStore`、Phase Dの`CampaignStoreTarget`と全く同じパターン）：

```prisma
model AdminStore {
  id      Int @id @default(autoincrement())
  adminId Int @map("admin_id")
  storeId Int @map("store_id")

  admin Admin @relation(fields: [adminId], references: [id])
  store Store @relation(fields: [storeId], references: [id])

  @@unique([adminId, storeId])
  @@map("admin_stores")
}
```

`model Admin`に`isActive Boolean @default(true) @map("is_active")`を追加する（`Member.isActive`と同じパターン）。`storeId`・`store`リレーションを削除し、`stores AdminStore[]`を追加する。`model Store`から`admins Admin[]`（`storeId`由来）を削除し、`adminStores AdminStore[]`を追加する。

**移行:** 既存の`storeId`が設定されている管理者（`role`が`manager`/`staff`）は対応する`AdminStore`行を1件作成してから`store_id`カラムを削除する。`role === "hq"`の管理者は元々`storeId`が`null`（全店舗）だったため、`AdminStore`行は作成しない（Iで「hqロールは店舗スコープなし」として扱う）。

**注意:** `lib/auth/admin-credentials.ts`（ログイン時のセッションに`storeId`を含めている場合）・`middleware.ts`・`lib/auth/access-control.ts`が`Admin.storeId`を参照していないか実装タスクの最初に確認する（現状は`role`のみセッションに載せているため影響なしの見込み）。

**招待制のための追加変更:** `Admin.passwordHash`を`String?`（nullable）に変更する（招待済みだがまだパスワード未設定のアカウントを表現するため）。`inviteToken String? @unique @map("invite_token")`・`inviteTokenExpiresAt DateTime? @map("invite_token_expires_at")`を追加する。招待が承諾されると`passwordHash`が設定され、`inviteToken`/`inviteTokenExpiresAt`は`null`に戻す。

## サーバーアクション（新規 `app/actions/manage-admins.ts`）

```ts
"use server";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/delivery/send-email";
import type { AdminRole } from "@prisma/client";

const INVITE_EXPIRY_DAYS = 7;

export interface AdminListItem {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  isPending: boolean; // true = 招待メール送信済みだがパスワード未設定
  storeIds: number[];
  storeNames: string[];
}

export async function listAdmins(): Promise<AdminListItem[]> {
  const admins = await prisma.admin.findMany({
    include: { stores: { include: { store: true } } },
    orderBy: { id: "asc" },
  });
  return admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    isActive: a.isActive,
    isPending: a.passwordHash === null,
    storeIds: a.stores.map((s) => s.storeId),
    storeNames: a.stores.map((s) => s.store.name),
  }));
}

function buildInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/admin/accept-invite?token=${token}`;
}

function inviteEmailBody(name: string, inviteUrl: string): string {
  return `${name}様\n\n管理画面アカウントが作成されました。以下のリンクからパスワードを設定してください（7日間有効です）。\n\n${inviteUrl}\n\nこのメールに心当たりがない場合は破棄してください。`;
}

export interface CreateAdminParams {
  name: string;
  email: string;
  role: AdminRole;
  storeIds: number[];
}

export type CreateAdminResult =
  | { status: "invited"; adminId: number; emailStatus: "sent" | "not_configured" | "failed"; inviteUrl: string }
  | { status: "email_taken" };

export async function createAdmin(params: CreateAdminParams): Promise<CreateAdminResult> {
  const existing = await prisma.admin.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const inviteToken = crypto.randomUUID();
  const inviteTokenExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const admin = await prisma.admin.create({
    data: {
      name: params.name,
      email: params.email,
      role: params.role,
      passwordHash: null,
      inviteToken,
      inviteTokenExpiresAt,
      stores: { create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });

  const inviteUrl = buildInviteUrl(inviteToken);
  const emailResult = await sendEmail({
    to: params.email,
    subject: "【フォレスパ】管理画面アカウントのご招待",
    body: inviteEmailBody(params.name, inviteUrl),
  });

  return { status: "invited", adminId: admin.id, emailStatus: emailResult.status, inviteUrl };
}

export type ResendInviteResult =
  | { status: "resent"; emailStatus: "sent" | "not_configured" | "failed"; inviteUrl: string }
  | { status: "already_active" }
  | { status: "not_found" };

// Brevo未設定期間中に送信できなかった招待、または期限切れになった招待をやり直すための再送機能。
export async function resendAdminInvite(adminId: number): Promise<ResendInviteResult> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    return { status: "not_found" };
  }
  if (admin.passwordHash !== null) {
    return { status: "already_active" };
  }

  const inviteToken = crypto.randomUUID();
  const inviteTokenExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.admin.update({ where: { id: adminId }, data: { inviteToken, inviteTokenExpiresAt } });

  const inviteUrl = buildInviteUrl(inviteToken);
  const emailResult = await sendEmail({
    to: admin.email,
    subject: "【フォレスパ】管理画面アカウントのご招待（再送）",
    body: inviteEmailBody(admin.name, inviteUrl),
  });

  return { status: "resent", emailStatus: emailResult.status, inviteUrl };
}

export interface UpdateAdminParams {
  adminId: number;
  name: string;
  role: AdminRole;
  storeIds: number[];
}

export async function updateAdmin(params: UpdateAdminParams): Promise<void> {
  await prisma.admin.update({
    where: { id: params.adminId },
    data: {
      name: params.name,
      role: params.role,
      stores: { deleteMany: {}, create: params.storeIds.map((storeId) => ({ storeId })) },
    },
  });
}

export async function deactivateAdmin(adminId: number): Promise<void> {
  await prisma.admin.update({ where: { id: adminId }, data: { isActive: false } });
}

export async function reactivateAdmin(adminId: number): Promise<void> {
  await prisma.admin.update({ where: { id: adminId }, data: { isActive: true } });
}
```

`lib/auth/admin-credentials.ts`の`authorizeAdmin`に`isActive: true`の絞り込みを追加し、アーカイブ済み管理者がログインできないようにする（`Member.isActive`が現状ログインをブロックしていないのとは異なり、管理者アカウントは実際にアクセス制御として機能させる——H自体がアクセス管理機能のため）。あわせて、`admin.passwordHash`が`null`（招待未承諾）の場合もログイン不可として`null`を返すガードを追加する。

## サーバーアクション（新規 `app/actions/accept-admin-invite.ts`）

招待リンク先（`/admin/accept-invite?token=...`、未認証で開けるページ）から呼び出す。

```ts
"use server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export interface InviteDetails {
  name: string;
  email: string;
}

export type GetInviteDetailsResult =
  | { status: "valid"; admin: InviteDetails }
  | { status: "invalid" }
  | { status: "expired" };

export async function getInviteDetails(token: string): Promise<GetInviteDetailsResult> {
  const admin = await prisma.admin.findUnique({ where: { inviteToken: token } });
  if (!admin) {
    return { status: "invalid" };
  }
  if (!admin.inviteTokenExpiresAt || admin.inviteTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }
  return { status: "valid", admin: { name: admin.name, email: admin.email } };
}

export type AcceptAdminInviteResult = { status: "accepted" } | { status: "invalid" } | { status: "expired" };

export async function acceptAdminInvite(
  token: string,
  password: string,
): Promise<AcceptAdminInviteResult> {
  const admin = await prisma.admin.findUnique({ where: { inviteToken: token } });
  if (!admin) {
    return { status: "invalid" };
  }
  if (!admin.inviteTokenExpiresAt || admin.inviteTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, inviteToken: null, inviteTokenExpiresAt: null },
  });

  return { status: "accepted" };
}
```

## UI変更（`app/admin/(dashboard)/accounts/page.tsx`）

`customers/page.tsx`と同じ構造（一覧テーブル＋新規登録モーダル＋編集モーダル＋Trash2/RotateCcwアイコン）：
- 列: 氏名・メールアドレス・所属店舗（`storeNames.join("、")`、hqロールの場合は「全店舗」固定表示）・ロール（日本語ラベル：本部／店長／一般）・状態（アクティブ／アーカイブ、`isActive`に応じたバッジ）・招待状況（`isPending`に応じて「招待中」／「設定済み」バッジ、招待中の行には「招待を再送信」ボタン）・編集アイコン・アーカイブ／復帰アイコン。
- 新規登録モーダル：氏名・メールアドレス・ロール（`<select>`）・所属店舗（チェックボックス群、ロールが`hq`の場合は非表示にして自動的に全店舗扱いとする）。作成成功後、`createAdmin`の`emailStatus`に応じたメッセージを表示する（`sent`＝「招待メールを送信しました」、`not_configured`＝「メール送信が未設定のため招待メールは送信されませんでした。Brevo設定後、一覧の『招待を再送信』から送信してください」、`failed`＝「招待メールの送信に失敗しました。後ほど『招待を再送信』からやり直してください」）。あわせて`inviteUrl`を画面上に選択可能なテキストとして表示し、Brevo未設定の間は管理者が手動でリンクを共有できるようにする。
- 編集モーダル：氏名・ロール・所属店舗のみ（メールアドレスは不変、パスワード変更は本Phaseのスコープ外）。

## 会員向け公開ページ `app/admin/accept-invite/page.tsx`（新規、`(dashboard)`配下ではない）

`/admin/login`と同じ配置（未認証で開ける）。URLの`?token=`クエリを読み、`getInviteDetails`で招待の有効性を確認したうえで、パスワード入力欄＋確認用入力欄＋送信ボタンのみのシンプルなページ。`acceptAdminInvite`が`"accepted"`を返したら`/admin/login`へ遷移し、そのままログインしてもらう。`"invalid"`／`"expired"`の場合はエラーメッセージを表示し、管理者に再招待を依頼する旨を案内する。

## テスト方針

- `manage-admins.ts`・`accept-admin-invite.ts`の全関数をTDDで新規テストを書く。
- ページはテスト対象外（既存踏襲）。

## 影響範囲

- `lib/auth/admin-credentials.ts`の`AuthorizedAdmin`インターフェースが`storeId: number | null`を持ち、`authorizeAdmin`が`admin.storeId`を返している（確認済み）。これを`storeIds: number[]`（`AdminStore`から取得）に変更する。ただし現状`lib/auth/config.ts`のJWTコールバックは`token.id`・`token.role`のみをセッションに積んでおり、`storeId`自体はこれまでセッションに伝播していなかった（未使用のデッドコードだった）。店舗スコープ表示の実装（Phase I）で初めて`token.storeIds`をセッションに積む必要が生じるため、本Phaseでは`AuthorizedAdmin.storeIds`への型変更のみ行い、`config.ts`のコールバック更新はPhase Iに委ねる。
- `lib/auth/access-control.ts`の`resolveAccessDecision`が現在`/admin/login`のみを未認証で許可する例外扱いにしている。`/admin/accept-invite`も同様に未認証アクセスを許可する対象に追加する必要がある（`middleware.ts`のmatcherは`/admin/:path*`のため、追加しないと未認証ユーザーが招待リンクを開いた瞬間に`/admin/login`へ強制リダイレクトされてしまう）。
- 環境変数`NEXT_PUBLIC_APP_URL`を新規に使用する（招待リンクの絶対URL生成用）。未設定時は`http://localhost:3000`にフォールバックする。本番運用時はユーザー側で環境変数を設定する必要がある。
