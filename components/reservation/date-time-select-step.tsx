"use client";

import { useEffect, useState } from "react";
import { getAvailableSlots } from "@/app/actions/availability";
import { minutesToLabel } from "@/lib/reservation/time";

interface DateTimeSelectStepProps {
  storeId: number;
  staffId: number | null;
  courseId: number;
  optionIds: number[];
  onSelect: (date: string, startMinutes: number) => void;
}

function nextDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function DateTimeSelectStep({
  storeId,
  staffId,
  courseId,
  optionIds,
  onSelect,
}: DateTimeSelectStepProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const dates = nextDates(14);

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

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-primary-700">日時を選択してください</h2>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            onClick={() => setSelectedDate(date)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
              selectedDate === date
                ? "border-primary-500 bg-primary-500 text-white"
                : "border-neutral-200 bg-neutral-0 text-neutral-700"
            }`}
          >
            {date.slice(5).replace("-", "/")}
          </button>
        ))}
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
