"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import {
  getCalendarReservations,
  type CalendarReservation,
} from "@/app/actions/calendar-reservations";
import { minutesToLabel } from "@/lib/reservation/time";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: string): string {
  switch (status) {
    case "temp_hold":
      return "仮予約";
    case "confirmed":
      return "確定";
    case "completed":
      return "来店済み";
    default:
      return status;
  }
}

export default function AdminCalendarPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);

  useEffect(() => {
    listStores().then((list) => {
      setStores(list);
      if (list.length > 0) setStoreId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (storeId === null) return;
    getCalendarReservations(storeId, date).then(setReservations);
  }, [storeId, date]);

  const grouped = reservations.reduce<Record<string, CalendarReservation[]>>((acc, r) => {
    const key = r.staffName ?? "指名なし";
    acc[key] = acc[key] ?? [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-heading text-2xl text-primary-700">予約カレンダー</h1>
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-neutral-500">この日の予約はありません。</p>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([staffName, items]) => (
          <div key={staffName}>
            <h2 className="mb-2 text-sm font-medium text-neutral-600">{staffName}</h2>
            <div className="flex flex-col gap-2">
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/reservations/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-0 p-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800">
                      {minutesToLabel(r.startMinutes)}〜{minutesToLabel(r.endMinutes)}
                      {r.courseName || "（明細なし）"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {r.memberName ?? "（未確定）"}
                      {r.source === "web" ? "WEB予約" : "電話予約"}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700">
                    {statusLabel(r.status)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
