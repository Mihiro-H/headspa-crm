"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Store as StoreIcon } from "lucide-react";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { getCurrentAdminStoreScope, type AdminStoreScope } from "@/app/actions/current-admin-scope";
import {
  getCalendarReservations,
  type CalendarReservation,
} from "@/app/actions/calendar-reservations";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { assignReservationStaff } from "@/app/actions/assign-reservation-staff";
import { minutesToLabel } from "@/lib/reservation/time";
import { formatJapaneseDate } from "@/lib/reservation/date-format";

// カードの背景色をステータス別に固定するためのクラス定義。
// 「指名なし」列を含むレイアウト計算とは無関係な、表示専用の定数。
const STATUS_CARD_CLASS: Record<string, string> = {
  temp_hold: "border-l-4 border-warning bg-warning/15",
  confirmed: "border-l-4 border-success bg-success/15",
  completed: "border-l-4 border-disabled bg-disabled/20",
};

// 上部の凡例用：カードの色分けとステータス名の対応表。
const STATUS_LEGEND: Array<{ status: string; label: string; dotClass: string }> = [
  { status: "temp_hold", label: "仮予約", dotClass: "bg-warning" },
  { status: "confirmed", label: "確定", dotClass: "bg-success" },
  { status: "completed", label: "来店済み", dotClass: "bg-disabled" },
];

const UNASSIGNED_COLUMN_KEY = "unassigned";

interface CalendarColumn {
  key: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function AdminCalendarPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [scope, setScope] = useState<AdminStoreScope>({ isUnrestricted: true, storeIds: [] });
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listStores(), getCurrentAdminStoreScope()]).then(([list, s]) => {
      setStores(list);
      setScope(s);
      const visible = s.isUnrestricted
        ? list
        : list.filter((store) => s.storeIds.includes(store.id));
      if (visible.length > 0) setStoreId(visible[0].id);
    });
  }, []);

  useEffect(() => {
    if (storeId === null) return;
    getCalendarReservations(storeId, date).then(setReservations);
    listStaffForStore(storeId).then(setStaffList);
  }, [storeId, date]);

  async function handleDropOnStaff(
    reservationId: number,
    targetStaffId: number,
    targetRowMinutes: number,
  ) {
    setDragOverKey(null);
    // ドラッグ元のカードと違う時間帯の行にドロップされた場合は弾く
    // （この機能は担当の割り当てのみが目的で、予約時間の変更はスコープ外）。
    const dragged = reservations.find((r) => r.id === reservationId);
    if (!dragged || dragged.startMinutes !== targetRowMinutes) {
      setMessage("同じ時間帯の列にドロップしてください。");
      return;
    }

    const result = await assignReservationStaff(reservationId, targetStaffId);
    if (result.status === "assigned") {
      setMessage(null);
      if (storeId !== null) {
        getCalendarReservations(storeId, date).then(setReservations);
      }
    } else if (result.status === "conflict") {
      setMessage("この時間帯は既に別の予約が入っているため割り当てできません。");
    } else {
      setMessage("担当の割り当てに失敗しました。");
    }
  }

  const visibleStores = scope.isUnrestricted
    ? stores
    : stores.filter((s) => scope.storeIds.includes(s.id));

  const hasUnassigned = reservations.some((r) => r.staffId === null);

  const columns: CalendarColumn[] = [
    ...staffList.map((s) => ({ key: String(s.id), label: s.name })),
    ...(hasUnassigned ? [{ key: UNASSIGNED_COLUMN_KEY, label: "指名なし" }] : []),
  ];

  const rows = Array.from(new Set(reservations.map((r) => r.startMinutes))).sort((a, b) => a - b);

  function findReservation(rowMinutes: number, columnKey: string): CalendarReservation | null {
    return (
      reservations.find((r) => {
        const matchesColumn =
          columnKey === UNASSIGNED_COLUMN_KEY
            ? r.staffId === null
            : r.staffId === Number(columnKey);
        return matchesColumn && r.startMinutes === rowMinutes;
      }) ?? null
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, -1))}
            aria-label="前日"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium text-neutral-800">{formatJapaneseDate(date)}</p>
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, 1))}
            aria-label="翌日"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="ml-4 flex items-center gap-3 text-xs text-neutral-600">
            {STATUS_LEGEND.map(({ status, label, dotClass }) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StoreIcon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <select
            value={storeId ?? ""}
            onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
          >
            {visibleStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && <p className="text-sm text-error">{message}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">この日の予約はありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="w-16 p-2" />
                {columns.map((c) => (
                  <th key={c.key} className="p-2 text-left font-medium text-neutral-700">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((rowMinutes) => (
                <tr key={rowMinutes} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 align-top text-xs text-neutral-500">
                    {minutesToLabel(rowMinutes)}
                  </td>
                  {columns.map((c) => {
                    const r = findReservation(rowMinutes, c.key);
                    const cellKey = `${rowMinutes}-${c.key}`;
                    // ドロップ先になれるのは「スタッフの列」かつ「空きセル」のみ。
                    const isDroppableStaffCell = c.key !== UNASSIGNED_COLUMN_KEY && !r;
                    // ドラッグできるのは「指名なし」列のカード（担当未定の予約）のみ。
                    const isDraggableCard = !!r && c.key === UNASSIGNED_COLUMN_KEY;

                    return (
                      <td
                        key={c.key}
                        className={`p-2 align-top ${
                          isDroppableStaffCell && dragOverKey === cellKey
                            ? "bg-primary-50"
                            : ""
                        }`}
                        onDragOver={
                          isDroppableStaffCell
                            ? (e) => {
                                e.preventDefault();
                                setDragOverKey(cellKey);
                              }
                            : undefined
                        }
                        onDragLeave={
                          isDroppableStaffCell ? () => setDragOverKey(null) : undefined
                        }
                        onDrop={
                          isDroppableStaffCell
                            ? (e) => {
                                e.preventDefault();
                                const reservationId = Number(
                                  e.dataTransfer.getData("text/plain"),
                                );
                                if (reservationId) {
                                  handleDropOnStaff(reservationId, Number(c.key), rowMinutes);
                                }
                              }
                            : undefined
                        }
                      >
                        {r && (
                          <Link
                            href={`/admin/reservations/${r.id}`}
                            draggable={isDraggableCard}
                            onDragStart={
                              isDraggableCard
                                ? (e) => {
                                    e.dataTransfer.setData("text/plain", String(r.id));
                                    e.dataTransfer.effectAllowed = "move";
                                  }
                                : undefined
                            }
                            className={`block rounded-md p-2 ${STATUS_CARD_CLASS[r.status] ?? "border-l-4 border-neutral-300 bg-neutral-50"} ${
                              isDraggableCard ? "cursor-grab" : ""
                            }`}
                          >
                            <p className="text-xs font-medium text-neutral-800">
                              {minutesToLabel(r.startMinutes)}{" "}
                              {r.memberName ? `${r.memberName}様` : "（未確定）"}
                            </p>
                            <p className="text-xs text-neutral-600">
                              {r.courseName
                                ? `${r.categoryName} ${r.courseName}`
                                : "（明細なし）"}
                            </p>
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
