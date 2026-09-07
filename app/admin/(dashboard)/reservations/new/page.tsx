"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { searchCustomers, type CustomerListItem } from "@/app/actions/search-customers";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { getAvailableSlots } from "@/app/actions/availability";
import { createPhoneReservation } from "@/app/actions/create-phone-reservation";
import { minutesToLabel } from "@/lib/reservation/time";

export default function AdminNewPhoneReservationPage() {
  const router = useRouter();
  const [memberQuery, setMemberQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [memberId, setMemberId] = useState<number | null>(null);

  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);

  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [courseId, setCourseId] = useState<number | null>(null);

  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<number[]>([]);
  const [startMinutes, setStartMinutes] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (memberQuery.length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomers([]);
      return;
    }
    searchCustomers({ name: memberQuery }).then(setCustomers);
  }, [memberQuery]);

  useEffect(() => {
    listStores().then(setStores);
    listCourseCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (categoryId !== null && storeId !== null) {
      listCoursesForCategory(categoryId, storeId).then(setCourses);
    }
  }, [categoryId, storeId]);

  useEffect(() => {
    if (storeId !== null) {
      listStaffForStore(storeId).then(setStaff);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId !== null && courseId !== null && date) {
      getAvailableSlots({ storeId, staffId, date, courseId, optionIds: [] }).then(setSlots);
    }
  }, [storeId, courseId, staffId, date]);

  async function handleSubmit() {
    if (memberId === null || storeId === null || courseId === null || startMinutes === null) {
      setError("会員・店舗・コース・日時をすべて選択してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createPhoneReservation({
      memberId,
      storeId,
      staffId,
      courseId,
      optionIds: [],
      reservationDate: date,
      startMinutes,
    });
    setSubmitting(false);

    if (result.status === "slot_unavailable") {
      setError("選択した時間枠は既に埋まっています。別の時間を選んでください。");
      return;
    }

    router.push(`/admin/reservations/${result.reservationId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">会員を検索</label>
        <input
          type="text"
          placeholder="氏名で検索"
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        {customers.length > 0 && (
          <ul className="rounded-md border border-neutral-200">
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setMemberId(c.id);
                    setMemberQuery(c.name);
                    setCustomers([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {memberId !== null && (
          <p className="text-xs text-primary-700">選択中の会員ID: {memberId}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">店舗</label>
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">選択してください</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">コースカテゴリ</label>
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">選択してください</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">コース</label>
        <select
          value={courseId ?? ""}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">選択してください</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">スタッフ（任意）</label>
        <select
          value={staffId ?? ""}
          onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        >
          <option value="">指名なし</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-600">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </div>

      {slots.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setStartMinutes(slot)}
              className={`rounded-md border px-2 py-2 text-sm ${
                startMinutes === slot
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-200 text-neutral-700"
              }`}
            >
              {minutesToLabel(slot)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
      >
        予約を登録する
      </button>
    </div>
  );
}
