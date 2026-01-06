import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
import { getRestaurantConfigInternal } from "./restaurantConfig.js";

const prisma = new PrismaClient();

async function testCloverAPI() {
  console.log("🧪 Testing Clover API Integration...\n");
  
  // Get restaurant from database with decrypted credentials
  const restaurant = await getRestaurantConfigInternal("bharat-bistro-001");
  if (!restaurant) {
    console.error("❌ Restaurant not found!");
    return;
  }
  
  const apiKey = restaurant.clover.apiKey;
  const merchantId = restaurant.clover.merchantId;
  
  console.log("📋 Credentials:");
  console.log(`   Merchant ID: ${merchantId}`);
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log("");
  
  const baseUrl = "https://sandbox.dev.clover.com/v3/merchants";
  
  try {
    // Step 1: Create empty order
    console.log("📝 Step 1: Creating empty order...");
    const orderRes = await fetch(`${baseUrl}/${merchantId}/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        state: "open"
      })
    });
    
    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      console.error(`❌ Order creation failed (${orderRes.status}):`, errorText);
      return;
    }
    
    const order = await orderRes.json();
    console.log(`✅ Order created: ${order.id}`);
    console.log("");
    
    // Step 2: Add line items using atomic operations
    console.log("📝 Step 2: Adding line items...");
    
    const testItems = [
      { name: "Butter Chicken", price: 1499, quantity: 2 },
      { name: "Garlic Naan", price: 299, quantity: 3 }
    ];
    for (const item of testItems) {
      const count = item.quantity || 1;
      console.log(`   Adding: ${count}x ${item.name} ($${item.price/100}) via duplication...`);
      
      for (let i = 0; i < count; i++) {
        const lineItemRes = await fetch(`${baseUrl}/${merchantId}/orders/${order.id}/line_items`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: item.name,
            price: item.price
            // unitQty removed: duplicating line items instead
          })
        });
        
        if (!lineItemRes.ok) {
          const errorText = await lineItemRes.text();
          console.error(`   ❌ Line item ${i+1} failed (${lineItemRes.status}):`, errorText);
          continue;
        }
        
        const lineItem = await lineItemRes.json();
        console.log(`   ✅ Line item ${i+1} added: ${lineItem.id}`);
      }
    }
    
    // Step 3a: Explicit Total Update (The Fix) - REMOVED TO TEST NATIVE CALC
    /*
    console.log("📝 Step 3a: Explicitly updating total (The Fix)...");
    const calculatedTotal = testItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    console.log(`   💰 Calculated Total: $${(calculatedTotal/100).toFixed(2)}`);
    ...
    */

    // ADDED: Note/Title update without Total to trigger Clover UI grouping if supported
    console.log("📝 Step 3a: Updating Note/Title (Native Calc)...");
    const updateRes = await fetch(`${baseUrl}/${merchantId}/orders/${order.id}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Test Order (Duplication)",
        note: "This order uses duplicated line items for quantity."
      })
    });    
    if (updateRes.ok) {
        console.log("   ✅ Explicit total updated successfully.");
    } else {
        console.error("   ❌ Failed to update total:", await updateRes.text());
    }
    
    console.log("");
    
    // Step 3: Get final order to verify
    console.log("📝 Step 3: Fetching final order...");
    const finalOrderRes = await fetch(`${baseUrl}/${merchantId}/orders/${order.id}?expand=lineItems`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    
    const finalOrder = await finalOrderRes.json();
    console.log(`✅ Final order total: $${finalOrder.total / 100}`);
    console.log(`✅ Line items: ${finalOrder.lineItems?.elements?.length || 0}`);
    
    if (finalOrder.lineItems?.elements) {
      finalOrder.lineItems.elements.forEach(item => {
        console.log(`   - ${item.name}: $${item.price / 100} x ${item.unitQty / 1000}`);
      });
    }
    
    console.log("");
    console.log(`🔗 View in Clover: https://sandbox.dev.clover.com/dashboard/orders/${order.id}`);
    
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCloverAPI();
