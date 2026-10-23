-- AlterTable
ALTER TABLE "card_networks" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "premise_categories" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
