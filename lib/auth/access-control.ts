export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

// hqロールが自分自身を含む全ロールの/admin/permissionsを「非表示」に設定してしまうと、
// 設定を戻せる唯一の画面から誰もアクセスできなくなるロックアウトが発生しうる。
// ダッシュボード同様、この画面自体は非表示設定の対象から常に除外する。
const NEVER_HIDDEN_PAGES = new Set(["/admin/dashboard", "/admin/permissions"]);

export function resolveAccessDecision(
  pathname: string,
  role: string | undefined,
  hiddenPageKeys: string[] = [],
): AccessDecision {
  // /admin/accept-inviteの例外はPhase Hで追加済み（アカウント招待の受諾ページを未認証で許可するため）。
  const isPublicAdminPage =
    pathname.startsWith("/admin/login") || pathname.startsWith("/admin/accept-invite");
  const isAdminArea = pathname.startsWith("/admin") && !isPublicAdminPage;
  const isMemberArea = pathname.startsWith("/mypage");

  if (isAdminArea && !(role && ADMIN_ROLES.has(role))) {
    return { type: "redirect", to: "/admin/login" };
  }

  if (isMemberArea && role !== "member") {
    return { type: "redirect", to: "/login" };
  }

  const isHidden =
    isAdminArea &&
    !NEVER_HIDDEN_PAGES.has(pathname) &&
    hiddenPageKeys.some((key) => pathname === key || pathname.startsWith(`${key}/`));

  if (isHidden) {
    return { type: "redirect", to: "/admin/dashboard" };
  }

  return { type: "allow" };
}
