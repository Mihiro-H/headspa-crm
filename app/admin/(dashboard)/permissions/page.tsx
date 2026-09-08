"use client";

import { useEffect, useState } from "react";
import {
  listPermissions,
  setPermission,
  type PagePermissionItem,
} from "@/app/actions/manage-permissions";
import type { AdminRole, PermissionLevel } from "@prisma/client";

const ROLES: AdminRole[] = ["hq", "manager", "staff"];
const ROLE_LABEL: Record<AdminRole, string> = { hq: "本部", manager: "店長", staff: "一般" };

const PAGE_KEYS: { key: string; label: string }[] = [
  { key: "/admin/dashboard", label: "ダッシュボード" },
  { key: "/admin/calendar", label: "予約カレンダー" },
  { key: "/admin/customers", label: "顧客管理" },
  { key: "/admin/customer-statuses", label: "ステータス設定" },
  { key: "/admin/reservations/new", label: "電話予約登録" },
  { key: "/admin/menu", label: "メニュー・料金管理" },
  { key: "/admin/campaigns", label: "キャンペーン管理" },
  { key: "/admin/staff", label: "スタッフ管理" },
  { key: "/admin/stores", label: "店舗管理" },
  { key: "/admin/reports", label: "売上・月報レポート" },
  { key: "/admin/segment-campaigns", label: "メール／LINE配信管理" },
  { key: "/admin/cron-logs", label: "Cronジョブ実行ログ" },
  { key: "/admin/accounts", label: "アカウント管理" },
  { key: "/admin/permissions", label: "権限設定" },
  { key: "/admin/terms", label: "利用規約設定" },
];

function levelFor(
  permissions: PagePermissionItem[],
  role: AdminRole,
  pageKey: string,
): PermissionLevel {
  return permissions.find((p) => p.role === role && p.pageKey === pageKey)?.level ?? "edit";
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<PagePermissionItem[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listPermissions().then(setPermissions);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleChange(role: AdminRole, pageKey: string, level: PermissionLevel) {
    const cellKey = `${role}:${pageKey}`;
    setSavingKey(cellKey);
    setError(null);
    try {
      await setPermission(role, pageKey, level);
      setPermissions((prev) => {
        const rest = prev.filter((p) => !(p.role === role && p.pageKey === pageKey));
        return [...rest, { role, pageKey, level }];
      });
    } catch {
      setError("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">ページ</th>
              {ROLES.map((role) => (
                <th key={role} className="p-3">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PAGE_KEYS.map(({ key, label }) => (
              <tr key={key} className="border-b border-neutral-100 last:border-0">
                <td className="p-3">{label}</td>
                {ROLES.map((role) => {
                  const cellKey = `${role}:${key}`;
                  return (
                    <td key={role} className="p-3">
                      <select
                        value={levelFor(permissions, role, key)}
                        onChange={(e) => handleChange(role, key, e.target.value as PermissionLevel)}
                        disabled={savingKey === cellKey}
                        className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
                      >
                        <option value="edit">編集</option>
                        <option value="view">閲覧</option>
                        <option value="hidden">非表示</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
