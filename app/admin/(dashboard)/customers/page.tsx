"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchCustomers, type CustomerListItem } from "@/app/actions/search-customers";

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default function AdminCustomersPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);

  useEffect(() => {
    searchCustomers({
      name: name || undefined,
      phone: phone || undefined,
    }).then(setCustomers);
  }, [name, phone]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-primary-700">顧客管理</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="氏名で検索"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
        <input
          type="text"
          placeholder="電話番号で検索"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">会員ID</th>
              <th className="p-3">氏名</th>
              <th className="p-3">ステータス</th>
              <th className="p-3">来店回数</th>
              <th className="p-3">累計金額</th>
              <th className="p-3">最終来店日</th>
              <th className="p-3">所属店舗</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 last:border-0">
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
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">該当する顧客がいません。</p>
        )}
      </div>
    </div>
  );
}
