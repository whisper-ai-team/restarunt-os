// agent.js
require("dotenv").config();

const livekit = require("@livekit/agents");
const {
  defineAgent,
  cli,
  WorkerOptions,
  initializeLogger,
  voice,
  runWithJobContextAsync,
  llm,
} = livekit;

const openai = require("@livekit/agents-plugin-openai");
const deepgram = require("@livekit/agents-plugin-deepgram");
const elevenlabs = require("@livekit/agents-plugin-elevenlabs");
const silero = require("@livekit/agents-plugin-silero");

// -----------------------------
// 1. CONFIGURATION & STATE
// -----------------------------
const CONFIG = {
  cloverApiKey: process.env.CLOVER_API_KEY,
  cloverMerchantId: process.env.CLOVER_MERCHANT_ID,
  cloverBaseUrl:
    process.env.CLOVER_BASE_URL || "https://apisandbox.dev.clover.com",
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhone: process.env.TWILIO_PHONE_NUMBER,
  menuCacheTtl: 10 * 60 * 1000, // 10 Minutes Cache
};

// Global State
let menuCache = {
  items: [],
  nameToItem: {},
  lastFetch: 0,
};

// -----------------------------
// 2. HELPERS (Formatting & SMS)
// -----------------------------
function formatCurrency(cents) {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

// Converts 2550 -> "25 dollars and 50 cents" for clear TTS
function formatCurrencyForSpeech(cents) {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "0 dollars";
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  if (remainder === 0) return `${dollars} dollars`;
  return `${dollars} dollars and ${remainder} cents`;
}

function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/^sip:/, "").replace(/\D/g, "");
}

// SMS Sender (Uses standard Fetch to avoid extra dependencies)
async function sendSms(to, body) {
  if (!CONFIG.twilioSid || !CONFIG.twilioToken || !CONFIG.twilioPhone) {
    console.warn("⚠️ SMS Skipped: Missing Twilio Credentials");
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${CONFIG.twilioSid}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: CONFIG.twilioPhone,
    Body: body,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${CONFIG.twilioSid}:${CONFIG.twilioToken}`).toString(
            "base64"
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (res.ok) console.log(`✅ SMS Sent to ${to}`);
    else console.error(`❌ SMS Failed: ${await res.text()}`);
  } catch (err) {
    console.error("❌ SMS Network Error:", err);
  }
}

// -----------------------------
// 3. CLOVER SERVICE (With Caching)
// -----------------------------
async function cloverRequest(path, { method = "GET", body } = {}) {
  if (!CONFIG.cloverApiKey || !CONFIG.cloverMerchantId) {
    throw new Error("Missing Clover credentials");
  }

  const url = `${CONFIG.cloverBaseUrl}/v3/merchants/${CONFIG.cloverMerchantId}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${CONFIG.cloverApiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Clover error ${res.status}: ${text}`);
  }
  return res.json();
}

// Smart Menu Fetcher (Implements "Real-Time Sync")
async function getMenu() {
  const now = Date.now();
  // Check Cache Validity
  if (
    menuCache.items.length > 0 &&
    now - menuCache.lastFetch < CONFIG.menuCacheTtl
  ) {
    return menuCache;
  }

  console.log("🔄 Refreshing Menu from Clover API...");
  try {
    const data = await cloverRequest("/items?limit=1000"); // Adjust limit as needed
    const items = data.elements || [];
    const nameToItem = {};

    for (const item of items) {
      if (!item.name || !item.id) continue;
      // We could filter out "hidden" items here if Clover provides that flag
      const key = item.name.trim().toLowerCase();
      nameToItem[key] = {
        id: item.id,
        name: item.name,
        price: typeof item.price === "number" ? item.price : 0,
      };
    }

    menuCache = { items, nameToItem, lastFetch: now };
    console.log(`✅ Menu Refreshed: ${items.length} items.`);
    return menuCache;
  } catch (err) {
    console.error("❌ Menu Fetch Failed:", err);
    return menuCache; // Return old cache if fail
  }
}

// -----------------------------
// 4. ORDER LOGIC (Kitchen Printer Optimized)
// -----------------------------
async function createOrder({ items, note, orderType, phoneNumber }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("No items");
  const { nameToItem } = await getMenu();

  // Create Header Note
  const noteParts = [];
  if (orderType) noteParts.push(`Type: ${orderType}`);
  if (note) noteParts.push(`Note: ${note}`);
  if (phoneNumber) noteParts.push(`Phone: ${phoneNumber}`);
  const headerNote = noteParts.join(" | ");

  // 1. Create Open Order
  const order = await cloverRequest("/orders", {
    method: "POST",
    body: { state: "open", title: headerNote },
  });

  const unmatched = [];
  let totalCents = 0;
  const orderSummaryLines = []; // For SMS

  // 2. Map Items & Format for Kitchen Printer
  const bulkLineItems = {
    items: items.map((it) => {
      const rawName = (it.name || "").trim();
      const key = rawName.toLowerCase();
      const qty = it.quantity || 1;
      const mods = it.modifications || ""; // e.g. "Spicy, Extra Sauce"

      const inv = nameToItem[key];

      // STRATEGY: Append mods to name so cook SEES it.
      // e.g. "Chicken Biryani" -> "Chicken Biryani **[Spicy]**"
      const kitchenFriendlyName = mods ? `${rawName} **[${mods}]**` : rawName;

      orderSummaryLines.push(`${qty}x ${kitchenFriendlyName}`);

      if (inv && inv.id) {
        totalCents += inv.price * qty;
        return {
          item: { id: inv.id },
          name: kitchenFriendlyName, // Send modified name to Clover
          price: inv.price,
          unitQty: qty,
        };
      }

      unmatched.push({ name: rawName, qty });
      return { name: kitchenFriendlyName, price: 0, unitQty: qty };
    }),
  };

  // 3. Add Lines
  await cloverRequest(`/orders/${order.id}/bulk_line_items`, {
    method: "POST",
    body: bulkLineItems,
  });

  // 4. Update Total
  await cloverRequest(`/orders/${order.id}`, {
    method: "POST",
    body: { total: totalCents },
  });

  // 5. Send SMS Confirmation (Trust Layer)
  if (phoneNumber) {
    const smsBody = `Bawarchi Biryanis: Order Confirmed!\n\n${orderSummaryLines.join(
      "\n"
    )}\n\nTotal: ${formatCurrency(totalCents)}\nPickup in ~20 mins.`;
    // Fire and forget (don't await)
    sendSms(phoneNumber, smsBody);
  }

  return { order, totalCents };
}

// -----------------------------
// 5. AGENT DEFINITION
// -----------------------------
initializeLogger({ level: "info", destination: "stdout" });

class RestaurantAgent extends voice.Agent {
  constructor({ restaurantName, systemPrompt, initialMenu, activeRoom }) {
    super({
      instructions: `
        You are the efficient, polite, and Indian-accented front-desk AI for ${restaurantName}.

        **CORE BEHAVIOR**
        - Keep answers short (1–2 sentences max).
        - Wait patiently if the user pauses.

        **SMART MENU SEARCH**
        - You have a list of "Popular Items" in your context.
        - IF the user asks for something NOT in that list, use the \`searchMenu\` tool to check our full database.
        - IF \`searchMenu\` returns nothing, apologize and say we don't have it.

        **ORDERING RULES**
        - Always ask for **Spice Level** (Mild/Med/Spicy) for Biryanis/Curries.
        - Always ask for **Quantity**.
        - When calling \`createCloverOrder\`, put the Spice Level in the 'modifications' field for that item.

        **ENDING THE CALL**
        - When \`createCloverOrder\` returns success:
        1. Read the "Speech Total" clearly.
        2. Say: "Order confirmed! Check your texts for a receipt. Thank you, Goodbye!"
        3. **IMMEDIATELY** call the \`hangUp\` tool.

        **SYSTEM CONTEXT**
        ${systemPrompt}

        **POPULAR ITEMS (Use searchMenu for others)**
        ${initialMenu}
      `,
      tools: {
        // 🔍 NEW TOOL: Smart Menu Search
        searchMenu: llm.tool({
          description:
            "Search the full menu database for specific items (e.g. 'goat', 'kheer').",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
          execute: async ({ query }) => {
            const { items } = await getMenu();
            const q = query.toLowerCase();
            // Simple fuzzy match
            const matches = items
              .filter((i) => i.name.toLowerCase().includes(q))
              .slice(0, 10); // Limit to top 10 results

            if (matches.length === 0) return "No items found.";
            return matches
              .map((m) => `${m.name} ($${(m.price / 100).toFixed(2)})`)
              .join("\n");
          },
        }),

        createCloverOrder: llm.tool({
          description: "Place order. REQUIRED: items, phoneNumber.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Exact item name" },
                    quantity: { type: "integer" },
                    modifications: {
                      type: "string",
                      description: "e.g. 'Spicy', 'No Onion'",
                    },
                  },
                  required: ["name"],
                },
              },
              note: { type: "string" },
              orderType: { type: "string", enum: ["pickup", "delivery"] },
              phoneNumber: { type: "string" },
            },
            required: ["items", "phoneNumber"],
          },
          execute: async ({ items, note, orderType, phoneNumber }) => {
            try {
              const { order, totalCents } = await createOrder({
                items,
                note,
                orderType: orderType || "pickup",
                phoneNumber,
              });

              const speechTotal = formatCurrencyForSpeech(totalCents);
              return `SUCCESS. Total: ${speechTotal}. SMS Sent. 
              INSTRUCTION: Say "Order confirmed! Your total is ${speechTotal}. Check your texts. Goodbye!" then hang up.`;
            } catch (err) {
              return { success: false, error: err.message };
            }
          },
        }),

        hangUp: llm.tool({
          description: "Call this IMMEDIATELY after saying Goodbye.",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            console.log("✂️ HangUp requested.");
            if (activeRoom) {
              setTimeout(() => {
                console.log("📞 DISCONNECTING.");
                activeRoom.disconnect();
              }, 4000); // 4s buffer for TTS
            }
            return "Ending call...";
          },
        }),
      },
    });
  }
}

// -----------------------------
// 6. MAIN ENTRY
// -----------------------------
const agent = defineAgent({
  name: "restaurant-os-agent",

  entry: async (ctx) => {
    console.log("🔌 Connecting...");
    await ctx.connect();

    let config = {};
    try {
      config = JSON.parse(ctx.job.metadata || "{}");
    } catch (e) {}
    const restaurantName = config.restaurantName || "Bawarchi Biryanis";
    const systemPrompt = config.systemPrompt || "You are a helpful assistant.";

    // Load Menu (Initial Popular List)
    let initialMenu = "Loading...";
    try {
      const { items } = await getMenu();
      // Only show top 20 items in initial context to save tokens/confusion
      initialMenu = items
        .slice(0, 20)
        .map((i) => `- ${i.name}`)
        .join("\n");
      initialMenu += "\n\n(Use searchMenu tool to find other items)";
    } catch (e) {
      initialMenu = "Menu unavailable.";
    }

    const participant = await ctx.waitForParticipant();

    // Normalization logic for phone number
    let callerPhone = normalizePhone(participant.identity);
    // If SIP returns "1234567890", assume US and add +1 for Twilio
    if (callerPhone.length === 10) callerPhone = `+1${callerPhone}`;
    else if (callerPhone.length > 10 && !callerPhone.startsWith("+"))
      callerPhone = `+${callerPhone}`;

    const restaurantAgent = new RestaurantAgent({
      restaurantName,
      systemPrompt,
      initialMenu,
      activeRoom: ctx.room,
    });

    // VAD Tuning (Patient)
    const vad = await silero.VAD.load({
      minSpeechDuration: 0.1,
      minSilenceDuration: 1.0,
      threshold: 0.5,
    });

    const session = new voice.AgentSession({
      vad,
      // Fix: Keywords removed to prevent crash
      stt: new deepgram.STT({ model: "nova-3" }),
      llm: new openai.LLM({ model: "gpt-4o-mini" }),
      // Feature: High Quality Indian Voice
      tts: new elevenlabs.TTS({
        modelID: "eleven_multilingual_v2",
        voice: { id: "6BZyx2XekeeXOkTVn8un", name: "Naina" },
      }),
    });

    session.on("error", (err) => console.error("🔥 Session Error:", err));

    try {
      await runWithJobContextAsync(ctx, async () => {
        await session.start({ agent: restaurantAgent, room: ctx.room });
        await session.generateReply({
          instructions: `Greet cheerfully with "Namaste" from ${restaurantName}.`,
        });

        await new Promise((resolve) => ctx.room.on("disconnected", resolve));
      });
    } catch (err) {
      console.error("❌ Fatal Error:", err);
    }
  },
});

if (require.main === module) {
  cli.runApp(new WorkerOptions({ agent: __filename }));
}

module.exports = agent;
