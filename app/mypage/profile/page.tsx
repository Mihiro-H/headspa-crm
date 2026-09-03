"use client";

import { useEffect, useState } from "react";
import {
  getMemberProfile,
  updateMemberProfile,
  changeMemberPassword,
  type MemberProfile,
} from "@/app/actions/update-member-profile";

const inputClass = "h-12 rounded-md border border-neutral-300 px-3";

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

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
      birthDate: profile.birthDate,
      gender: profile.gender,
      emailNotificationEnabled: profile.emailNotificationEnabled,
      lineNotificationEnabled: profile.lineNotificationEnabled,
    });
    setSavingProfile(false);
    setProfileMessage(result.status === "updated" ? "保存しました。" : "保存に失敗しました。");
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
      <h1 className="font-heading text-xl text-primary-700">プロフィール編集</h1>

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
        <input
          type="date"
          value={profile.birthDate}
          onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })}
          className={inputClass}
        />
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
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={profile.lineNotificationEnabled}
            onChange={(e) => setProfile({ ...profile, lineNotificationEnabled: e.target.checked })}
          />
          LINE配信を受け取る
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
          <input
            type="password"
            placeholder="現在のパスワード"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="password"
          placeholder="新しいパスワード"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          disabled={savingPassword}
          onClick={handlePasswordSave}
          className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
        >
          {profile.hasPassword ? "パスワードを変更する" : "パスワードを設定する"}
        </button>
      </div>
    </div>
  );
}
