-- CreateTable
CREATE TABLE "terms_of_service" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "body_text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_of_service_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so the app has a row to read/upsert from day one.
INSERT INTO "terms_of_service" ("id", "body_text", "updated_at") VALUES (1, '', CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING;
