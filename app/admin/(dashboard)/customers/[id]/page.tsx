"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getCustomerDetail, type CustomerDetail } from "@/app/actions/customer-detail";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const GENDER_LABEL: Record<string, string> = {
  female: "女性",
  male: "男性",
  other: "その他",
};

export default function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    getCustomerDetail(Number(id)).then(setCustomer);
  }, [id]);

  if (!customer) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-lg font-medium text-secondary-700">
              {customer.name.charAt(0)}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-medium text-neutral-800">{customer.name} 様</p>
              <span
                className="rounded-full px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: customer.statusColor }}
              >
                {customer.statusName}会員
              </span>
            </div>
          </div>

          {/* 来店回数・累計利用金額はここで大きく目立たせる */}
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-xs text-neutral-500">来店回数</p>
              <p className="text-2xl font-semibold text-primary-700">{customer.visitCount}回</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">累計利用金額</p>
              <p className="text-2xl font-semibold text-primary-700">
                {formatYen(customer.totalSpent)}
              </p>
            </div>
          </div>
        </div>

        {/* 旧「基本情報」タブの内容をここに統合 */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
          <span>フリガナ：{customer.nameKana ?? "—"}</span>
          <span>メール：{customer.email}</span>
          <span>電話番号：{customer.phone}</span>
          <span>誕生月：{customer.birthMonth}月</span>
          <span>性別：{GENDER_LABEL[customer.gender] ?? customer.gender}</span>
          <span>LINE連携：{customer.lineLinked ? "連携済み" : "未連携"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-600">来店履歴</h2>
        {customer.reservationHistory.length === 0 && (
          <p className="text-sm text-neutral-500">来店履歴がありません。</p>
        )}
        {customer.reservationHistory.map((h) => (
          <div
            key={h.id}
            className="rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm"
          >
            <p className="text-sm font-medium text-neutral-800">
              {h.date}　{h.courseName || "（明細なし）"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {h.storeName}　担当：{h.staffName ?? "指名なし"}　{formatYen(h.totalPrice)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
