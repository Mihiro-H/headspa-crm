"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMemberNextReservation,
  cancelMemberReservation,
  type MemberReservationDetail,
} from "@/app/actions/member-reservation-detail";

export default function MemberReservationPage() {
  const router = useRouter();
  const [reservation, setReservation] = useState<MemberReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getMemberNextReservation().then((r) => {
      setReservation(r);
      setLoading(false);
    });
  }, []);

  async function handleCancel() {
    if (!reservation) return;
    if (!window.confirm("ご予約をキャンセルします。よろしいですか？")) return;

    setProcessing(true);
    const result = await cancelMemberReservation({ reservationId: reservation.id });
    setProcessing(false);

    if (result.status === "cancelled") {
      setReservation(null);
      setMessage("ご予約をキャンセルしました。");
    } else if (result.status === "deadline_passed") {
      setMessage("キャンセル期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("キャンセルに失敗しました。");
    }
  }

  async function handleChange() {
    if (!reservation) return;
    if (
      !window.confirm(
        "変更のため、現在のご予約を一度キャンセルして新しいご予約に進みます。よろしいですか？",
      )
    ) {
      return;
    }

    setProcessing(true);
    const result = await cancelMemberReservation({ reservationId: reservation.id });
    setProcessing(false);

    if (result.status === "cancelled") {
      router.push("/reserve");
    } else if (result.status === "deadline_passed") {
      setMessage("変更期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("変更に失敗しました。");
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  if (!reservation) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-xl text-primary-700">予約確認</h1>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
        <p className="text-sm text-neutral-500">次回のご予約はありません。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl text-primary-700">予約確認</h1>
      {message && <p className="text-sm text-neutral-600">{message}</p>}

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
        <p className="font-medium text-neutral-800">
          {reservation.reservationDate} {reservation.startTimeLabel}〜{reservation.endTimeLabel}
        </p>
        <p className="text-sm text-neutral-600">店舗：{reservation.storeName}</p>
        <p className="text-sm text-neutral-600">メニュー：{reservation.courseName}</p>
        {reservation.optionNames.length > 0 && (
          <p className="text-sm text-neutral-600">
            オプション：{reservation.optionNames.join("、")}
          </p>
        )}
        {reservation.staffName && (
          <p className="text-sm text-neutral-600">担当：{reservation.staffName}</p>
        )}
        <p className="text-sm font-medium text-neutral-800">
          合計金額：{reservation.totalPrice.toLocaleString()}円
        </p>
      </div>

      {reservation.canModify ? (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={processing}
            onClick={handleChange}
            className="h-12 flex-1 rounded-lg border border-primary-500 font-medium text-primary-600 disabled:opacity-50"
          >
            変更する
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleCancel}
            className="h-12 flex-1 rounded-lg border border-error text-error disabled:opacity-50"
          >
            キャンセルする
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">
          <p>キャンセル期限（施術日前日23:59）を過ぎています。</p>
          <p>お電話にて店舗へご連絡ください：{reservation.storePhone}</p>
        </div>
      )}
    </div>
  );
}
