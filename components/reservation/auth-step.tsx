"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { registerMember } from "@/app/actions/register-member";

interface AuthStepProps {
  onAuthenticated: () => void;
}

const inputClass = "h-12 w-full rounded-md border border-neutral-300 px-3";
const passwordInputClass = "h-12 w-full rounded-md border border-neutral-300 px-3 pr-10";

export function AuthStep({ onAuthenticated }: AuthStepProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    birthMonth: 1,
    gender: "female" as "female" | "male" | "other",
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  async function handleRegister() {
    setSubmitting(true);
    setError(null);
    const result = await registerMember(form);
    if (result.status === "email_taken") {
      setError("このメールアドレスは既に登録されています。");
      setSubmitting(false);
      return;
    }
    const signInResult = await signIn("member-credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setSubmitting(false);
    if (signInResult?.ok) {
      onAuthenticated();
    } else {
      setError("登録は完了しましたが、ログインに失敗しました。もう一度ログインしてください。");
    }
  }

  async function handleLogin() {
    setSubmitting(true);
    setError(null);
    const signInResult = await signIn("member-credentials", {
      email: loginForm.email,
      password: loginForm.password,
      redirect: false,
    });
    setSubmitting(false);
    if (signInResult?.ok) {
      onAuthenticated();
    } else {
      setError("メールアドレスまたはパスワードが正しくありません。");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">会員登録／ログイン</h2>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => signIn("line")}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] font-medium text-white"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          LINEで連携ログイン
        </button>
        <p className="text-center text-xs text-neutral-500">
          LINE連携すると、予約確認などのお知らせをLINEで受け取れます。<br/>
        </p>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-lg border p-2 text-sm ${
            mode === "register"
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-neutral-200 text-neutral-600"
          }`}
        >
          新規登録
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg border p-2 text-sm ${
            mode === "login"
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-neutral-200 text-neutral-600"
          }`}
        >
          ログイン
        </button>
      </div>

      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      {mode === "register" ? (
        <div className="flex w-full flex-col gap-3">
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
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="パスワード"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={passwordInputClass}
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
          <br/>
            性別は、性別限定コース・オプションの選択可否判定に使用いたします。
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRegister}
            className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            登録して次へ
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <input
            type="email"
            placeholder="メールアドレス"
            autoComplete="email"
            value={loginForm.email}
            onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
          />
          <div className="relative">
            <input
              type={showLoginPassword ? "text" : "password"}
              placeholder="パスワード"
              autoComplete="current-password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
              className={passwordInputClass}
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((v) => !v)}
              aria-label={showLoginPassword ? "パスワードを非表示にする" : "パスワードを表示する"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showLoginPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleLogin}
            className="h-12 w-full rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            ログインして次へ
          </button>
        </div>
      )}
    </div>
  );
}
