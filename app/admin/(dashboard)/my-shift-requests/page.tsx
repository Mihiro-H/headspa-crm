"use client";

import { useEffect, useState } from "react";
import {
  getMyStaffId,
  getStaffShiftRequests,
  saveStaffShiftRequest,
  type StaffShiftRequestItem,
} from "@/app/actions/staff-shift-requests";

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
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const EMPTY_ITEM = (workDate: string): StaffShiftRequestItem => ({
  workDate,
  isDayOffRequested: false,
  preferredStartMinutes: null,
  preferredEndMinutes: null,
});

export default function MyShiftRequestsPage() {
  const [staffId, setStaffId] = useState<number | null | undefined>(undefined);
  const [yearMonth, setYearMonth] = useState(yearMonthWithOffset(1));
  const [requests, setRequests] = useState<Map<string, StaffShiftRequestItem>>(new Map());

  useEffect(() => {
    getMyStaffId().then(setStaffId);
  }, []);

  useEffect(() => {
    if (!staffId) return;
    getStaffShiftRequests(staffId, yearMonth).then((items) => {
      setRequests(new Map(items.map((i) => [i.workDate, i])));
    });
  }, [staffId, yearMonth]);

  async function handleChange(workDate: string, patch: Partial<StaffShiftRequestItem>) {
    if (!staffId) return;
    const next = { ...(requests.get(workDate) ?? EMPTY_ITEM(workDate)), ...patch };
    setRequests((prev) => new Map(prev).set(workDate, next));
    await saveStaffShiftRequest({
      staffId,
      workDate,
      isDayOffRequested: next.isDayOffRequested,
      preferredStartMinutes: next.preferredStartMinutes,
      preferredEndMinutes: next.preferredEndMinutes,
    });
  }

  if (staffId === undefined) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>;
  }
  if (staffId === null) {
    return (
      <p className="text-sm text-neutral-500">
        スタッフとして紐付けられていません。管理者にお問い合わせください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl text-primary-700">シフト希望</h1>
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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <th className="p-2 font-medium">日付</th>
              <th className="p-2 font-medium">休み希望</th>
              <th className="p-2 font-medium">希望開始</th>
              <th className="p-2 font-medium">希望終了</th>
            </tr>
          </thead>
          <tbody>
            {daysInYearMonth(yearMonth).map((workDate) => {
              const item = requests.get(workDate);
              const isDayOff = item?.isDayOffRequested ?? false;
              return (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-neutral-800">{workDate}</td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={isDayOff}
                      onChange={(e) =>
                        handleChange(workDate, {
                          isDayOffRequested: e.target.checked,
                          preferredStartMinutes: e.target.checked ? null : item?.preferredStartMinutes ?? null,
                          preferredEndMinutes: e.target.checked ? null : item?.preferredEndMinutes ?? null,
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="time"
                      disabled={isDayOff}
                      value={timeInputFromMinutes(item?.preferredStartMinutes ?? null)}
                      onChange={(e) =>
                        handleChange(workDate, {
                          preferredStartMinutes: minutesFromTimeInput(e.target.value),
                        })
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="time"
                      disabled={isDayOff}
                      value={timeInputFromMinutes(item?.preferredEndMinutes ?? null)}
                      onChange={(e) =>
                        handleChange(workDate, {
                          preferredEndMinutes: minutesFromTimeInput(e.target.value),
                        })
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
