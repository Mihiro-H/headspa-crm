"use client";

import { useEffect, useState } from "react";
import {
  getMemberNotifications,
  type MemberNotificationItem,
} from "@/app/actions/member-notifications";

const TEMPLATE_TYPE_LABEL: Record<MemberNotificationItem["templateType"], string> = {
  birthday: "誕生日メッセージ",
  reminder: "来店リマインド",
  segment: "キャンペーンのお知らせ",
};

function formatSentAt(sentAt: string): string {
  const date = new Date(sentAt);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日`;
}

export default function MemberNotificationsPage() {
  const [notifications, setNotifications] = useState<MemberNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMemberNotifications()
      .then((n) => {
        setNotifications(n ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("お知らせの取得に失敗しました。");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl text-primary-700">お知らせ</h1>

      {notifications.length === 0 ? (
        <p className="text-sm text-neutral-500">お知らせはまだありません。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary-600">
                  {TEMPLATE_TYPE_LABEL[n.templateType]}
                </span>
                <span className="text-xs text-neutral-500">{formatSentAt(n.sentAt)}</span>
              </div>
              {n.subject && <p className="mt-1 text-sm text-neutral-800">{n.subject}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
