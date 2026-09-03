export type GenderRestriction = "none" | "female" | "male";
export type MemberGender = "female" | "male" | "other";

export interface GenderCheckResult {
  allowed: boolean;
  warning: boolean;
}

export function checkGenderRestriction(
  restriction: GenderRestriction,
  memberGender: MemberGender,
): GenderCheckResult {
  if (restriction === "none") {
    return { allowed: true, warning: false };
  }

  if (memberGender === "other") {
    return { allowed: true, warning: true };
  }

  if (memberGender === restriction) {
    return { allowed: false, warning: false };
  }

  return { allowed: true, warning: false };
}
