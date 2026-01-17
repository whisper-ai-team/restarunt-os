import { getMenu } from "../services/cloverService.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  console.log("🔍 Verifying Real API Connections...");

  const restaurants = [
    { name: "Pulcinella", slug: "pulcinella-pizza" },
    { name: "Domions", slug: "domions-pizza" }
  ];

  for (const r of restaurants) {
    const dbRes = await prisma.restaurant.findUnique({ where: { slug: r.slug } });
    if (!dbRes) {
        console.error(`❌ ${r.name} not found in DB!`);
        continue;
    }

    console.log(`\n🍔 Testing ${r.name} (ID: ${dbRes.id})...`);
    console.log(`   Merchant: ${dbRes.cloverMerchantId}`);
    
    try {
        const credentials = {
            merchantId: dbRes.cloverMerchantId,
            apiKey: dbRes.cloverApiKey,
            ecommerceToken: dbRes.cloverEcommerceToken,
            environment: dbRes.cloverEnvironment 
        };
        
        const menu = await getMenu(credentials, dbRes.id);
        console.log(`   ✅ Success! Found ${menu.items.length} items.`);
        if (menu.items.length > 0) {
            console.log(`      Sample: ${menu.items[0].name} - $${(menu.items[0].price/100).toFixed(2)}`);
        } else {
            console.warn(`      ⚠️  Menu is empty (Auth worked, but no items?)`);
        }
    } catch (e) {
        console.error(`   ❌ Failed: ${e.message}`);
    }
  }
}

verify().finally(() => prisma.$disconnect());
