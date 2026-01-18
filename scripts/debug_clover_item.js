
import "dotenv/config";
import { getMenu } from "../services/cloverService.js";
import { CONFIG } from "../config/agentConfig.js";

// Mock Credentials if .env is missing (User will need to ensure .env is set)
const credentials = {
    apiKey: process.env.CLOVER_API_KEY,
    merchantId: process.env.CLOVER_MERCHANT_ID,
    environment: "production"
};

async function runDebug() {
    console.log("🔍 [DEBUG] Fetching Menu from Clover API...");
    console.log(`   Merchant ID: ${credentials.merchantId}`);
    
    if (!credentials.apiKey) {
        console.error("❌ MISSING CLOVER_API_KEY in .env");
        process.exit(1);
    }

    try {
        const { items } = await getMenu(credentials, "debug-session");
        
        console.log(`\n🍔 Total Items Fetched: ${items.length}`);
        
        // Search for the specific item
        const query = "Chicken Tikka Masala";
        const matches = items.filter(i => i.name.toLowerCase().includes("chicken tikka"));
        
        console.log(`\n🎯 Searching for "${query}"... Found ${matches.length} candidates:\n`);
        
        matches.forEach(item => {
            console.log(`   [${item.name}]`);
            console.log(`   - ID: ${item.id}`);
            console.log(`   - Price: $${(item.price/100).toFixed(2)}`);
            console.log(`   - Hidden: ${item.hidden} (Raw Value: ${JSON.stringify(item.hidden)})`);
            console.log(`   - Available: ${item.available}`);
            console.log(`   - Is Revenue: ${item.isRevenue}`);
            console.log(`   - Tags: ${JSON.stringify(item.tags || [])}`);
            
            if (item.hidden) {
                console.log("   ❌ BLOCKED: This item is marked 'hidden' by Clover API.");
            } else {
                console.log("   ✅ VISIBLE: This item should be searchable.");
            }
            console.log("------------------------------------------------");
        });

        if (matches.length === 0) {
            console.log("❌ PROBLEM: The item is missing from the API response entirely.");
            console.log("   Possible causes: Sync latency, 'Show in App' not checked, or Pagination limit.");
        }

    } catch (e) {
        console.error("❌ DEBUG FAILED:", e);
    }
}

runDebug();
