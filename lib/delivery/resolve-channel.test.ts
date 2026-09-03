import { describe, it, expect } from "vitest";
import { isMemberEligibleForChannel, resolveMemberChannel } from "./resolve-channel";

describe("isMemberEligibleForChannel", () => {
  it("is eligible for email mode regardless of LINE link", () => {
    expect(isMemberEligibleForChannel("email", null)).toBe(true);
    expect(isMemberEligibleForChannel("email", "line-user-1")).toBe(true);
  });

  it("is eligible for line mode only when LINE-linked", () => {
    expect(isMemberEligibleForChannel("line", "line-user-1")).toBe(true);
    expect(isMemberEligibleForChannel("line", null)).toBe(false);
  });

  it("is eligible for auto mode regardless of LINE link", () => {
    expect(isMemberEligibleForChannel("auto", null)).toBe(true);
    expect(isMemberEligibleForChannel("auto", "line-user-1")).toBe(true);
  });
});

describe("resolveMemberChannel", () => {
  it("resolves to email when mode is email, regardless of LINE link", () => {
    expect(resolveMemberChannel("email", "line-user-1")).toBe("email");
    expect(resolveMemberChannel("email", null)).toBe("email");
  });

  it("resolves to line when mode is line", () => {
    expect(resolveMemberChannel("line", "line-user-1")).toBe("line");
  });

  it("resolves to line when mode is auto and the member is LINE-linked", () => {
    expect(resolveMemberChannel("auto", "line-user-1")).toBe("line");
  });

  it("resolves to email when mode is auto and the member is not LINE-linked", () => {
    expect(resolveMemberChannel("auto", null)).toBe("email");
  });
});
