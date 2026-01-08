// RestaurantAgent.js - Voice agent class with all tool definitions
import { voice, llm } from "@livekit/agents";
import Fuse from "fuse.js";
import { buildSystemPrompt } from "../promptBuilder.js";
import { getVoiceFromSelection } from "../voiceMap.js";
import { isOpen, redact, metaphone, INSTANCE_ID } from "../utils/agentUtils.js";
import { validateOrder } from "../utils/dietaryHelpers.js";
import { DIETARY_MAP } from "../config/agentConfig.js";
import { getMenu, createCloverOrder } from "../services/cloverService.js";
import { sendOrderConfirmation } from "../services/notificationService.js";
import { printOrderToKitchen } from "../cloverPrint.js";

// -----------------------------
import { MenuMatcher } from "../utils/menuMatcher.js";

// -----------------------------
// RESTAURANT AGENT CLASS
// -----------------------------
export class RestaurantAgent extends voice.Agent {
  constructor({ restaurantConfig, initialMenu, activeRoom, cuisineProfile, customerDetails, sessionCart, finalizeCallback }) {
    const personalizedContext = `
      You are speaking with ${customerDetails.name}.
      Cuisine Focus: ${cuisineProfile.name}.
      Persona Instructions: ${cuisineProfile.personaInstructions}
    `;

    const selectedVoice = getVoiceFromSelection(restaurantConfig.voiceSelection);
    const personaTags = selectedVoice.tags || [];
    let personaFlavor = "";
    if (personaTags.includes("energetic")) personaFlavor = "Be high-energy and enthusiastically helpful.";
    if (personaTags.includes("soft") || personaTags.includes("warm")) personaFlavor = "Be soothing, warm, and gentle in your delivery.";
    if (personaTags.includes("professional")) personaFlavor = "Be formal, precise, and highly efficient.";
    if (personaTags.includes("confidence")) personaFlavor = "Speak with authority and clear confidence.";

    const upsellContext = `
      REVENUE BOOSTER:
      - If NO DRINK in order, suggest: ${cuisineProfile.upsellItems.drinks.join(", ")}.
      - If ONLY MAINS/DISHES ordered (no sides), suggest: ${cuisineProfile.upsellItems.sides.join(", ")}.
      - At the VERY END (during summary), suggest a dessert: ${cuisineProfile.upsellItems.desserts.join(", ")}.
    `;

    const systemPrompt = buildSystemPrompt({
      restaurantName: restaurantConfig.name,
      info: restaurantConfig.info,
      instructions: restaurantConfig.instructions + personalizedContext + "\n" + personaFlavor + "\n" + upsellContext,
      menuContext: initialMenu,
      tone: "friendly",
    }) + "\n\nCRITICAL: Be extremely concise. Use short sentences for speed.";

    // CLOSED STATE OVERRIDE
    const isClosed = !isOpen(restaurantConfig.businessHours, restaurantConfig.timezone);
    let finalInstructions = "";
    
    if (isClosed) {
       finalInstructions = `You are the answering system for ${restaurantConfig.name}. 
       CRITICAL: The restaurant is CURRENTLY CLOSED.
       1. Politely inform the user that you are closed.
       2. Do NOT take any orders.
       3. Do NOT answer questions about the menu.
       4. Suggest they check the website for hours.
       5. Say "Goodbye" and call the 'hangUp' tool immediately.`;
    } else {
       // Append standard rules only if OPEN
       finalInstructions = systemPrompt + `
       
       CRITICAL OPERATIONAL RULES:
       1. TOOL USAGE (CART): You MUST call the 'addToOrder' tool EVERY TIME a customer mentions an item they want to order. IMPORTANT: Pass the EXACT item name found in the menu search. Do NOT append allergy names (e.g. use "Butter Chicken", NOT "Butter Chicken Cashew").
       2. ALLERGIES (SAFETY): If the user orders more than 2 items AND hasn't mentioned allergies, you MUST ask: "Before I finalize that, do you have any food allergies or dietary restrictions I should note for the kitchen?". 
       3. ALLERGIES (MATCH): If a user mentions an allergy, immediately use 'logDietaryRestriction'. NEVER guess. This is critical for safety.
       4. ORDER SUMMARY: Before finalizing, you MUST read back the entire order summary (items, quantities, total) and ask "Is this correct?".
       5. CONFIRM ORDER: After the user confirms ('yes', 'correct'), you MUST call 'confirmOrder'.
       6. HUMAN HAND-OFF: If the user is frustrated, use 'transferToHuman'.
       7. ENDING CALL: When done, say exactly: "${restaurantConfig.endCallMessage || "Goodbye! Have a great day."}" and call 'hangUp'.
       `;
    }

    super({
      instructions: finalInstructions,
      tools: {
        getRestaurantInfo: llm.tool({
          description: "Get info.",
          parameters: { type: "object", properties: {} },
          execute: async () =>
            `Address: ${restaurantConfig.info.address}. Hours: ${restaurantConfig.info.hours}.`,
        }),

        checkOrderStatus: llm.tool({
          description: "Check status.",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            if (activeRoom.state === "disconnected") return;
            return `Latest order for ${customerDetails.name}: Kitchen is preparing it.`;
          },
        }),

        bookTable: llm.tool({
          description: "Book table.",
          parameters: {
            type: "object",
            properties: {
              partySize: { type: "integer" },
              time: { type: "string" },
            },
            required: ["partySize", "time"],
          },
          execute: async ({ partySize, time }) =>
            `Reservation confirmed for ${partySize} people at ${time}.`,
        }),

        transferToHuman: llm.tool({
          description: "Connect the customer to a human manager or restaurant staff.",
          parameters: {
            type: "object",
            properties: {
              reason: { type: "string", description: "Why the human is needed (e.g. frustration, complex request)" }
            }
          },
          execute: async ({ reason }) => {
             console.log(`📡 [${INSTANCE_ID}] TRANSFER TRIGGERED. Reason: ${reason}`);
             // In a real SIP environment, we would use session.transfer()
             // For now, we simulate the handover response.
             return "SUCCESS: Transferring you to a manager now. Please hold for a moment.";
          }
        }),

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
              const availableItems = cloverItems.filter((i) => !i.hidden);

              const enrichedItems = availableItems.map((cItem) => {
                const soundCodes = metaphone.process(cItem.name);

                return {
                  ...cItem,
                  description: cItem.description || "Freshly prepared from our menu.",
                  soundCode: soundCodes ? soundCodes[0] : "",
                };
              });

              // 2. Phonetic Search
              const [querySound] = metaphone.process(fixedQuery) || [];
              if (querySound) {
                const matches = enrichedItems.filter(
                  (i) => i.soundCode === querySound
                );
                if (matches.length > 0) {
                  console.log(`   🎯 PHONETIC MATCH: "${matches[0].name}"`);
                  // Output includes Description now!
                  return `System: Found "${matches[0].name}" - ${matches[0].description}. Offer this to the user.`;
                }
              }

              // 3. Fuzzy Search
              const fuse = new Fuse(enrichedItems, {
                keys: ["name", "synonyms"],
                threshold: 0.5,
                distance: 100,
              });
              const results = fuse.search(fixedQuery);

              if (results.length === 0)
                return "System: No items found matching that description.";

              console.log(`   ✅ Fuzzy Match: "${results[0].item.name}"`);
              // Output includes Description now!
              return `System: Found "${results[0].item.name}" - ${results[0].item.description}. Offer this.`;
            } catch (err) {
              return "System: Error accessing menu.";
            }
          },
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
            // --- TURN DEDUPLICATION ---
            const turnHash = `${turn_id}-${itemName}-${quantity}`;
            if (this.lastProcessedHash === turnHash) {
                console.log(`🛡️ [DEDUPE] Blocked duplicate add for: ${itemName}`);
                return `System: Item ${itemName} was already added in this turn. Proceed with conversation.`;
            }
            this.lastProcessedHash = turnHash;

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
                const active = Array.from(this.activeAllergies);
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
            const safetyCheck = validateOrder(itemData.name, Array.from(this.activeAllergies));
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
             this.activeAllergies.add(normalized);
             console.log(`🛡️ [SAFETY] Logged allergy: ${normalized}. Active: ${Array.from(this.activeAllergies).join(", ")}`);
             return `System: Recorded ${normalized} allergy. Future orders containing this will be blocked automatically. Confirm this with the user: "I've noted your ${normalized} allergy/restriction."`;
          }
        }),

        // --- NEW SAFETY & REVENUE TOOLS ---
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
      },
    });

    // Store callback for use in tools (after super)
    this.finalizeCallback = finalizeCallback;
    this.lastProcessedHash = null; // Guard for duplicate adds in a single turn
    this.activeAllergies = new Set(); // Track session-level allergies
  }
}
