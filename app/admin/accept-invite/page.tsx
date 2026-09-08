"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getInviteDetails,
  acceptAdminInvite,
  type InviteDetails,
} from "@/app/actions/accept-admin-invite";

type LoadState =
  | { status: "loading" }
  | { status: "valid"; admin: InviteDetails }
  | { status: "invalid" }
  | { status: "expired" };

export default function AcceptAdminInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loadState, setLoadState] = useState<LoadState>(() =>
    token ? { status: "loading" } : { status: "invalid" },
  );
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    getInviteDetails(token).then((result) => {
      if (result.status === "valid") {
        setLoadState({ status: "valid", admin: result.admin });
      } else {
        setLoadState({ status: result.status });
      }
    });
  }, [token]);

  async function handleSubmit() {
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません。");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await acceptAdminInvite(token, password);
    setSubmitting(false);
    if (result.status === "accepted") {
      router.push("/admin/login");
    } else {
      setError(
        result.status === "expired"
          ? "招待の有効期限が切れています。管理者に再招待を依頼してください。"
          : "招待リンクが無効です。管理者に再招待を依頼してください。",
      );
    }
  }

  if (loadState.status === "loading") {
    return (
      <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
        <p className="text-sm text-neutral-500">確認中...</p>
      </div>
    );
  }

  if (loadState.status !== "valid") {
    return (
      <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
        <h1 className="font-heading text-2xl text-primary-700">フォレスパ 管理画面</h1>
        <p className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {loadState.status === "expired"
            ? "招待の有効期限が切れています。管理者に再招待を依頼してください。"
            : "招待リンクが無効です。管理者に再招待を依頼してください。"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl text-primary-700">フォレスパ 管理画面</h1>
      <p className="text-sm text-neutral-600">
        {loadState.admin.name}様（{loadState.admin.email}）のパスワードを設定してください。
      </p>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <input
        type="password"
        placeholder="新しいパスワード（8文字以上）"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <input
        type="password"
        placeholder="新しいパスワード（確認）"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        パスワードを設定する
      </button>
    </div>
  );
}
