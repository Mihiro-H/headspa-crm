"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await signIn("admin-credentials", { email, password, redirect: false });
    setSubmitting(false);
    // NextAuth v5 beta系は認証失敗時でもok:trueとerrorが同時に返ることがあるため、
    // okだけでなくerrorが無いことも確認する（2026-09-12、実機調査で確認済み）。
    if (result?.ok && !result?.error) {
      router.push("/admin/dashboard");
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl text-primary-700">フォレスパ 管理画面</h1>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-12 rounded-md border border-neutral-300 px-3"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
      >
        ログイン
      </button>
    </div>
  );
}
