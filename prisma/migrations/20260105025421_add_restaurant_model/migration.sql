/*
  Multi-Tenant Migration: Add Restaurant Model
  
  Strategy:
  1. Create Restaurant table
  2. Insert Bharat Bistro (current restaurant)
  3. Add restaurantId column to Order with temp default
  4. Update existing orders to link to Bharat Bistro
  5. Make restaurantId required and add foreign key
*/

-- Step 1: Create Restaurant table
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "cloverMerchantId" TEXT NOT NULL,
    "cloverApiKey" TEXT NOT NULL,
    "cloverEnvironment" TEXT NOT NULL DEFAULT 'production',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "cuisineType" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT,
    "defaultPrinterId" TEXT,
    "autoPrint" BOOLEAN NOT NULL DEFAULT true,
    "deviceId" TEXT,
    "voiceSelection" TEXT NOT NULL DEFAULT 'alloy',
    "greeting" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- Step 2: Insert Bharat Bistro (uses encrypted API key - will be set via seed script)
INSERT INTO "Restaurant" (
  "id",
  "updatedAt",
  "name",
  "slug",
  "phoneNumber", 
  "cloverMerchantId",
  "cloverApiKey",
  "address",
  "city",
  "state",
  "zipCode",
  "cuisineType",
  "voiceSelection"
) VALUES (
  'bharat-bistro-001',
  CURRENT_TIMESTAMP,
  'Bharat Bistro',
  'bharat-bistro',
  '+12013444638',
  'AY9ARGETAKY31',
  'PLACEHOLDER_WILL_BE_UPDATED',
  '123 Main Street',
  'Jersey City',
  'NJ',
  '07302',
  'Indian',
  'alloy'
);

-- Step 3: Add restaurantId column (nullable first)
ALTER TABLE "Order" ADD COLUMN "restaurantId" TEXT;

-- Step 4: Update all existing orders to link to Bharat Bistro
UPDATE "Order" SET "restaurantId" = 'bharat-bistro-001' WHERE "restaurantId" IS NULL;

-- Step 5: Make restaurantId required
ALTER TABLE "Order" ALTER COLUMN "restaurantId" SET NOT NULL;

-- Step 6: Create indexes
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
CREATE UNIQUE INDEX "Restaurant_phoneNumber_key" ON "Restaurant"("phoneNumber");
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");

-- Step 7: Add foreign key constraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" 
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
