-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "endCallMessage" TEXT,
ADD COLUMN     "nextBillingDate" TIMESTAMP(3),
ADD COLUMN     "notificationConfig" JSONB,
ADD COLUMN     "paymentMethodExpiry" TEXT,
ADD COLUMN     "paymentMethodLast4" TEXT,
ADD COLUMN     "paymentMethodType" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionPlan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "voiceLanguage" TEXT DEFAULT 'en-US',
ADD COLUMN     "voiceSpeed" DOUBLE PRECISION DEFAULT 1.0;
