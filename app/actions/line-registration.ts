"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Gender } from "@prisma/client";

export type PendingLineSignupResult = { status: "pending"; name: string } | { status: "none" };

// LINEログインで新規（既存会員に紐付かない）としてフラグが立った直後のセッションかを
// 確認する。/register/line-completeページが、直接アクセス（保留中の連携が無い）で
// 開かれた場合の判定に使う。
export async function getPendingLineSignup(): Promise<PendingLineSignupResult> {
  const session = await auth();
  if (!session?.needsProfileCompletion) {
    return { status: "none" };
  }
  return { status: "pending", name: session.pendingLineName ?? "" };
}

export interface CompleteLineRegistrationParams {
  name: string;
  email: string;
  phone: string;
  birthMonth: number;
  gender: Gender;
}

export type CompleteLineRegistrationResult =
  | { status: "created"; memberId: number }
  | { status: "email_taken" }
  | { status: "no_pending_line_signup" };

export async function completeLineRegistration(
  params: CompleteLineRegistrationParams,
): Promise<CompleteLineRegistrationResult> {
  const session = await auth();
  // pendingLineUserIdはクライアントからではなく、認証済みセッション（LINE OAuth
  // コールバックがjwtコールバックで設定したもの）から取る。クライアント入力を
  // 信用してlineUserIdを受け取ると、他人のLINEアカウントを騙って紐付けられてしまう。
  if (!session?.needsProfileCompletion || !session.pendingLineUserId) {
    return { status: "no_pending_line_signup" };
  }

  const existing = await prisma.member.findUnique({ where: { email: params.email } });
  if (existing) {
    return { status: "email_taken" };
  }

  const defaultStatus = await prisma.customerStatus.findFirstOrThrow({
    orderBy: { sortOrder: "asc" },
  });

  const member = await prisma.member.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      birthMonth: params.birthMonth,
      gender: params.gender,
      lineUserId: session.pendingLineUserId,
      // LINEのみでの新規登録はパスワード未設定。マイページのプロフィール編集から
      // 後から設定できる（既存のhasPassword/パスワード追加設定と同じ扱い）。
      passwordHash: null,
      statusId: defaultStatus.id,
    },
  });

  return { status: "created", memberId: member.id };
}
