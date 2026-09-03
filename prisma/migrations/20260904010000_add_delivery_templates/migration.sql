-- CreateTable
CREATE TABLE "delivery_templates" (
    "template_id" SERIAL NOT NULL,
    "type" "delivery_template_type" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255),
    "body_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_templates_pkey" PRIMARY KEY ("template_id")
);

-- AddForeignKey
ALTER TABLE "segment_campaigns" ADD CONSTRAINT "segment_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "delivery_templates"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_delivery_settings" ADD CONSTRAINT "auto_delivery_settings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "delivery_templates"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;
