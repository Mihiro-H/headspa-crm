"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  getPendingLineSignup,
  completeLineRegistration,
} from "@/app/actions/line-registration";

const inputClass = "h-12 w-full rounded-md border border-neutral-300 px-3";

// リダイレクト元（middlewareまたは予約ウィザード）が付与する、登録完了後に
// 戻る先。無指定・不正な値の場合はマイページに戻す。
function resolveNextPath(): string {
  if (typeof window === "undefined") return "/mypage";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/mypage";
}

export default function LineCompleteProfilePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    birthMonth: 1,
    gender: "female" as "female" | "male" | "other",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPendingLineSignup().then((result) => {
      if (result.status === "none") {
        setStatus("none");
        router.replace("/mypage");
        return;
      }
      setForm((f) => ({ ...f, name: result.name }));
      setStatus("ready");
    });
  }, [router]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await completeLineRegistration(form);

    if (result.status === "email_taken") {
      setError("このメールアドレスは既に登録されています。");
      setSubmitting(false);
      return;
    }
    if (result.status === "no_pending_line_signup") {
      setError("LINE連携の情報が見つかりませんでした。お手数ですが最初からお試しください。");
      setSubmitting(false);
      return;
    }

    // 会員レコードは作成済みだが、今のセッションはまだLINEのuserIdだけを持つ
    // 未登録状態のトークンのまま。作成した会員に紐付いたセッションへ更新するため、
    // LINE側の同意は既に済んでいるはずの認証を、もう一度（今度は既存会員として）
    // 実行し直す。
    await signIn("line", { callbackUrl: resolveNextPath() });
  }

  if (status === "loading" || status === "none") {
    return <p className="p-4 text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="font-heading text-xl text-primary-700">会員情報の登録</h1>
      <p className="text-sm text-neutral-600">
        LINE連携が完了しました。あと少しで登録は完了です。以下の情報をご入力ください。
      </p>

      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      <input
        type="text"
        placeholder="氏名"
        autoComplete="name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className={inputClass}
      />
      <input
        type="email"
        placeholder="メールアドレス"
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className={inputClass}
      />
      <input
        type="tel"
        placeholder="電話番号（任意）"
        autoComplete="tel"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        className={inputClass}
      />
      <select
        value={form.birthMonth}
        onChange={(e) => setForm((f) => ({ ...f, birthMonth: Number(e.target.value) }))}
        className={inputClass}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
          <option key={month} value={month}>
            {month}月生まれ
          </option>
        ))}
      </select>
      <select
        value={form.gender}
        onChange={(e) =>
          setForm((f) => ({ ...f, gender: e.target.value as typeof form.gender }))
        }
        className={inputClass}
      >
        <option value="female">女性</option>
        <option value="male">男性</option>
        <option value="other">その他</option>
      </select>
      <p className="text-xs text-neutral-500">
        誕生月をご登録いただくと誕生月特典が受け取れます。
        <br />
        性別は、性別限定コース・オプションの選択可否判定に使用いたします。
      </p>
      <p className="text-xs text-neutral-500">
        <a href="/terms" target="_blank" className="text-primary-600 underline">
          利用規約
        </a>
        に同意の上、登録してください。
      </p>
      <button
        type="button"
        disabled={submitting || !form.name || !form.email}
        onClick={handleSubmit}
        className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
      >
        登録する
      </button>
    </div>
  );
}
