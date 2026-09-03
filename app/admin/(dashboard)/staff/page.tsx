"use client";

import { useEffect, useState } from "react";
import { listAllStaff, updateStaff, type ManagedStaff } from "@/app/actions/manage-staff";

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    listAllStaff().then(setStaff);
  }, []);

  async function handleFeeBlur(member: ManagedStaff, nominationFee: number) {
    setSaving(member.id);
    await updateStaff({ staffId: member.id, nominationFee, isActive: member.isActive });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, nominationFee } : s)));
    setSaving(null);
  }

  async function handleToggleActive(member: ManagedStaff) {
    const isActive = !member.isActive;
    setSaving(member.id);
    await updateStaff({ staffId: member.id, nominationFee: member.nominationFee, isActive });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, isActive } : s)));
    setSaving(null);
  }

  const grouped = staff.reduce<Record<string, ManagedStaff[]>>((acc, s) => {
    acc[s.storeName] = acc[s.storeName] ?? [];
    acc[s.storeName].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">スタッフ管理</h1>

      {Object.entries(grouped).map(([storeName, members]) => (
        <div key={storeName} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-600">{storeName}</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">氏名</th>
                  <th className="p-3">紹介文</th>
                  <th className="p-3">指名料金</th>
                  <th className="p-3">在籍</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3 text-neutral-500">{s.bio ?? "—"}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={s.nominationFee}
                        onBlur={(e) => handleFeeBlur(s, Number(e.target.value))}
                        className="h-9 w-24 rounded-md border border-neutral-300 px-2"
                      />
                    </td>
                    <td className="p-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={s.isActive}
                          onChange={() => handleToggleActive(s)}
                        />
                        {s.isActive ? "在籍中" : "退職"}
                      </label>
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {saving === s.id ? "保存中..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
