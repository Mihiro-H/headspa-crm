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
  const [tab, setTab] = useState<"basic" | "history">("basic");
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    getCustomerDetail(Number(id)).then(setCustomer);
  }, [id]);

  if (!customer) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl text-primary-700">{customer.name}</h1>
        <span
          className="rounded-full px-2 py-1 text-xs text-white"
          style={{ backgroundColor: customer.statusColor }}
        >
          {customer.statusName}
        </span>
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("basic")}
          className={`px-4 py-2 text-sm ${
            tab === "basic"
              ? "border-b-2 border-primary-500 text-primary-700"
              : "text-neutral-500"
          }`}
        >
          基本情報
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm ${
            tab === "history"
              ? "border-b-2 border-primary-500 text-primary-700"
              : "text-neutral-500"
          }`}
        >
          来店履歴
        </button>
      </div>

      {tab === "basic" && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-sm">
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">フリガナ：</span>
            {customer.nameKana ?? "—"}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">メール：</span>
            {customer.email}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">電話番号：</span>
            {customer.phone}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">生年月日：</span>
            {customer.birthDate}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">性別：</span>
            {GENDER_LABEL[customer.gender] ?? customer.gender}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">LINE連携：</span>
            {customer.lineLinked ? "連携済み" : "未連携"}
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">来店回数：</span>
            {customer.visitCount}回
          </p>
          <p className="text-sm text-neutral-800">
            <span className="text-neutral-500">累計利用金額：</span>
            {formatYen(customer.totalSpent)}
          </p>
        </div>
      )}

      {tab === "history" && (
        <div className="flex flex-col gap-2">
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
      )}
    </div>
  );
}
