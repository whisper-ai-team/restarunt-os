// agent.js
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import Fuse from "fuse.js";
import natural from "natural";

import { getVoiceFromSelection } from "./voiceMap.js";
import { buildSystemPrompt } from "./promptBuilder.js";
import { getDeepgramKeywords, masterMenu } from "./menuData.js";

// -----------------------------
// 1. CONFIGURATION & CORRECTIONS
// -----------------------------
const CONFIG = {
  cloverBaseUrl:
    process.env.CLOVER_BASE_URL || "https://apisandbox.dev.clover.com",
  menuCacheTtl: 10 * 60 * 1000,
};

// THE "HEARING AID" LAYER: Fix common Deepgram errors deterministically
const HEARING_CORRECTIONS = {
  bone: "goan",
  cone: "goan",
  gourd: "goan",
  gone: "goan",
  biden: "baingan",
  byun: "baingan",
  bertha: "bharta",
  barra: "vada",
  pao: "pav",
  ubuntu: "guntur", // "Ubuntu Chicken" -> "Guntur Chicken"
};

const MOCK_DB = {
  "+15712799105": { name: "Venkat", lastOrder: "Hyderabadi Biryani" },
  "+12013444638": { name: "Suresh", lastOrder: "Masala Dosa" },
};

let menuCache = { items: [], lastFetch: 0 };
let sessionCart = [];
let customerDetails = { name: "Guest", phone: "Unknown" };

process.setMaxListeners(20);
initializeLogger({ level: "info", destination: "stdout" });

// -----------------------------
// 2. GLOBAL SINGLETONS
// -----------------------------
const vadLoadPromise = silero.VAD.load({
  minSpeechDuration: 0.05,
  minSilenceDuration: 1.0,
  threshold: 0.4,
});

const metaphone = new natural.DoubleMetaphone();

// -----------------------------
// 3. HELPERS
// -----------------------------
async function finalizeSession(reason) {
  if (sessionCart.length === 0) {
    console.log(`🏁 Call ended (${reason}). No order placed.`);
    return;
  }
  console.log("------------------------------------------------");
  console.log(`💾 SAVING ORDER FOR: ${customerDetails.name}`);
  sessionCart.forEach((item) => {
    console.log(
      `   - ${item.qty}x ${item.name} ($${(item.price / 100).toFixed(2)})`
    );
  });
  console.log("------------------------------------------------");
  sessionCart = [];
}

// -----------------------------
// 4. CLOVER SERVICE
// -----------------------------
async function cloverRequest(path, { method = "GET", body } = {}, credentials) {
  const apiKey = credentials.apiKey || process.env.CLOVER_API_KEY;
  const merchId = credentials.merchantId || process.env.CLOVER_MERCHANT_ID;

  if (!apiKey || !merchId) throw new Error("Missing Clover credentials");

  const url = `${CONFIG.cloverBaseUrl}/v3/merchants/${merchId}${path}`;
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

async function getMenu(credentials) {
  const now = Date.now();
  if (
    menuCache.items.length > 0 &&
    now - menuCache.lastFetch < CONFIG.menuCacheTtl
  ) {
    return menuCache;
  }
  try {
    const data = await cloverRequest("/items?limit=1000", {}, credentials);
    const items = data.elements || [];
    menuCache = { items, lastFetch: now };
    return menuCache;
  } catch (err) {
    console.error("❌ Menu Fetch Failed:", err);
    return { items: [], lastFetch: now };
  }
}

function parseJobMetadata(metadataString) {
  let data = {};
  try {
    data = JSON.parse(metadataString || "{}");
  } catch (e) {}
  return {
    name: data.restaurantName || "Bharat Bistro",
    greeting: data.greeting || "Namaste! Welcome to Bharat Bistro.",
    instructions: data.systemPrompt || "",
    info: {
      address: data.address || "123 Curry Lane",
      hours: data.hours || "11 AM - 10 PM",
      phone: data.phone || "555-0199",
    },
    voiceSelection: data.voices || data.voiceId || "indian",
    clover: { apiKey: data.cloverApiKey, merchantId: data.cloverMerchantId },
  };
}

// -----------------------------
// 5. AGENT DEFINITION
// -----------------------------
class RestaurantAgent extends voice.Agent {
  constructor({ restaurantConfig, initialMenu, activeRoom }) {
    const personalizedContext = `
      You are speaking with ${customerDetails.name}.
      If they exist in the database, welcome them back.
    `;

    const systemPrompt = buildSystemPrompt({
      restaurantName: restaurantConfig.name,
      info: restaurantConfig.info,
      instructions: restaurantConfig.instructions + personalizedContext,
      menuContext: initialMenu,
      tone: "friendly",
    });

    super({
      instructions: systemPrompt,
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

        // --- SMARTEST MENU SEARCH ---
        searchMenu: llm.tool({
          description:
            "Search menu with Hearing Correction, Phonetic, and Fuzzy matching.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
          execute: async ({ query }) => {
            if (activeRoom.state === "disconnected") return;
            console.log(`🔍 Raw Query: "${query}"`);

            // 1. HEARING AID: Fix specific bad words
            let fixedQuery = query.toLowerCase();
            Object.keys(HEARING_CORRECTIONS).forEach((badWord) => {
              if (fixedQuery.includes(badWord)) {
                fixedQuery = fixedQuery.replace(
                  badWord,
                  HEARING_CORRECTIONS[badWord]
                );
              }
            });
            console.log(`   ✨ Fixed Query: "${fixedQuery}"`);

            try {
              const { items: cloverItems } = await getMenu(
                restaurantConfig.clover
              );

              // Filter out hidden items (Availability Check)
              const availableItems = cloverItems.filter((i) => !i.hidden);

              const enrichedItems = availableItems.map((cItem) => {
                const cNameClean = cItem.name.trim().toLowerCase();
                const brainEntry = masterMenu.find(
                  (m) => m.name.trim().toLowerCase() === cNameClean
                );
                const soundCodes = metaphone.process(cItem.name);
                return {
                  ...cItem,
                  synonyms: brainEntry ? brainEntry.synonyms : [],
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
                  const list = matches
                    .map((m) => `- ${m.name} ($${(m.price / 100).toFixed(2)})`)
                    .join("\n");
                  return `System: Found matches based on sound:\n${list}\n(Please offer these to the user)`;
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
              const list = results
                .slice(0, 5)
                .map(
                  (r) =>
                    `- ${r.item.name} ($${(r.item.price / 100).toFixed(2)})`
                )
                .join("\n");
              return `System: Found matches:\n${list}\n(Please offer these to the user)`;
            } catch (err) {
              return "System: Error accessing menu.";
            }
          },
        }),

        addToOrder: llm.tool({
          description: "Add item to cart.",
          parameters: {
            type: "object",
            properties: {
              itemName: { type: "string" },
              quantity: { type: "integer" },
              notes: { type: "string" },
            },
            required: ["itemName", "quantity"],
          },
          execute: async ({ itemName, quantity, notes }) => {
            const { items } = await getMenu(restaurantConfig.clover);
            const itemData = items.find(
              (i) => i.name.toLowerCase() === itemName.toLowerCase()
            );
            const price = itemData ? itemData.price : 0;
            sessionCart.push({
              name: itemName,
              qty: quantity,
              price: price,
              notes: notes || "",
            });
            return `System: Added ${quantity}x ${itemName}. Ask if they want anything else.`;
          },
        }),

        confirmOrder: llm.tool({
          description: "Finalize order.",
          parameters: { type: "object", properties: {} },
          execute: async () =>
            `System: Order confirmed for ${customerDetails.name}. Total items: ${sessionCart.length}. End call now.`,
        }),

        hangUp: llm.tool({
          description: "End call.",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            if (activeRoom) setTimeout(() => activeRoom.disconnect(), 1000);
            return "Goodbye!";
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

    console.log("⏳ Waiting for caller...");
    const participant = await ctx.waitForParticipant();
    console.log(`👤 Caller Connected: ${participant.identity}`);

    const callerPhone = participant.identity.replace("sip_", "");
    if (MOCK_DB[callerPhone]) {
      customerDetails = { name: MOCK_DB[callerPhone].name, phone: callerPhone };
    } else {
      customerDetails = { name: "Guest", phone: callerPhone };
    }

    sessionCart = [];
    const restaurantConfig = parseJobMetadata(ctx.job.metadata);
    let initialGreeting =
      customerDetails.name !== "Guest"
        ? `Namaste ${customerDetails.name}! Welcome back to Bharat Bistro.`
        : restaurantConfig.greeting;

    let initialMenu = "Loading...";
    let deepgramKeywords = [];
    let rawKeywords = getDeepgramKeywords();
    deepgramKeywords = rawKeywords.map((k) =>
      typeof k === "string" ? [k.split(":")[0], parseFloat(k.split(":")[1])] : k
    );

    try {
      const { items } = await getMenu(restaurantConfig.clover);
      initialMenu = items
        .slice(0, 50)
        .map((i) => `- ${i.name}`)
        .join("\n");
      console.log(`🚀 Injected ${deepgramKeywords.length} Manual Keywords.`);
    } catch (e) {}

    const onHangup = async () => await finalizeSession("Caller Hangup");
    const onRoomClose = async () => await finalizeSession("Room Closed");
    ctx.room.on("participant_disconnected", onHangup);
    ctx.room.on("disconnected", onRoomClose);

    const vadModel = await vadLoadPromise;
    const selectedVoice = getVoiceFromSelection(
      restaurantConfig.voiceSelection
    );

    const restaurantAgent = new RestaurantAgent({
      restaurantConfig,
      initialMenu,
      activeRoom: ctx.room,
    });

    const session = new voice.AgentSession({
      vad: vadModel,
      stt: new deepgram.STT({
        model: "nova-2",
        language: "en-IN",
        keywords: deepgramKeywords,
        smartFormat: true,
        endpointing: 300,
      }),
      llm: new openai.LLM({ model: "gpt-4o-mini" }),
      tts: new elevenlabs.TTS({
        modelID: "eleven_multilingual_v2",
        voice: { id: selectedVoice.id },
      }),
    });

    try {
      await runWithJobContextAsync(ctx, async () => {
        await session.start({ agent: restaurantAgent, room: ctx.room });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await session.generateReply({
          instructions: `Say exactly: "${initialGreeting}"`,
        });
        await new Promise((resolve) => ctx.room.on("disconnected", resolve));
      });
    } catch (err) {
      console.error("❌ Fatal Error:", err);
    } finally {
      ctx.room.off("participant_disconnected", onHangup);
      ctx.room.off("disconnected", onRoomClose);
    }
  },
});

export default agent;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
}
