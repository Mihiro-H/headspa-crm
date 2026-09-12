import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminLoginPage from "./page";

// app/login/page.tsxと同根のバグ：NextAuth v5 beta系は認証失敗時でも
// ok:trueかつerror:"CredentialsSignin"を返すことがある（2026-09-12、実機調査で確認済み）。
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { signIn } from "next-auth/react";

describe("AdminLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証失敗時（ok:trueだがerrorありのNextAuth v5 beta特有レスポンス）にエラーメッセージを表示する", async () => {
    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      code: "credentials",
      status: 200,
      ok: true,
      url: null,
    } as never);

    render(<AdminLoginPage />);

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

    render(<AdminLoginPage />);

    fireEvent.change(screen.getByPlaceholderText("メールアドレス"), {
      target: { value: "admin@foresupa.example.com" },
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
