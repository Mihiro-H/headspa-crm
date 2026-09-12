"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { getMypageSummary, type MypageSummary } from "@/app/actions/mypage-summary";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

export default function MypageTopPage() {
  const [summary, setSummary] = useState<MypageSummary | null>(null);

  useEffect(() => {
    getMypageSummary().then(setSummary);
  }, []);

  if (!summary) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  const progressRatio =
    summary.nextStatusMinVisitCount !== null
      ? Math.min(
          1,
          Math.max(
            0,
            (summary.visitCount - summary.currentStatusMinVisitCount) /
              (summary.nextStatusMinVisitCount - summary.currentStatusMinVisitCount),
          ),
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">こんにちは</p>
        <p className="text-lg font-medium text-neutral-800">{summary.name} 様</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-secondary-200 bg-secondary-50 p-4">
        <p className="text-center text-xs text-neutral-500">現在のステータス</p>
        <p
          className="text-center text-lg font-medium"
          style={{ color: summary.statusColor }}
        >
          {summary.statusName}会員
        </p>
        {progressRatio !== null ? (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full"
                style={{ width: `${progressRatio * 100}%`, backgroundColor: summary.statusColor }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-600">
              <span>来店{summary.visitCount}回</span>
              <span>{summary.nextStatusName}まであと{summary.visitsToNextStatus}回</span>
            </div>
          </>
        ) : (
          <p className="text-center text-xs text-neutral-600">来店{summary.visitCount}回</p>
        )}
      </div>

      {summary.nextReservation ? (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
          <p className="text-xs text-primary-600">次回のご予約</p>
          <p className="font-medium text-neutral-800">
            {formatJapaneseDate(summary.nextReservation.reservationDate)}{" "}
            {summary.nextReservation.startTimeLabel}〜
          </p>
          <p className="text-sm text-neutral-600">
            {summary.nextReservation.storeName} / {summary.nextReservation.courseName}
          </p>
          {summary.nextReservation.staffName && (
            <p className="text-sm text-neutral-600">担当：{summary.nextReservation.staffName}</p>
          )}
          <div className="mt-2 flex gap-3">
            <Link
              href="/mypage/reservation"
              className="h-10 flex-1 rounded-lg border border-primary-500 text-center text-sm font-medium leading-10 text-primary-600"
            >
              変更
            </Link>
            <Link
              href="/mypage/reservation"
              className="h-10 flex-1 rounded-lg border border-error text-center text-sm leading-10 text-error"
            >
              キャンセル
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500">
          次回のご予約はありません。
        </div>
      )}

      <Link
        href="/reserve"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-accent-500 text-base font-medium text-white"
      >
        <CalendarPlus className="h-5 w-5" aria-hidden="true" />
        新しく予約する
      </Link>
    </div>
  );
}
