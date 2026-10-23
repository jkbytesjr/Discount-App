-- CreateEnum
CREATE TYPE "AlertEventType" AS ENUM ('TRIGGERED', 'DELIVERED', 'OPENED', 'DISMISSED', 'DETAIL_VIEWED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "AlertMode" AS ENUM ('PERSONALISED', 'PERSONALISED_PLUS_GENERAL', 'ALL');

-- CreateTable
CREATE TABLE "user_cards" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "card_product_id" TEXT NOT NULL,
    "nickname" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wallets" (
    "user_id" UUID NOT NULL,
    "wallet_provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("user_id","wallet_provider_id")
);

-- CreateTable
CREATE TABLE "alert_preferences" (
    "user_id" UUID NOT NULL,
    "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" "AlertMode" NOT NULL DEFAULT 'PERSONALISED',
    "quiet_from" TEXT,
    "quiet_to" TEXT,
    "general_issuers" TEXT[],
    "general_wallets" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "discount_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","discount_id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "client_event_id" TEXT,
    "user_id" UUID,
    "device_id" TEXT,
    "premise_id" TEXT NOT NULL,
    "discount_ids" TEXT[],
    "type" "AlertEventType" NOT NULL,
    "reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distance_m" INTEGER,
    "coarse_lat" DOUBLE PRECISION,
    "coarse_lng" DOUBLE PRECISION,
    "app_version" TEXT,
    "os_version" TEXT,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_cards_user_id_card_product_id_key" ON "user_cards"("user_id", "card_product_id");

-- CreateIndex
CREATE INDEX "favorites_discount_id_idx" ON "favorites"("discount_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_events_client_event_id_key" ON "alert_events"("client_event_id");

-- CreateIndex
CREATE INDEX "alert_events_premise_id_occurred_at_idx" ON "alert_events"("premise_id", "occurred_at");

-- CreateIndex
CREATE INDEX "alert_events_type_occurred_at_idx" ON "alert_events"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "alert_events_user_id_occurred_at_idx" ON "alert_events"("user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_card_product_id_fkey" FOREIGN KEY ("card_product_id") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_wallet_provider_id_fkey" FOREIGN KEY ("wallet_provider_id") REFERENCES "wallet_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
