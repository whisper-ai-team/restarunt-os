import { prisma } from "../server.js";
import { getMenu } from "./cloverService.js";

/**
 * Syncs the menu from Clover to Postgres for a specific restaurant.
 * @param {string} restaurantId 
 */
export async function syncMenuForRestaurant(restaurantId) {
    console.log(`🔄 [SYNC] Starting Menu Sync for Restaurant ID: ${restaurantId}`);

    try {
        // 1. Fetch Credentials & Config
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId }
        });

        if (!restaurant) throw new Error("Restaurant not found");

        const credentials = {
            apiKey: restaurant.cloverApiKey,
            merchantId: restaurant.cloverMerchantId,
            ecommerceToken: restaurant.cloverEcommerceToken,
            environment: restaurant.cloverEnvironment
        };

        if (!credentials.apiKey || !credentials.merchantId) {
            console.warn(`⚠️ [SYNC] Missing Clover Credentials for ${restaurant.name}. Skipping.`);
            return;
        }

        // 2. Fetch from Clover (using existing service)
        const menuData = await getMenu(credentials, restaurantId);
        const externalItems = menuData.items || [];

        console.log(`📥 [SYNC] Fetched ${externalItems.length} items from Clover.`);

        // 3. Upsert into Postgres
        let successCount = 0;
        let failCount = 0;

        for (const item of externalItems) {
            try {
                // Ensure required fields
                if (!item.name || !item.price) continue;

                // Flatten category
                const categoryName = item.categories && item.categories.length > 0 
                    ? item.categories[0].name 
                    : "General";

                await prisma.menuItem.upsert({
                    where: {
                        restaurantId_cloverId: {
                            restaurantId: restaurant.id,
                            cloverId: item.id || "manual-" + item.name // Safety fallback
                        }
                    },
                    update: {
                        name: item.name,
                        price: item.price,
                        description: item.description || "",
                        category: categoryName,
                        available: !item.hidden, // Clover 'hidden' -> Our 'available'
                        updatedAt: new Date()
                    },
                    create: {
                        restaurantId: restaurant.id,
                        cloverId: item.id,
                        name: item.name,
                        price: item.price,
                        description: item.description || "",
                        category: categoryName,
                        available: !item.hidden
                    }
                });
                successCount++;
            } catch (err) {
                console.error(`❌ [SYNC] Failed to upsert item ${item.name}:`, err.message);
                failCount++;
            }
        }

        console.log(`✅ [SYNC] Completed for ${restaurant.name}. Success: ${successCount}, Failed: ${failCount}`);
        
        return { success: true, count: successCount };

    } catch (err) {
        console.error(`❌ [SYNC] Critical Failure:`, err);
        return { success: false, error: err.message };
    }
}
