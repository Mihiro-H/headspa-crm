-- 予約完了通知（会員がWEB予約を確定した瞬間に送るメール/LINE）用に、
-- 既存のauto_delivery_type / delivery_template_typeそれぞれに"confirmation"を追加する。
-- 既存の値（birthday/reminder/segment）はそのまま維持し、値の追加のみ行う。
ALTER TYPE "auto_delivery_type" ADD VALUE IF NOT EXISTS 'confirmation';
ALTER TYPE "delivery_template_type" ADD VALUE IF NOT EXISTS 'confirmation';
