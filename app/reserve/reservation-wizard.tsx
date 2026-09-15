"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WizardProgress } from "@/components/reservation/wizard-progress";
import { StoreSelectStep } from "@/components/reservation/store-select-step";
import { CategorySelectStep } from "@/components/reservation/category-select-step";
import { CourseSelectStep } from "@/components/reservation/course-select-step";
import { OptionSelectStep } from "@/components/reservation/option-select-step";
import { StaffSelectStep } from "@/components/reservation/staff-select-step";
import { DateTimeSelectStep } from "@/components/reservation/date-time-select-step";
import { AuthStep } from "@/components/reservation/auth-step";
import { ConfirmationStep } from "@/components/reservation/confirmation-step";
import { CompletionStep } from "@/components/reservation/completion-step";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listCoursesForCategory, type CourseListItem } from "@/app/actions/courses";
import { listOptions, type OptionListItem } from "@/app/actions/options";
import { listStaffForStore, type StaffListItem } from "@/app/actions/staff";
import { createTempHoldReservation } from "@/app/actions/create-temp-hold";
import { confirmReservation } from "@/app/actions/confirm-reservation";
import { minutesToLabel } from "@/lib/reservation/time";
import type { MemberGender } from "@/lib/reservation/gender-restriction";
import { LINE_RESUME_STORAGE_KEY, parseLineResumeState, type WizardState } from "@/components/reservation/wizard-state";

const TOTAL_STEPS = 9;

export function ReservationWizard({ memberGender }: { memberGender: MemberGender | null }) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    storeId: null,
    categoryId: null,
    courseId: null,
    optionIds: [],
    staffId: null,
    reservationDate: null,
    startTimeLabel: null,
    reservationId: null,
    errorMessage: null,
  });
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [options, setOptions] = useState<OptionListItem[]>([]);
  const [staff, setStaff] = useState<StaffListItem[]>([]);

  // LINEログインから戻ってきた直後、フルページ遷移で消えてしまったウィザードの
  // 状態をsessionStorageから復元する（LINE_RESUME_STORAGE_KEYの保存元は
  // auth-step.tsxのLINEログインボタン）。保存が無い通常の初回表示では何もしない。
  useEffect(() => {
    const saved = sessionStorage.getItem(LINE_RESUME_STORAGE_KEY);
    sessionStorage.removeItem(LINE_RESUME_STORAGE_KEY);
    const restored = parseLineResumeState(saved);
    if (!restored) return;

    // sessionStorage（外部システム）から復元した値をstateに反映するためのeffect。
    // 通常のデータ取得（.then(setter)）とは違い同期的な代入だが、これは
    // マウント時に一度だけsessionStorageと同期する必要がある正当なケース。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(restored);

    // 確認画面（step 8）はcourses/options/staffの一覧を表示に使うが、
    // 通常のstep遷移（step===3/4/5時点の各useEffect）を経由せずstep 8へ
    // 直接ジャンプするため、ここで明示的に取得しておく。
    if (restored.categoryId !== null && restored.storeId !== null) {
      listCoursesForCategory(restored.categoryId, restored.storeId).then(setCourses);
    }
    listOptions().then(setOptions);
    if (restored.storeId !== null) {
      listStaffForStore(restored.storeId).then(setStaff);
    }
  }, []);

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
      reservationDate: date,
      startTimeLabel: minutesToLabel(startMinutes),
      step: 7,
      errorMessage: null,
    }));
  }

  async function handleConfirm() {
    if (state.reservationId === null) return;
    // confirmingステートの更新はReactの再描画を待つため反映に一瞬遅れがあり、
    // 素早い連打・トラックパッドの誤爆等で「予約する」ボタンが無効化される前に
    // 2回目のクリックが素通りしてconfirmReservationが二重に呼ばれることがある。
    // refは同期的に即反映されるため、ここで確実に二重実行をブロックする。
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    const result = await confirmReservation({ reservationId: state.reservationId });
    confirmingRef.current = false;
    setConfirming(false);

    if (result.status !== "confirmed") {
      setState((s) => ({
        ...s,
        errorMessage:
          result.status === "expired"
            ? "仮予約の有効期限が切れました。お手数ですが最初からやり直してください。"
            : "予約の確定に失敗しました。もう一度お試しください。",
      }));
      return;
    }

    setState((s) => ({ ...s, step: 9, errorMessage: null }));
  }

  function handleBack() {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1), errorMessage: null }));
  }

  const selectedStore = stores.find((s) => s.id === state.storeId);
  const selectedCourse = courses.find((c) => c.id === state.courseId);
  const selectedOptions = options.filter((o) => state.optionIds.includes(o.id));
  const selectedStaff = staff.find((s) => s.id === state.staffId);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      {state.step < 9 && (
        <Link
          href="/mypage"
          className="self-start text-sm text-neutral-400 hover:text-primary-600"
        >
          ← マイページに戻る
        </Link>
      )}

      <WizardProgress currentStep={state.step} totalSteps={TOTAL_STEPS} />

      {state.step > 1 && state.step <= 6 && (
        <button
          type="button"
          onClick={handleBack}
          className="self-start text-sm text-neutral-500 hover:text-primary-600"
        >
          ← 戻る
        </button>
      )}

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

      {state.step === 7 && (
        <AuthStep wizardState={state} onAuthenticated={() => setState((s) => ({ ...s, step: 8 }))} />
      )}

      {state.step === 8 && state.reservationDate !== null && state.startTimeLabel !== null && (
        <ConfirmationStep
          store={selectedStore}
          course={selectedCourse}
          options={selectedOptions}
          staff={selectedStaff}
          reservationDate={state.reservationDate}
          startTimeLabel={state.startTimeLabel}
          onConfirm={handleConfirm}
          submitting={confirming}
          errorMessage={state.errorMessage}
        />
      )}

      {state.step === 9 && state.reservationId !== null && (
        <CompletionStep reservationId={state.reservationId} />
      )}
    </div>
  );
}
