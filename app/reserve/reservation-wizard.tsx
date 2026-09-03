"use client";

import { useEffect, useState } from "react";
import { WizardProgress } from "@/components/reservation/wizard-progress";
import { StoreSelectStep } from "@/components/reservation/store-select-step";
import { CategorySelectStep } from "@/components/reservation/category-select-step";
import { CourseSelectStep } from "@/components/reservation/course-select-step";
import { OptionSelectStep } from "@/components/reservation/option-select-step";
import { StaffSelectStep } from "@/components/reservation/staff-select-step";
import { DateTimeSelectStep } from "@/components/reservation/date-time-select-step";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listOptions, type OptionListItem } from "@/app/actions/options";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { createTempHoldReservation } from "@/app/actions/create-temp-hold";
import type { MemberGender } from "@/lib/reservation/gender-restriction";

const TOTAL_STEPS = 9;

interface WizardState {
  step: number;
  storeId: number | null;
  categoryId: number | null;
  courseId: number | null;
  optionIds: number[];
  staffId: number | null;
  reservationId: number | null;
  errorMessage: string | null;
}

export function ReservationWizard({ memberGender }: { memberGender: MemberGender | null }) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    storeId: null,
    categoryId: null,
    courseId: null,
    optionIds: [],
    staffId: null,
    reservationId: null,
    errorMessage: null,
  });
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [options, setOptions] = useState<OptionListItem[]>([]);
  const [staff, setStaff] = useState<StaffListItem[]>([]);

  useEffect(() => {
    listStores().then(setStores);
  }, []);

  useEffect(() => {
    listCourseCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (state.step === 3 && state.categoryId !== null && state.storeId !== null) {
      listCoursesForCategory(state.categoryId, state.storeId).then(setCourses);
    }
  }, [state.step, state.categoryId, state.storeId]);

  useEffect(() => {
    if (state.step === 4) {
      listOptions().then(setOptions);
    }
  }, [state.step]);

  useEffect(() => {
    if (state.step === 5 && state.storeId !== null) {
      listStaffForStore(state.storeId).then(setStaff);
    }
  }, [state.step, state.storeId]);

  async function handleDateTimeSelect(date: string, startMinutes: number) {
    if (state.storeId === null || state.courseId === null) return;

    const result = await createTempHoldReservation({
      storeId: state.storeId,
      staffId: state.staffId,
      courseId: state.courseId,
      optionIds: state.optionIds,
      reservationDate: date,
      startMinutes,
    });

    if (result.status === "slot_unavailable") {
      setState((s) => ({
        ...s,
        errorMessage: "選択した時間枠は他のお客様に予約されました。別の時間をお選びください。",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      reservationId: result.reservationId,
      step: 7,
      errorMessage: null,
    }));
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <WizardProgress currentStep={state.step} totalSteps={TOTAL_STEPS} />

      {state.step === 1 && (
        <StoreSelectStep
          stores={stores}
          onSelect={(storeId) => setState((s) => ({ ...s, storeId, step: 2 }))}
        />
      )}

      {state.step === 2 && (
        <CategorySelectStep
          categories={categories}
          onSelect={(categoryId) => setState((s) => ({ ...s, categoryId, step: 3 }))}
        />
      )}

      {state.step === 3 && (
        <CourseSelectStep
          courses={courses}
          memberGender={memberGender}
          onSelect={(courseId) => setState((s) => ({ ...s, courseId, step: 4 }))}
        />
      )}

      {state.step === 4 && (
        <OptionSelectStep
          options={options}
          memberGender={memberGender}
          selectedOptionIds={state.optionIds}
          onToggle={(optionId) =>
            setState((s) => ({
              ...s,
              optionIds: s.optionIds.includes(optionId)
                ? s.optionIds.filter((id) => id !== optionId)
                : [...s.optionIds, optionId],
            }))
          }
          onNext={() => setState((s) => ({ ...s, step: 5 }))}
        />
      )}

      {state.step === 5 && (
        <StaffSelectStep
          staff={staff}
          onSelect={(staffId) => setState((s) => ({ ...s, staffId, step: 6 }))}
        />
      )}

      {state.step === 6 && state.storeId !== null && state.courseId !== null && (
        <div className="flex flex-col gap-3">
          {state.errorMessage && (
            <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{state.errorMessage}</p>
          )}
          <DateTimeSelectStep
            storeId={state.storeId}
            staffId={state.staffId}
            courseId={state.courseId}
            optionIds={state.optionIds}
            onSelect={handleDateTimeSelect}
          />
        </div>
      )}

      {state.step >= 7 && (
        <p className="text-center text-sm text-neutral-500">
          仮予約番号: {state.reservationId ?? "—"}
          <br />
          会員登録/ログイン・確認・完了はPhase 5で実装予定です。
        </p>
      )}
    </div>
  );
}
