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
  voice, // Back to 'voice' namespace
  WorkerOptions,
  Worker,
} from "@livekit/agents";
import { RoomServiceClient } from "livekit-server-sdk";

import * as openai from "@livekit/agents-plugin-openai";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as silero from "@livekit/agents-plugin-silero";

// Import our modular components
import { isOpen, redact, INSTANCE_ID, startHeartbeat } from "./utils/agentUtils.js";
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
                   
                   // VERIFICATION: Dump ALL items for user check
                   const allNames = initialMenu.map(i => i.name).sort();
                   console.log("📜 [FULL MENU DUMP] Starting...");
                   console.log(JSON.stringify(allNames, null, 2));
                   console.log("📜 [FULL MENU DUMP] End.");
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

    // 3. Create Interaction Agent
    const agentId = "restaurant-agent-" + INSTANCE_ID;
    console.log(`🤖 [${INSTANCE_ID}] Creating Agent (ID: ${agentId}) with Voice: ${selectedVoice?.id}`);
    
    if (!selectedVoice?.id) throw new Error("Voice Selection Failed");

    const restaurantAgent = new voice.Agent({
        id: agentId,
        instructions: systemPrompt,
        tools: tools,
    });
    
    // GUARDRAIL: Ensure 'id' is strictly accessible (Polyfill for older Agent SDKs if needed)
    if (!restaurantAgent.id) {
        console.warn(`⚠️ [${INSTANCE_ID}] Agent.id is missing after construction! Patching...`);
        restaurantAgent.id = agentId;
    }
    // Also patch internal _id if it exists, just in case
    if (restaurantAgent._id === undefined) restaurantAgent._id = agentId;

    // 4. Create Session with Optimized Pipeline
    console.log(`🎤 [${INSTANCE_ID}] Initializing AgentSession...`);
    
    // Debug Room State
    if (!ctx.room) console.error(`❌ [${INSTANCE_ID}] CRITICAL: Room is undefined!`);
    else console.log(`🔍 [${INSTANCE_ID}] Room State: Name=${ctx.room.name}, SID=${ctx.room.sid}`);

    // --- PREPARE STT KEYWORDS ---
    const sttKeywords = initialMenu.length > 0 ? 
        initialMenu
          .map(i => i.name.replace(/[^a-zA-Z\s]/g, "").trim()) 
          .filter(n => n.length > 3) 
          .map(name => [name, "3.0"]) 
        : [];

    if (customerName && customerName !== "Guest") {
        const nameParts = customerName.split(" ").filter(p => p.length > 2);
        nameParts.forEach(part => sttKeywords.push([part, "10.0"]));
    }
    ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"].forEach(d => sttKeywords.push([d, "5.0"]));

    const session = new voice.AgentSession({
        agent: restaurantAgent,
        
        // --- LATENCY & INTERRUPTION OPTIMIZATIONS ---
        voiceOptions: {
            allowInterruptions: true,
            minInterruptionDuration: 500, // 0.5s of speech to interrupt
            minEndpointingDelay: 100, // 100ms silence = turn end (Fast!)
            maxEndpointingDelay: 1500, // Force end turn after 1.5s
            preemptiveGeneration: true // Start LLM early
        },
        
        vad: new silero.VAD({
            minSpeechDuration: 0.1, 
            minSilenceDuration: 0.1, // Quick turn taking
        }),
        stt: new deepgram.STT({
            model: "nova-2-general", 
            smartFormat: true,
            interimResults: true, // Important for interruption detection
            keywords: sttKeywords
        }),
        llm: new openai.LLM({
            model: "gpt-4o-mini", // Low latency model
        }),
        tts: new openai.TTS({
            voice: selectedVoice.id,
            speed: restaurantConfig.voiceSpeed || 1.1,
        }),
    });

    // 5. Start Session
    try {
        console.log(`🚀 [${INSTANCE_ID}] Starting Session...`);
        // CRITICAL FIX: Pass 'agent' to start() as AgentSession constructor does not retain it in this version
        await session.start({ room: ctx.room, agent: restaurantAgent });
        
        const initialGreeting = `Hello${customerName && customerName !== "Guest" ? " " + customerName : ""}! Welcome to ${restaurantConfig.name}. Would you like to place an order for pickup or delivery?`;
        
        await session.say(initialGreeting);
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
