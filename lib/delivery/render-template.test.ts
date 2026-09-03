import { describe, it, expect } from "vitest";
import { renderTemplate } from "./render-template";

describe("renderTemplate", () => {
  it("replaces a known merge tag with its value", () => {
    expect(renderTemplate("{{氏名}}様、ご予約ありがとうございます。", { 氏名: "山田太郎" })).toBe(
      "山田太郎様、ご予約ありがとうございます。",
    );
  });

  it("replaces multiple occurrences of the same tag", () => {
    expect(renderTemplate("{{氏名}}さん、{{氏名}}さん", { 氏名: "鈴木花子" })).toBe(
      "鈴木花子さん、鈴木花子さん",
    );
  });

  it("replaces multiple different tags", () => {
    expect(
      renderTemplate("{{氏名}}様、{{店舗名}}にてお待ちしております。", {
        氏名: "山田太郎",
        店舗名: "フォレスパ 渋谷店",
      }),
    ).toBe("山田太郎様、フォレスパ 渋谷店にてお待ちしております。");
  });

  it("leaves an unknown tag untouched", () => {
    expect(renderTemplate("{{氏名}}様、{{未定義タグ}}", { 氏名: "山田太郎" })).toBe(
      "山田太郎様、{{未定義タグ}}",
    );
  });

  it("returns the text unchanged when it contains no tags", () => {
    expect(renderTemplate("いつもありがとうございます。", { 氏名: "山田太郎" })).toBe(
      "いつもありがとうございます。",
    );
  });
});
