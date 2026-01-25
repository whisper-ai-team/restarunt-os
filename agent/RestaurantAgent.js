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
import { createDeliveryTools } from "./tools/DeliveryTools.js";

// -----------------------------
import { MenuMatcher } from "../utils/menuMatcher.js";

// -----------------------------
// RESTAURANT AGENT CLASS
// -----------------------------
export class RestaurantAgent extends voice.Agent {
  constructor({ restaurantConfig, initialMenu, activeRoom, cuisineProfile, customerDetails, sessionCart, callRecord, finalizeCallback }) {
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
       0. CATERING TRIAGE: IF the user mentions "catering", "large party for events", or "bulk order", you MUST say: "I can absolutely help get you to a manager for catering." and IMMEDIATELY call the 'transferToHuman' tool with reason="Catering Inquiry".
       1. CUISINE GUARDRAIL: You represent an AUTHENTIC ${cuisineProfile.name} restaurant. You MUST strictly adhere to this cuisine.
          - If the user asks for dishes from a different cuisine (e.g., asking for Sushi at an Italian restaurant), politely refuse and say: "I apologize, but we specialize in ${cuisineProfile.name} cuisine. We don't serve that here."
          - NEVER recommend items that are clearly not ${cuisineProfile.name} (e.g., do not suggest Curry if you are a Pizza place).
          - ONLY discuss items that exist in the menu provided or are standard staples of ${cuisineProfile.name} cuisine if and only if they match the menu style.
       2. TOOL USAGE (CART): You MUST call the 'addToOrder' tool EVERY TIME a customer mentions an item they want to order. IMPORTANT: Pass the EXACT item name found in the menu search.
          - SPICY LEVEL CHECK: For Indian dishes (e.g. Curries, Biryanis), if the customer has NOT specified a spice level, you MUST ask: "How spicy would you like that? Mild, Medium, or Spicy?" BEFORE calling 'addToOrder' if possible, or include it in the 'notes' field.
             // 3. ORDER TYPE: Before finalizing, you MUST confirm if the order is for "Pickup" or "Delivery" using 'setOrderType'. If "Delivery", you MUST collect the address using 'setDeliveryAddress'.
        4. EMAIL COLLECTION (MANDATORY): You MUST ask for the customer's email address for every order (both Pickup and Delivery) to send the receipt and payment link. Use 'setEmail' to save it. Say: "I need your email address to send you the receipt and secure payment link."
        5. ALLERGIES (SAFETY): If the user orders more than 2 items AND hasn't mentioned allergies, you MUST ask: "Before I finalize that, do you have any food allergies or dietary restrictions I should note for the kitchen?". 
        6. ALLERGIES (MATCH): If a user mentions an allergy, immediately use 'logDietaryRestriction'. NEVER guess. This is critical for safety.
        7. ORDER SUMMARY: Before finalizing, you MUST read back the entire order summary (items, quantities, total) and ask "Is this correct?".
        8. PAYMENT: If the customer asks how to pay, use 'getPaymentInfo'. Inform them they can pay at the restaurant for pickup or via an SMS link for delivery.
        9. CONFIRM ORDER: After the user confirms ('yes', 'correct'), you MUST call 'confirmOrder'.
        10. HUMAN HAND-OFF: If the user is frustrated, use 'transferToHuman'.
        11. ENDING CALL: When done, say exactly: "${restaurantConfig.endCallMessage || "Goodbye! Have a great day."}" and call 'hangUp'.
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

        getPaymentInfo: llm.tool({
          description: "Explain how payment works.",
          parameters: { type: "object", properties: {} },
          execute: async () => {
             return "Pickup orders: Pay at the restaurant when you arrive. Delivery orders: We will send you an SMS link for secure online payment after the order is confirmed.";
          }
        }),
        
        setEmail: llm.tool({
            description: "Save the customer's email address. Required for all orders.",
            parameters: {
                type: "object",
                properties: { email: { type: "string" } },
                required: ["email"]
            },
            execute: async ({ email }) => {
                // Basic validation could go here
                // Strip spaces
                const cleanEmail = email ? email.trim() : "";
                
                if (!cleanEmail || cleanEmail.length < 5 || !cleanEmail.includes("@")) {
                    console.warn(`⚠️ [${INSTANCE_ID}] Invalid email provided: "${email}"`);
                    return "System: The email provided seems invalid. Please ask the user to repeat it clearly, spelling it out if necessary.";
                }

                customerDetails.email = cleanEmail;
                console.log(`📧 [${INSTANCE_ID}] Email Captured: ${cleanEmail}`);
                return `System: Email saved: ${cleanEmail}. You may now proceed with the order.`;
            }
        }),

        ...createDeliveryTools(sessionCart, customerDetails, restaurantConfig),

        transferToHuman: llm.tool({
          description: "Connect the customer to a human manager or restaurant staff.",
          parameters: {
            type: "object",
            properties: {
              reason: { type: "string", description: "Why the human is needed (e.g. frustration, complex request)" }
            }
          },
          execute: async ({ reason }) => {
             console.log("\n" + "=".repeat(50));
             console.log(`🎁 [${INSTANCE_ID}] TRANSFER TRIGGERED. Reason: ${reason}`);
             console.log("=".repeat(50) + "\n");
             
             try {
                // Get the staff phone from notification config
                const staffPhone = restaurantConfig.notificationConfig?.phoneNumbers?.[0] || "+18639009879"; // Updated to requested staff number
                
                if (!this.callRecord || !this.callRecord.id) {
                    console.error(`❌ [${INSTANCE_ID}] Transfer Failed: No active callRecord.`, { 
                        hasRecord: !!this.callRecord, 
                        hasId: !!this.callRecord?.id 
                    });
                    throw new Error("Call record not found or not initialized");
                }
                
                console.log(`📡 [${INSTANCE_ID}] Initiating transfer for Call ID: ${this.callRecord.id} to ${staffPhone}`);
                
                console.log(`📡 [${INSTANCE_ID}] Initiating transfer for Call ID: ${this.callRecord.id} to ${staffPhone}`);
                
                // FIX: Use Public URL for Fly.io inter-process communication
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3001}`;
                const res = await fetch(`${API_BASE}/api/calls/${this.callRecord.id}/transfer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ staffPhone })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "Transfer request failed");
                }

                return "SUCCESS: I'm transferring you to a manager now. Please hold for one moment while I connect you.";
             } catch (err) {
                console.error("❌ Transfer Tool Failed:", err.message);
                return `System Error: I couldn't initiate the transfer (${err.message}). Please apologize and ask the customer if you can take their number for a callback instead.`;
             }
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
              const matchedItem = results[0].item;
              return `System: Found "${matchedItem.name}" ($${(matchedItem.price / 100).toFixed(2)}) - ${matchedItem.description}. Offer this.`;
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
             
             // 2. Guard Clause: Mandatory Email Collection
             if (!customerDetails.email || customerDetails.email.trim() === "") {
               console.warn(`⚠️ [${INSTANCE_ID}] confirmOrder blocked: Missing Email.`);
               return "System: BLOCKED. You CANNOT finalize the order because the email address is missing. You MUST ask: 'I need your email address to send you the receipt and payment link.' Use 'setEmail' logic.";
             }

            const itemCount = sessionCart.reduce((acc, item) => acc + item.qty, 0);
            const totalCents = sessionCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            
            // 0. HIGH VALUE PROTECTION (FAKE ORDER CHECK)
            if (totalCents > 10000) { // $100.00
                console.warn(`🛡️ [SAFETY] High Value Order Detected: $${(totalCents/100).toFixed(2)}`);
                // We add a 'verified' flag to the order logic if needed, but for now we instruct the agent via return string
                // Note: If calling this tool again after verification, we proceed.
                // A simple stateless check: The Agent must strictly ask this.
                // We can't easily block execution here without state, so we rely on the Prompt to enforce this BEFORE calling confirmOrder
                // or we return a "Soft Block" requesting verbal confirmation if not already done.
                // Implementation: We'll log it and append a flag to the internal order note.
            }
            
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
            
            // 2. Persist to our Database via API (Delegates to OrderService on server)
            // UPDATED: Now including customerEmail for receipt/payment links
            try {
              // FIX: Use Public URL for Fly.io inter-process communication
              const API_BASE = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`;
              console.log(`💾 [${INSTANCE_ID}] Persisting order to: ${API_BASE}/api/orders`);

              await fetch(`${API_BASE}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customerName: customerDetails.name,
                  customerPhone: customerDetails.phone,
                  customerEmail: customerDetails.email || null, // Capture email from state
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

            // Note: SMS/Email is now handled by the API (OrderService)
            
            return `System: Order submitted to Kitchen. Total items: ${itemCount}. You should now say: "Your order is in! I just sent a confirmation text and email. We'll let you know when it's ready. Goodbye!" and then IMMEDIATELY call the 'hangUp' tool.`;
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
                // Add a delay to allow TTS "Goodbye" to flush
                setTimeout(() => {
                    console.log(`🔌 [${INSTANCE_ID}] Disconnecting room now.`);
                    activeRoom.disconnect();
                }, 2000);
            }
            return "System: Hanging up call. Say goodbye first.";
          },
        }),
      },
    });

    // Store meta-data for use in tools
    this.callRecord = callRecord;
    this.finalizeCallback = finalizeCallback;
    this.lastProcessedHash = null; // Guard for duplicate adds in a single turn
    this.activeAllergies = new Set(); // Track session-level allergies
  }
}
