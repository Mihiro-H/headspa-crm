"use client";

import { useEffect, useState } from "react";
import { getAvailableSlots } from "@/app/actions/availability";
import { minutesToLabel } from "@/lib/reservation/time";
import { MAX_BOOKING_MONTHS_AHEAD } from "@/lib/reservation/booking-window";

interface DateTimeSelectStepProps {
  storeId: number;
  staffId: number | null;
  courseId: number;
  optionIds: number[];
  onSelect: (date: string, startMinutes: number) => void;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 週の始まりを月曜日とする
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function tomorrow(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return addDays(d, 1);
}

function latestBookableDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + MAX_BOOKING_MONTHS_AHEAD, d.getUTCDate()));
}

export function DateTimeSelectStep({
  storeId,
  staffId,
  courseId,
  optionIds,
  onSelect,
}: DateTimeSelectStepProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(tomorrow()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState("");

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const earliestSelectable = toDateString(tomorrow());
  const latestSelectable = toDateString(latestBookableDate());
  // 週が月をまたぐ場合、月曜日基準だと表示中の週のほとんどが翌月なのに前月表記になってしまう。
  // ISO週の慣習にならい、週の中日（木曜日）が属する月を見出しに使う。
  const monthAnchor = weekDates[3];
  const monthLabel = `${monthAnchor.getUTCFullYear()}年${monthAnchor.getUTCMonth() + 1}月`;

  useEffect(() => {
    if (!selectedDate) return;
    // Standard data-fetch-on-dependency-change pattern: always re-fetches (no
    // caching), so switching store/staff/course/options/date never shows stale
    // availability.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getAvailableSlots({ storeId, staffId, date: selectedDate, courseId, optionIds })
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [selectedDate, storeId, staffId, courseId, optionIds]);

  function handleJumpToDate(dateStr: string) {
    const target = new Date(`${dateStr}T00:00:00.000Z`);
    setWeekStart(startOfWeek(target));
    setSelectedDate(dateStr);
    setShowDatePicker(false);
    setPickerValue("");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">日時を選択してください</h2>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-600"
        >
          ← 前週
        </button>
        <span className="text-sm font-medium text-neutral-700">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-600"
        >
          次週 →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d) => {
          const dateStr = toDateString(d);
          const isOutOfRange = dateStr < earliestSelectable || dateStr > latestSelectable;
          return (
            <button
              key={dateStr}
              type="button"
              disabled={isOutOfRange}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex flex-col items-center rounded-lg border py-2 text-xs disabled:cursor-not-allowed disabled:opacity-30 ${
                selectedDate === dateStr
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-200 bg-neutral-0 text-neutral-700"
              }`}
            >
              <span>{WEEKDAY_LABELS[d.getUTCDay()]}</span>
              <span className="mt-1 font-medium">{d.getUTCDate()}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400">ご予約は本日から3ヶ月先までお受けできます。</p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowDatePicker((v) => !v)}
          className="self-start text-sm text-primary-600 underline"
        >
          日付を指定して移動
        </button>
        {showDatePicker && (
          <div className="flex gap-2">
            <input
              type="date"
              min={earliestSelectable}
              max={latestSelectable}
              value={pickerValue}
              onChange={(e) => setPickerValue(e.target.value)}
              className="h-10 w-48 rounded-md border border-neutral-300 px-2"
            />
            <button
              type="button"
              disabled={!pickerValue}
              onClick={() => handleJumpToDate(pickerValue)}
              className="rounded-md bg-primary-500 px-3 text-sm text-white disabled:opacity-50"
            >
              移動する
            </button>
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="grid grid-cols-3 gap-2">
          {loading && (
            <p className="col-span-3 text-center text-sm text-neutral-500">読み込み中...</p>
          )}
          {!loading && slots.length === 0 && (
            <p className="col-span-3 text-center text-sm text-neutral-500">空き枠がありません</p>
          )}
          {!loading &&
            slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(selectedDate, slot)}
                className="rounded-lg border border-neutral-200 bg-neutral-0 py-2 text-sm text-neutral-800 hover:border-primary-300"
              >
                {minutesToLabel(slot)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
