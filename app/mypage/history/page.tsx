"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMemberReservationHistory,
  type MemberReservationHistoryItem,
} from "@/app/actions/member-reservation-history";
import { cancelMemberReservation } from "@/app/actions/member-reservation-detail";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

const STATUS_LABEL: Record<string, string> = {
  completed: "来店済み",
  confirmed: "予約確定",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

export default function MemberHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<MemberReservationHistoryItem[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getMemberReservationHistory().then((h) => setHistory(h ?? []));
  }, []);

  async function handleCancel(reservationId: number) {
    if (!window.confirm("ご予約をキャンセルします。よろしいですか？")) return;

    setProcessingId(reservationId);
    const result = await cancelMemberReservation({ reservationId });
    setProcessingId(null);

    if (result.status === "cancelled") {
      setMessage("ご予約をキャンセルしました。");
      setHistory((prev) =>
        prev.map((h) => (h.id === reservationId ? { ...h, status: "cancelled", canModify: false } : h)),
      );
    } else if (result.status === "deadline_passed") {
      setMessage("キャンセル期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("キャンセルに失敗しました。");
    }
  }

  async function handleChange(reservationId: number) {
    if (
      !window.confirm(
        "変更のため、現在のご予約を一度キャンセルして新しいご予約に進みます。よろしいですか？",
      )
    ) {
      return;
    }

    setProcessingId(reservationId);
    const result = await cancelMemberReservation({ reservationId });
    setProcessingId(null);

    if (result.status === "cancelled") {
      router.push("/reserve");
    } else if (result.status === "deadline_passed") {
      setMessage("変更期限を過ぎているため、お電話にて店舗へご連絡ください。");
    } else {
      setMessage("変更に失敗しました。");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl text-primary-700">来店履歴</h1>
      {message && <p className="text-sm text-neutral-600">{message}</p>}

      {history.length === 0 ? (
        <p className="text-sm text-neutral-500">来店履歴はまだありません。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-neutral-800">{formatJapaneseDate(h.date)}</p>
                <span className="text-xs text-neutral-500">{STATUS_LABEL[h.status] ?? h.status}</span>
              </div>
              <p className="text-sm text-neutral-600">
                {h.storeName} / {h.courseName}
              </p>
              {h.staffName && <p className="text-sm text-neutral-600">担当：{h.staffName}</p>}
              <p className="text-sm font-medium text-neutral-800">
                {h.totalPrice.toLocaleString()}円
              </p>
              {h.canModify && (
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={processingId === h.id}
                    onClick={() => handleChange(h.id)}
                    className="h-9 flex-1 rounded-lg border border-primary-500 text-sm font-medium text-primary-600 disabled:opacity-50"
                  >
                    変更する
                  </button>
                  <button
                    type="button"
                    disabled={processingId === h.id}
                    onClick={() => handleCancel(h.id)}
                    className="h-9 flex-1 rounded-lg border border-error text-sm text-error disabled:opacity-50"
                  >
                    キャンセルする
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
