"use client";

import { useEffect, useState } from "react";
import { getSalesReport, type SalesReport } from "@/app/actions/sales-report";
import { listStores, type StoreListItem } from "@/app/actions/stores";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  const now = new Date();
  return toDateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

function defaultEndDate(): string {
  return toDateInputValue(new Date());
}

function downloadCsv(details: SalesReport["details"], startDate: string, endDate: string) {
  const header = ["日付", "店舗", "会員名", "メニュー", "スタッフ", "金額"];
  const rows = details.map((d) => [
    d.date,
    d.storeName,
    d.memberName,
    d.courseName,
    d.staffName ?? "",
    String(d.totalPrice),
  ]);
  const csvBody = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csvBody}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sales-report_${startDate}_${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function BarList({
  items,
}: {
  items: { label: string; total: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="text-sm text-neutral-500">データがありません。</p>}
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm text-neutral-700">
            <span>{item.label}</span>
            <span>{item.total.toLocaleString()}円</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-primary-500"
              style={{ width: `${Math.round((item.total / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SalesReportPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [storeId, setStoreId] = useState<number | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listStores().then(setStores);
  }, []);

  async function handleSearch() {
    setLoading(true);
    const result = await getSalesReport({ startDate, endDate, storeId });
    setReport(result);
    setLoading(false);
  }

  useEffect(() => {
    // 初回のみデフォルト期間でレポートを読み込む。以降の再取得は「表示を更新」ボタンから明示的に行う。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">売上・月報レポート</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">店舗</label>
          <select
            value={storeId ?? ""}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">全店舗</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="h-10 rounded-lg bg-primary-500 px-4 font-medium text-white disabled:opacity-50"
        >
          表示を更新
        </button>
        {report && (
          <button
            type="button"
            onClick={() => downloadCsv(report.details, startDate, endDate)}
            className="h-10 rounded-lg border border-primary-500 px-4 font-medium text-primary-600"
          >
            Excelダウンロード（CSV）
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">読み込み中...</p>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">売上合計</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.salesTotal.toLocaleString()}円
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">客数</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.customerCount}件
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">客単価</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.averageSpend.toLocaleString()}円
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">新規／リピート</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.newCustomerCount}／{report.summary.repeatCustomerCount}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <p className="text-xs text-neutral-500">指名売上比率</p>
              <p className="font-heading text-xl text-primary-700">
                {report.summary.nominationSalesRatio}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-sm font-medium text-neutral-600">日別売上推移</h2>
              <BarList items={report.dailySales.map((d) => ({ label: d.date, total: d.total }))} />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-sm font-medium text-neutral-600">メニュー別売上構成</h2>
              <BarList
                items={report.courseSales.map((c) => ({ label: c.courseName, total: c.total }))}
              />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4">
              <h2 className="text-sm font-medium text-neutral-600">スタッフ別売上</h2>
              <BarList
                items={report.staffSales.map((s) => ({ label: s.staffName, total: s.total }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-neutral-600">明細一覧</h2>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500">
                    <th className="p-3">日付</th>
                    <th className="p-3">店舗</th>
                    <th className="p-3">会員名</th>
                    <th className="p-3">メニュー</th>
                    <th className="p-3">スタッフ</th>
                    <th className="p-3">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {report.details.map((d) => (
                    <tr key={d.id} className="border-b border-neutral-100 last:border-0">
                      <td className="p-3">{d.date}</td>
                      <td className="p-3">{d.storeName}</td>
                      <td className="p-3">{d.memberName}</td>
                      <td className="p-3">{d.courseName}</td>
                      <td className="p-3">{d.staffName ?? "指名なし"}</td>
                      <td className="p-3">{d.totalPrice.toLocaleString()}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
