# フォレスパ Phase 0+1: プロジェクト基盤 + DBスキーマ + 認証基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** フォレスパ（ヘッドスパ専門店4店舗）会員管理・予約システムの土台となる、Next.jsプロジェクト基盤・全19テーブルのDBスキーマ・会員/管理者の認証基盤（メール＋パスワード、LINE連携ログイン）を構築する。

**Architecture:** Next.js 15 (App Router / TypeScript) の単一アプリで会員向け（`/`, `/mypage` 等）と管理向け（`/admin`）をルートグループで分離。データベースはSupabase上のPostgreSQLをPrismaで操作。認証はAuth.js (NextAuth v5) を使い、会員用Credentials Provider・管理者用Credentials Provider・LINE OAuth Providerの3系統を1つの設定に統合し、JWTの`role`クレームでアクセス制御する。

**Tech Stack:** Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui / PostgreSQL (Supabase) + Prisma / Auth.js (next-auth@5) + bcryptjs / Vitest + Testing Library / ESLint + Prettier

**参照元資料:**

- `01_designtokens.md`（デザイントークン）
- `02_screenspecification.md`（画面仕様書）
- `03_erdiagram.mermaid`（ER図）
- `04_tabledesign.md`（テーブル設計書）

**このPhaseで作らないもの（Phase 2以降）:** 画面UI実装（M-01〜M-06, A-01〜A-14）、予約ロジック、キャンペーン価格計算、Cronジョブ本体、メール/LINE配信連携。このPhaseは「ログインできる・DBが全テーブル揃っている」状態がゴール。

> **実行環境に関する注記（Task 1実施時に判明・全タスク共通）:**
>
> - このプロジェクトディレクトリはサンドボックスにより`.git`への書き込み（`git add`/`git commit`含む）がブロックされている。**各タスクの「コミット」ステップは実行せず**、変更ファイル一覧を報告するだけにとどめる。コミットはユーザーが区切りの良いタイミングでチャット欄から`!`プレフィックス付きコマンドとしてまとめて実行する。
> - `create-next-app@latest`はTailwind CSS v4を生成する（`tailwind.config.ts`は使わずCSS内`@theme`ディレクティブで設定）。Task 2以降でTailwindの設定に触れる場合はv4のCSS-first方式に従う。
> - このサンドボックスは`next/font/google`のビルド時フォント取得に失敗する（ネットワーク制限）。Google Fontsを使う場合は`next/font/google`を避け、CSSの`@import url(...)`でGoogle Fonts CDNを参照する（ブラウザ実行時に取得されるため、`npm run build`はネットワーク不要で成功する）。
> - このサンドボックスは`npm run dev`のポートバインドに失敗することがある。動作確認は`npm run build`の成功を主な基準とし、ポート起動確認は必須としない。
> - Next.js 16は`next build`/`next dev`のデフォルトビルダーがTurbopackであり、Turbopackはワーカープロセス間通信でポートバインドを行うため、このサンドボックスでは`TurbopackInternalError: ... binding to a port - Operation not permitted`で失敗する。`package.json`の`dev`/`build`スクリプトは`next dev --webpack`/`next build --webpack`とし、常にwebpackビルダーを使うこと（Task 1実施時に修正済み）。
> - **`npm run build`（webpack版）自体もこのサンドボックスでは不安定**（Task 3実施時に判明）。「Creating an optimized production build ...」で無限にハングする、あるいはエラーなしで未完了のまま終了することがある。原因はNext.jsのビルドワーカープロセス（jest-worker経由の子プロセス）がこのサンドボックスでI/O待ちのままブロックすることと推測されるが、`ps`/`top`/`pkill`/`killall`がサンドボックスで権限拒否されるため断定できていない。**Task 4以降は`npm run build`をタスクの必須検証手段としない**。代わりに`npx tsc --noEmit`（型チェック）と`npx eslint .`（静的解析、Task 4で導入）を自動検証の中心とし、`npm run build`のフル確認は区切りの良いタイミングでユーザーに`!`プレフィックス経由の手動実行を依頼する。
> - **`.env`・`.env.*`ファイルはこのサンドボックスから読み書き・`source`・`fs.readFileSync`等いかなる方法でも一切アクセス不可**（意図的なセキュリティ制限。`~/.claude/CLAUDE.md`のルール通り）。値の確認・編集は必ずユーザーに依頼する。値そのものを見せてもらう必要はなく、キー名・行の長さ・存在確認など構造情報だけをユーザーに実行してもらえば十分診断できる。
> - **`npx prisma validate` / `npx prisma migrate` 等、`.env`のDATABASE_URL/DIRECT_URLを読み込むPrismaコマンドは、このサンドボックス環境固有の原因不明のバグで`Error: Environment variable not found: DIRECT_URL`（P1012）を必ず出す**（Task 6実施時に判明）。ユーザー自身のターミナルでは同じ`.env`・同じコマンドで正常に動作することを確認済み（原因はサンドボックスのNode.js実行環境かプロセス起動方式に起因すると推測されるが未特定）。**実DB接続を伴うPrismaコマンド（`migrate dev`、`db seed`、`db push`等）は必ずユーザーのターミナルで実行してもらう**。スキーマの構文チェックのみで良い場合（Task 7〜12）は、実DBに接続しないダミーの整形済みURLを`DATABASE_URL=... DIRECT_URL=... npx prisma validate`のようにインライン環境変数として渡せば、このサンドボックスからでも検証可能。

---

## Task 1: Next.jsプロジェクトのスキャフォールド + Git初期化

**Files:**

- Create: プロジェクトルート一式（`app/`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `package.json` 等）
- Modify: `.gitignore`（既存ファイルにNext.js標準の除外設定をマージ）

- [x] **Step 1: Gitリポジトリを初期化する（未初期化の場合）**

```bash
git status || git init
```

- [x] **Step 2: 隣接する一時ディレクトリにNext.jsをスキャフォールドする**

現在のディレクトリには`CLAUDE.md`等の既存ファイルがあり、`create-next-app`は非空ディレクトリへの直接実行を拒否するため、一時ディレクトリに生成してからマージする。

```bash
cd ..
npx create-next-app@latest headspa-crm-scaffold \
  --typescript --tailwind --eslint --app \
  --no-src-dir --import-alias "@/*" --use-npm
```

- [x] **Step 3: 生成物をプロジェクトルートへマージする**

```bash
cd headspa-crm-scaffold
cp -R app components public next.config.ts postcss.config.mjs \
  tailwind.config.ts tsconfig.json package.json package-lock.json \
  next-env.d.ts ../headspa-crm/ 2>/dev/null || true
```

`components`ディレクトリが生成されていない場合はスキップされて問題ない。

- [x] **Step 4: .gitignoreをマージする**

`headspa-crm-scaffold/.gitignore`の内容を確認し、既存の`.gitignore`（`.env`, `CLAUDE.local.md`等の記載あり）に無い行だけ追記する。

```bash
cd ../headspa-crm
comm -13 <(sort .gitignore) <(sort ../headspa-crm-scaffold/.gitignore) >> .gitignore
```

- [x] **Step 5: 一時ディレクトリを削除する**

```bash
rm -rf ../headspa-crm-scaffold
```

- [x] **Step 6: 依存関係をインストールする**

```bash
npm install
```

- [x] **Step 7: 開発サーバーが起動することを確認する**

```bash
npm run dev
```

ターミナルに `Ready in ...ms` と表示され、ブラウザで `http://localhost:3000` を開いてNext.jsのデフォルトページが表示されることを確認したら `Ctrl+C` で停止する。

- [x] **Step 8: コミット**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project"
```

---

## Task 2: Tailwind設定にデザイントークンを反映する

> **注記（Task 1実施時に判明）:** `create-next-app@latest`が生成したプロジェクトはTailwind CSS v4であり、`tailwind.config.ts`は存在しない（CSS内`@theme`ディレクティブで設定するv4方式）。本タスクはv4方式に合わせて記述している。またこの開発環境は`next/font/google`のビルド時フォント取得がネットワーク制限で失敗するため、Noto Serif JP／Noto Sans JPは`next/font/google`を使わず、`globals.css`内の`@import url(...)`でGoogle Fonts CDNから読み込む（ブラウザ実行時の取得になるため、このサンドボックスの`npm run build`はネットワーク不要で成功する）。

**Files:**

- Modify: `app/globals.css`

- [x] **Step 1: `app/globals.css`をデザイントークンで置き換える**

`app/globals.css`の内容全体を以下に置き換える（`@theme inline`ブロックはshadcn/ui（Task 3で導入）が使う`--background`/`--foreground`等のセマンティック変数なので保持し、ブランドトークンは別の`@theme`ブロックとして追加する。複数の`@theme`ブロックはTailwind v4でマージされる）。

```css
@import "tailwindcss";
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;700&display=swap");

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

@theme {
  --color-primary-50: #f3f6f1;
  --color-primary-100: #e4eae0;
  --color-primary-200: #c9d6c0;
  --color-primary-300: #a9c09c;
  --color-primary-400: #8aab78;
  --color-primary-500: #6b8e5a;
  --color-primary-600: #567348;
  --color-primary-700: #435938;
  --color-primary-800: #33452b;
  --color-primary-900: #24311e;

  --color-secondary-50: #fdfbf7;
  --color-secondary-100: #f8f1e7;
  --color-secondary-200: #f0e4d0;
  --color-secondary-300: #e5d3b3;
  --color-secondary-400: #d8be8f;
  --color-secondary-500: #c9a66b;
  --color-secondary-600: #b08a4e;
  --color-secondary-700: #8c6d3d;

  --color-accent-400: #e3a57d;
  --color-accent-500: #d98c5f;
  --color-accent-600: #c17847;
  --color-accent-700: #a0602f;

  --color-neutral-0: #ffffff;
  --color-neutral-50: #faf9f7;
  --color-neutral-100: #f2f0ec;
  --color-neutral-200: #e5e1d8;
  --color-neutral-300: #d0c9ba;
  --color-neutral-400: #a9a08d;
  --color-neutral-500: #837962;
  --color-neutral-600: #665d49;
  --color-neutral-700: #4d4536;
  --color-neutral-800: #362f24;
  --color-neutral-900: #211c15;

  --color-success: #6b8e5a;
  --color-warning: #d9a441;
  --color-error: #c4573b;
  --color-info: #5b87a6;
  --color-disabled: #c9c4b8;

  --color-status-visitor: #a9a08d;
  --color-status-regular: #8aab78;
  --color-status-silver: #adb7bd;
  --color-status-gold: #c9a66b;
  --color-status-platinum: #8d7b9e;

  --font-heading: "Noto Serif JP", serif;
  --font-body: "Noto Sans JP", -apple-system, sans-serif;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(36, 49, 30, 0.06);
  --shadow-md: 0 4px 12px rgba(36, 49, 30, 0.08);
  --shadow-lg: 0 8px 24px rgba(36, 49, 30, 0.14);

  --breakpoint-sm: 375px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1440px;
}

/* モーショントークン（Tailwindユーティリティ化はせず、コンポーネント側でCSS変数として参照する） */
:root {
  --motion-duration-fast: 150ms;
  --motion-duration-base: 250ms;
  --motion-duration-slow: 400ms;
  --motion-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  font-family: var(--font-body);
  background-color: var(--color-neutral-50);
  color: var(--color-neutral-600);
}

h1,
h2,
h3,
h4 {
  font-family: var(--font-heading);
}
```

`--color-primary-50`〜`900`のようなshade付きトークンは`bg-primary-500`・`text-primary-700`のようなユーティリティを生成し、shadcnが使う`--color-background`（shade無し、`bg-background`を生成）とはユーティリティ名が衝突しないため、Task 3のshadcn/ui導入と共存できる。

- [x] **Step 2: `app/page.tsx`をブランドカラーで書き換えて反映を確認する**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="rounded-lg bg-neutral-0 p-6 shadow-md">
        <h1 className="font-heading text-2xl text-primary-700">フォレスパ</h1>
        <p className="mt-2 text-sm text-neutral-600">会員管理・予約システム seedページ</p>
        <button className="mt-4 h-12 w-full rounded-lg bg-accent-500 font-medium text-white">
          予約する
        </button>
      </div>
    </main>
  );
}
```

- [x] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

`Compiled successfully` と表示されることを確認する。`npm run dev`でも`primary-700`の見出しと`accent-500`のボタンが表示されることを目視確認する（このサンドボックスではポートバインドができない場合があるため、`npm run build`の成功をもって確認とし、`curl`でのポート起動確認は必須としない）。

- [x] **Step 4: 変更ファイルを記録する（コミットは後回し）**

このプロジェクトでは`.git`への書き込みがサンドボックスでブロックされているため、`git add`/`git commit`はこのタスクでは実行しない。変更したファイル（`app/globals.css`, `app/page.tsx`）を報告に含め、ユーザーが後でまとめてコミットする。

---

## Task 3: shadcn/uiを導入する

**Files:**

- Create: `components.json`, `lib/utils.ts`, `components/ui/button.tsx`

- [x] **Step 1: shadcn/uiを初期化する**

```bash
npx shadcn@latest init -d
```

`-d`でデフォルト設定（New York style, Zinc base color, CSS variables）を使う。ベースカラーは後でTask 2のトークンで上書きするため、ここでは初期値のままでよい。

- [x] **Step 2: Buttonコンポーネントを追加する**

```bash
npx shadcn@latest add button
```

- [x] **Step 3: `app/page.tsx`のボタンをshadcn/uiのButtonに置き換えて確認する**

```tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="rounded-lg bg-neutral-0 p-6 shadow-md">
        <h1 className="font-heading text-2xl text-primary-700">フォレスパ</h1>
        <p className="mt-2 text-sm text-neutral-600">会員管理・予約システム seedページ</p>
        <Button className="mt-4 h-12 w-full rounded-lg bg-accent-500 text-white hover:bg-accent-600">
          予約する
        </Button>
      </div>
    </main>
  );
}
```

- [x] **Step 4: ビルド確認**

```bash
npm run build
```

- [x] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: install shadcn/ui and Button component"
```

---

## Task 4: ESLint / Prettierを設定する

**Files:**

- Create: `.prettierrc.json`, `.prettierignore`
- Modify: `eslint.config.mjs`（`create-next-app`が生成したFlat Config）

- [x] **Step 1: Prettierと連携パッケージをインストールする**

```bash
npm install --save-dev prettier eslint-config-prettier
```

- [x] **Step 2: `.prettierrc.json`を作成する**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [x] **Step 3: `.prettierignore`を作成する**

```
.next
node_modules
coverage
```

- [x] **Step 4: `eslint.config.mjs`にPrettierとの競合ルールを無効化する設定を追加する**

`eslint.config.mjs`の`export default`配列の末尾に以下を追加する。

```javascript
import eslintConfigPrettier from "eslint-config-prettier";

// ...既存のconfig配列に続けて
export default [
  // ...既存要素
  eslintConfigPrettier,
];
```

- [x] **Step 5: `package.json`にフォーマットスクリプトを追加する**

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [x] **Step 6: 実行して確認する**

```bash
npm run format
npx eslint . --max-warnings=0
```

エラーが出た場合はそのファイルを個別に修正する（このステップでプレースホルダーの修正は発生しない前提。もし発生したら実際に直す）。

- [x] **Step 7: コミット**

```bash
git add -A
git commit -m "chore: configure Prettier and align ESLint config"
```

---

## Task 5: Vitest + Testing Libraryのテスト環境を構築する

**Files:**

- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `lib/sample.ts`, `lib/sample.test.ts`（動作確認用。確認後Task内で削除）

- [x] **Step 1: 依存関係をインストールする**

```bash
npm install --save-dev vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom
```

- [x] **Step 2: `vitest.config.ts`を作成する**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [x] **Step 3: `vitest.setup.ts`を作成する**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [x] **Step 4: `package.json`にテストスクリプトを追加する**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [x] **Step 5: 動作確認用の失敗するテストを書く**

`lib/sample.ts`:

```typescript
export function add(a: number, b: number): number {
  return 0;
}
```

`lib/sample.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { add } from "./sample";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

- [x] **Step 6: テストが失敗することを確認する**

```bash
npm test
```

Expected: `FAIL lib/sample.test.ts` / `expected 0 to be 5`

- [x] **Step 7: 実装を直してテストを通す**

`lib/sample.ts`:

```typescript
export function add(a: number, b: number): number {
  return a + b;
}
```

- [x] **Step 8: テストが通ることを確認する**

```bash
npm test
```

Expected: `PASS lib/sample.test.ts`

- [x] **Step 9: 動作確認用ファイルを削除する**

```bash
rm lib/sample.ts lib/sample.test.ts
```

- [x] **Step 10: コミット**

```bash
git add -A
git commit -m "chore: set up Vitest and Testing Library"
```

---

## Task 6: Supabase接続とPrismaの初期化

**Files:**

- Create: `prisma/schema.prisma`
- Modify: `.env.example`
- Create: `lib/db.ts`

- [x] **Step 1: Supabaseプロジェクトを作成する（手動作業）**

Supabaseダッシュボード（https://supabase.com）で新規プロジェクトを作成し、Project Settings → Database から以下2つの接続文字列を控える。

- Connection pooling（Transaction mode, ポート6543）→ アプリ実行時用
- Direct connection（ポート5432）→ マイグレーション実行用

- [x] **Step 2: Prismaをインストールし初期化する**

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init --datasource-provider postgresql
```

- [x] **Step 3: `prisma/schema.prisma`のdatasourceブロックを以下に置き換える**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [x] **Step 4: `.env.example`に接続変数のプレースホルダーを追記する**

既存の`.env.example`（`init-secure-project.sh`が生成したもの）に以下を追記する。

```bash
# Supabase / Prisma
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres"
```

- [x] **Step 5: ローカルの`.env`に実際の接続文字列を設定する（Gitには含めない）**

```bash
cp .env.example .env
```

`.env`を開き、Step1で控えた実際の接続文字列に書き換える。`.env`は`.gitignore`で除外済みであることを確認する。

- [x] **Step 6: Prisma ClientとSupabase接続を検証する**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [x] **Step 7: Prisma Clientシングルトンを作成する**

`lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [x] **Step 8: コミット**

```bash
git add prisma .env.example lib/db.ts
git commit -m "chore: initialize Prisma with Supabase datasource"
```

---

## Task 7: Prismaスキーマ①（店舗・スタッフ・管理者系）

**Files:**

- Modify: `prisma/schema.prisma`

- [x] **Step 1: Enum `AdminRole`と`Store`/`StoreHoliday`/`Staff`/`StaffShift`/`Admin`モデルを追記する**

`prisma/schema.prisma`の末尾に追記する。

```prisma
enum AdminRole {
  hq
  manager
  staff

  @@map("admin_role")
}

model Store {
  id                      Int      @id @default(autoincrement()) @map("store_id")
  name                    String   @db.VarChar(100)
  address                 String?  @db.VarChar(255)
  phone                   String   @db.VarChar(20)
  weekdayOpen             DateTime @map("weekday_open") @db.Time()
  weekdayClose            DateTime @map("weekday_close") @db.Time()
  weekendOpen             DateTime @map("weekend_open") @db.Time()
  weekendClose            DateTime @map("weekend_close") @db.Time()
  luxuryLastOrderWeekday  DateTime @map("luxury_last_order_weekday") @db.Time()
  luxuryLastOrderWeekend  DateTime @map("luxury_last_order_weekend") @db.Time()
  nearestStation          String?  @map("nearest_station") @db.VarChar(100)
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  staff          Staff[]
  storeHolidays  StoreHoliday[]
  admins         Admin[]

  @@map("stores")
}

model StoreHoliday {
  id          Int      @id @default(autoincrement()) @map("holiday_id")
  storeId     Int      @map("store_id")
  holidayDate DateTime @map("holiday_date") @db.Date
  reason      String?  @db.VarChar(100)

  store Store @relation(fields: [storeId], references: [id])

  @@unique([storeId, holidayDate])
  @@map("store_holidays")
}

model Staff {
  id            Int      @id @default(autoincrement()) @map("staff_id")
  storeId       Int      @map("store_id")
  name          String   @db.VarChar(100)
  photoUrl      String?  @map("photo_url") @db.VarChar(255)
  bio           String?
  nominationFee Int      @default(0) @map("nomination_fee")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")

  store  Store        @relation(fields: [storeId], references: [id])
  shifts StaffShift[]

  @@map("staff")
}

model StaffShift {
  id        Int       @id @default(autoincrement()) @map("shift_id")
  staffId   Int       @map("staff_id")
  workDate  DateTime  @map("work_date") @db.Date
  startTime DateTime? @map("start_time") @db.Time()
  endTime   DateTime? @map("end_time") @db.Time()
  isDayOff  Boolean   @default(false) @map("is_day_off")

  staff Staff @relation(fields: [staffId], references: [id])

  @@unique([staffId, workDate])
  @@map("staff_shifts")
}

model Admin {
  id           Int       @id @default(autoincrement()) @map("admin_id")
  storeId      Int?      @map("store_id")
  name         String    @db.VarChar(100)
  email        String    @unique @db.VarChar(255)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  role         AdminRole
  createdAt    DateTime  @default(now()) @map("created_at")

  store Store? @relation(fields: [storeId], references: [id])

  @@map("admins")
}
```

- [x] **Step 2: フォーマットとバリデーションを実行する**

```bash
npx prisma format
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [x] **Step 3: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add store, staff and admin models"
```

---

## Task 8: Prismaスキーマ②（会員・ステータス系）

**Files:**

- Modify: `prisma/schema.prisma`

- [x] **Step 1: Enum `Gender`と`CustomerStatus`/`Member`モデルを追記する**

```prisma
enum Gender {
  female
  male
  other

  @@map("gender")
}

model CustomerStatus {
  id            Int    @id @default(autoincrement()) @map("status_id")
  name          String @db.VarChar(50)
  minVisitCount Int    @map("min_visit_count")
  colorCode     String @map("color_code") @db.VarChar(7)
  sortOrder     Int    @map("sort_order")

  members Member[]

  @@map("customer_statuses")
}

model Member {
  id             Int      @id @default(autoincrement()) @map("member_id")
  primaryStoreId Int?     @map("primary_store_id")
  statusId       Int      @map("status_id")
  name           String   @db.VarChar(100)
  nameKana       String?  @map("name_kana") @db.VarChar(100)
  email          String   @unique @db.VarChar(255)
  phone          String   @db.VarChar(20)
  passwordHash   String?  @map("password_hash") @db.VarChar(255)
  gender         Gender
  birthDate      DateTime @map("birth_date") @db.Date
  lineUserId     String?  @unique @map("line_user_id") @db.VarChar(100)
  visitCount     Int      @default(0) @map("visit_count")
  totalSpent     Int      @default(0) @map("total_spent")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  status CustomerStatus @relation(fields: [statusId], references: [id])

  @@index([statusId, visitCount])
  @@index([birthDate])
  @@map("members")
}
```

`primaryStoreId`はこの段階ではリレーションを張らず素のInt/カラムのみとする（Task 7の`Store`モデル側に`primaryMembers Member[] @relation("MemberPrimaryStore")`を追加していないため）。Step 2で両モデルに追記してリレーションを完成させる。

- [x] **Step 2: `Store`モデルと`Member`モデルにリレーションを追加する**

`prisma/schema.prisma`内、`model Store`の`admins Admin[]`の下に1行追加する。

```prisma
  primaryMembers Member[] @relation("MemberPrimaryStore")
```

`model Member`の`primaryStoreId Int? @map("primary_store_id")`の下、`statusId`行の後にリレーションフィールドを追加する。

```prisma
  primaryStore Store? @relation("MemberPrimaryStore", fields: [primaryStoreId], references: [id])
```

- [x] **Step 3: フォーマットとバリデーション**

```bash
npx prisma format
npx prisma validate
```

- [x] **Step 4: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add member and customer status models"
```

---

## Task 9: Prismaスキーマ③（メニュー系: カテゴリ・コース・オプション）

**Files:**

- Modify: `prisma/schema.prisma`

- [x] **Step 1: Enum `GenderRestriction`と`CourseCategory`/`Course`/`Option`モデルを追記する**

```prisma
enum GenderRestriction {
  none
  female
  male

  @@map("gender_restriction")
}

model CourseCategory {
  id                Int               @id @default(autoincrement()) @map("category_id")
  name              String            @db.VarChar(100)
  description       String?
  genderRestriction GenderRestriction @default(none) @map("gender_restriction")
  sortOrder         Int               @map("sort_order")
  isPublished       Boolean           @default(true) @map("is_published")

  courses Course[]

  @@map("course_categories")
}

model Course {
  id                  Int               @id @default(autoincrement()) @map("course_id")
  categoryId          Int               @map("category_id")
  name                String            @db.VarChar(100)
  durationEstimateMin Int               @map("duration_estimate_min")
  treatmentTimeMin    Int               @map("treatment_time_min")
  price               Int
  genderRestriction   GenderRestriction @default(none) @map("gender_restriction")
  sortOrder           Int               @map("sort_order")
  isPublished         Boolean           @default(true) @map("is_published")

  category CourseCategory @relation(fields: [categoryId], references: [id])

  @@map("courses")
}

model Option {
  id                     Int               @id @default(autoincrement()) @map("option_id")
  name                   String            @db.VarChar(100)
  durationMin            Int               @map("duration_min")
  price                  Int
  genderRestriction      GenderRestriction @default(none) @map("gender_restriction")
  requiresAdvanceBooking Boolean           @default(true) @map("requires_advance_booking")
  discountExempt         Boolean           @default(true) @map("discount_exempt")

  @@map("options")
}
```

- [x] **Step 2: フォーマットとバリデーション**

```bash
npx prisma format
npx prisma validate
```

- [x] **Step 3: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add course category, course and option models"
```

---

## Task 10: Prismaスキーマ④（キャンペーン系）

**Files:**

- Modify: `prisma/schema.prisma`

- [x] **Step 1: Enum `DiscountType`と`Campaign`/`CampaignCourseTarget`/`CampaignCategoryTarget`モデルを追記する**

```prisma
enum DiscountType {
  percentage
  fixed_amount

  @@map("discount_type")
}

model Campaign {
  id            Int          @id @default(autoincrement()) @map("campaign_id")
  targetStoreId Int?         @map("target_store_id")
  name          String       @db.VarChar(100)
  discountType  DiscountType @map("discount_type")
  discountValue Int          @map("discount_value")
  startDate     DateTime     @map("start_date") @db.Date
  endDate       DateTime     @map("end_date") @db.Date
  priority      Int          @default(0)
  isPublished   Boolean      @default(true) @map("is_published")

  targetStore     Store?                   @relation(fields: [targetStoreId], references: [id])
  courseTargets   CampaignCourseTarget[]
  categoryTargets CampaignCategoryTarget[]

  @@map("campaigns")
}

model CampaignCourseTarget {
  id         Int @id @default(autoincrement())
  campaignId Int @map("campaign_id")
  courseId   Int @map("course_id")

  campaign Campaign @relation(fields: [campaignId], references: [id])
  course   Course   @relation(fields: [courseId], references: [id])

  @@map("campaign_course_targets")
}

model CampaignCategoryTarget {
  id         Int @id @default(autoincrement())
  campaignId Int @map("campaign_id")
  categoryId Int @map("category_id")

  campaign Campaign       @relation(fields: [campaignId], references: [id])
  category CourseCategory @relation(fields: [categoryId], references: [id])

  @@map("campaign_category_targets")
}
```

- [x] **Step 2: 既存モデルに逆参照リレーションを追加する**

`model Store`に1行追加（`primaryMembers`の下）。

```prisma
  campaigns Campaign[]
```

`model Course`に1行追加（`category`の下）。

```prisma
  campaignTargets CampaignCourseTarget[]
```

`model CourseCategory`に1行追加（`courses`の下）。

```prisma
  campaignTargets CampaignCategoryTarget[]
```

- [x] **Step 3: フォーマットとバリデーション**

```bash
npx prisma format
npx prisma validate
```

- [x] **Step 4: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add campaign and campaign target models"
```

---

## Task 11: Prismaスキーマ⑤（予約系）

**Files:**

- Modify: `prisma/schema.prisma`

- [x] **Step 1: Enum群と`Reservation`/`ReservationItem`モデルを追記する**

```prisma
enum ReservationStatus {
  temp_hold
  confirmed
  completed
  cancelled
  no_show

  @@map("reservation_status")
}

enum ReservationSource {
  web
  phone

  @@map("reservation_source")
}

enum ReservationItemType {
  course
  option

  @@map("reservation_item_type")
}

model Reservation {
  id                   Int               @id @default(autoincrement()) @map("reservation_id")
  memberId             Int               @map("member_id")
  storeId              Int               @map("store_id")
  staffId              Int?              @map("staff_id")
  reservationDate      DateTime          @map("reservation_date") @db.Date
  startTime            DateTime          @map("start_time") @db.Time()
  endTime              DateTime          @map("end_time") @db.Time()
  status               ReservationStatus
  source               ReservationSource
  nominationFeeApplied Int               @default(0) @map("nomination_fee_applied")
  totalPrice           Int               @map("total_price")
  tempHoldExpiresAt    DateTime?         @map("temp_hold_expires_at")
  cancellationDeadline DateTime          @map("cancellation_deadline")
  createdAt            DateTime          @default(now()) @map("created_at")
  updatedAt            DateTime          @updatedAt @map("updated_at")

  member Member             @relation(fields: [memberId], references: [id])
  store  Store               @relation(fields: [storeId], references: [id])
  staff  Staff?              @relation(fields: [staffId], references: [id])
  items  ReservationItem[]

  @@index([storeId, reservationDate, staffId])
  @@index([status, tempHoldExpiresAt])
  @@index([memberId, status])
  @@map("reservations")
}

model ReservationItem {
  id                 Int                 @id @default(autoincrement()) @map("item_id")
  reservationId      Int                 @map("reservation_id")
  itemType           ReservationItemType @map("item_type")
  courseId           Int?                @map("course_id")
  optionId           Int?                @map("option_id")
  appliedCampaignId  Int?                @map("applied_campaign_id")
  priceAtBooking     Int                 @map("price_at_booking")

  reservation Reservation @relation(fields: [reservationId], references: [id])
  course      Course?     @relation(fields: [courseId], references: [id])
  option      Option?     @relation(fields: [optionId], references: [id])
  campaign    Campaign?   @relation(fields: [appliedCampaignId], references: [id])

  @@map("reservation_items")
}
```

- [x] **Step 2: 既存モデルに逆参照リレーションを追加する**

`model Member`に1行追加（`status`の下）。

```prisma
  reservations Reservation[]
```

`model Store`に1行追加（`campaigns`の下）。

```prisma
  reservations Reservation[]
```

`model Staff`に1行追加（`shifts`の下）。

```prisma
  reservations Reservation[]
```

`model Course`に1行追加（`campaignTargets`の下）。

```prisma
  reservationItems ReservationItem[]
```

`model Option`に1行追加（`discountExempt`定義の下）。

```prisma
  reservationItems ReservationItem[]
```

`model Campaign`に1行追加（`categoryTargets`の下）。

```prisma
  reservationItems ReservationItem[]
```

- [x] **Step 3: フォーマットとバリデーション**

```bash
npx prisma format
npx prisma validate
```

- [x] **Step 4: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add reservation and reservation item models"
```

---

## Task 12: Prismaスキーマ⑥（メモ・配信・Cronログ系）

**Files:**

- Modify: `prisma/schema.prisma`

- [x] **Step 1: 残りのEnumとモデルを追記する**

```prisma
enum ChannelMode {
  email
  line
  auto

  @@map("channel_mode")
}

enum AutoDeliveryType {
  birthday
  reminder

  @@map("auto_delivery_type")
}

enum DeliveryChannel {
  email
  line

  @@map("delivery_channel")
}

enum DeliveryTemplateType {
  birthday
  reminder
  segment

  @@map("delivery_template_type")
}

enum JobStatus {
  success
  failed

  @@map("job_status")
}

model CustomerNote {
  id        Int      @id @default(autoincrement()) @map("note_id")
  memberId  Int      @map("member_id")
  staffId   Int      @map("staff_id")
  noteText  String   @map("note_text")
  createdAt DateTime @default(now()) @map("created_at")

  member Member @relation(fields: [memberId], references: [id])
  staff  Staff  @relation(fields: [staffId], references: [id])

  @@map("customer_notes")
}

model SegmentCampaign {
  id                Int         @id @default(autoincrement()) @map("segment_campaign_id")
  name              String      @db.VarChar(100)
  conditionJson     Json        @map("condition_json")
  channelMode       ChannelMode @map("channel_mode")
  templateId        Int         @map("template_id")
  scheduledAt       DateTime?   @map("scheduled_at")
  sentAt            DateTime?   @map("sent_at")
  targetCount       Int         @map("target_count")
  createdByAdminId  Int         @map("created_by_admin_id")
  createdAt         DateTime    @default(now()) @map("created_at")

  createdByAdmin Admin          @relation(fields: [createdByAdminId], references: [id])
  emailLineLogs  EmailLineLog[]

  @@map("segment_campaigns")
}

model AutoDeliverySetting {
  id          Int              @id @default(autoincrement()) @map("setting_id")
  type        AutoDeliveryType
  channelMode ChannelMode      @map("channel_mode")
  sendTiming  String           @map("send_timing") @db.VarChar(50)
  templateId  Int              @map("template_id")
  isActive    Boolean          @default(true) @map("is_active")

  @@map("auto_delivery_settings")
}

model EmailLineLog {
  id                Int                   @id @default(autoincrement()) @map("log_id")
  memberId          Int                   @map("member_id")
  channel           DeliveryChannel
  templateType      DeliveryTemplateType  @map("template_type")
  segmentCampaignId Int?                  @map("segment_campaign_id")
  subject           String?               @db.VarChar(255)
  sentAt            DateTime              @map("sent_at")
  status            JobStatus

  member          Member           @relation(fields: [memberId], references: [id])
  segmentCampaign SegmentCampaign? @relation(fields: [segmentCampaignId], references: [id])

  @@index([memberId, sentAt])
  @@map("email_line_logs")
}

model CronJobLog {
  id           Int       @id @default(autoincrement()) @map("log_id")
  jobName      String    @map("job_name") @db.VarChar(100)
  executedAt   DateTime  @map("executed_at")
  status       JobStatus
  targetCount  Int       @default(0) @map("target_count")
  errorMessage String?

  @@map("cron_job_logs")
}
```

- [x] **Step 2: `Member`モデルに逆参照リレーションを追加する**

`model Member`の`reservations Reservation[]`の下に追加する。

```prisma
  customerNotes  CustomerNote[]
  emailLineLogs  EmailLineLog[]
```

`model Staff`に1行追加（`reservations`の下）。

```prisma
  customerNotes CustomerNote[]
```

`model Admin`に1行追加（末尾）。

```prisma
  segmentCampaigns SegmentCampaign[]
```

- [x] **Step 3: フォーマットとバリデーション**

```bash
npx prisma format
npx prisma validate
```

- [x] **Step 4: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add notes, delivery and cron log models"
```

---

## Task 13: マイグレーションを実行しPrisma Clientを生成する

**Files:**

- Create: `prisma/migrations/`（Prismaが自動生成）

- [x] **Step 1: 初回マイグレーションを作成・適用する**

```bash
npx prisma migrate dev --name init
```

Expected: `Your database is now in sync with your schema.` および19テーブル分のCREATE TABLE文がログに表示される。

- [x] **Step 2: Supabaseダッシュボードのテーブルエディタで19テーブルが作成されていることを目視確認する**

`stores`, `store_holidays`, `staff`, `staff_shifts`, `admins`, `members`, `customer_statuses`, `course_categories`, `courses`, `options`, `campaigns`, `campaign_course_targets`, `campaign_category_targets`, `reservations`, `reservation_items`, `customer_notes`, `segment_campaigns`, `auto_delivery_settings`, `email_line_logs`, `cron_job_logs` の20テーブル（うち`campaign_course_targets`/`campaign_category_targets`を1テーブルずつカウント）。

- [x] **Step 3: Prisma Clientの型が生成されていることを確認する**

```bash
npx tsc --noEmit
```

エラーが出ないことを確認する（`@prisma/client`の型がプロジェクトのTypeScriptから解決できていることの確認）。

- [x] **Step 4: コミット**

```bash
git add prisma/migrations
git commit -m "chore: add initial database migration"
```

---

## Task 14: シードスクリプトを作成する

**Files:**

- Create: `prisma/seed.ts`
- Modify: `package.json`

- [x] **Step 1: `tsx`をインストールする**

```bash
npm install --save-dev tsx
```

- [x] **Step 2: `prisma/seed.ts`を作成する**

画面仕様書に記載の4店舗・5ステータス・6カテゴリを投入する。

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stores = await Promise.all(
    [
      {
        name: "フォレスパ 東京丸の内本店",
        phone: "03-0000-0001",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T20:00:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T19:30:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:30:00Z"),
        nearestStation: "東京駅 徒歩5分・大手町駅 徒歩7分",
      },
      {
        name: "フォレスパ 渋谷店",
        phone: "03-0000-0002",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T18:30:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T17:30:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:00:00Z"),
        nearestStation: "渋谷駅 徒歩8分",
      },
      {
        name: "フォレスパ 池袋店",
        phone: "03-0000-0003",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T18:30:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T17:30:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:00:00Z"),
        nearestStation: "池袋駅 徒歩4分",
      },
      {
        name: "フォレスパ 新宿店",
        phone: "03-0000-0004",
        weekdayOpen: new Date("1970-01-01T11:00:00Z"),
        weekdayClose: new Date("1970-01-01T18:30:00Z"),
        weekendOpen: new Date("1970-01-01T10:00:00Z"),
        weekendClose: new Date("1970-01-01T17:30:00Z"),
        luxuryLastOrderWeekday: new Date("1970-01-01T18:00:00Z"),
        luxuryLastOrderWeekend: new Date("1970-01-01T17:00:00Z"),
        nearestStation: "新宿駅1番出口 徒歩8分・新宿三丁目南口 徒歩2分",
      },
    ].map((store) =>
      prisma.store.upsert({
        where: { name: store.name },
        update: {},
        create: store,
      }),
    ),
  );

  await Promise.all(
    [
      { name: "ビジター", minVisitCount: 1, colorCode: "#A9A08D", sortOrder: 1 },
      { name: "レギュラー", minVisitCount: 2, colorCode: "#8AAB78", sortOrder: 2 },
      { name: "シルバー", minVisitCount: 6, colorCode: "#ADB7BD", sortOrder: 3 },
      { name: "ゴールド", minVisitCount: 11, colorCode: "#C9A66B", sortOrder: 4 },
      { name: "プラチナ", minVisitCount: 21, colorCode: "#8D7B9E", sortOrder: 5 },
    ].map((status) =>
      prisma.customerStatus.upsert({
        where: { name: status.name },
        update: {},
        create: status,
      }),
    ),
  );

  await Promise.all(
    [
      { name: "頭皮ケア重点", sortOrder: 1, genderRestriction: "none" as const },
      { name: "頭皮マッサージ重点", sortOrder: 2, genderRestriction: "none" as const },
      { name: "ヘアエステ重点", sortOrder: 3, genderRestriction: "none" as const },
      { name: "フォーメン", sortOrder: 4, genderRestriction: "male" as const },
      { name: "スペシャルダブルケア", sortOrder: 5, genderRestriction: "none" as const },
      { name: "ラグジュアリー", sortOrder: 6, genderRestriction: "none" as const },
    ].map((category) =>
      prisma.courseCategory.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      }),
    ),
  );

  console.log(`Seeded ${stores.length} stores.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

`upsert`の`where: { name }`を使うには`name`列に一意制約が必要になる。次のStepでスキーマに一意制約を追加する。

- [x] **Step 3: `Store`/`CustomerStatus`/`CourseCategory`の`name`列に一意制約を追加する**

`prisma/schema.prisma`の3モデルの`name`フィールド行をそれぞれ以下に変更する。

`model Store`:

```prisma
  name String @unique @db.VarChar(100)
```

`model CustomerStatus`:

```prisma
  name String @unique @db.VarChar(50)
```

`model CourseCategory`:

```prisma
  name String @unique @db.VarChar(100)
```

- [x] **Step 4: マイグレーションを再作成する**

```bash
npx prisma migrate dev --name add_unique_name_constraints
```

- [x] **Step 5: `package.json`にPrisma seed設定とスクリプトを追加する**

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "db:seed": "prisma db seed"
  }
}
```

- [x] **Step 6: シードを実行する**

```bash
npm run db:seed
```

Expected: `Seeded 4 stores.`

- [x] **Step 7: Supabaseダッシュボードで`stores`テーブルに4件、`customer_statuses`に5件、`course_categories`に6件のレコードがあることを確認する**

- [x] **Step 8: コミット**

```bash
git add prisma package.json
git commit -m "feat: add seed script for stores, statuses and categories"
```

---

## Task 15: パスワードハッシュ化ユーティリティ（TDD）

**Files:**

- Create: `lib/auth/password.ts`
- Test: `lib/auth/password.test.ts`

- [x] **Step 1: 依存関係をインストールする**

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

- [x] **Step 2: 失敗するテストを書く**

`lib/auth/password.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password utility", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
```

- [x] **Step 3: テストが失敗することを確認する**

```bash
npx vitest run lib/auth/password.test.ts
```

Expected: FAIL（`./password`モジュールが見つからない）

- [x] **Step 4: 実装する**

`lib/auth/password.ts`:

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [x] **Step 5: テストが通ることを確認する**

```bash
npx vitest run lib/auth/password.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 6: コミット**

```bash
git add lib/auth/password.ts lib/auth/password.test.ts package.json package-lock.json
git commit -m "feat: add password hashing utility"
```

---

## Task 16: Auth.js基盤のセットアップ

**Files:**

- Create: `lib/auth/config.ts`, `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `types/next-auth.d.ts`
- Test: `lib/auth/config.test.ts`

- [x] **Step 1: Auth.jsをインストールする**

```bash
npm install next-auth@beta
```

- [x] **Step 2: 失敗するテストを書く**

`lib/auth/config.test.ts`:

```typescript
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
```

- [x] **Step 3: テストが失敗することを確認する**

```bash
npx vitest run lib/auth/config.test.ts
```

Expected: FAIL（`./config`モジュールが見つからない）

- [x] **Step 4: 設定ファイルの骨格を実装する**

`lib/auth/config.ts`:

```typescript
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {},
};
```

- [x] **Step 5: テストが通ることを確認する**

```bash
npx vitest run lib/auth/config.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 6: ルートのAuth.jsエントリポイントを作成する**

`auth.ts`（プロジェクトルート）:

```typescript
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

`app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [x] **Step 7: セッション/JWTの型を拡張する**

`types/next-auth.d.ts`:

```typescript
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
    };
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    needsProfileCompletion?: boolean;
    pendingLineUserId?: string;
    pendingLineName?: string;
  }
}
```

- [x] **Step 8: 環境変数を`.env.example`に追記する**

```bash
# Auth.js
AUTH_SECRET="run `npx auth secret` to generate"
```

- [x] **Step 9: ローカルの`.env`にシークレットを生成して設定する**

```bash
npx auth secret
```

生成された値を`.env`の`AUTH_SECRET`に設定する（`.env`はGit管理外）。

- [x] **Step 10: 型チェックを実行する**

```bash
npx tsc --noEmit
```

- [x] **Step 11: コミット**

```bash
git add lib/auth/config.ts lib/auth/config.test.ts auth.ts app/api/auth types/next-auth.d.ts .env.example package.json package-lock.json
git commit -m "feat: set up Auth.js base configuration"
```

---

## Task 17: 会員メール/パスワード認証（TDD）

**Files:**

- Create: `lib/auth/member-credentials.ts`
- Test: `lib/auth/member-credentials.test.ts`
- Modify: `lib/auth/config.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/auth/member-credentials.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeMember } from "./member-credentials";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: {
      findUnique: vi.fn(),
    },
  },
}));

describe("authorizeMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the member when email and password match", async () => {
    const passwordHash = await hashPassword("himitsu-password");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      email: "taro@example.com",
      name: "山田太郎",
      passwordHash,
    } as never);

    const result = await authorizeMember({
      email: "taro@example.com",
      password: "himitsu-password",
    });

    expect(result).toEqual({
      id: "1",
      email: "taro@example.com",
      name: "山田太郎",
      role: "member",
    });
  });

  it("returns null when the member does not exist", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const result = await authorizeMember({
      email: "unknown@example.com",
      password: "anything",
    });

    expect(result).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("himitsu-password");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      email: "taro@example.com",
      name: "山田太郎",
      passwordHash,
    } as never);

    const result = await authorizeMember({
      email: "taro@example.com",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  it("returns null when the member has no password set (LINE-only account)", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      email: "taro@example.com",
      name: "山田太郎",
      passwordHash: null,
    } as never);

    const result = await authorizeMember({
      email: "taro@example.com",
      password: "anything",
    });

    expect(result).toBeNull();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/auth/member-credentials.test.ts
```

Expected: FAIL（`./member-credentials`モジュールが見つからない）

- [x] **Step 3: 実装する**

`lib/auth/member-credentials.ts`:

```typescript
import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

export interface AuthorizedMember {
  id: string;
  email: string;
  name: string;
  role: "member";
}

export async function authorizeMember(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedMember | null> {
  const member = await prisma.member.findUnique({
    where: { email: credentials.email },
  });

  if (!member || !member.passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, member.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: String(member.id),
    email: member.email,
    name: member.name,
    role: "member",
  };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/auth/member-credentials.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: `lib/auth/config.ts`にProviderとして登録する**

```typescript
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeMember } from "./member-credentials";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "member-credentials",
      name: "会員ログイン",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeMember({
          email: credentials.email as string,
          password: credentials.password as string,
        });
      },
    }),
  ],
  callbacks: {},
};
```

- [x] **Step 6: 型チェックとテスト一式を実行する**

```bash
npx tsc --noEmit
npm test
```

- [x] **Step 7: コミット**

```bash
git add lib/auth/member-credentials.ts lib/auth/member-credentials.test.ts lib/auth/config.ts
git commit -m "feat: add member email/password authentication"
```

---

## Task 18: 管理者メール/パスワード認証（TDD）

**Files:**

- Create: `lib/auth/admin-credentials.ts`
- Test: `lib/auth/admin-credentials.test.ts`
- Modify: `lib/auth/config.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/auth/admin-credentials.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeAdmin } from "./admin-credentials";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: {
      findUnique: vi.fn(),
    },
  },
}));

describe("authorizeAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the admin with its role when credentials match", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      storeId: 2,
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "admin-password",
    });

    expect(result).toEqual({
      id: "1",
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      role: "manager",
      storeId: 2,
    });
  });

  it("returns null when the admin does not exist", async () => {
    vi.mocked(prisma.admin.findUnique).mockResolvedValue(null);

    const result = await authorizeAdmin({
      email: "unknown@foresupa.jp",
      password: "anything",
    });

    expect(result).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("admin-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 1,
      email: "manager@foresupa.jp",
      name: "店長 佐藤",
      passwordHash,
      role: "manager",
      storeId: 2,
    } as never);

    const result = await authorizeAdmin({
      email: "manager@foresupa.jp",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  it("passes through a null storeId for HQ admins", async () => {
    const passwordHash = await hashPassword("hq-password");
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({
      id: 2,
      email: "hq@foresupa.jp",
      name: "本部 鈴木",
      passwordHash,
      role: "hq",
      storeId: null,
    } as never);

    const result = await authorizeAdmin({
      email: "hq@foresupa.jp",
      password: "hq-password",
    });

    expect(result?.storeId).toBeNull();
    expect(result?.role).toBe("hq");
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/auth/admin-credentials.test.ts
```

Expected: FAIL（`./admin-credentials`モジュールが見つからない）

- [x] **Step 3: 実装する**

`lib/auth/admin-credentials.ts`:

```typescript
import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

export interface AuthorizedAdmin {
  id: string;
  email: string;
  name: string;
  role: "hq" | "manager" | "staff";
  storeId: number | null;
}

export async function authorizeAdmin(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedAdmin | null> {
  const admin = await prisma.admin.findUnique({
    where: { email: credentials.email },
  });

  if (!admin) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: String(admin.id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
    storeId: admin.storeId,
  };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/auth/admin-credentials.test.ts
```

Expected: PASS（4 tests）

- [x] **Step 5: `lib/auth/config.ts`の`providers`配列に管理者用Providerを追加する**

`lib/auth/config.ts`の先頭のimport群に1行追加する（`authorizeMember`のimportの下）。

```typescript
import { authorizeAdmin } from "./admin-credentials";
```

`providers`配列の中、`member-credentials`のCredentials定義の直後（配列の2番目の要素として）に以下を追加する。既存の`member-credentials`定義はそのまま残す。

```typescript
    Credentials({
      id: "admin-credentials",
      name: "管理者ログイン",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeAdmin({
          email: credentials.email as string,
          password: credentials.password as string,
        });
      },
    }),
```

- [x] **Step 6: 型チェックとテスト一式を実行する**

```bash
npx tsc --noEmit
npm test
```

- [x] **Step 7: コミット**

```bash
git add lib/auth/admin-credentials.ts lib/auth/admin-credentials.test.ts lib/auth/config.ts
git commit -m "feat: add admin email/password authentication"
```

---

## Task 19: LINEログイン連携

**Files:**

- Create: `lib/auth/line-member.ts`
- Test: `lib/auth/line-member.test.ts`
- Modify: `lib/auth/config.ts`

**注記:** このタスクでは「LINEログイン→既存会員なら認証／未登録なら性別・生年月日の追加入力が必要というフラグを立てる」までのロジックを実装する。追加入力画面（M-01の補助フロー）自体はPhase 3（会員向け画面実装）で作る。

- [x] **Step 1: 失敗するテストを書く**

`lib/auth/line-member.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { findOrFlagLineMember } from "./line-member";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: {
      findUnique: vi.fn(),
    },
  },
}));

describe("findOrFlagLineMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing member when line_user_id is already linked", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 5,
      email: "hanako@example.com",
      name: "佐藤花子",
      lineUserId: "U1234567890",
    } as never);

    const result = await findOrFlagLineMember("U1234567890", "花子");

    expect(result).toEqual({
      status: "existing",
      id: "5",
      email: "hanako@example.com",
      name: "佐藤花子",
      role: "member",
    });
  });

  it("flags profile completion when no member is linked to this LINE account yet", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const result = await findOrFlagLineMember("U9999999999", "花子");

    expect(result).toEqual({
      status: "needs_profile_completion",
      lineUserId: "U9999999999",
      name: "花子",
    });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/auth/line-member.test.ts
```

Expected: FAIL（`./line-member`モジュールが見つからない）

- [x] **Step 3: 実装する**

`lib/auth/line-member.ts`:

```typescript
import { prisma } from "@/lib/db";

export type LineMemberLookupResult =
  | { status: "existing"; id: string; email: string; name: string; role: "member" }
  | { status: "needs_profile_completion"; lineUserId: string; name: string };

export async function findOrFlagLineMember(
  lineUserId: string,
  displayName: string,
): Promise<LineMemberLookupResult> {
  const member = await prisma.member.findUnique({ where: { lineUserId } });

  if (member) {
    return {
      status: "existing",
      id: String(member.id),
      email: member.email,
      name: member.name,
      role: "member",
    };
  }

  return {
    status: "needs_profile_completion",
    lineUserId,
    name: displayName,
  };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/auth/line-member.test.ts
```

Expected: PASS（2 tests）

- [x] **Step 5: LINE Developersでチャネルを作成する（手動作業）**

https://developers.line.biz/ でLINEログイン用チャネルを作成し、コールバックURLに`http://localhost:3000/api/auth/callback/line`（本番URLは後で追加）を登録、Channel IDとChannel Secretを控える。

- [x] **Step 6: `.env.example`に環境変数を追記する**

```bash
# LINE Login
LINE_CLIENT_ID="your-line-channel-id"
LINE_CLIENT_SECRET="your-line-channel-secret"
```

ローカルの`.env`にはStep5で控えた実際の値を設定する。

- [x] **Step 7: `lib/auth/config.ts`にLINE Providerとコールバックを追加する**

```typescript
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import LineProvider from "next-auth/providers/line";
import { authorizeMember } from "./member-credentials";
import { authorizeAdmin } from "./admin-credentials";
import { findOrFlagLineMember } from "./line-member";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "member-credentials",
      name: "会員ログイン",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeMember({
          email: credentials.email as string,
          password: credentials.password as string,
        });
      },
    }),
    Credentials({
      id: "admin-credentials",
      name: "管理者ログイン",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeAdmin({
          email: credentials.email as string,
          password: credentials.password as string,
        });
      },
    }),
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }

      if (account?.provider === "line" && account.providerAccountId) {
        const result = await findOrFlagLineMember(
          account.providerAccountId,
          (profile as { name?: string } | undefined)?.name ?? "",
        );

        if (result.status === "existing") {
          token.id = result.id;
          token.role = "member";
          token.needsProfileCompletion = false;
        } else {
          token.needsProfileCompletion = true;
          token.pendingLineUserId = result.lineUserId;
          token.pendingLineName = result.name;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id ?? "";
      session.user.role = token.role ?? "";
      session.needsProfileCompletion = token.needsProfileCompletion;
      session.pendingLineUserId = token.pendingLineUserId;
      session.pendingLineName = token.pendingLineName;
      return session;
    },
  },
};
```

- [x] **Step 8: 型チェックとテスト一式を実行する**

```bash
npx tsc --noEmit
npm test
```

- [x] **Step 9: コミット**

```bash
git add lib/auth/line-member.ts lib/auth/line-member.test.ts lib/auth/config.ts .env.example
git commit -m "feat: add LINE login with pending-profile detection"
```

---

## Task 20: ルートグループ別アクセス制御ミドルウェア（TDD）

**Files:**

- Create: `lib/auth/access-control.ts`
- Test: `lib/auth/access-control.test.ts`
- Create: `middleware.ts`

- [x] **Step 1: 失敗するテストを書く**

`lib/auth/access-control.test.ts`:

```typescript
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
```

- [x] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run lib/auth/access-control.test.ts
```

Expected: FAIL（`./access-control`モジュールが見つからない）

- [x] **Step 3: 実装する**

`lib/auth/access-control.ts`:

```typescript
export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export function resolveAccessDecision(pathname: string, role: string | undefined): AccessDecision {
  const isAdminLoginPage = pathname.startsWith("/admin/login");
  const isAdminArea = pathname.startsWith("/admin") && !isAdminLoginPage;
  const isMemberArea = pathname.startsWith("/mypage");

  if (isAdminArea && !(role && ADMIN_ROLES.has(role))) {
    return { type: "redirect", to: "/admin/login" };
  }

  if (isMemberArea && role !== "member") {
    return { type: "redirect", to: "/login" };
  }

  return { type: "allow" };
}
```

- [x] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/auth/access-control.test.ts
```

Expected: PASS（7 tests）

- [x] **Step 5: `middleware.ts`を作成してAuth.jsのミドルウェアと接続する**

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { resolveAccessDecision } from "@/lib/auth/access-control";

export default auth((req) => {
  const decision = resolveAccessDecision(req.nextUrl.pathname, req.auth?.user?.role);

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/mypage/:path*"],
};
```

- [x] **Step 6: 型チェックとテスト・ビルドを実行する**

```bash
npx tsc --noEmit
npm test
npm run build
```

- [x] **Step 7: コミット**

```bash
git add lib/auth/access-control.ts lib/auth/access-control.test.ts middleware.ts
git commit -m "feat: add role-based route protection middleware"
```

---

## 完了確認チェックリスト

- [x] `npm run build` が成功する
- [x] `npm test` の全テストがパスする（Task 5, 15, 16, 17, 18, 19, 20のテスト、合計20+ tests）
- [x] `npx prisma studio` でSupabase上の19テーブル全てが確認できる
- [x] `npm run db:seed` で4店舗・5ステータス・6カテゴリが投入されている
- [x] `/admin/dashboard`, `/mypage` へ未ログインでアクセスするとそれぞれ`/admin/login`, `/login`へリダイレクトされる（手動確認、該当ページはPhase 3/4で実装するため現時点では404でも可。ミドルウェアのリダイレクト自体はcurlで検証：`curl -I http://localhost:3000/admin/dashboard` の`Location`ヘッダを確認）
