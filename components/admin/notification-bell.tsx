"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem,
} from "@/app/actions/notifications";

const TYPE_LABEL: Record<string, string> = {
  new_reservation: "新規予約",
  cancellation: "キャンセル",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadNotificationCount(null).then(setUnreadCount);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await listNotifications(null);
      setNotifications(list);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsAsRead(null);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function handleItemClick(n: NotificationItem) {
    if (!n.isRead) {
      await markNotificationAsRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary-50"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-neutral-200 bg-neutral-0 shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 p-3">
            <span className="text-sm font-medium text-neutral-700">通知</span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-primary-600 underline"
            >
              すべて既読にする
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="p-4 text-sm text-neutral-500">通知はありません。</p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={`/admin/reservations/${n.reservationId}`}
                onClick={() => handleItemClick(n)}
                className={`block border-b border-neutral-50 p-3 text-sm last:border-0 ${
                  n.isRead ? "text-neutral-500" : "bg-primary-50 text-neutral-800"
                }`}
              >
                <span className="text-xs text-neutral-400">{TYPE_LABEL[n.type] ?? n.type}</span>
                <p>{n.message}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
