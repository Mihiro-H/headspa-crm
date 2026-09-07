"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, RotateCcw, ArrowUp, ArrowDown, Plus } from "lucide-react";
import {
  searchCustomers,
  type CustomerListItem,
  type CustomerSortField,
  type SortDirection,
} from "@/app/actions/search-customers";
import {
  createCustomerByAdmin,
  updateCustomerByAdmin,
  deactivateCustomer,
  reactivateCustomer,
} from "@/app/actions/manage-customers";
import { listCustomerStatuses, type CustomerStatusItem } from "@/app/actions/customer-statuses";
import { listStores, type StoreListItem } from "@/app/actions/stores";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

const PAGE_SIZE = 20;

const SORT_COLUMNS: { field: CustomerSortField; label: string }[] = [
  { field: "id", label: "会員ID" },
  { field: "visitCount", label: "来店回数" },
  { field: "totalSpent", label: "累計金額" },
  { field: "lastVisitDate", label: "最終来店日" },
];

const EMPTY_CREATE_FORM = {
  name: "",
  email: "",
  phone: "",
  gender: "female" as "female" | "male" | "other",
  birthMonth: 1,
  primaryStoreId: null as number | null,
};

export default function AdminCustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [statusIds, setStatusIds] = useState<number[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortBy, setSortBy] = useState<CustomerSortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statuses, setStatuses] = useState<CustomerStatusItem[]>([]);
  const [stores, setStores] = useState<StoreListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    primaryStoreId: null as number | null,
  });
  const [saving, setSaving] = useState(false);

  function reload() {
    searchCustomers({
      name: name || undefined,
      phone: phone || undefined,
      statusIds: statusIds.length > 0 ? statusIds : undefined,
      includeInactive,
      sortBy,
      sortDirection,
      page,
    }).then((result) => {
      setCustomers(result.items);
      setTotalCount(result.totalCount);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, statusIds, includeInactive, sortBy, sortDirection, page]);

  useEffect(() => {
    listCustomerStatuses().then(setStatuses);
    listStores().then(setStores);
  }, []);

  function toggleStatus(statusId: number) {
    setPage(1);
    setStatusIds((prev) =>
      prev.includes(statusId) ? prev.filter((id) => id !== statusId) : [...prev, statusId],
    );
  }

  function toggleSort(field: CustomerSortField) {
    setPage(1);
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createCustomerByAdmin(createForm);
    setCreating(false);
    if (result.status === "email_taken") {
      setCreateError("このメールアドレスは既に登録されています。");
      return;
    }
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateOpen(false);
    // 新規顧客は既定の並び順（id降順）の先頭に現れる。ページ・並び順が既に既定状態でなければ
    // 既定に戻すことで新規顧客が確実に見える位置に表示されるようにする。
    // 既に既定状態ならuseEffectが再発火しないため直接reload()する。
    if (sortBy === "id" && sortDirection === "desc" && page === 1) {
      reload();
    } else {
      setSortBy("id");
      setSortDirection("desc");
      setPage(1);
    }
  }

  function startEdit(customer: CustomerListItem) {
    setEditing(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      primaryStoreId: customer.primaryStoreId,
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    await updateCustomerByAdmin({ memberId: editing.id, ...editForm });
    setSaving(false);
    setEditing(null);
    reload();
  }

  async function handleDeactivate(customer: CustomerListItem) {
    if (!window.confirm(`${customer.name}様を無効化しますか？`)) return;
    await deactivateCustomer(customer.id);
    reload();
  }

  async function handleReactivate(customer: CustomerListItem) {
    await reactivateCustomer(customer.id);
    reload();
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white"
        >
          <Plus size={16} />
          新規登録
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="氏名で検索"
          value={name}
          onChange={(e) => {
            setPage(1);
            setName(e.target.value);
          }}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <input
          type="text"
          placeholder="電話番号で検索"
          value={phone}
          onChange={(e) => {
            setPage(1);
            setPhone(e.target.value);
          }}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setPage(1);
              setIncludeInactive(e.target.checked);
            }}
          />
          無効な顧客も表示
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleStatus(s.id)}
            aria-pressed={statusIds.includes(s.id)}
            className="rounded-full px-3 py-1 text-xs text-white transition-opacity"
            style={{
              backgroundColor: s.colorCode,
              opacity: statusIds.length === 0 || statusIds.includes(s.id) ? 1 : 0.35,
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-0 text-left text-neutral-500 sticky top-0 z-10">
              {SORT_COLUMNS.slice(0, 1).map(({ field, label }) => (
                <th
                  key={field}
                  className="p-3"
                  aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(field)}
                    className="flex items-center gap-1"
                  >
                    {label}
                    {sortBy === field &&
                      (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th className="p-3">氏名</th>
              <th className="p-3">ステータス</th>
              {SORT_COLUMNS.slice(1).map(({ field, label }) => (
                <th
                  key={field}
                  className="p-3"
                  aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(field)}
                    className="flex items-center gap-1"
                  >
                    {label}
                    {sortBy === field &&
                      (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th className="p-3">所属店舗</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-neutral-100 last:border-0 ${!c.isActive ? "opacity-50" : ""}`}
              >
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="text-primary-700 underline">
                    {c.id}
                  </Link>
                </td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs text-white"
                    style={{ backgroundColor: c.statusColor }}
                  >
                    {c.statusName}
                  </span>
                </td>
                <td className="p-3">{c.visitCount}</td>
                <td className="p-3">{formatYen(c.totalSpent)}</td>
                <td className="p-3">{c.lastVisitDate ?? "—"}</td>
                <td className="p-3">{c.primaryStoreName ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-neutral-500 hover:text-primary-600"
                      aria-label="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    {c.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(c)}
                        className="text-neutral-500 hover:text-error"
                        aria-label="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(c)}
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
        {customers.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">該当する顧客がいません。</p>
        )}
      </div>

      <p className="text-center text-xs text-neutral-500">{totalCount}件中 {customers.length}件を表示</p>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="新規顧客登録">
        <div className="flex flex-col gap-3">
          {createError && (
            <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{createError}</p>
          )}
          <input
            type="text"
            placeholder="氏名"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="電話番号"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <div className="flex gap-3">
            <select
              value={createForm.gender}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  gender: e.target.value as "female" | "male" | "other",
                })
              }
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              <option value="female">女性</option>
              <option value="male">男性</option>
              <option value="other">その他</option>
            </select>
            <select
              value={createForm.birthMonth}
              onChange={(e) =>
                setCreateForm({ ...createForm, birthMonth: Number(e.target.value) })
              }
              className="h-10 rounded-md border border-neutral-300 px-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}月生まれ
                </option>
              ))}
            </select>
          </div>
          <select
            value={createForm.primaryStoreId ?? ""}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                primaryStoreId: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗（任意）</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={creating || !createForm.name || !createForm.email || !createForm.phone}
            onClick={handleCreate}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            登録する
          </button>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="顧客情報を編集"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="氏名"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <input
            type="text"
            placeholder="電話番号"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2"
          />
          <select
            value={editForm.primaryStoreId ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                primaryStoreId: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="h-10 rounded-md border border-neutral-300 px-2"
          >
            <option value="">所属店舗（任意）</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || !editForm.name || !editForm.phone}
            onClick={handleSaveEdit}
            className="h-12 rounded-lg bg-primary-500 font-medium text-white disabled:opacity-50"
          >
            更新する
          </button>
        </div>
      </Modal>
    </div>
  );
}
