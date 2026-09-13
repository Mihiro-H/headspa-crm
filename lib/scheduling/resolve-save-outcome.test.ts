import { describe, it, expect } from "vitest";
import { resolveSaveOutcome } from "./resolve-save-outcome";

describe("resolveSaveOutcome", () => {
  it("returns 'keep' when the save succeeded and this is still the latest request for the date", () => {
    expect(resolveSaveOutcome({ latestSeqForDate: 1, ownSeq: 1, saveSucceeded: true })).toBe("keep");
  });

  it("returns 'rollback' when the save failed and this is still the latest request for the date", () => {
    expect(resolveSaveOutcome({ latestSeqForDate: 1, ownSeq: 1, saveSucceeded: false })).toBe(
      "rollback",
    );
  });

  it("returns 'ignore_stale' when a newer request for the same date has since been issued, even if this save succeeded", () => {
    // 呼び出しA(seq=1)の後に呼び出しB(seq=2)が発行された状態でAの結果が返ってきたケース
    expect(resolveSaveOutcome({ latestSeqForDate: 2, ownSeq: 1, saveSucceeded: true })).toBe(
      "ignore_stale",
    );
  });

  it("returns 'ignore_stale' when a newer request for the same date has since been issued and this save failed", () => {
    // Aが失敗して返ってきても、既にBが発行済みならAの失敗でBの変更を巻き戻してはいけない
    expect(resolveSaveOutcome({ latestSeqForDate: 2, ownSeq: 1, saveSucceeded: false })).toBe(
      "ignore_stale",
    );
  });
});
