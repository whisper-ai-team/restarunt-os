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
  llm, // for tools
} = livekit;

// Plugin imports
const openai = require("@livekit/agents-plugin-openai");
const deepgram = require("@livekit/agents-plugin-deepgram");
const elevenlabs = require("@livekit/agents-plugin-elevenlabs");

// -----------------------------
// Clover config & helper
// -----------------------------
const CLOVER_API_KEY = process.env.CLOVER_API_KEY;
const CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;
const CLOVER_BASE_URL =
  process.env.CLOVER_BASE_URL || "https://apisandbox.dev.clover.com";

// We will NOT send orderType to Clover for now (it caused 400),
// we just put it into the note/title for the kitchen.
let cloverInventoryCache = null; // { items, nameToId }

// Minimal fetch using Node 18+ global fetch
async function cloverRequest(path, { method = "GET", body } = {}) {
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Missing Clover credentials in env");
  }

  const url = `${CLOVER_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${CLOVER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Clover error ${res.status}: ${text || res.statusText || "unknown"}`
    );
  }

  return res.json();
}

// Load Clover items once and cache: both list + name->id map
// Load Clover items once and cache: both list + name->item map
async function getCloverInventory() {
  if (cloverInventoryCache) return cloverInventoryCache;

  const data = await cloverRequest("/items?limit=1000");
  const items = data.elements || [];
  const nameToItem = {};

  for (const item of items) {
    if (!item.name || !item.id) continue;
    const key = item.name.trim().toLowerCase();
    nameToItem[key] = {
      id: item.id,
      // Clover price is in cents, may be undefined/null for variable-price items
      price: typeof item.price === "number" ? item.price : null,
    };
  }

  cloverInventoryCache = { items, nameToItem };
  console.log(
    `🧾 Loaded ${items.length} Clover items from API for merchant ${CLOVER_MERCHANT_ID}`
  );
  return cloverInventoryCache;
}

/**
 * items: [{ name: "Chicken Dum Biryani", quantity: 2 }, ...]
 * orderType: "pickup" | "delivery" | "dine_in" (we only use this in note/title)
 */
/**
 * items: [{ name: "Chicken Dum Biryani", quantity: 2 }, ...]
 * orderType: "pickup" | "delivery" | "dine_in" (we only use this in note/title)
 */
/**
 * items: [{ name: "Chicken Dum Biryani", quantity: 2 }, ...]
 * orderType: "pickup" | "delivery" | "dine_in" (we only use this in note/title)
 */
async function createCloverOrderFromItems({ items, note, orderType }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items passed to Clover order");
  }

  const { nameToItem } = await getCloverInventory();

  // Build title / note with order type info
  const noteParts = [];
  if (orderType) noteParts.push(`OrderType: ${orderType}`);
  if (note) noteParts.push(`Note: ${note}`);
  const noteText = noteParts.join(" | ") || "Phone order via AI agent";

  // 1) Create base order (state: open) - NO orderType field to avoid 400
  const orderBody = {
    state: "open",
    title: noteText,
  };

  const order = await cloverRequest("/orders", {
    method: "POST",
    body: orderBody,
  });

  // 2) Build line items using inventory map
  const unmatched = [];
  const bulkLineItems = {
    items: items.map((it) => {
      const name = (it.name || "").trim();
      const key = name.toLowerCase();
      const qty = it.quantity > 0 ? it.quantity : 1;

      const inv = nameToItem[key]; // { id, price }

      if (inv && inv.id) {
        const priceInCents = typeof inv.price === "number" ? inv.price : 0;

        return {
          item: { id: inv.id },
          name,
          price: priceInCents, // MUST be integer cents
          unitQty: qty, // integer, quantity of item
        };
      }

      // fallback: custom item
      return {
        name,
        price: 0,
        unitQty: qty,
      };
    }),
  };

  await cloverRequest(`/orders/${order.id}/bulk_line_items`, {
    method: "POST",
    body: bulkLineItems,
  });

  if (unmatched.length) {
    console.warn(
      "⚠️ Unmatched items (custom line items with price=0):",
      unmatched
    );
  }

  return order;
}

// -----------------------------
// Initialize LiveKit logger
// -----------------------------
initializeLogger({
  level: "info",
  destination: "stdout",
});

// Env sanity check
console.log("=== ENV CHECK (agent.js) ===");
console.log("LIVEKIT_URL:", process.env.LIVEKIT_URL || "<missing>");
console.log("LIVEKIT_API_KEY present?", !!process.env.LIVEKIT_API_KEY);
console.log("LIVEKIT_API_SECRET present?", !!process.env.LIVEKIT_API_SECRET);
console.log("OPENAI_API_KEY present?", !!process.env.OPENAI_API_KEY);
console.log("DEEPGRAM_API_KEY present?", !!process.env.DEEPGRAM_API_KEY);
console.log("ELEVEN_API_KEY present?", !!process.env.ELEVEN_API_KEY);
console.log("ELEVEN_VOICE_ID:", process.env.ELEVEN_VOICE_ID || "<default>");
console.log("CLOVER_API_KEY present?", !!CLOVER_API_KEY);
console.log("CLOVER_MERCHANT_ID:", CLOVER_MERCHANT_ID || "<missing>");
console.log("CLOVER_BASE_URL:", CLOVER_BASE_URL);
console.log("=======================================");

// -----------------------------
// Restaurant Agent with Clover tool
// -----------------------------
class RestaurantAgent extends voice.Agent {
  constructor({ restaurantName, systemPromptText, menuText }) {
    super({
      instructions: `
        You are the AI receptionist for ${restaurantName}, an Indian restaurant.

        **Caller & Accent**
        - Many callers will have Indian accents.
        - Some may mix English with Indian languages (Hindi, Telugu, Tamil, etc.).
        - Be patient, don't over-correct, and if you don't understand, say:
          "Sorry, the line broke a bit, can you please repeat that slowly?"

        **Personality**
        - Warm, polite, slightly informal.
        - Speak clearly and naturally, no robotic tone.
        - You can use simple phrases like "sure", "absolutely", "no worries".

        **Restaurant Context**
        - Cuisine: Indian (South & North), with veg, non-veg, and Indo-Chinese options.
        - Always clarify:
          - Veg vs Non-veg
          - Spice level (Mild / Medium / Spicy)
          - Dine-in, takeout, or delivery (if supported)

        **Menu Handling**
        - Use this menu context to answer questions and suggest dishes:
          ${menuText}
        - These items are coming directly from Clover. Prefer EXACT names from this list.
        - If caller says "butter chicken", "biryani", "tandoori", etc., map to the closest item in the Clover list.
        - If item is not in the list, say:
          "I don’t see that exact item in today’s menu, but we have something similar: ..."
        - Do NOT invent items that are not in the Clover menu.

        **Order Flow**
        - For orders, follow this sequence:
          1) Ask what they'd like to order.
          2) For each item: confirm size (if applicable), spice level, and quantity.
          3) Ask: "Anything else for you today?" until they say they are done.
          4) At the end, repeat the full order slowly.
          5) Confirm pickup/delivery time and phone number if needed.

        **Clover Order Tool**
        - When the caller says their order is final and confirmed, use the tool
          "createCloverOrder" with a clean list of items and quantities, plus any notes.
        - Use only dish names that match Clover menu items whenever possible.
        - After the tool succeeds, tell the caller:
          - That the order is placed.
          - The main items and total count.
          - Estimated ready time (use a simple rule, e.g. 20–25 minutes, do not fetch from API).

        **Rules**
        - Keep responses short and clear for phone audio.
        - Never guess about prices or availability if not in context; say you'll confirm with staff.
        - If caller sounds confused, slow down and rephrase simply.
        ${systemPromptText}
      `,
      tools: {
        // Tool the LLM can call to create a Clover order
        createCloverOrder: llm.tool({
          description:
            "Place a Clover order for the caller using a list of items and optional note.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                description:
                  "List of order items. Use Clover-style names and correct quantities.",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description:
                        "Dish name, e.g. 'Chicken Dum Biryani', 'Paneer 65'. Must map to Clover menu if possible.",
                    },
                    quantity: {
                      type: "integer",
                      minimum: 1,
                      description:
                        "How many of this item. Default to 1 if caller doesn't specify.",
                    },
                  },
                  required: ["name"],
                },
              },
              note: {
                type: "string",
                description:
                  "Any special instructions, spice levels, or clarifications for the kitchen.",
              },
              orderType: {
                type: "string",
                description:
                  "Order type such as 'pickup', 'delivery', or 'dine_in'. Only used in the note/title, not sent as Clover orderType.",
              },
            },
            required: ["items"],
          },
          execute: async ({ items, note, orderType }) => {
            try {
              const order = await createCloverOrderFromItems({
                items,
                note,
                orderType,
              });

              return {
                success: true,
                orderId: order.id,
              };
            } catch (err) {
              console.error("❌ Clover order failed:", err);
              return {
                success: false,
                error: err.message || String(err),
              };
            }
          },
        }),
      },
    });
  }
}

// -----------------------------
// Agent Definition
// -----------------------------
const agent = defineAgent({
  name: "universal-restaurant-agent",

  entry: async (ctx) => {
    console.log("🛰  Job received:", {
      roomName: ctx.room?.name,
      roomSid: ctx.room?.sid,
    });

    // 1) Connect to the LiveKit room (WebRTC)
    try {
      console.log("🔌 Connecting to LiveKit room via WebRTC...");
      await ctx.connect();
      console.log("✅ Agent connected to room:", ctx.room.name);
    } catch (err) {
      console.error("❌ ctx.connect() failed:", {
        type: err?.type,
        message: err?.message,
        stack: err?.stack,
      });
      return;
    }

    // 2) Parse job metadata (restaurant config from dispatch)
    let config = {};
    try {
      console.log("🎭 Raw metadata:", ctx.job.metadata);
      config = JSON.parse(ctx.job.metadata || "{}");
    } catch (e) {
      console.error("❌ Failed to parse metadata, using defaults.", e);
      config = {};
    }

    const restaurantName = config.restaurantName || "Bawarchi Biryanis Miami";
    const systemPromptText =
      config.systemPrompt || "You are a helpful restaurant receptionist.";
    const baseMenuText = config.menu || "Menu is not available right now.";

    // 3) Fetch Clover inventory and build menu text for the prompt
    let combinedMenuText = baseMenuText;
    try {
      const { items } = await getCloverInventory();
      const cloverMenuText =
        items && items.length
          ? items.map((i) => `- ${i.name}`).join("\n")
          : "No Clover items loaded.";

      combinedMenuText = `
[Restaurant Menu Text]
${baseMenuText}

[Live Clover Menu Items]
${cloverMenuText}
      `;
    } catch (err) {
      console.error("❌ Failed to load Clover menu for prompt:", err);
      combinedMenuText = baseMenuText;
    }

    // 4) Wait for SIP caller to join
    console.log("⏳ Waiting for human caller to join SIP...");
    const participant = await ctx.waitForParticipant();
    console.log("👤 Human Caller Detected:", participant.identity);

    const restaurantAgent = new RestaurantAgent({
      restaurantName,
      systemPromptText,
      menuText: combinedMenuText,
    });

    // 5) Configure the AgentSession: STT + LLM + TTS
    const session = new voice.AgentSession({
      stt: new deepgram.STT({
        // language: "en-IN", // uncomment if supported by your Deepgram plan
      }),
      llm: new openai.LLM({
        model: "gpt-4o-mini",
      }),
      tts: new elevenlabs.TTS({
        voiceId: process.env.ELEVEN_VOICE_ID || undefined,
      }),
    });

    // 6) Start the session WITH an explicit job-context wrapper
    await runWithJobContextAsync(ctx, async () => {
      console.log("🚀 Starting AgentSession in job context...");
      await session.start({
        agent: restaurantAgent,
        room: ctx.room,
      });

      console.log("🗣️ Generating initial greeting...");
      await session.generateReply({
        instructions: `Greet the caller, mention "${restaurantName}", and ask how you can help them.`,
      });
    });

    // After this, the session will keep handling the conversation automatically.
  },
});

// -----------------------------
// Run Worker via CLI
// -----------------------------
if (require.main === module) {
  const worker = new WorkerOptions({
    agent: __filename,
  });

  cli.runApp(worker);
}

module.exports = agent;
