
import { llm } from "@livekit/agents";
import Fuse from "fuse.js";
import { metaphone, redact, INSTANCE_ID } from "../utils/agentUtils.js";
import { validateOrder } from "../utils/dietaryHelpers.js";
import { DIETARY_MAP } from "../config/agentConfig.js";
import { getMenu, createCloverOrder } from "../services/cloverService.js";
import { sendOrderConfirmation } from "../services/notificationService.js";
import { printOrderToKitchen } from "../cloverPrint.js";
import { createDeliveryTools } from "./tools/DeliveryTools.js";
import { MenuMatcher } from "../utils/menuMatcher.js";

/**
 * Factory function to create tools with closure context
 */
export function createRestaurantTools({ 
  restaurantConfig, 
  activeRoom, 
  customerDetails, 
  sessionCart, 
  callRecord, 
  finalizeCallback, 
  cuisineProfile,
  activeAllergies,
  menuLoadSuccess 
}) {
    
    // Helper to guard against duplicate adds
    let lastProcessedHash = null;

    return {
        // ... (other tools remain same)

        // --- SMARTEST MENU SEARCH (Minimalist Output) ---
        // --- INTELLIGENT MENU SEARCH (With Descriptions) ---
        searchMenu: llm.tool({
          description: "Use this ONLY to check if an item is available or to get its price/description. DO NOT use this to add items to an order. If a user asks 'Do you have X', call this tool.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
          execute: async ({ query }) => {
            if (activeRoom.state === "disconnected") return;
            
            // STRICT MODE CHECK
            if (!menuLoadSuccess) {
                return "System: CRITICAL - The menu is unavailable (offline mode). You must apologize and tell the user you cannot check the menu right now.";
            }

            console.log(`🔍 User Query: "${query}"`);

            // 1. SILENT CORRECTION (Dynamic based on Cuisine)
            let fixedQuery = query.toLowerCase();
            if (cuisineProfile.phoneticCorrections) {
              Object.keys(cuisineProfile.phoneticCorrections).forEach((badWord) => {
                if (fixedQuery.includes(badWord)) {
                  fixedQuery = fixedQuery.replace(
                    badWord,
                    cuisineProfile.phoneticCorrections[badWord]
                  );
                }
              });
            }

            try {
              const { items: cloverItems } = await getMenu(
                restaurantConfig.clover,
                restaurantConfig.id
              );
              // ... rest of logic
            } catch (err) {
              return "System: Error accessing menu.";
            }
          },
        }),

        removeFromOrder: llm.tool({
          description: "Use this ONLY when the customer wants to remove an item they previously added or reduce the quantity.",
          parameters: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              quantityToRemove: { type: "integer", description: "Optional: number of items to remove. If omitted, removes all of that item." }
            },
            required: ["itemName"],
          },
          execute: async ({ itemName, quantityToRemove }) => {
            const query = itemName.toLowerCase();
            const index = sessionCart.findIndex(i => i.name.toLowerCase().includes(query));
            
            if (index === -1) {
                return `System: I couldn't find "${itemName}" in the current cart. Cart has: ${sessionCart.map(i => i.name).join(", ")}.`;
            }

            const item = sessionCart[index];
            if (quantityToRemove && quantityToRemove < item.qty) {
                item.qty -= quantityToRemove;
                console.log(`🛒 Updated quantity for ${item.name}: ${item.qty}`);
                return `System: Reduced ${item.name} quantity to ${item.qty}. Confirm this: "Okay, I've updated that. You now have ${item.qty} ${item.name} in your cart."`;
            } else {
                sessionCart.splice(index, 1);
                console.log(`🛒 Removed from Order: ${item.name}`);
                return `System: Removed ${item.name} from cart. Confirm this: "No problem, I've removed the ${item.name} from your order."`;
            }
          }
        }),

        addToOrder: llm.tool({
          description: "Use this ONLY when the customer explicitly wants to buy/order an item. Requires itemName and quantity. Validates against the menu before adding.",
          parameters: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              quantity: { type: "integer" },
              notes: { type: "string" },
              turn_id: { type: "string", description: "A unique identifier for the current user utterance to prevent double-adding." }
            },
            required: ["itemName", "quantity", "turn_id"],
          },
          execute: async ({ itemName, quantity, notes, turn_id }) => {
            // STRICT MODE CHECK
            if (!menuLoadSuccess) {
                return "System: CRITICAL - The menu system is offline. You CANNOT add items to the order. Apologize to the user.";
            }

            // --- TURN DEDUPLICATION ---
            const turnHash = `${turn_id}-${itemName}-${quantity}`;
            if (lastProcessedHash === turnHash) {
                console.log(`🛡️ [DEDUPE] Blocked duplicate add for: ${itemName}`);
                return `System: Item ${itemName} was already added in this turn. Proceed with conversation.`;
            }
            lastProcessedHash = turnHash;

            const { items } = await getMenu(restaurantConfig.clover, restaurantConfig.id);
            
            // --- LAYER B: MENU MATCHER ENGINE ---
            const matchResult = MenuMatcher.findMatch(itemName, items);
            
            // CASE 1: AMBIGUOUS
            if (matchResult.ambiguous) {
                const [opt1, opt2] = matchResult.ambiguous;
                console.log(`🛡️ [MATCHER] Ambiguous request: "${itemName}" -> "${opt1.name}" vs "${opt2.name}"`);
                return `System: Request for "${itemName}" is ambiguous. You MUST ask: "Did you mean ${opt1.name} or ${opt2.name}?" (Do not guess).`;
            }
            
            // CASE 2: NO MATCH (Low Confidence)
            if (!matchResult.match) {
                console.log(`🛡️ [MATCHER] Low confidence for: "${itemName}"`);
                
                // Try Soft Match for Suggestions (The "Malai Kofta" fix)
                const suggestions = MenuMatcher.findSuggestions(itemName, items);
                if (suggestions.length > 0) {
                     const names = suggestions.map(s => s.name).join('" or "');
                     console.log(`💡 [MATCHER] Suggesting: ${names}`);
                     return `System: I couldn't confidently match "${itemName}", but it sounds like "${names}". Ask the user: "Did you mean ${names}?"`;
                }

                return `System: I couldn't confidently match "${itemName}" to a menu item. Please apologize and ask for the item again, or ask if they'd like to hear categories.`;
            }
            
            // CASE 3: MATCH FOUND
            const itemData = matchResult.match;
            
            // --- LAYER C: SAFETY CHECK (The Sentinel Logic) ---
            if (itemData.dietaryTags && itemData.dietaryTags.length > 0) {
                const active = Array.from(activeAllergies);
                const conflict = active.find(allergy => {
                     // Check if any tag matches the allergy (fuzzy match)
                     return itemData.dietaryTags.some(tag => tag.includes(allergy) || allergy.includes(tag));
                });

                if (conflict) {
                     const reason = `Item "${itemData.name}" is tagged with "${conflict}" by our Safety Sentinel.`;
                     console.warn(`🛡️ [SENTINEL] Blocked unsafe item: ${itemData.name}. Reason: ${reason}`);
                     return `System: BLOCKED. You CANNOT add "${itemData.name}" because it contains ${conflict}. Inform the customer immediately.`;
                }
            }
            
            // Legacy Fallback (Optional, but keeping for complete safety net)
            const safetyCheck = validateOrder(itemData.name, Array.from(activeAllergies));
            if (!safetyCheck.safe) {
                console.warn(`🛡️ [SAFETY] Blocked unsafe item: ${itemData.name}. Reason: ${safetyCheck.reason}`);
                return `System: BLOCKED. You CANNOT add "${itemData.name}" because the customer has a declared allergy. ${safetyCheck.reason}. Inform the customer immediately.`;
            }

            console.log(`🛒 Added to Order: ${itemData.name} x${quantity} (Score: ${matchResult.score?.toFixed(2) || 'N/A'})`);
            sessionCart.push({ name: itemData.name, qty: quantity, price: itemData.price, notes: notes || "" });
            return `System: Added ${quantity}x ${itemData.name} to order. Total items in cart: ${sessionCart.length}. IMPORTANT: Read back the item name to confirm: "Okay, ${quantity} ${itemData.name}. Is that correct?"`;
          },
        }),

        logDietaryRestriction: llm.tool({
          description: "Call this IMMEDIATELY when the user mentions an allergy or dietary restriction (e.g. 'I'm allergic to nuts', 'I'm vegan'). This enforces safety checks on all future orders.",
          parameters: {
            type: "object",
            properties: {
              restriction: { type: "string", description: "The specific allergy or diet (e.g. 'nuts', 'diary', 'shellfish', 'gluten', 'vegan')" }
            },
            required: ["restriction"]
          },
          execute: async ({ restriction }) => {
             const normalized = restriction.toLowerCase();
             activeAllergies.add(normalized);
             console.log(`🛡️ [SAFETY] Logged allergy: ${normalized}. Active: ${Array.from(activeAllergies).join(", ")}`);
             return `System: Recorded ${normalized} allergy. Future orders containing this will be blocked automatically. Confirm this with the user: "I've noted your ${normalized} allergy/restriction."`;
          }
        }),

        checkDietaryInfo: llm.tool({
          description: "Check allergens for a specific item using the structural safety map.",
          parameters: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              concern: { type: "string", description: "The allergy or restriction (e.g. nuts, gluten, dairy, vegan)" },
            },
            required: ["itemName"],
          },
          execute: async ({ itemName, concern }) => {
            console.log(`⚠️ [${INSTANCE_ID}] ALLERGY CHECK: ${itemName} for ${concern}`);
            const query = itemName.toLowerCase();
            const restriction = (concern || "").toLowerCase();

            // Match restriction to DIETARY_MAP keys
            let mapKey = null;
            if (restriction.includes("nut")) mapKey = "nuts";
            else if (restriction.includes("dairy") || restriction.includes("milk") || restriction.includes("lactose")) mapKey = "dairy";
            else if (restriction.includes("gluten") || restriction.includes("wheat")) mapKey = "gluten";
            else if (restriction.includes("shell") || restriction.includes("shrimp") || restriction.includes("prawn")) mapKey = "shellfish";
            else if (restriction.includes("vegan") || restriction.includes("vegetarian")) mapKey = "vegan_unfriendly";

            if (mapKey) {
              const highRiskItems = DIETARY_MAP[mapKey];
              const isMatch = highRiskItems.some(risk => query.includes(risk));
              if (isMatch) {
                return `WARNING: "${itemName}" is NOT safe for customers with ${concern} restrictions because it typically contains ingredients like ${query}. Please inform the customer and suggest an alternative.`;
              }
            }

            return `System: No direct match found in safety map for "${itemName}" regarding ${concern}. Advise the customer: "I will mark this clearly for the kitchen team as a ${concern} restriction to ensure they take extra precautions during preparation."`;
          },
        }),

        confirmOrder: llm.tool({
          description: "IMMEDIATELY CALL THIS FUNCTION when the user confirms their order (says 'yes', 'correct', 'that's right'). DO NOT just say you're finalizing - CALL THIS NOW.",
          parameters: { type: "object", properties: {} },
          execute: async () => {
             // 1. Guard Clause: Prevent empty orders
             if (sessionCart.length === 0) {
               console.warn(`⚠️ [${INSTANCE_ID}] confirmOrder called with empty cart. Rejection sent.`);
               return "System: The cart is empty. You cannot verify or place an order. Ask the user what they would like to order first.";
             }

            const itemCount = sessionCart.reduce((acc, item) => acc + item.qty, 0);
            const totalCents = sessionCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            
            // 1. Create order in Clover POS
            let cloverOrderId = null;
            try {
              const cloverOrder = await createCloverOrder(
                sessionCart,
                customerDetails.name,
                customerDetails.phone,
                restaurantConfig.clover // Use restaurant-specific credentials from DB
              );
              cloverOrderId = cloverOrder.id;
              console.log(`✅ [${INSTANCE_ID}] Clover order created: ${cloverOrderId}`);
              
              // Auto-print to kitchen if enabled
              if (restaurantConfig.printing?.autoPrint !== false) {
                try {
                  await printOrderToKitchen(cloverOrderId, restaurantConfig, sessionCart);
                  console.log(`🖨️  [${INSTANCE_ID}] Order sent to kitchen printer`);
                } catch (printErr) {
                  console.error(`⚠️  [${INSTANCE_ID}] Print failed (non-critical): ${printErr.message}`);
                  // Don't block order completion - printing is optional
                }
              }
            } catch (err) {
              console.error(`⚠️  [${INSTANCE_ID}] Clover order failed:`, err);
              console.error(`   Error message: ${err.message}`);
              console.error(`   Error stack: ${err.stack}`);
              console.error(`   Credentials check:`, {
                hasApiKey: !!restaurantConfig.clover?.apiKey,
                hasMerchantId: !!restaurantConfig.clover?.merchantId,
                merchantId: restaurantConfig.clover?.merchantId
              });
              // Continue anyway - order will still show in our dashboard
            }
            
            // 2. Persist to our Database
            try {
              const PORT = process.env.PORT || 3000;
              await fetch(`http://localhost:${PORT}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customerName: customerDetails.name,
                  customerPhone: customerDetails.phone,
                  items: sessionCart,
                  totalAmount: totalCents,
                  cloverOrderId, // Store Clover reference
                  restaurantId: restaurantConfig.id // Multi-tenant link
                })
              });
              console.log(`💾 [${INSTANCE_ID}] Order persisted to DB.`);
            } catch (err) {
              console.error(`❌ [${INSTANCE_ID}] Failed to persist order:`, err.message);
            }

            // 3. Send SMS Confirmation
            await sendOrderConfirmation(customerDetails.phone, restaurantConfig.name, sessionCart, totalCents);
            
            return `System: Order submitted to Kitchen for ${redact(customerDetails.name)}. Total items: ${itemCount}. You should now say: "Your order is in! I just sent a confirmation text to your phone. We'll let you know when it's ready. Thank you for choosing us!" then use 'hangUp'.`;
          }
        }),

        hangUp: llm.tool({
          description: "End the call gracefully.",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            console.log(`🔌 [${INSTANCE_ID}] 'hangUp' tool triggered. saving state...`);
            
            // CRITICAL: Save state BEFORE disconnecting using the callback passed from entrypoint
            if (finalizeCallback) { // Accessing from constructor argument scope is safer
                try {
                    await finalizeCallback("Agent Triggered Hangup");
                } catch (err) {
                    console.error(`⚠️ [${INSTANCE_ID}] Finalize callback failed in hangUp:`, err);
                }
            }

            if (activeRoom) {
                // Add a small delay to allow TTS "Goodbye" to flush if possible
                setTimeout(() => {
                    console.log(`🔌 [${INSTANCE_ID}] Disconnecting room now.`);
                    activeRoom.disconnect();
                }, 1500);
            }
            return "System: Hanging up call. Say goodbye first.";
          },
        }),

        transferToHuman: llm.tool({
            description: "Use this tool to physically transfer the call to a human agent. You MUST call this tool if you say you are transferring. Do NOT just say you will transfer. Execute this tool.",
            parameters: { type: "object", properties: { reason: { type: "string" } } },
            execute: async ({ reason }) => {
                // Fix: Prioritize 'transferPhoneNumber' (DB) -> 'phoneNumber' (API Identity) -> 'phone'
                const targetPhone = restaurantConfig.transferPhoneNumber || restaurantConfig.phoneNumber || restaurantConfig.phone; 
                
                console.log(`📡 [${INSTANCE_ID}] Transfer Tool Triggered. Config Phone: ${targetPhone}`);

                if (!targetPhone) {
                    return "System: Cannot transfer - no phone number configured for this restaurant. Apologize to the user.";
                }

                console.log(`📡 [${INSTANCE_ID}] Initiating Transfer to ${targetPhone}. Reason: ${reason}`);

                // Call the API to trigger SIP REFER
                try {
                     // We need the database Call ID. 
                     // Assuming 'callRecord' has the ID from the initialization step.
                     const callId = callRecord?.id;
                     
                     if (!callId) {
                         console.error(`❌ [${INSTANCE_ID}] Transfer failed: Missing Call ID`);
                         return "System: Technical error: Cannot find active call record to transfer. Apologize.";
                     }

                     // Fix for Fly.io: Agent runs in separate VM, so localhost doesn't reach API.
                     // Use NEXT_PUBLIC_API_URL if available (Prod), else localhost (Local Dev).
                     const API_BASE = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3001}`;
                     
                     console.log(`🔗 [${INSTANCE_ID}] Calling Transfer API at: ${API_BASE}/api/calls/${callId}/transfer`);
                     
                     const response = await fetch(`${API_BASE}/api/calls/${callId}/transfer`, {
                         method: "POST",
                         headers: { "Content-Type": "application/json" },
                         body: JSON.stringify({ staffPhone: targetPhone })
                     });

                     if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`API Error ${response.status}: ${errText}`);
                     }

                     return "System: Transfer initiated. Tell the user: 'I play classical music while I transfer you to a manager. Please hold.' then wait.";
                } catch (err) {
                    console.error(`❌ [${INSTANCE_ID}] Transfer API failed:`, err);
                    return "System: Unable to transfer due to technical error. Apologize.";
                }
            }
        }),
    };
}
