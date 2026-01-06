import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking Restaurant Clover Configuration...\n");
  
  const restaurants = await prisma.restaurant.findMany();
  
  if (restaurants.length === 0) {
    console.log("❌ No restaurants found in database!");
    console.log("   Run the onboarding wizard at http://localhost:3001/admin/new");
    return;
  }
  
  for (const restaurant of restaurants) {
    console.log(`📍 Restaurant: ${restaurant.name}`);
    console.log(`   ID: ${restaurant.id}`);
    console.log(`   Phone: ${restaurant.phoneNumber}`);
    console.log(`   Merchant ID: ${restaurant.cloverMerchantId || "❌ NOT SET"}`);
    console.log(`   API Key: ${restaurant.cloverApiKey ? "✅ SET (encrypted)" : "❌ NOT SET"}`);
    
    if (!restaurant.cloverMerchantId || !restaurant.cloverApiKey) {
      console.log(`   ⚠️  WARNING: Missing Clover credentials!`);
      console.log(`   → Update via Admin Dashboard: http://localhost:3001/admin/${restaurant.id}`);
    } else {
      console.log(`   ✅ Clover credentials configured`);
    }
    
    console.log("");
  }
  
  console.log("\n💡 Next Steps:");
  console.log("   1. Restart the agent: npm run agent:dev");
  console.log("   2. Make a test call");
  console.log("   3. Check Clover dashboard for the order");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
