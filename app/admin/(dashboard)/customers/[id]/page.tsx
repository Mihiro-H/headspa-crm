"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { getCustomerDetail, type CustomerDetail } from "@/app/actions/customer-detail";
import {
  getCustomerNote,
  saveCustomerNote,
  type CustomerNoteDetail,
} from "@/app/actions/customer-notes";
import {
  getCustomerDeliveryHistory,
  type CustomerDeliveryLogItem,
} from "@/app/actions/customer-delivery-history";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const GENDER_LABEL: Record<string, string> = {
  female: "女性",
  male: "男性",
  other: "その他",
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "メール",
  line: "LINE",
};

const TEMPLATE_TYPE_LABEL: Record<string, string> = {
  birthday: "誕生日メッセージ",
  reminder: "来店リマインド",
  segment: "セグメント配信",
};

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  success: "成功",
  failed: "失敗",
};

type Tab = "history" | "notes" | "delivery";

export default function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const memberId = Number(id);
  const [tab, setTab] = useState<Tab>("history");
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    getCustomerDetail(memberId).then(setCustomer);
  }, [memberId]);

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

      <div className="flex gap-2 border-b border-neutral-200">
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
        <button
          type="button"
          onClick={() => setTab("notes")}
          className={`px-4 py-2 text-sm ${
            tab === "notes" ? "border-b-2 border-primary-500 text-primary-700" : "text-neutral-500"
          }`}
        >
          カルテ・メモ
        </button>
        <button
          type="button"
          onClick={() => setTab("delivery")}
          className={`px-4 py-2 text-sm ${
            tab === "delivery"
              ? "border-b-2 border-primary-500 text-primary-700"
              : "text-neutral-500"
          }`}
        >
          配信履歴
        </button>
      </div>

      {tab === "history" && <ReservationHistoryTable customer={customer} />}
      {tab === "notes" && <CustomerNoteEditor memberId={memberId} />}
      {tab === "delivery" && <DeliveryHistoryTable memberId={memberId} />}
    </div>
  );
}

function ReservationHistoryTable({ customer }: { customer: CustomerDetail }) {
  if (customer.reservationHistory.length === 0) {
    return <p className="text-sm text-neutral-500">来店履歴がありません。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
            <th className="p-3 font-medium">来店日</th>
            <th className="p-3 font-medium">店舗</th>
            <th className="p-3 font-medium">コース</th>
            <th className="p-3 font-medium">担当</th>
            <th className="p-3 font-medium">金額</th>
            <th className="p-3 font-medium">指名</th>
          </tr>
        </thead>
        <tbody>
          {customer.reservationHistory.map((h) => (
            <tr key={h.id} className="border-b border-neutral-100 last:border-0">
              <td className="p-3 text-neutral-800">{h.date}</td>
              <td className="p-3 text-neutral-800">{h.storeName}</td>
              <td className="p-3 text-neutral-800">
                {h.courseName ? `${h.categoryName}・${h.courseName}` : "（明細なし）"}
              </td>
              <td className="p-3 text-neutral-800">{h.staffName ?? "—"}</td>
              <td className="p-3 text-neutral-800">{formatYen(h.totalPrice)}</td>
              <td className="p-3 text-neutral-800">{h.nominated ? "○" : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerNoteEditor({ memberId }: { memberId: number }) {
  const [note, setNote] = useState<CustomerNoteDetail | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getCustomerNote(memberId).then((n) => {
      setNote(n);
      setText(n?.noteText ?? "");
      setLoading(false);
    });
  }, [memberId]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    await saveCustomerNote(memberId, text);
    setSaving(false);
    setMessage("保存しました。");
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {note?.createdAt && (
        <p className="text-xs text-neutral-500">
          最終更新：{new Date(note.createdAt).toLocaleString("ja-JP")}
        </p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="お客様の特徴、施術上の注意点などを自由に記入してください。"
        className="w-full rounded-lg border border-neutral-300 p-3 text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="h-10 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          保存する
        </button>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
      </div>
    </div>
  );
}

function DeliveryHistoryTable({ memberId }: { memberId: number }) {
  const [logs, setLogs] = useState<CustomerDeliveryLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerDeliveryHistory(memberId).then((l) => {
      setLogs(l);
      setLoading(false);
    });
  }, [memberId]);

  if (loading) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }
  if (logs.length === 0) {
    return <p className="text-sm text-neutral-500">配信履歴がありません。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
            <th className="p-3 font-medium">配信日時</th>
            <th className="p-3 font-medium">チャネル</th>
            <th className="p-3 font-medium">種別</th>
            <th className="p-3 font-medium">件名</th>
            <th className="p-3 font-medium">結果</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-neutral-100 last:border-0">
              <td className="p-3 text-neutral-800">
                {new Date(log.sentAt).toLocaleString("ja-JP")}
              </td>
              <td className="p-3 text-neutral-800">{CHANNEL_LABEL[log.channel] ?? log.channel}</td>
              <td className="p-3 text-neutral-800">
                {log.segmentCampaignId !== null ? (
                  <Link href="/admin/segment-campaigns" className="text-primary-600 underline">
                    {log.segmentCampaignName ?? "セグメント配信"}
                  </Link>
                ) : (
                  (TEMPLATE_TYPE_LABEL[log.templateType] ?? log.templateType)
                )}
              </td>
              <td className="p-3 text-neutral-800">{log.subject ?? "—"}</td>
              <td className="p-3 text-neutral-800">
                {DELIVERY_STATUS_LABEL[log.status] ?? log.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
