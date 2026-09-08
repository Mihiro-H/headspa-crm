import { describe, it, expect } from "vitest";
import { resolveAccessDecision } from "./access-control";

describe("resolveAccessDecision", () => {
  it("allows admin roles into /admin routes", () => {
    expect(resolveAccessDecision("/admin/dashboard", "manager")).toEqual({
      type: "allow",
    });
  });

  it("redirects a member trying to access /admin routes", () => {
    expect(resolveAccessDecision("/admin/dashboard", "member")).toEqual({
      type: "redirect",
      to: "/admin/login",
    });
  });

  it("redirects an unauthenticated user trying to access /admin routes", () => {
    expect(resolveAccessDecision("/admin/dashboard", undefined)).toEqual({
      type: "redirect",
      to: "/admin/login",
    });
  });

  it("always allows the /admin/login page itself", () => {
    expect(resolveAccessDecision("/admin/login", undefined)).toEqual({
      type: "allow",
    });
  });

  it("always allows the /admin/accept-invite page itself", () => {
    expect(resolveAccessDecision("/admin/accept-invite", undefined)).toEqual({
      type: "allow",
    });
  });

  it("allows members into /mypage routes", () => {
    expect(resolveAccessDecision("/mypage", "member")).toEqual({ type: "allow" });
  });

  it("redirects a non-member trying to access /mypage routes", () => {
    expect(resolveAccessDecision("/mypage", "manager")).toEqual({
      type: "redirect",
      to: "/login",
    });
  });

  it("allows any other route through untouched", () => {
    expect(resolveAccessDecision("/", undefined)).toEqual({ type: "allow" });
  });
});
