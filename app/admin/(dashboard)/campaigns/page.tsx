"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, RotateCcw, Plus } from "lucide-react";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  republishCampaign,
  type CampaignListItem,
} from "@/app/actions/manage-campaigns";
import { listAllCoursesForManagement, type ManagedCourse } from "@/app/actions/manage-courses";
import { listCourseCategories, type CourseCategoryListItem } from "@/app/actions/course-categories";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: "",
  discountType: "percentage" as "percentage" | "fixed_amount",
  discountValue: 10,
  startDate: "",
  endDate: "",
  priority: 0,
  storeIds: [] as number[],
  courseIds: [] as number[],
  categoryIds: [] as number[],
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategoryListItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [includeUnpublished, setIncludeUnpublished] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    listCampaigns({ includeUnpublished, page }).then((result) => {
      setCampaigns(result.items);
      setTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeUnpublished, page]);

  useEffect(() => {
    listAllCoursesForManagement().then(setCourses);
    listCourseCategories().then(setCategories);
    listStores().then(setStores);
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: CampaignListItem) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue,
      startDate: c.startDate,
      endDate: c.endDate,
      priority: c.priority,
      storeIds: c.storeIds,
      courseIds: c.courseIds,
      categoryIds: c.categoryIds,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    if (editingId) {
      await updateCampaign({ campaignId: editingId, ...form });
    } else {
      await createCampaign(form);
    }
    setSubmitting(false);
    setModalOpen(false);
    // 新規作成は一覧の先頭（1ページ目）に表示されるため、1ページ目以外を見ていた場合は
    // 1ページ目に戻す。編集は表示順が変わらないため、閲覧中のページのまま再取得する。
    // 1ページ目なら useEffect の再発火が起きないため直接再取得する。
    if (editingId) {
      reload();
    } else if (page === 1) {
      reload();
    } else {
      setPage(1);
    }
  }

  async function handleDelete(c: CampaignListItem) {
    if (!window.confirm(`「${c.name}」を無効化しますか？`)) return;
    await deleteCampaign(c.id);
    reload();
  }

  async function handleRestore(c: CampaignListItem) {
    await republishCampaign(c.id);
    reload();
  }

  function toggleStore(id: number) {
    setForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

  function toggleCourse(id: number) {
    setForm((f) => ({
      ...f,
      courseIds: f.courseIds.includes(id)
        ? f.courseIds.filter((c) => c !== id)
        : [...f.courseIds, id],
    }));
  }

  function toggleCategory(id: number) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-1 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規作成
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={includeUnpublished}
          onChange={(e) => {
            setPage(1);
            setIncludeUnpublished(e.target.checked);
          }}
        />
        無効なキャンペーンも表示
      </label>

      <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
              <th className="p-3">キャンペーン名</th>
              <th className="p-3">割引</th>
              <th className="p-3">期間</th>
              <th className="p-3">対象店舗</th>
              <th className="p-3">対象</th>
              <th className="p-3">優先度</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-neutral-100 last:border-0 ${!c.isPublished ? "opacity-50" : ""}`}
              >
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  {c.discountType === "percentage" ? `${c.discountValue}%` : formatYen(c.discountValue)}
                </td>
                <td className="p-3">
                  {c.startDate} 〜 {c.endDate}
                </td>
                <td className="p-3">{c.storeNames.join("、")}</td>
                <td className="p-3">{c.targetNames.join("、") || "—"}</td>
                <td className="p-3">{c.priority}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {c.isPublished ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(c)}
                        className="text-neutral-500 hover:text-primary-600"
                        aria-label="復元"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">キャンペーンがありません。</p>
        )}
      </div>

      <p className="text-center text-xs text-neutral-500">{totalCount}件中 {campaigns.length}件を表示</p>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? "キャンペーンを編集" : "新規キャンペーン作成"}
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="キャンペーン名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
          />

          <div className="flex gap-3">
            <select
              value={form.discountType}
              onChange={(e) =>
                setForm({ ...form, discountType: e.target.value as "percentage" | "fixed_amount" })
              }
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            >
              <option value="percentage">定率（%）</option>
              <option value="fixed_amount">定額（円）</option>
            </select>
            <input
              type="number"
              min={0}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-neutral-300 px-3 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-neutral-600">優先度</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className="h-10 w-24 rounded-md border border-neutral-300 px-3 text-sm"
            />
          </div>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象店舗（未選択の場合は全店舗が対象）</p>
            <div className="flex flex-wrap gap-3">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.storeIds.includes(s.id)}
                    onChange={() => toggleStore(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象カテゴリ</p>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-neutral-600">対象コース</p>
            <div className="flex flex-col gap-2">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="mb-1 text-xs font-medium text-neutral-500">{cat.name}</p>
                  <div className="flex flex-wrap gap-3">
                    {courses
                      .filter((course) => course.categoryId === cat.id)
                      .map((course) => (
                        <label key={course.id} className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={form.courseIds.includes(course.id)}
                            onChange={() => toggleCourse(course.id)}
                          />
                          {course.name}
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || !form.name || !form.startDate || !form.endDate}
            onClick={handleSubmit}
            className="h-12 rounded-lg bg-accent-500 font-medium text-white disabled:opacity-50"
          >
            {editingId ? "更新する" : "キャンペーンを作成する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
