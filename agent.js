// agent.js
import "dotenv/config"; // Replaces require("dotenv").config()
import path from "node:path";
import { fileURLToPath } from "node:url";

// Convert CommonJS __filename to ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  defineAgent,
  cli,
  WorkerOptions,
  initializeLogger,
  voice,
  runWithJobContextAsync,
  llm,
} from "@livekit/agents";

import * as openai from "@livekit/agents-plugin-openai";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as silero from "@livekit/agents-plugin-silero";

// Your custom voice map
import { getNextRotatedVoice } from "./voiceMap.js";

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

async function getMenu() {
  const now = Date.now();
  if (
    menuCache.items.length > 0 &&
    now - menuCache.lastFetch < CONFIG.menuCacheTtl
  ) {
    return menuCache;
  }

  console.log("🔄 Refreshing Menu from Clover API...");
  try {
    const data = await cloverRequest("/items?limit=1000");
    const items = data.elements || [];
    const nameToItem = {};

    for (const item of items) {
      if (!item.name || !item.id) continue;
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
    return menuCache;
  }
}

// -----------------------------
// 4. ORDER LOGIC
// -----------------------------
async function createOrder({ items, note, orderType, phoneNumber }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("No items");
  const { nameToItem } = await getMenu();

  const noteParts = [];
  if (orderType) noteParts.push(`Type: ${orderType}`);
  if (note) noteParts.push(`Note: ${note}`);
  if (phoneNumber) noteParts.push(`Phone: ${phoneNumber}`);
  const headerNote = noteParts.join(" | ");

  const order = await cloverRequest("/orders", {
    method: "POST",
    body: { state: "open", title: headerNote },
  });

  const unmatched = [];
  let totalCents = 0;
  const orderSummaryLines = [];

  const bulkLineItems = {
    items: items.map((it) => {
      const rawName = (it.name || "").trim();
      const key = rawName.toLowerCase();
      const qty = it.quantity || 1;
      const mods = it.modifications || "";

      const inv = nameToItem[key];
      const kitchenFriendlyName = mods ? `${rawName} **[${mods}]**` : rawName;

      orderSummaryLines.push(`${qty}x ${kitchenFriendlyName}`);

      if (inv && inv.id) {
        totalCents += inv.price * qty;
        return {
          item: { id: inv.id },
          name: kitchenFriendlyName,
          price: inv.price,
          unitQty: qty,
        };
      }

      unmatched.push({ name: rawName, qty });
      return { name: kitchenFriendlyName, price: 0, unitQty: qty };
    }),
  };

  await cloverRequest(`/orders/${order.id}/bulk_line_items`, {
    method: "POST",
    body: bulkLineItems,
  });

  await cloverRequest(`/orders/${order.id}`, {
    method: "POST",
    body: { total: totalCents },
  });

  if (phoneNumber) {
    const smsBody = `Bawarchi Biryanis: Order Confirmed!\n\n${orderSummaryLines.join(
      "\n"
    )}\n\nTotal: ${formatCurrency(totalCents)}\nPickup in ~20 mins.`;
    sendSms(phoneNumber, smsBody);
  }

  return { order, totalCents };
}

// -----------------------------
// 5. AGENT DEFINITION
// -----------------------------
initializeLogger({ level: "info", destination: "stdout" });

// -----------------------------
// 1. RESTAURANT KNOWLEDGE BASE
// (Edit these details to match your restaurant)
// -----------------------------
const RESTAURANT_INFO = {
  address: "5959 Long Point Rd, Houston, TX 77055",
  phone: "(713) 461-4500",
  hours: "11:00 AM to 10:00 PM every day",
  dietary: {
    halal: "Yes, all our meats are 100% Halal certified.",
    vegetarian:
      "Yes, we have a large selection of vegetarian curries and biryanis.",
    vegan:
      "We offer vegan options like Chana Masala and Aloo Gobi. Please ask to remove ghee/cream.",
    glutenFree:
      "Most of our curries are gluten-free, but please avoid Naan bread.",
  },
};

// -----------------------------
// 2. UPDATED AGENT CLASS
// -----------------------------
class RestaurantAgent extends voice.Agent {
  constructor({ restaurantName, systemPrompt, initialMenu, activeRoom }) {
    super({
      instructions: `
        You are the efficient, polite, and Indian-accented front-desk AI for ${restaurantName}.
        
        **CORE BEHAVIOR**
        - Keep answers short (1–2 sentences max).
        - Wait patiently if the user pauses.

        **STORE INFORMATION (Use this for FAQ)**
        - Location: ${RESTAURANT_INFO.address}
        - Phone: ${RESTAURANT_INFO.phone}
        - Hours: ${RESTAURANT_INFO.hours}
        - Halal Status: ${RESTAURANT_INFO.dietary.halal}
        - Vegetarian/Vegan: ${RESTAURANT_INFO.dietary.vegetarian} ${RESTAURANT_INFO.dietary.vegan}
        - Gluten Free: ${RESTAURANT_INFO.dietary.glutenFree}

        **SMART MENU SEARCH**
        - You have a list of "Popular Items" in your context.
        - IF the user asks for something NOT in that list, use the \`searchMenu\` tool.
        
        **ORDERING RULES**
        - Always ask for **Spice Level** (Mild/Med/Spicy) for Biryanis/Curries.
        - Always ask for **Quantity**.
        
        **ENDING THE CALL**
        - When \`createCloverOrder\` returns success, say: "Order confirmed! Check your texts. Goodbye!" then call \`hangUp\`.

        **SYSTEM CONTEXT**
        ${systemPrompt}

        **POPULAR ITEMS**
        ${initialMenu}
      `,
      tools: {
        searchMenu: llm.tool({
          description: "Search full menu database.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
          execute: async ({ query }) => {
            const { items } = await getMenu();
            const q = query.toLowerCase();
            const matches = items
              .filter((i) => i.name.toLowerCase().includes(q))
              .slice(0, 10);
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
                    name: { type: "string" },
                    quantity: { type: "integer" },
                    modifications: { type: "string" },
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
              return `SUCCESS. Total: ${speechTotal}. SMS Sent.`;
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
              }, 4000);
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

    let initialMenu = "Loading...";
    try {
      const { items } = await getMenu();
      initialMenu = items
        .slice(0, 20)
        .map((i) => `- ${i.name}`)
        .join("\n");
      initialMenu += "\n\n(Use searchMenu tool to find other items)";
    } catch (e) {
      initialMenu = "Menu unavailable.";
    }

    const participant = await ctx.waitForParticipant();
    let callerPhone = normalizePhone(participant.identity);
    if (callerPhone.length === 10) callerPhone = `+1${callerPhone}`;
    else if (callerPhone.length > 10 && !callerPhone.startsWith("+"))
      callerPhone = `+${callerPhone}`;

    const restaurantAgent = new RestaurantAgent({
      restaurantName,
      systemPrompt,
      initialMenu,
      activeRoom: ctx.room,
    });

    const vad = await silero.VAD.load({
      minSpeechDuration: 0.1,
      minSilenceDuration: 1.0,
      threshold: 0.5,
    });

    // 🚀 NEW: Get Rotated Voice
    const currentVoice = getNextRotatedVoice();

    const session = new voice.AgentSession({
      vad,
      stt: new deepgram.STT({ model: "nova-3" }),
      llm: new openai.LLM({ model: "gpt-4o-mini" }),
      tts: new elevenlabs.TTS({
        modelID: "eleven_multilingual_v2",
        voice: { id: currentVoice.id, name: currentVoice.name },
      }),
    });

    // Inject System Prompt about the voice persona
    session.systemPrompt = `You are ${currentVoice.name}. You are the ${
      currentVoice.category || "professional"
    } front-desk assistant for ${restaurantName}.`;

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

export default agent;

// ESM equivalent of "if (require.main === module)"
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
}
