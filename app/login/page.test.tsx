import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MemberLoginPage from "./page";

// next-auth/reactのsignInをモック化し、NextAuth v5 beta特有の
// 「認証失敗でもok:trueかつerror:"CredentialsSignin"を返す」挙動を再現する。
// 参考: 2026-09-12、実ブラウザでの調査でこの挙動を確認済み（headspa-crm-db-full-reset-2026-09-12関連の調査中に発覚）。
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { signIn } from "next-auth/react";

describe("MemberLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証失敗時（ok:trueだがerrorありのNextAuth v5 beta特有レスポンス）にエラーメッセージを表示する", async () => {
    // NextAuth v5 beta.32で実際に観測された戻り値の形（ok:trueとerrorが同時に立つ）
    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      code: "credentials",
      status: 200,
      ok: true,
      url: null,
    } as never);

    render(<MemberLoginPage />);

    fireEvent.change(screen.getByPlaceholderText("メールアドレス"), {
      target: { value: "test-nonexistent@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), {
      target: { value: "wrongpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスまたはパスワードが正しくありません。"),
      ).toBeInTheDocument();
    });
  });

  it("認証成功時（ok:trueかつerrorなし）はエラーを表示しない", async () => {
    vi.mocked(signIn).mockResolvedValue({
      error: undefined,
      code: undefined,
      status: 200,
      ok: true,
      url: null,
    } as never);

    render(<MemberLoginPage />);

    fireEvent.change(screen.getByPlaceholderText("メールアドレス"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("パスワード"), {
      target: { value: "correctpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(vi.mocked(signIn)).toHaveBeenCalled();
    });

    expect(
      screen.queryByText("メールアドレスまたはパスワードが正しくありません。"),
    ).not.toBeInTheDocument();
  });
});
