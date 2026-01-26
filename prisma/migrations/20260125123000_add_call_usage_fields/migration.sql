-- Add AI usage metrics and model config to Call records
ALTER TABLE "Call" ADD COLUMN "aiUsage" JSONB;
ALTER TABLE "Call" ADD COLUMN "modelConfig" JSONB;
