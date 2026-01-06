-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "isTakeoverActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentUrl" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "cloverEcommerceToken" TEXT;
