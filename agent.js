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

// Plugin imports (CommonJS)
const openai = require("@livekit/agents-plugin-openai");
const deepgram = require("@livekit/agents-plugin-deepgram");
const elevenlabs = require("@livekit/agents-plugin-elevenlabs");
const silero = require("@livekit/agents-plugin-silero");
const livekitPlugins = require("@livekit/agents-plugin-livekit");

// -----------------------------
// Clover config & helpers
// -----------------------------
const CLOVER_API_KEY = process.env.CLOVER_API_KEY;
const CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;
const CLOVER_BASE_URL =
  process.env.CLOVER_BASE_URL || "https://apisandbox.dev.clover.com";

let cloverInventoryCache = null; // { items, nameToItem }

// Format cents -> "$12.34"
function formatCurrency(cents) {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

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

// Load Clover items once and cache: list + name->item map (id + price)
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
      // Clover "price" is integer cents. May be undefined/null for variable-price items.
      price:
        typeof item.price === "number" && !Number.isNaN(item.price)
          ? item.price
          : null,
    };
  }

  cloverInventoryCache = { items, nameToItem };
  console.log(
    `🧾 Loaded ${items.length} Clover items from API for merchant ${CLOVER_MERCHANT_ID}`
  );
  return cloverInventoryCache;
}

/**
 * Create a Clover order from items
 */
async function createCloverOrderFromItems({
  items,
  note,
  orderType,
  phoneNumber,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items passed to Clover order");
  }

  const { nameToItem } = await getCloverInventory();

  // Build title / note with order type info
  const noteParts = [];
  if (orderType) noteParts.push(`OrderType: ${orderType}`);
  if (note) noteParts.push(`Note: ${note}`);
  if (phoneNumber) noteParts.push(`Phone: ${phoneNumber}`);
  const noteText = noteParts.join(" | ") || "Phone order via AI agent";

  // 1) Create base order (state: open)
  const orderBody = {
    state: "open",
    title: noteText,
  };

  const order = await cloverRequest("/orders", {
    method: "POST",
    body: orderBody,
  });

  // 2) Build line items using inventory map and compute subtotal
  const unmatched = [];
  let totalCents = 0;

  const bulkLineItems = {
    items: items.map((it) => {
      const name = (it.name || "").trim();
      const key = name.toLowerCase();
      const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;

      const inv = nameToItem[key]; // { id, price } or undefined

      if (inv && inv.id) {
        const priceInCents =
          typeof inv.price === "number" && !Number.isNaN(inv.price)
            ? inv.price
            : 0;

        totalCents += priceInCents * qty;

        return {
          item: { id: inv.id },
          name,
          price: priceInCents, // cents EACH
          unitQty: qty, // integer quantity
        };
      }

      // No match found: custom line item with price=0
      unmatched.push({ name, qty });

      return {
        name,
        price: 0,
        unitQty: qty,
      };
    }),
  };

  // 3) Add all line items
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

  // 4) Update the order TOTAL so Clover shows it on the dashboard
  try {
    await cloverRequest(`/orders/${order.id}`, {
      method: "POST",
      body: {
        total: totalCents, // subtotal before tax, in cents
      },
    });
  } catch (err) {
    console.error("⚠️ Failed to update Clover order total:", err);
  }

  return {
    order,
    totalCents,
    unmatched,
  };
}

/**
 * Find latest order for a phone number by searching recent orders' title/note
 */
async function findLatestOrderByPhone(phoneNumber) {
  const target = normalizePhone(phoneNumber);
  if (!target) return null;

  const data = await cloverRequest("/orders?limit=50&expand=lineItems");
  const orders = data.elements || [];

  const matches = orders.filter((o) => {
    const text = `${o.title || ""} ${o.note || ""}`;
    const digits = normalizePhone(text);
    return digits.includes(target);
  });

  if (!matches.length) return null;

  matches.sort(
    (a, b) =>
      (b.clientCreatedTime || b.createdTime || 0) -
      (a.clientCreatedTime || a.createdTime || 0)
  );

  return matches[0];
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
console.log("CLOVER_API_KEY present?", !!CLOVER_API_KEY);
console.log("CLOVER_MERCHANT_ID:", CLOVER_MERCHANT_ID || "<missing>");
console.log("CLOVER_BASE_URL:", CLOVER_BASE_URL);
console.log("=======================================");

// -----------------------------
// Restaurant Agent with Clover tools
// -----------------------------
class RestaurantAgent extends voice.Agent {
  constructor({ restaurantName, systemPromptText, menuText }) {
    super({
      instructions: `
          You are the efficient and polite front-desk AI for ${restaurantName}.
  
          **CORE BEHAVIOR**
          - **Be Concise:** Keep responses short (1-2 sentences max). Do not lecture.
          - **Be Polite but Direct:** Use "Sure," "No problem," and "Got it." Avoid flowery language.
          - **Handling Accents:** Many callers have heavy Indian accents. If you are not 100% sure what they said, do NOT guess. Say: "Sorry, the line is breaking up. Could you say that again?"
  
          **MENU & ORDERING RULES**
          - Use the [Live Clover Menu Items] below.
          - If they ask for "Chicken 65" and you see "Chicken 65 (Dry)", map it.
          - If an item is not in the list, say: "I don't see that on the menu today. We have [Closest Item]. Would you like that?"
          - For every main dish, ALWAYS clarify:
            1. Spice level (Mild, Medium, Spicy).
            2. Quantity (default to 1 if not specified).
  
          **CONVERSATION FLOW**
          1. Greet: "Thank you for calling ${restaurantName}. How can I help you?"
          2. Take Order: If they order multiple items, confirm: "Got it, [Item 1] and [Item 2]. What spice level for those?"
          3. Confirm: Read the full order back once they stop adding items.
          4. Finalize: Ask: "Is that everything for today?"
          5. Execute:
             - Ask for their phone number.
             - Call the \`createCloverOrder\` tool.
          6. Success/Fail:
             - If tool fails: "I'm having trouble with the system. Please hold or call back."
             - If tool succeeds: Read total and say pickup time: "Your total is [Amount]. It will be ready in about 20 minutes. Thank you!"
  
          **CRITICAL RESTRICTIONS**
          - NEVER say the order is placed until the tool returns \`success: true\`.
          - NEVER make up prices. Use only the tool's total.
          - NEVER ask for credit card info. Payment is at the store.
  
          **SYSTEM CONTEXT**
          ${systemPromptText}
  
          **MENU DATA**
          ${menuText}
        `,
      tools: {
        createCloverOrder: llm.tool({
          description:
            "Place a Clover order. REQUIRED: items, note (spice level/instructions), phoneNumber.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                description:
                  "List of items. Map caller's words to the closest Clover menu item names.",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Exact menu item name from Clover list.",
                    },
                    quantity: {
                      type: "integer",
                      minimum: 1,
                      description: "Quantity.",
                    },
                  },
                  required: ["name"],
                },
              },
              note: {
                type: "string",
                description:
                  "Spice levels (Mild/Med/Spicy) and special requests.",
              },
              orderType: {
                type: "string",
                description: "pickup or delivery",
              },
              phoneNumber: {
                type: "string",
                description: "Caller phone number for the order.",
              },
            },
            required: ["items", "phoneNumber"],
          },
          execute: async ({ items, note, orderType, phoneNumber }) => {
            console.log("🧾 createCloverOrder TOOL CALLED", {
              items,
              note,
              phoneNumber,
            });

            try {
              const { order, totalCents, unmatched } =
                await createCloverOrderFromItems({
                  items,
                  note,
                  orderType: orderType || "pickup",
                  phoneNumber,
                });

              return {
                success: true,
                orderId: order.id,
                totalCents,
                formattedTotal: formatCurrency(totalCents),
                unmatched,
              };
            } catch (err) {
              console.error("❌ Clover order failed:", err);
              return {
                success: false,
                error: "System error: " + err.message,
              };
            }
          },
        }),

        getCloverOrderStatus: llm.tool({
          description: "Check status of an existing order by phone number.",
          parameters: {
            type: "object",
            properties: {
              phoneNumber: {
                type: "string",
                description: "The caller's phone number.",
              },
            },
            required: ["phoneNumber"],
          },
          execute: async ({ phoneNumber }) => {
            try {
              const order = await findLatestOrderByPhone(phoneNumber);
              if (!order) return { found: false };
              return {
                found: true,
                status: order.state, // e.g., 'open', 'paid', 'locked'
                title: order.title,
                total: order.total,
              };
            } catch (err) {
              return { found: false, error: err.message };
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

    // 5) Load VAD + turn detector and configure AgentSession
    console.log("🧠 Loading Silero VAD...");
    const vad = await silero.VAD.load(); // uses sane defaults
    console.log("✅ Silero VAD loaded.");

    const turnDetector = new livekitPlugins.turnDetector.MultilingualModel();
    console.log("✅ LiveKit turn detector initialized.");

    const session = new voice.AgentSession({
      vad,
      turnDetection: turnDetector,
      stt: new deepgram.STT({
        model: "nova-3",
      }),
      llm: new openai.LLM({
        model: "gpt-4o-mini",
      }),
      // 🔊 ElevenLabs TTS
      tts: new elevenlabs.TTS(),
      voiceOptions: {
        // Turn OFF preemptive generation to reduce aggressive early responses
        preemptiveGeneration: false,
      },
    });

    // 6) Start the session WITH an explicit job-context wrapper
    await runWithJobContextAsync(ctx, async () => {
      console.log("🚀 Starting AgentSession in job context...");
      await session.start({
        agent: restaurantAgent,
        room: ctx.room,
      });

      console.log("🗣️ Generating initial greeting (no interruptions)...");
      await session.generateReply({
        instructions: `Greet the caller, mention "${restaurantName}", and ask how you can help them.`,
        allowInterruptions: false, // don't let greeting get cut off
      });
    });
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
