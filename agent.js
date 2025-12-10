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
// 1. Clover Configuration
// -----------------------------
const CLOVER_API_KEY = process.env.CLOVER_API_KEY;
const CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;
const CLOVER_BASE_URL =
  process.env.CLOVER_BASE_URL || "https://apisandbox.dev.clover.com";

let cloverInventoryCache = null;

function formatCurrency(cents) {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function normalizePhone(phone) {
  if (!phone) return "";
  // Removes "sip:" prefix and any non-digit characters
  return String(phone).replace(/^sip:/, "").replace(/\D/g, "");
}

// -----------------------------
// 2. Clover API Helpers
// -----------------------------
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
      price:
        typeof item.price === "number" && !Number.isNaN(item.price)
          ? item.price
          : null,
    };
  }

  cloverInventoryCache = { items, nameToItem };
  console.log(
    `🧾 Loaded ${items.length} Clover items for merchant ${CLOVER_MERCHANT_ID}`
  );
  return cloverInventoryCache;
}

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

  const noteParts = [];
  if (orderType) noteParts.push(`OrderType: ${orderType}`);
  if (note) noteParts.push(`Note: ${note}`);
  if (phoneNumber) noteParts.push(`Phone: ${phoneNumber}`);
  const noteText = noteParts.join(" | ") || "Phone order via AI agent";

  // Create Order
  const order = await cloverRequest("/orders", {
    method: "POST",
    body: { state: "open", title: noteText },
  });

  const unmatched = [];
  let totalCents = 0;

  // Map Items
  const bulkLineItems = {
    items: items.map((it) => {
      const name = (it.name || "").trim();
      const key = name.toLowerCase();
      const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
      const inv = nameToItem[key];

      if (inv && inv.id) {
        const priceInCents =
          typeof inv.price === "number" && !Number.isNaN(inv.price)
            ? inv.price
            : 0;
        totalCents += priceInCents * qty;
        return {
          item: { id: inv.id },
          name,
          price: priceInCents,
          unitQty: qty,
        };
      }
      unmatched.push({ name, qty });
      return { name, price: 0, unitQty: qty };
    }),
  };

  // Add Items to Order
  await cloverRequest(`/orders/${order.id}/bulk_line_items`, {
    method: "POST",
    body: bulkLineItems,
  });

  // Update Total
  try {
    await cloverRequest(`/orders/${order.id}`, {
      method: "POST",
      body: { total: totalCents },
    });
  } catch (err) {
    console.error("⚠️ Failed to update Clover order total:", err);
  }

  return { order, totalCents, unmatched };
}

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
// 3. Agent & Logger Init
// -----------------------------
initializeLogger({
  level: "info",
  destination: "stdout",
});

class RestaurantAgent extends voice.Agent {
  constructor({ restaurantName, systemPromptText, menuText }) {
    super({
      instructions: `
        You are the efficient, polite, and Indian-accented front-desk AI for ${restaurantName}.

        **CORE BEHAVIOR**
        - Your goal is to take orders efficiently.
        - Keep answers short (1–2 sentences max).
        - If the user pauses, wait patiently. Do not interrupt them unless they stop speaking.

        **MENU & ORDERING RULES**
        - Use the [Live Clover Menu Items] list below.
        - If an item is missing, apologize and suggest the closest match.
        - ALWAYS ask for "Spice Level" and "Quantity" for main dishes.

        **CONVERSATION FLOW**
        1. Greet: "Namaste! Thank you for calling ${restaurantName}. How can I help you today?"
        2. Take Order: Listen carefully to the items.
        3. Confirm: Read back the order to verify.
        4. Finalize: Ask for the customer's phone number.
        5. Execute: Call the \`createCloverOrder\` tool.

        **SYSTEM CONTEXT**
        ${systemPromptText}

        **MENU DATA**
        ${menuText}
      `,
      tools: {
        createCloverOrder: llm.tool({
          description: "Place a Clover order. REQUIRED: items, phoneNumber.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "integer" },
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
              return { success: false, error: err.message };
            }
          },
        }),
        getCloverOrderStatus: llm.tool({
          description: "Check status of an existing order by phone number.",
          parameters: {
            type: "object",
            properties: {
              phoneNumber: { type: "string" },
            },
            required: ["phoneNumber"],
          },
          execute: async ({ phoneNumber }) => {
            try {
              const order = await findLatestOrderByPhone(phoneNumber);
              if (!order) return { found: false };
              return {
                found: true,
                status: order.state,
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
// 4. Main Entry Point
// -----------------------------
const agent = defineAgent({
  name: "universal-restaurant-agent",

  entry: async (ctx) => {
    console.log("🔌 Connecting to LiveKit room...");
    await ctx.connect();
    console.log("✅ Agent connected to room:", ctx.room.name);

    // -- Config Loading --
    let config = {};
    try {
      config = JSON.parse(ctx.job.metadata || "{}");
    } catch (e) {
      config = {};
    }
    const restaurantName = config.restaurantName || "Bawarchi Biryanis Miami";
    const baseMenuText = config.menu || "Menu is not available.";

    // -- Load Clover Menu --
    let combinedMenuText = baseMenuText;
    try {
      const { items } = await getCloverInventory();
      const cloverMenuText =
        items && items.length
          ? items.map((i) => `- ${i.name}`).join("\n")
          : "No Clover items loaded.";
      combinedMenuText = `[Clover Menu Items]\n${cloverMenuText}\n\n[Base Menu]\n${baseMenuText}`;
    } catch (err) {
      combinedMenuText = baseMenuText;
    }

    // -- Wait for User --
    console.log("⏳ Waiting for human caller...");
    const participant = await ctx.waitForParticipant();

    // Normalize SIP identity for Clover (e.g. "sip:+12345" -> "12345")
    const callerPhone = normalizePhone(participant.identity);
    console.log("👤 Caller Identity:", participant.identity, "->", callerPhone);

    const restaurantAgent = new RestaurantAgent({
      restaurantName,
      systemPromptText: config.systemPrompt || "You are a helpful assistant.",
      menuText: combinedMenuText,
    });

    // -- VAD TUNING (Anti-Cut-Off) --
    console.log("🧠 Loading Silero VAD (Tuned for patience)...");
    const vad = await silero.VAD.load({
      minSpeechDuration: 0.1, // Recognize short "Yes/No" quickly
      minSilenceDuration: 0.8, // Wait 0.8s of silence before replying (Prevents cutting off)
      threshold: 0.5,
    });

    // -- Session Setup --
    console.log("🧪 Creating AgentSession...");
    const session = new voice.AgentSession({
      vad,
      // Deepgram Nova-3 is currently the fastest STT
      stt: new deepgram.STT({ model: "nova-3" }),

      // GPT-4o-mini is fastest/cheapest for simple ordering
      llm: new openai.LLM({ model: "gpt-4o-mini" }),

      // -- ELEVENLABS TUNING (Low Latency) --
      tts: new elevenlabs.TTS({
        // MUST use Turbo v2.5 for <1s latency
        modelID: "eleven_turbo_v2_5",
        // ⚠️ REPLACE THIS ID WITH YOUR CHOSEN INDIAN VOICE ID ⚠️
        // "Raveena" or similar
        voice: {
          id: "9w21nMuk8CWXIME31V1S", // <--- CHANGE THIS ID
        },
        // Stream small chunks for faster playback start
        chunk_length_schedule: [50, 100, 200],
      }),
    });

    // Log TTS errors to debug silence
    session.on("error", (err) => console.error("🔥 Session Error:", err));

    try {
      await runWithJobContextAsync(ctx, async () => {
        console.log("🚀 Starting AgentSession...");
        await session.start({
          agent: restaurantAgent,
          room: ctx.room,
        });

        console.log("📢 Sending Greeting...");
        const handle = await session.generateReply({
          instructions: `Greet the caller cheerfully using "Namaste", mention "${restaurantName}", and ask how you can help.`,
          allowInterruptions: true,
        });

        await handle.waitForPlayout();
        console.log("✅ Greeting finished.");

        // -- KEEP-ALIVE: Don't exit until call ends --
        await new Promise((resolve) => {
          ctx.room.on("disconnected", () => {
            console.log("📞 Room disconnected. Ending session.");
            resolve();
          });
        });
      });
    } catch (err) {
      console.error("❌ Error in AgentSession:", err);
    }
  },
});

if (require.main === module) {
  cli.runApp(new WorkerOptions({ agent: __filename }));
}

module.exports = agent;
