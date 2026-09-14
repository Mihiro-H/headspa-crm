"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import {
  getMemberProfile,
  updateMemberProfile,
  changeMemberPassword,
  type MemberProfile,
} from "@/app/actions/update-member-profile";

// signIn("line", ...)のcallbackUrlに付与し、リダイレクト後に「連携を試みた直後か」を
// 判定するためのマーカー（NextAuthのセッション/トークンには連携成功・失敗の詳細を
// 持たせず、単純にこのURLパラメータの有無とlineLinkedの最新値だけで表示を決める）。
const LINE_LINK_CALLBACK_URL = "/mypage/profile?lineLink=1";

const inputClass = "h-12 rounded-md border border-neutral-300 px-3";
const passwordInputClass = "h-12 w-full rounded-md border border-neutral-300 px-3 pr-10";

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [justAttemptedLineLink] = useState(
    () => typeof window !== "undefined" && window.location.search.includes("lineLink=1"),
  );

  useEffect(() => {
    getMemberProfile().then(setProfile);
  }, []);

  async function handleProfileSave() {
    if (!profile) return;
    setSavingProfile(true);
    setProfileMessage(null);
    const result = await updateMemberProfile({
      name: profile.name,
      phone: profile.phone,
      birthMonth: profile.birthMonth,
      gender: profile.gender,
      emailNotificationEnabled: profile.emailNotificationEnabled,
      lineNotificationEnabled: profile.lineNotificationEnabled,
    });
    setSavingProfile(false);
    if (result.status === "updated") {
      setProfileMessage("保存しました。");
    } else if (result.status === "line_not_linked") {
      setProfileMessage("LINE連携がされていないため、LINE配信は有効にできません。");
    } else {
      setProfileMessage("保存に失敗しました。");
    }
  }

  async function handlePasswordSave() {
    setSavingPassword(true);
    setPasswordMessage(null);
    const result = await changeMemberPassword({
      currentPassword: profile?.hasPassword ? currentPassword : null,
      newPassword,
    });
    setSavingPassword(false);
    if (result.status === "updated") {
      setPasswordMessage("パスワードを更新しました。");
      setCurrentPassword("");
      setNewPassword("");
      setProfile((p) => (p ? { ...p, hasPassword: true } : p));
    } else if (result.status === "incorrect_current_password") {
      setPasswordMessage("現在のパスワードが正しくありません。");
    } else {
      setPasswordMessage("更新に失敗しました。");
    }
  }

  if (!profile) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl text-primary-700">プロフィール編集</h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">基本情報</h2>
        {profileMessage && <p className="text-sm text-neutral-600">{profileMessage}</p>}
        <input
          type="text"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          className={inputClass}
          placeholder="氏名"
        />
        <input
          type="tel"
          value={profile.phone}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          className={inputClass}
          placeholder="電話番号"
        />
        <select
          value={profile.birthMonth}
          onChange={(e) => setProfile({ ...profile, birthMonth: Number(e.target.value) })}
          className={inputClass}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
            <option key={month} value={month}>
              {month}月生まれ
            </option>
          ))}
        </select>
        <select
          value={profile.gender}
          onChange={(e) =>
            setProfile({ ...profile, gender: e.target.value as MemberProfile["gender"] })
          }
          className={inputClass}
        >
          <option value="female">女性</option>
          <option value="male">男性</option>
          <option value="other">その他</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={profile.emailNotificationEnabled}
            onChange={(e) =>
              setProfile({ ...profile, emailNotificationEnabled: e.target.checked })
            }
          />
          メール配信を受け取る
        </label>
        <label
          className={`flex items-center gap-2 text-sm ${
            profile.lineLinked ? "text-neutral-700" : "text-neutral-400"
          }`}
        >
          <input
            type="checkbox"
            checked={profile.lineNotificationEnabled}
            disabled={!profile.lineLinked}
            onChange={(e) => setProfile({ ...profile, lineNotificationEnabled: e.target.checked })}
          />
          LINE配信を受け取る
          {!profile.lineLinked && "（LINE連携が必要です）"}
        </label>

        <button
          type="button"
          disabled={savingProfile}
          onClick={handleProfileSave}
          className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
        >
          保存する
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">
          {profile.hasPassword ? "パスワード変更" : "メールログインを追加設定する"}
        </h2>
        {!profile.hasPassword && (
          <p className="text-xs text-neutral-500">
            現在LINE連携のみでログインしています。パスワードを設定すると、メールアドレス＋パスワードでもログインできるようになります。
          </p>
        )}
        {passwordMessage && <p className="text-sm text-neutral-600">{passwordMessage}</p>}
        {profile.hasPassword && (
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="現在のパスワード"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
        )}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="新しいパスワード"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
        <button
          type="button"
          disabled={savingPassword}
          onClick={handlePasswordSave}
          className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
        >
          {profile.hasPassword ? "パスワードを変更する" : "パスワードを設定する"}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">LINE連携</h2>
        {profile.lineLinked ? (
          <p className="text-sm text-neutral-700">LINE連携済みです。</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              メールアドレスでの登録に加えてLINEを連携すると、次回からLINEでもログインできるようになります。
            </p>
            {justAttemptedLineLink && (
              <p className="text-sm text-error">
                連携できませんでした。このLINEアカウントは既に別の会員に連携されている可能性があります。
              </p>
            )}
            <button
              type="button"
              onClick={() => signIn("line", { callbackUrl: LINE_LINK_CALLBACK_URL })}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] font-medium text-white"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              LINEと連携する
            </button>
          </>
        )}
      </div>
    </div>
  );
}
