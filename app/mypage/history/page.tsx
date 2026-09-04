"use client";

import { useEffect, useState } from "react";
import {
  getMemberReservationHistory,
  type MemberReservationHistoryItem,
} from "@/app/actions/member-reservation-history";
import {
  listCustomerStatuses,
  type CustomerStatusItem,
} from "@/app/actions/customer-statuses";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

const STATUS_LABEL: Record<string, string> = {
  completed: "来店済み",
  confirmed: "予約確定",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

export default function MemberHistoryPage() {
  const [history, setHistory] = useState<MemberReservationHistoryItem[]>([]);
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);

  useEffect(() => {
    getMemberReservationHistory().then((h) => setHistory(h ?? []));
    listCustomerStatuses().then(setStatuses);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl text-primary-700">来店履歴・ステータス確認</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">ステータス条件</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">ステータス</th>
                <th className="p-3">来店回数</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">
                    <span
                      className="rounded-full px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: s.colorCode }}
                    >
                      {s.name}
                    </span>
                  </td>
                  <td className="p-3">{s.minVisitCount}回以上</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">来店履歴</h2>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
