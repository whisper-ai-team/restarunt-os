// cloverService.js - Clover POS API integration
import { CONFIG } from "../config/agentConfig.js";
import { INSTANCE_ID } from "../utils/agentUtils.js";
import { MenuIntelligenceService } from "./menuIntelligence.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let menuCache = { items: [], lastFetch: 0 };

// -----------------------------
// CLOVER SERVICE
// -----------------------------
export async function cloverRequest(path, { method = "GET", body } = {}, credentials) {
  const apiKey = credentials.apiKey || process.env.CLOVER_API_KEY;
  const merchId = credentials.merchantId || process.env.CLOVER_MERCHANT_ID;
  const env = credentials.environment || "production"; 

  // Dynamic Base URL Selection
  const baseUrl = env === "sandbox" 
      ? "https://apisandbox.dev.clover.com" 
      : "https://api.clover.com";

  if (!apiKey || !merchId) throw new Error("Missing Clover credentials");

  const url = `${baseUrl}/v3/merchants/${merchId}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(`Clover error ${res.status}`);
  return res.json();
}

export async function getMenu(credentials, restaurantId) {
  const now = Date.now();
  if (
    menuCache.items.length > 0 &&
    now - menuCache.lastFetch < CONFIG.menuCacheTtl
  ) {
    return menuCache;
  }
  
  // Timeout wrapper for fetch
  const fetchWithTimeout = async (url, opts, ms = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };



// ... existing imports

// ... existing code



  try {
    console.log(`🍔 [${INSTANCE_ID}] Fetching menu from Clover (Recursive)...`);
    
    let allItems = [];
    let offset = 0;
    const limit = 1000;
    let keepFetching = true;

    while (keepFetching) {
        console.log(`   🔄 Fetching page offset=${offset}...`);
        const data = await cloverRequest(`/items?limit=${limit}&offset=${offset}&expand=categories`, {}, credentials, fetchWithTimeout);
        const pageItems = data.elements || [];
        allItems = allItems.concat(pageItems);

        if (pageItems.length < limit) {
            keepFetching = false;
        } else {
            offset += limit;
        }
    }

    const items = allItems;
    menuCache = { items, lastFetch: now };
    console.log(`🍔 [${INSTANCE_ID}] Menu fetch success: ${items.length} TOTAL items.`);
    
    // --- AI SENTINEL TRIGGER ---
    if (items.length > 0 && restaurantId) {
       // 1. Kick off Enrichment (Fire & Forget)
       MenuIntelligenceService.enrichMenu(restaurantId, items).catch(err => {
           console.error(`⚠️ [MenuSentinel] Background enrichment failed:`, err);
       });
       
       // 2. Try to merge existing intelligence immediately
       try {
           const enrichedItems = await MenuIntelligenceService.mergeIntelligence(restaurantId, items);
           menuCache = { items: enrichedItems, lastFetch: now };
           console.log(`🍔 [${INSTANCE_ID}] Menu fetch success: ${items.length} items (Enriched).`);
           return menuCache;
       } catch (err) {
           console.warn(`⚠️ [MenuSentinel] Merge failed, returning raw items:`, err);
       }
    }
    
    return menuCache;
  } catch (err) {
    console.error("❌ Menu Fetch Failed:", err.message);
    return { items: [], lastFetch: now };
  }
}


// Helper: Create order in Clover POS
export async function createCloverOrder(cart, customerName, customerPhone, credentials) {
  console.log(`🔧 [createCloverOrder] Starting with:`, {
    itemCount: cart.length,
    customerName,
    hasApiKey: !!credentials?.apiKey,
    hasMerchantId: !!credentials?.merchantId,
    merchantId: credentials?.merchantId
  });
  
  try {


    // Step 1: Create empty order
    console.log(`   Step 1: Creating empty order...`);
    const order = await cloverRequest("/orders", {
      method: "POST",
      body: {
        state: "open"
      }
    }, credentials);
    
    console.log(`   ✅ Order created: ${order.id}`);
    
    // Step 2: Add line items one by one using atomic operations
    console.log(`   Step 2: Adding ${cart.length} line items...`);
    
    // Ensure we have menu items to check against for authoritative pricing
    const menuItems = menuCache?.items || [];
    let calculatedTotal = 0;
    
    for (const item of cart) {
      // DUPLICATION STRATEGY: Loop over quantity and add each as a separate line item
      // This ensures Clover Dashboard shows "2x" or multiple lines for visibility.
      const count = item.qty || 1;
      console.log(`      Processing: ${count}x ${item.name}`);
      
      // Find authoritative price from menu cache
      const linkedItem = menuItems.find(m => 
        m.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      
      const itemPrice = linkedItem ? linkedItem.price : item.price;
      const priceSource = linkedItem ? "menu_cache" : "adhoc";

      for (let i = 0; i < count; i++) {
        let lineItemPayload = {};
        
        if (linkedItem) {
          lineItemPayload = {
            item: { id: linkedItem.id }
            // unitQty removed: Duplicating for visibility
          };
        } else {
          lineItemPayload = {
            name: item.name,
            price: item.price
            // unitQty removed: Duplicating for visibility
          };
        }

        await cloverRequest(`/orders/${order.id}/line_items`, {
          method: "POST",
          body: lineItemPayload
        }, credentials);
        
        calculatedTotal += itemPrice;
      }
      
      console.log(`      ✅ Added ${count} line(s) for ${item.name} (${priceSource})`);
    }

    // Step 3: Explicitly update order total and note
    // REQUIRED: Ad-Hoc/Atomic items often result in $0.00 Dashboard Totals without this.
    console.log(`   Step 3: Updating order total to $${(calculatedTotal/100).toFixed(2)}...`);
    
    const noteText = `Phone Order from ${customerName || "Customer"} (${customerPhone || "Unknown"})\nType: Pickup`;

    await cloverRequest(`/orders/${order.id}`, {
      method: "POST", // Updates existing order
      body: {
        total: calculatedTotal,
        note: noteText,
        title: "Phone Order"
      }
    }, credentials);
    
    console.log("   ✅ Order finalized in Clover.");
    
    return order;
  } catch (err) {
    console.error(`❌ Clover order creation failed: ${err.message}`);
    throw err;
  }
}

// Export menuCache for external access if needed
export { menuCache };
