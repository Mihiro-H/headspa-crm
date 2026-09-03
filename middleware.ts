import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { resolveAccessDecision } from "@/lib/auth/access-control";

export default auth((req) => {
  const decision = resolveAccessDecision(req.nextUrl.pathname, req.auth?.user?.role);

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/mypage/:path*"],
};
