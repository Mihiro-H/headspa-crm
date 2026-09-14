"use client";

import { useEffect, useState } from "react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getCurrentAdminStoreScope, type AdminStoreScope } from "@/app/actions/current-admin-scope";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { listShiftRequestsForStore, type StaffShiftRequestItem } from "@/app/actions/staff-shift-requests";
import { generateShiftDraftForStore } from "@/app/actions/generate-shift-draft";
import {
  listShiftDraftsForStore,
  updateShiftDraft,
  confirmShiftDraftForStore,
  type ShiftDraftItem,
} from "@/app/actions/shift-drafts";
import {
  exportConfirmedShifts,
  type ConfirmedShiftRow,
} from "@/app/actions/export-confirmed-shifts";
import { getStaffFormRoster } from "@/app/actions/staff-form-roster";
import { minutesToLabel } from "@/lib/reservation/time";

function yearMonthWithOffset(monthOffset: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + monthOffset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInYearMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, "0")}`);
}

function minutesFromTimeInput(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function timeInputFromMinutes(minutes: number | null): string {
  return minutes === null ? "" : minutesToLabel(minutes);
}

// 既存の売上・月報レポート（reports/page.tsx）と同じ方式：ブラウザ内でCSVを組み立てて
// ダウンロードする。先頭のBOM（﻿）はExcelで日本語CSVを開いたときの文字化けを防ぐため。
function downloadShiftCsv(rows: ConfirmedShiftRow[], storeName: string, yearMonth: string) {
  const header = ["日付", "スタッフ名", "休み", "開始", "終了"];
  const csvRows = rows.map((r) => [
    r.workDate,
    r.staffName,
    r.isDayOff ? "休み" : "",
    r.isDayOff ? "" : timeInputFromMinutes(r.startMinutes),
    r.isDayOff ? "" : timeInputFromMinutes(r.endMinutes),
  ]);
  const csvBody = [header, ...csvRows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csvBody}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `staff-shifts_${storeName}_${yearMonth}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function requestSummary(item: StaffShiftRequestItem | undefined): string {
  if (!item) return "未提出";
  if (item.requestType === "day_off") return "休み希望";
  if (item.requestType === "full") return "出勤";
  // requestType === "reduced"
  if (item.preferredStartMinutes !== null || item.preferredEndMinutes !== null) {
    const start = item.preferredStartMinutes !== null ? timeInputFromMinutes(item.preferredStartMinutes) : "?";
    const end = item.preferredEndMinutes !== null ? timeInputFromMinutes(item.preferredEndMinutes) : "?";
    return `時短 ${start}〜${end}`;
  }
  return "不備(時短希望・時間未入力)";
}

export default function StaffShiftsPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
  const [storeId, setStoreId] = useState<number | null>(null);
  const [yearMonth, setYearMonth] = useState(yearMonthWithOffset(1));
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [requestsByStaffId, setRequestsByStaffId] = useState<Record<number, StaffShiftRequestItem[]>>({});
  const [draftsByStaffId, setDraftsByStaffId] = useState<Record<number, ShiftDraftItem[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listStores(), getCurrentAdminStoreScope()]).then(([list, s]) => {
      setStores(list);
      setScope(s);
      const visible = s.isUnrestricted ? list : list.filter((store) => s.storeIds.includes(store.id));
      if (visible.length > 0) setStoreId(visible[0].id);
    });
  }, []);

  async function reload() {
    if (storeId === null) return;
    const [staff, requestsResult, draftsResult] = await Promise.all([
      listStaffForStore(storeId),
      listShiftRequestsForStore(storeId, yearMonth),
      listShiftDraftsForStore(storeId, yearMonth),
    ]);
    setStaffList(staff);
    setRequestsByStaffId(requestsResult.status === "ok" ? requestsResult.requestsByStaffId : {});
    setDraftsByStaffId(draftsResult.status === "ok" ? draftsResult.draftsByStaffId : {});
  }

  useEffect(() => {
    if (storeId === null) return;
    Promise.all([
      listStaffForStore(storeId),
      listShiftRequestsForStore(storeId, yearMonth),
      listShiftDraftsForStore(storeId, yearMonth),
    ]).then(([staff, requestsResult, draftsResult]) => {
      setStaffList(staff);
      setRequestsByStaffId(requestsResult.status === "ok" ? requestsResult.requestsByStaffId : {});
      setDraftsByStaffId(draftsResult.status === "ok" ? draftsResult.draftsByStaffId : {});
    });
  }, [storeId, yearMonth]);

  const visibleStores = scope.isUnrestricted ? stores : stores.filter((s) => scope.storeIds.includes(s.id));
  const days = daysInYearMonth(yearMonth);

  function draftFor(staffId: number, workDate: string): ShiftDraftItem | undefined {
    return draftsByStaffId[staffId]?.find((d) => d.workDate === workDate);
  }

  async function handleGenerate() {
    if (storeId === null) return;
    const result = await generateShiftDraftForStore(storeId, yearMonth);
    if (result.status === "generated") {
      setMessage(`${result.count}件のドラフトを作成しました。`);
      reload();
    } else {
      setMessage("ドラフトの作成に失敗しました。");
    }
  }

  async function handleDraftChange(staffId: number, workDate: string, patch: Partial<ShiftDraftItem>) {
    const current = draftFor(staffId, workDate) ?? {
      workDate,
      isDayOff: true,
      startMinutes: null,
      endMinutes: null,
    };
    const next = { ...current, ...patch };
    await updateShiftDraft({
      staffId,
      workDate,
      isDayOff: next.isDayOff,
      startMinutes: next.startMinutes,
      endMinutes: next.endMinutes,
    });
    reload();
  }

  async function handleConfirm() {
    if (storeId === null) return;
    const result = await confirmShiftDraftForStore(storeId, yearMonth);
    if (result.status === "confirmed") {
      setMessage(`${result.count}件のシフトを確定しました。`);
    } else {
      setMessage("確定に失敗しました。");
    }
  }

  async function handleExport() {
    if (storeId === null) return;
    const result = await exportConfirmedShifts(storeId, yearMonth);
    if (result.status === "ok") {
      const storeName = stores.find((s) => s.id === storeId)?.name ?? "店舗";
      downloadShiftCsv(result.rows, storeName, yearMonth);
    } else {
      setMessage("ダウンロードに失敗しました。");
    }
  }

  async function handleCopyFormRoster() {
    if (storeId === null) return;
    const result = await getStaffFormRoster(storeId);
    if (result.status !== "ok") {
      setMessage("コピーに失敗しました。");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.labels.join("\n"));
      setMessage(`${result.labels.length}件をクリップボードにコピーしました。`);
    } catch {
      // ブラウザの権限拒否(NotAllowedError)や非セキュアコンテキスト等でrejectされうる
      setMessage("クリップボードへのコピーに失敗しました。ブラウザの権限設定をご確認ください。");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl text-primary-700">スタッフシフト管理</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-2 text-sm"
        >
          {visibleStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="h-10 w-32 rounded-md border border-neutral-300 px-2 text-sm"
        >
          {[0, 1, 2].map((offset) => {
            const value = yearMonthWithOffset(offset);
            return (
              <option key={value} value={value}>
                {value}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          className="h-10 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          AIで自動作成
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="h-10 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          確定する
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          確定済みシフトをダウンロード（CSV）
        </button>
        <button
          type="button"
          onClick={handleCopyFormRoster}
          className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          フォーム用スタッフ一覧をコピー
        </button>
      </div>

      {message && <p className="text-sm text-neutral-600">{message}</p>}

      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-600">提出済みの希望（閲覧のみ）</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-24 p-2 text-left font-medium text-neutral-700">日付</th>
                {staffList.map((s) => (
                  <th key={s.id} className="p-2 text-left font-medium text-neutral-700">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((workDate) => (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-xs text-neutral-500">{workDate}</td>
                  {staffList.map((s) => (
                    <td key={s.id} className="p-2 text-xs text-neutral-700">
                      {requestSummary(requestsByStaffId[s.id]?.find((r) => r.workDate === workDate))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-600">ドラフト（クリックして編集）</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-24 p-2 text-left font-medium text-neutral-700">日付</th>
                {staffList.map((s) => (
                  <th key={s.id} className="p-2 text-left font-medium text-neutral-700">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((workDate) => (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-xs text-neutral-500">{workDate}</td>
                  {staffList.map((s) => {
                    const draft = draftFor(s.id, workDate);
                    const isDayOff = draft?.isDayOff ?? true;
                    return (
                      <td key={s.id} className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={isDayOff}
                            onChange={(e) =>
                              handleDraftChange(s.id, workDate, {
                                isDayOff: e.target.checked,
                                startMinutes: e.target.checked ? null : draft?.startMinutes ?? null,
                                endMinutes: e.target.checked ? null : draft?.endMinutes ?? null,
                              })
                            }
                          />
                          <input
                            type="time"
                            disabled={isDayOff}
                            value={timeInputFromMinutes(draft?.startMinutes ?? null)}
                            onChange={(e) =>
                              handleDraftChange(s.id, workDate, {
                                startMinutes: minutesFromTimeInput(e.target.value),
                              })
                            }
                            className="w-20 rounded-md border border-neutral-300 px-1 py-0.5 text-xs disabled:opacity-50"
                          />
                          <input
                            type="time"
                            disabled={isDayOff}
                            value={timeInputFromMinutes(draft?.endMinutes ?? null)}
                            onChange={(e) =>
                              handleDraftChange(s.id, workDate, {
                                endMinutes: minutesFromTimeInput(e.target.value),
                              })
                            }
                            className="w-20 rounded-md border border-neutral-300 px-1 py-0.5 text-xs disabled:opacity-50"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
