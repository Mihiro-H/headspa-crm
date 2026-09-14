import { describe, it, expect } from "vitest";
import { isMemberEligibleForChannel, resolveMemberChannel, type MemberChannelPreferences } from "./resolve-channel";

function prefs(overrides: Partial<MemberChannelPreferences> = {}): MemberChannelPreferences {
  return {
    lineUserId: "line-user-1",
    emailNotificationEnabled: true,
    lineNotificationEnabled: true,
    ...overrides,
  };
}

describe("resolveMemberChannel", () => {
  it("resolves to email when mode is email and the member allows email", () => {
    expect(resolveMemberChannel("email", prefs())).toBe("email");
  });

  it("resolves to none when mode is email but the member disabled email notifications", () => {
    expect(resolveMemberChannel("email", prefs({ emailNotificationEnabled: false }))).toBe("none");
  });

  it("resolves to line when mode is line and the member is LINE-linked and allows LINE", () => {
    expect(resolveMemberChannel("line", prefs())).toBe("line");
  });

  it("resolves to none when mode is line but the member is not LINE-linked", () => {
    expect(resolveMemberChannel("line", prefs({ lineUserId: null }))).toBe("none");
  });

  it("resolves to none when mode is line but the member disabled LINE notifications", () => {
    expect(resolveMemberChannel("line", prefs({ lineNotificationEnabled: false }))).toBe("none");
  });

  it("resolves to line when mode is auto and the member is LINE-linked and allows LINE", () => {
    expect(resolveMemberChannel("auto", prefs())).toBe("line");
  });

  it("falls back to email when mode is auto but the member disabled LINE notifications", () => {
    expect(resolveMemberChannel("auto", prefs({ lineNotificationEnabled: false }))).toBe("email");
  });

  it("falls back to email when mode is auto and the member is not LINE-linked", () => {
    expect(resolveMemberChannel("auto", prefs({ lineUserId: null }))).toBe("email");
  });

  it("resolves to none when mode is auto and the member disabled both channels", () => {
    expect(
      resolveMemberChannel("auto", prefs({ lineUserId: null, emailNotificationEnabled: false })),
    ).toBe("none");
  });
});

describe("isMemberEligibleForChannel", () => {
  it("is true exactly when resolveMemberChannel does not resolve to none", () => {
    expect(isMemberEligibleForChannel("line", prefs({ lineUserId: null }))).toBe(false);
    expect(isMemberEligibleForChannel("line", prefs())).toBe(true);
    expect(isMemberEligibleForChannel("auto", prefs({ lineUserId: null, emailNotificationEnabled: false }))).toBe(
      false,
    );
  });
});
