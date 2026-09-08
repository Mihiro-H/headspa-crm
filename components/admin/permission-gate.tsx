"use client";

import { usePathname } from "next/navigation";

export interface PermissionGateProps {
  viewOnlyPageKeys: string[];
  children: React.ReactNode;
}

export function PermissionGate({ viewOnlyPageKeys, children }: PermissionGateProps) {
  const pathname = usePathname();
  const isViewOnly = viewOnlyPageKeys.some(
    (key) => pathname === key || pathname.startsWith(`${key}/`),
  );

  if (!isViewOnly) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p
        role="status"
        className="rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-700"
      >
        このページは閲覧のみ許可されています。
      </p>
      <div className="pointer-events-none opacity-60">{children}</div>
    </div>
  );
}
