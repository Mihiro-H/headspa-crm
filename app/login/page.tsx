"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MessageCircle, Eye, EyeOff } from "lucide-react";

export default function MemberLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await signIn("member-credentials", { email, password, redirect: false });
    setSubmitting(false);
    // NextAuth v5 beta系は認証失敗時でもok:trueとerrorが同時に返ることがあるため、
    // okだけでなくerrorが無いことも確認する（2026-09-12、実機調査で確認済み）。
    if (result?.ok && !result?.error) {
      router.push("/mypage");
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-start gap-4 p-4 pt-16">
      <Image
        src="/logo/foresupa_logo_tight_transparent.png"
        alt="フォレスパ"
        width={1206}
        height={600}
        className="h-auto w-40"
        priority
      />
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <button
        type="button"
        onClick={() => signIn("line", { callbackUrl: "/mypage" })}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] font-medium text-white"
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        LINEで連携ログイン
      </button>
      <p className="text-center text-xs text-neutral-500">
        LINE連携すると、予約確認や前日リマインドなどのお知らせをLINEで受け取れます。
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        または
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
      <input
        type="email"
        placeholder="メールアドレス"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 w-full rounded-md border border-neutral-300 px-3"
      />
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="パスワード"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-md border border-neutral-300 px-3 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "パスワードを非表示にする" : "パスワードを表示する"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
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
