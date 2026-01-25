// agent.js - Main entry point for the Restaurant OS Voice Agent
import "dotenv/config";
import crypto from "crypto";
if (!globalThis.crypto) {
  globalThis.crypto = crypto;
}
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Google Cloud credentials (Used for STT only if needed, but we use Deepgram)
import { readFileSync } from "node:fs";
let googleCredentials = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const raw = readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
    console.log(`📋 [${INSTANCE_ID}] Found GAC file at ${process.env.GOOGLE_APPLICATION_CREDENTIALS}. Size: ${raw.length} bytes.`);
    googleCredentials = JSON.parse(raw);
    console.log(`📋 [${INSTANCE_ID}] Google Credentials parsed successfully.`);
  } catch (err) {
    console.error(`❌ [${INSTANCE_ID}] Google Credentials Load ERROR:`, err.message);
  }
}

import {
  defineAgent,
  initializeLogger,
  voice,
  WorkerOptions,
  Worker,
} from "@livekit/agents";
import { RoomServiceClient } from "livekit-server-sdk";

// OpenAI Realtime Plugin
import * as openai from "@livekit/agents-plugin-openai";

// Import our modular components
import { isOpen, redact, INSTANCE_ID, startHeartbeat, extractMenuKeywords } from "./utils/agentUtils.js";

// Suppress benign cleanup race conditions in LiveKit SDK
process.on('unhandledRejection', (reason) => {
    if (reason?.code === 'ERR_INVALID_STATE' && reason?.message?.includes('WritableStream is closed')) {
        // This is a known benign race condition during session teardown
        return;
    }
    console.error('🚨 CRITICAL: Unhandled Rejection:', reason);
});
import { parseJobMetadata } from "./config/agentConfig.js";
import { getMenu } from "./services/cloverService.js";
import { finalizeSession } from "./services/sessionManager.js";
import { getCuisineProfile, normalizeCuisineKey } from "./cuisines/cuisineRegistry.js";
import { getVoiceFromSelection } from "./voiceMap.js";
import { PrismaClient } from "@prisma/client";

// Refactored Modules
import { createRestaurantTools } from "./agent/tools.js";
import { createRestaurantPrompt } from "./agent/prompt.js";

let prisma = null;

process.on("uncaughtException", (err) => {
  console.error("🚨 CRITICAL: Uncaught Exception in Agent Process:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  const errStr = (reason?.message || reason?.toString() || "").toLowerCase();
  if (errStr.includes("samplerate") || errStr.includes("vad")) {
     // Benign error during shutdown race condition
     return;
  }
  console.error("🚨 CRITICAL: Unhandled Rejection in Agent Process:", reason);
});

initializeLogger({ level: "info", destination: "stdout" });
console.log(`🚀 [${INSTANCE_ID}] Script Loaded. Waiting for entrypoint...`);

// Start heartbeat monitoring
startHeartbeat();

// Initialize Room Service (for SIP Disconnect)
const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
);

// -----------------------------
// MAIN ENTRY
// -----------------------------
const agent = defineAgent({
  name: "restaurant-os-agent",

  entry: async (ctx) => {
    console.log("🔌 Parallel Boot: Connecting room & loading menu...");
    
    // 1. Kick off parallel tasks immediately
    const connectPromise = ctx.connect();
    
    // Try multiple metadata sources
    const rawMetadata = ctx.job?.metadata || ctx.job?.dispatch?.metadata || "";
    console.log(`📋 Raw metadata string: "${rawMetadata}"`);
    
    const metadataDetails = parseJobMetadata(rawMetadata); // Local parse
    let { restaurantId, customerName, customerPhone } = metadataDetails || {};
    
    console.log(`🔍 Initial Content Lookup: ID=${restaurantId}, Customer=${customerName}`);

    // Lazy load Prisma
    if (!prisma) {
        console.log(`🗄️ [${INSTANCE_ID}] Initializing Prisma Client...`);
        prisma = new PrismaClient();
    }

    // ------------------------------------------
    // ROBUST CONTEXT RESOLUTION (The "Safe Boot")
    // ------------------------------------------
    let restaurantConfig = null;
    let callRecord = null;
    
    // Attempt 1: Metadata (Fastest)
    if (restaurantId && restaurantId !== 'undefined') {
        try {
            restaurantConfig = await prisma.restaurant.findUnique({
                where: { id: restaurantId }
                // businessHours is fetched by default as a scalar
            });
            if (restaurantConfig) console.log(`✅ [CONTEXT] Resolved via Metadata: ${restaurantConfig.name}`);
        } catch (e) { console.error("⚠️ Metadata lookup failed", e); }
    }

    // Attempt 2: Room Name Mapping (DB Call)
    if (!restaurantConfig) {
        const roomName = ctx.job?.room?.name || "";
        console.log(`⚠️ [CONTEXT] Missing ID. Trying Room Name Lookup: "${roomName}"...`);
        
        // Wait for connection to ensure we have the room info if needed, but ctx.job should have it
        try {
           // Retry loop for DB propagation (critical for SIP calls)
           let retries = 0;
           while (!restaurantConfig && retries < 2) {
               const callContext = await prisma.call.findFirst({
                   where: { roomName: roomName },
                   include: { restaurant: true }, // businessHours is scalar, so just include restaurant
                   orderBy: { createdAt: 'desc' } // Get latest
               });

               if (callContext?.restaurant) {
                   restaurantConfig = callContext.restaurant;
                   callRecord = callContext;
                   customerName = callContext.customerName || customerName;
                   customerPhone = callContext.customerPhone || customerPhone;
                   console.log(`✅ [CONTEXT] Resolved via DB Call Record: ${restaurantConfig.name}`);
                   break;
               }
               
               console.log(`⏳ [CONTEXT] Retry ${retries + 1}/2: waiting for webhook...`);
               await new Promise(r => setTimeout(r, 1500));
               retries++;
           }
        } catch (err) {
            console.error("❌ [CONTEXT] Room Lookup Error:", err);
        }
    }

    // Attempt 3: Regex Fallback (The "Hail Mary")
    if (!restaurantConfig && ctx.job?.room?.name) {
        console.log("⚠️ [CONTEXT] Final Fallback: Regex extraction from Room Name");
        const match = ctx.job.room.name.match(/call-(\d+)-/);
        if (match && match[1]) {
             try {
                 restaurantConfig = await prisma.restaurant.findUnique({
                     where: { id: parseInt(match[1]) }
                 });
                 if (restaurantConfig) console.log(`✅ [CONTEXT] Resolved via Regex: ${restaurantConfig.name}`);
             } catch (e) {}
        }
    }

    // Default Fallback
    if (!restaurantConfig) {
        console.error("🚨 [CRITICAL] Could not resolve restaurant context. Using DEFAULT.");
        restaurantConfig = {
            id: 0,
            name: "Generic Pizza",
            voiceSelection: "shimmer",
            instructions: "You are a helpful pizza assistant.",
            clover: { merchantId: null, apiKey: null },
            businessHours: [],
            timezone: "America/New_York",
            info: { address: "123 Main St", hours: "9am-9pm" }
        };
    }

    // Load Menu & Config
    let initialMenu = [];
    let menuLoadSuccess = false;

    try {
        if (restaurantConfig.id) {
           // ADAPTER: Map flat Prisma fields to nested config expected by services
           const cloverConfig = restaurantConfig.cloverMerchantId ? {
               merchantId: restaurantConfig.cloverMerchantId,
               apiKey: restaurantConfig.cloverApiKey,
               ecommerceToken: restaurantConfig.cloverEcommerceToken,
               environment: restaurantConfig.cloverEnvironment || "production"
           } : restaurantConfig.clover; // Fallback for default object

           // FIX: Update the main config object so tools see the resolved credentials
           restaurantConfig.clover = cloverConfig;

           if (cloverConfig?.apiKey && cloverConfig?.merchantId) {
               const menuData = await getMenu(cloverConfig, restaurantConfig.id);
               initialMenu = menuData.items;
               if (initialMenu.length > 0) {
                   menuLoadSuccess = true;
                   console.log(`🍔 [${INSTANCE_ID}] Initial Menu Loaded: ${initialMenu.length} items`);
                   // DEBUG: Check for specific missing items
                   const chickenItems = initialMenu.filter(i => i.name.toLowerCase().includes("chicken")).map(i => i.name);
                   const kormaItems = initialMenu.filter(i => i.name.toLowerCase().includes("korma")).map(i => i.name);
                   const fishItems = initialMenu.filter(i => i.name.toLowerCase().includes("fish")).map(i => i.name);
                   
                   console.log(`🔍 [DEBUG-MENU] Found ${chickenItems.length} 'Chicken' items:`, chickenItems.slice(0, 10)); 
                   console.log(`🔍 [DEBUG-MENU] Found ${kormaItems.length} 'Korma' items:`, kormaItems);
                   console.log(`🔍 [DEBUG-MENU] Found ${fishItems.length} 'Fish' items:`, fishItems);
                   
                   // VERIFICATION: Dump ALL items for user check (COMMENTED OUT FOR PRODUCTION/DEBUGGING)
                   // const allNames = initialMenu.map(i => i.name).sort();
                   // console.log("📜 [FULL MENU DUMP] Starting...");
                   // console.log(JSON.stringify(allNames, null, 2));
                   // console.log("📜 [FULL MENU DUMP] End.");

                   // DEBUG: Check API Key
                   if (!process.env.OPENAI_API_KEY) {
                       console.error("🚨 [CRITICAL] OPENAI_API_KEY is MISSING in environment variables!");
                   } else {
                       console.log(`✅ [${INSTANCE_ID}] OPENAI_API_KEY is present (${process.env.OPENAI_API_KEY.substring(0, 5)}...)`);
                   }
               } else {
                   console.warn(`⚠️ [${INSTANCE_ID}] STRICT MODE: Menu fetch returned 0 items. Disabling ordering.`);
                   menuLoadSuccess = false;
               }
           } else {
               console.warn(`⚠️ [${INSTANCE_ID}] STRICT MODE: Missing API Key or Merchant ID. Disabling ordering.`);
               menuLoadSuccess = false;
           }
        }
    } catch (err) {
        console.error("❌ Menu Load Failed (Strict Mode):", err.message);
        menuLoadSuccess = false;
    }

    // Wait for room connection
    await connectPromise;
    console.log(`🔗 [${INSTANCE_ID}] Connected to room: ${ctx.room.name}`);

    // Cleanup Listeners
    ctx.room.on("disconnected", async () => {
        console.log(`🔌 [${INSTANCE_ID}] Room Disconnected. Cleaning up...`);
        try {
            await finalizeSession(
                "Room Disconnected",
                sessionCart,
                finalCustomerDetails,
                restaurantConfig.id,
                callRecord?.id
            );
        } catch(e) {
            console.error("Finalize error:", e);
        }
        console.log(`👋 [${INSTANCE_ID}] Exiting process cleanly.`);
        process.exit(0);
    });

    // ------------------------------------------
    // PIPELINE (AgentSession) CONFIGURATION
    // ------------------------------------------
    
    // 1. Prepare State
    const sessionCart = [];
    const activeAllergies = new Set();
    const finalCustomerDetails = {
        name: customerName || "Guest",
        phone: customerPhone || "Unknown"
    };

    // 2. Prepare Tools & Prompt
    const cuisineKey = normalizeCuisineKey(restaurantConfig.cuisine || restaurantConfig.cuisineType || "american");
    const cuisineProfile = getCuisineProfile(cuisineKey);
    
    // Create Tools Object Map
    const tools = createRestaurantTools({
        restaurantConfig,
        activeRoom: ctx.room,
        customerDetails: finalCustomerDetails,
        sessionCart,
        callRecord,
        finalizeCallback: (reason) => finalizeSession(
            reason,
            sessionCart,
            finalCustomerDetails,
            restaurantConfig.id,
            callRecord?.id
        ),
        closeRoomCallback: async () => {
             console.log(`🔌 [${INSTANCE_ID}] Explicitly closing room for SIP disconnect: ${ctx.room.name}`);
             try {
                await roomService.deleteRoom(ctx.room.name);
             } catch (e) {
                console.error("Failed to close room via API:", e);
                // Fallback: Disconnect agent locally if API fails
                ctx.room.disconnect(); 
             }
        },
        cuisineProfile,
        activeAllergies,
        menuLoadSuccess // Pass strict flag
    });

    const systemPrompt = createRestaurantPrompt({
        restaurantConfig,
        initialMenu,
        cuisineProfile,
        customerDetails: finalCustomerDetails,
        menuLoadSuccess // Pass strict flag
    });

    const selectedVoice = getVoiceFromSelection(restaurantConfig.voiceSelection);

    // 3. Initialize OpenAI Realtime Model
    console.log(`🤖 [${INSTANCE_ID}] Initializing OpenAI Realtime Model with Voice: ${selectedVoice?.id}`);
    
    if (!selectedVoice?.id) throw new Error("Voice Selection Failed");

    // --- PREPARE TRANSCRIPTION HINTS ---
    // OpenAI Realtime/Whisper uses a 'prompt' string instead of explicit keyword boosting
    // OPTIMIZATION: Use extracted keywords instead of full list to save tokens (~90% reduction)
    const menuKeywords = initialMenu.length > 0 ? extractMenuKeywords(initialMenu) : "";
    
    const transcriptionPrompt = menuKeywords 
        ? `Vocabulary: ${menuKeywords}. Context: Restaurant ordering for ${restaurantConfig.name}.`
        : `Context: Restaurant ordering for ${restaurantConfig.name}.`;

    console.log(`📝 [${INSTANCE_ID}] Transcription Prompt: ${transcriptionPrompt.substring(0, 100)}...`);

    const model = new openai.realtime.RealtimeModel({
        model: "gpt-4o-realtime-preview",
        inputAudioTranscription: { 
            model: "gpt-4o-mini-transcribe",
            prompt: transcriptionPrompt // GUIDE THE MODEL WITH MENU ITEMS
        },
        instructions: systemPrompt,
        voice: selectedVoice.id,
        modalities: ["audio", "text"],
        toolChoice: "auto",
        temperature: 0.8,
    });

    // 4. Initialize Voice Agent & Session
    // We must create AgentSession manually because accessing agent.session throws if not managed by Worker
    const restaurantAgent = new voice.Agent({
        llm: model,
        instructions: systemPrompt,
        tools: tools,
    });

    const session = new voice.AgentSession({
        llm: model,
        instructions: systemPrompt,
        tools: tools,
    });

    // 5. Start Session
    try {
        console.log(`🚀 [${INSTANCE_ID}] Starting Realtime Session via AgentSession...`);
        
        // Start the high-level AgentSession
        await session.start({ agent: restaurantAgent, room: ctx.room });
        
        const initialGreeting = `Hello${customerName && customerName !== "Guest" ? " " + customerName : ""}! Welcome to ${restaurantConfig.name}. Would you like to place an order for pickup or delivery?`;
        
        // Send initial greeting (Realtime API pattern requires explicit item creation)
        session.chatCtx.addMessage({
            role: "assistant",
            content: initialGreeting
        });
        
        // Trigger response generation for the greeting
        session.generateReply();

        console.log(`✅ [${INSTANCE_ID}] Session Started. Triggered Greeting.`);
    } catch (e) {
        console.error(`❌ [${INSTANCE_ID}] Session Start Failed:`, e);
        // Cleanly exit to prevent zombie state
        process.exit(1); 
    }


  }
});

export default agent;

// Simplified entry point for production reliability
const isMain = process.argv[1] && (
  process.argv[1].endsWith('agent.js') || 
  process.argv[1] === fileURLToPath(import.meta.url)
);

if (isMain) {
  console.log(`🚀 [${INSTANCE_ID}] Worker bootstrapping...`);
  
  // Initialize LiveKit Worker
  const worker = new Worker(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    wsURL: process.env.LIVEKIT_URL,
  }));

  console.log(`🏗️ [${INSTANCE_ID}] Worker instance created. Running...`);
  await worker.run();
  console.log(`✅ [${INSTANCE_ID}] Worker has stopped.`);
}
