"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMyStaffId,
  getStaffShiftRequests,
  saveStaffShiftRequest,
  type ShiftRequestType,
  type StaffShiftRequestItem,
} from "@/app/actions/staff-shift-requests";
import { minutesToLabel } from "@/lib/reservation/time";
import { resolveSaveOutcome } from "@/lib/scheduling/resolve-save-outcome";
import { isShiftRequestComplete } from "@/lib/scheduling/shift-request-completion";

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

const REQUEST_TYPES: readonly ShiftRequestType[] = ["full", "day_off", "reduced"];

const REQUEST_TYPE_LABELS: Record<ShiftRequestType, string> = {
  full: "出勤",
  day_off: "休み希望",
  reduced: "時短希望",
};

const EMPTY_ITEM = (workDate: string): StaffShiftRequestItem => ({
  workDate,
  requestType: "full",
  preferredStartMinutes: null,
  preferredEndMinutes: null,
});

export default function MyShiftRequestsPage() {
  const [staffId, setStaffId] = useState<number | null | undefined>(undefined);
  const [yearMonth, setYearMonth] = useState(yearMonthWithOffset(1));
  const [requests, setRequests] = useState<Map<string, StaffShiftRequestItem>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 同一日付への変更が短時間に連続した場合、古いリクエストの失敗結果で
  // 新しい変更を誤って巻き戻さないよう、日付ごとに連番を振って
  // 「自分が最後に投げたリクエストか」を判定する
  const requestSeqRef = useRef<Map<string, number>>(new Map());

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
    const previous = requests.get(workDate);
    const next = { ...(previous ?? EMPTY_ITEM(workDate)), ...patch };
    setRequests((prev) => new Map(prev).set(workDate, next));
    setErrorMessage(null);

    const seq = (requestSeqRef.current.get(workDate) ?? 0) + 1;
    requestSeqRef.current.set(workDate, seq);

    const result = await saveStaffShiftRequest({
      staffId,
      workDate,
      requestType: next.requestType,
      preferredStartMinutes: next.preferredStartMinutes,
      preferredEndMinutes: next.preferredEndMinutes,
    });

    const outcome = resolveSaveOutcome({
      latestSeqForDate: requestSeqRef.current.get(workDate) ?? seq,
      ownSeq: seq,
      saveSucceeded: result.status === "saved",
    });

    if (outcome === "rollback") {
      setRequests((prev) => {
        const rolledBack = new Map(prev);
        if (previous) {
          rolledBack.set(workDate, previous);
        } else {
          rolledBack.delete(workDate);
        }
        return rolledBack;
      });
      setErrorMessage(`${workDate}の保存に失敗しました。もう一度お試しください。`);
    }
  }

  function handleRequestTypeChange(workDate: string, requestType: ShiftRequestType) {
    const item = requests.get(workDate);
    if (requestType === "reduced") {
      // 時短希望に切り替えた直後は、既存の時刻があればそれを引き継ぐ
      handleChange(workDate, {
        requestType,
        preferredStartMinutes: item?.preferredStartMinutes ?? null,
        preferredEndMinutes: item?.preferredEndMinutes ?? null,
      });
    } else {
      // 出勤・休み希望では時刻は使わないのでクリアする
      handleChange(workDate, { requestType, preferredStartMinutes: null, preferredEndMinutes: null });
    }
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

  const days = daysInYearMonth(yearMonth);
  const completeCount = days.filter((d) => isShiftRequestComplete(requests.get(d))).length;

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

      <p className="text-sm text-neutral-600">
        {days.length}日中{completeCount}件完了・{days.length - completeCount}件不備
      </p>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <th scope="col" className="p-2 font-medium">日付</th>
              <th scope="col" className="p-2 font-medium">希望区分</th>
              <th scope="col" className="p-2 font-medium">希望開始</th>
              <th scope="col" className="p-2 font-medium">希望終了</th>
            </tr>
          </thead>
          <tbody>
            {days.map((workDate) => {
              const item = requests.get(workDate);
              const requestType = item?.requestType ?? "full";
              const isReduced = requestType === "reduced";
              return (
                <tr key={workDate} className="border-b border-neutral-100 last:border-0">
                  <td className="p-2 text-neutral-800">{workDate}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      {REQUEST_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-1 text-xs text-neutral-700">
                          <input
                            type="radio"
                            name={`request-type-${workDate}`}
                            aria-label={`${workDate} ${REQUEST_TYPE_LABELS[type]}`}
                            checked={requestType === type}
                            onChange={() => handleRequestTypeChange(workDate, type)}
                          />
                          {REQUEST_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      type="time"
                      aria-label={`${workDate} 希望開始時刻`}
                      disabled={!isReduced}
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
                      aria-label={`${workDate} 希望終了時刻`}
                      disabled={!isReduced}
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
