import { describe, it, expect, vi, beforeEach } from "vitest";
import { authConfig } from "./config";
import { linkLineToMember, findOrFlagLineMember } from "./line-member";

vi.mock("@/lib/db", () => ({
  prisma: {
    rolePagePermission: { findMany: vi.fn() },
  },
}));

vi.mock("./line-member", () => ({
  linkLineToMember: vi.fn(),
  findOrFlagLineMember: vi.fn(),
}));

describe("authConfig", () => {
  it("uses JWT session strategy", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
  });

  it("starts with an empty providers list to be filled in later tasks", () => {
    expect(Array.isArray(authConfig.providers)).toBe(true);
  });
});

describe("authConfig.callbacks.jwt (LINE account linking)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links the LINE account to the already-signed-in member instead of switching sessions", async () => {
    // 会員としてログイン中のtoken（メール/パスワードでのログイン後、以降のリクエストで
    // NextAuthが渡してくるトークンの状態を模している）に対し、LINEアカウントで
    // signIn("line", ...)した直後のjwtコールバック呼び出しを再現する。
    const token: Record<string, unknown> = { id: "5", role: "member" };
    vi.mocked(linkLineToMember).mockResolvedValue({ status: "linked" });

    const result = await authConfig.callbacks!.jwt!({
      token,
      // OAuthサインイン時、NextAuthはprovider側のuserオブジェクトも渡してくる。
      // LINEプロバイダのデフォルトuserにはroleが無い（undefinedになる）ことが、
      // 今回のバグ（token.roleが上書きされて連携分岐に入れなくなる）の原因だった。
      user: { id: "U_LINE_RAW_ID" },
      account: { provider: "line", providerAccountId: "U_LINE_RAW_ID", type: "oauth" },
      profile: { name: "テスト太郎" },
    } as never);

    expect(linkLineToMember).toHaveBeenCalledWith(5, "U_LINE_RAW_ID");
    expect(findOrFlagLineMember).not.toHaveBeenCalled();
    // 連携後もセッションは元の会員(id: "5")のまま。LINE側の生IDに入れ替わっていないこと、
    // roleが"member"のまま失われていないことの両方を確認する。
    expect(result).toMatchObject({ id: "5", role: "member" });
  });

  it("still runs the normal login/signup lookup for a fresh LINE sign-in with no prior member session", async () => {
    const token: Record<string, unknown> = {};
    vi.mocked(findOrFlagLineMember).mockResolvedValue({
      status: "existing",
      id: "9",
      email: "a@example.com",
      name: "既存太郎",
      role: "member",
    });

    const result = await authConfig.callbacks!.jwt!({
      token,
      user: { id: "U_LINE_RAW_ID" },
      account: { provider: "line", providerAccountId: "U_LINE_RAW_ID", type: "oauth" },
      profile: { name: "既存太郎" },
    } as never);

    expect(linkLineToMember).not.toHaveBeenCalled();
    expect(findOrFlagLineMember).toHaveBeenCalledWith("U_LINE_RAW_ID", "既存太郎");
    expect(result).toMatchObject({ id: "9", role: "member" });
  });
});
