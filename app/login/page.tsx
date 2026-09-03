"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function MemberLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await signIn("member-credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (result?.ok) {
      router.push("/mypage");
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-heading text-2xl text-primary-700">フォレスパ</h1>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <button
        type="button"
        onClick={() => signIn("line", { callbackUrl: "/mypage" })}
        className="h-12 w-full rounded-lg bg-[#06C755] font-medium text-white"
      >
        LINEで連携ログイン
      </button>
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        または
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
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
      <p className="text-center text-sm text-neutral-500">
        初めての方は
        <a href="/reserve" className="text-primary-600 underline">
          ご予約はこちら
        </a>
        から会員登録できます。
      </p>
    </div>
  );
}
