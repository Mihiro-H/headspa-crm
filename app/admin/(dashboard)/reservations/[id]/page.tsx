"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getReservationDetail,
  cancelReservation,
  markNoShow,
  type ReservationDetail,
} from "@/app/actions/reservation-detail";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "temp_hold":
      return "仮予約";
    case "confirmed":
      return "確定";
    case "completed":
      return "来店済み";
    case "cancelled":
      return "キャンセル";
    case "no_show":
      return "無断キャンセル";
    default:
      return status;
  }
}

export default function AdminReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getReservationDetail(Number(id)).then(setReservation);
  }, [id]);

  async function handleCancel() {
    setProcessing(true);
    await cancelReservation(Number(id));
    setProcessing(false);
    router.push("/admin/calendar");
  }

  async function handleNoShow() {
    setProcessing(true);
    await markNoShow(Number(id));
    setProcessing(false);
    router.push("/admin/calendar");
  }

  if (!reservation) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  const canOperate = reservation.status === "confirmed" || reservation.status === "temp_hold";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
          {statusLabel(reservation.status)}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">会員：</span>
          {reservation.memberName ?? "—"}（{reservation.memberPhone ?? "—"}）
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">店舗：</span>
          {reservation.storeName}
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">日時：</span>
          {reservation.reservationDate} {reservation.startTimeLabel}〜
          {reservation.endTimeLabel}
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">メニュー：</span>
          {reservation.courseName
            ? `${reservation.categoryName} ${reservation.courseName}`
            : "（明細なし）"}
        </p>
        {reservation.optionNames.length > 0 && (
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">オプション：</span>
            {reservation.optionNames.join("、")}
          </p>
        )}
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">担当：</span>
          {reservation.staffName ?? "指名なし"}
        </p>
        <p className="text-sm text-neutral-800">
          <span className="text-neutral-500">経路：</span>
          {reservation.source === "web" ? "WEB予約" : "電話予約"}
        </p>
        <p className="mt-2 text-lg font-medium text-neutral-800">
          合計 {formatYen(reservation.totalPrice)}
        </p>
      </div>

      {canOperate && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={processing}
            onClick={handleCancel}
            className="h-10 rounded-lg border border-error px-4 text-sm text-error disabled:opacity-50"
          >
            キャンセルする
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleNoShow}
            className="h-10 rounded-lg border border-neutral-300 px-4 text-sm text-neutral-700 disabled:opacity-50"
          >
            無断キャンセル（No-show）登録
          </button>
        </div>
      )}
    </div>
  );
}
