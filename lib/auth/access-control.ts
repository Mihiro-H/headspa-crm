export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export function resolveAccessDecision(
  pathname: string,
  role: string | undefined,
): AccessDecision {
  const isAdminLoginPage = pathname.startsWith("/admin/login");
  const isAdminArea = pathname.startsWith("/admin") && !isAdminLoginPage;
  const isMemberArea = pathname.startsWith("/mypage");

  if (isAdminArea && !(role && ADMIN_ROLES.has(role))) {
    return { type: "redirect", to: "/admin/login" };
  }

  if (isMemberArea && role !== "member") {
    return { type: "redirect", to: "/login" };
  }

  return { type: "allow" };
}
