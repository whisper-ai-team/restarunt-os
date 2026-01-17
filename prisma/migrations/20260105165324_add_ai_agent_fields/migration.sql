-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "agentGuidelines" TEXT,
ADD COLUMN     "aiName" TEXT NOT NULL DEFAULT 'Hayman';
