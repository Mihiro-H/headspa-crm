"use client";

import { useEffect, useState } from "react";
import { getMypageSummary, type MypageSummary } from "@/app/actions/mypage-summary";

export default function MypageTopPage() {
  const [summary, setSummary] = useState<MypageSummary | null>(null);

  useEffect(() => {
    getMypageSummary().then(setSummary);
  }, []);

  if (!summary) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg text-primary-700">フォレスパ</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-700">{summary.name} 様</span>
          <span
            className="rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: summary.statusColor }}
          >
            {summary.statusName}
          </span>
        </div>
      </div>

      {summary.nextReservation ? (
        <a
          href="/mypage/reservation"
          className="flex flex-col gap-1 rounded-lg border border-primary-200 bg-primary-50 p-4"
        >
          <p className="text-xs text-primary-600">次回のご予約</p>
          <p className="font-medium text-neutral-800">
            {summary.nextReservation.reservationDate} {summary.nextReservation.startTimeLabel}〜
          </p>
          <p className="text-sm text-neutral-600">
            {summary.nextReservation.storeName} / {summary.nextReservation.courseName}
          </p>
          {summary.nextReservation.staffName && (
            <p className="text-sm text-neutral-600">担当：{summary.nextReservation.staffName}</p>
          )}
        </a>
      ) : (
        <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-500">
          次回のご予約はありません。
        </div>
      )}

      {summary.nextStatusName && summary.visitsToNextStatus !== null && (
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-700">
            次回来店まであと{summary.visitsToNextStatus}回で{summary.nextStatusName}
          </p>
        </div>
      )}
    </div>
  );
}
