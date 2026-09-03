import { describe, it, expect } from "vitest";
import { authConfig } from "./config";

describe("authConfig", () => {
  it("uses JWT session strategy", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
  });

  it("starts with an empty providers list to be filled in later tasks", () => {
    expect(Array.isArray(authConfig.providers)).toBe(true);
  });
});
