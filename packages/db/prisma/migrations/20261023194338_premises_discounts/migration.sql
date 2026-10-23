-- CreateEnum
CREATE TYPE "PremiseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EligibilityScope" AS ENUM ('CARD_PRODUCT', 'ISSUER_ANY', 'ANY_BANK_CARD', 'WALLET', 'ANY_WALLET', 'GENERAL');

-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('PERCENT', 'FIXED', 'CASHBACK', 'BOGO', 'FREE_ITEM', 'POINTS');

-- CreateTable
CREATE TABLE "premises" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "approx" BOOLEAN NOT NULL DEFAULT false,
    "alert_radius_m" INTEGER NOT NULL DEFAULT 150,
    "opening_hours" TEXT,
    "phone" TEXT,
    "status" "PremiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "data_origin" "DataOrigin" NOT NULL DEFAULT 'REAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "premises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title_pt" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "description_pt" TEXT,
    "description_en" TEXT,
    "terms_pt" TEXT,
    "terms_en" TEXT,
    "redemption_pt" TEXT,
    "redemption_en" TEXT,
    "promo_code" TEXT,
    "valid_from" DATE,
    "valid_to" DATE,
    "schedule_days" TEXT[],
    "schedule_from" TEXT,
    "schedule_to" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "status" "DiscountStatus" NOT NULL DEFAULT 'DRAFT',
    "data_origin" "DataOrigin" NOT NULL DEFAULT 'REAL',
    "source_ref" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_premises" (
    "discount_id" TEXT NOT NULL,
    "premise_id" TEXT NOT NULL,

    CONSTRAINT "discount_premises_pkey" PRIMARY KEY ("discount_id","premise_id")
);

-- CreateTable
CREATE TABLE "discount_eligibility" (
    "id" TEXT NOT NULL,
    "discount_id" TEXT NOT NULL,
    "scope" "EligibilityScope" NOT NULL,
    "card_product_id" TEXT,
    "issuer_id" TEXT,
    "wallet_id" TEXT,
    "card_type" "CardType",
    "network_id" TEXT,
    "benefit" "BenefitType" NOT NULL,
    "value" DOUBLE PRECISION,
    "value_mzn" INTEGER,
    "value_text_pt" TEXT,
    "value_text_en" TEXT,
    "min_spend_mzn" INTEGER,
    "max_discount_mzn" INTEGER,
    "comment_pt" TEXT,
    "comment_en" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "discount_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "premises_business_id_idx" ON "premises"("business_id");

-- CreateIndex
CREATE INDEX "discounts_business_id_status_idx" ON "discounts"("business_id", "status");

-- CreateIndex
CREATE INDEX "discount_eligibility_discount_id_idx" ON "discount_eligibility"("discount_id");

-- AddForeignKey
ALTER TABLE "premises" ADD CONSTRAINT "premises_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "premises" ADD CONSTRAINT "premises_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "premise_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_premises" ADD CONSTRAINT "discount_premises_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_premises" ADD CONSTRAINT "discount_premises_premise_id_fkey" FOREIGN KEY ("premise_id") REFERENCES "premises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_eligibility" ADD CONSTRAINT "discount_eligibility_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Range checks that Prisma cannot express (BR-7, BR-8)
ALTER TABLE "premises" ADD CONSTRAINT "premises_alert_radius_chk" CHECK ("alert_radius_m" BETWEEN 50 AND 1000);
ALTER TABLE "premises" ADD CONSTRAINT "premises_lat_chk" CHECK ("lat" IS NULL OR "lat" BETWEEN -90 AND 90);
ALTER TABLE "premises" ADD CONSTRAINT "premises_lng_chk" CHECK ("lng" IS NULL OR "lng" BETWEEN -180 AND 180);
ALTER TABLE "premises" ADD CONSTRAINT "premises_latlng_pair_chk" CHECK (("lat" IS NULL) = ("lng" IS NULL));
ALTER TABLE "discount_eligibility" ADD CONSTRAINT "eligibility_percent_chk"
  CHECK ("benefit" NOT IN ('PERCENT','CASHBACK') OR ("value" >= 0.01 AND "value" <= 100));
