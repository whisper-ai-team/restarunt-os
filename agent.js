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
  metrics,
} from "@livekit/agents";
import { RoomServiceClient } from "livekit-server-sdk";

// OpenAI Realtime Plugin
import * as openai from "@livekit/agents-plugin-openai";

// Import our modular components
import { isOpen, redact, INSTANCE_ID, startHeartbeat, extractMenuKeywords, truncateText } from "./utils/agentUtils.js";
import { getPlanLimits, getUsageStatus } from "./utils/billing.js";
import { getModelRouting } from "./utils/modelRouting.js";
import { getDeterministicReply } from "./utils/intentRouting.js";

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
  // Suppress benign cleanup errors (SDK race conditions during session teardown)
  if (errStr.includes("samplerate") || 
      errStr.includes("vad") ||
      errStr.includes("writable") ||
      errStr.includes("err_internal_assertion")) {
     return; // Silent ignore - these are harmless cleanup race conditions
  }
  console.error("🚨 CRITICAL: Unhandled Rejection in Agent Process:", reason);
});

initializeLogger({ level: "info", destination: "stdout" });
console.log(`🚀 [${INSTANCE_ID}] Script Loaded. Waiting for entrypoint...`);

const MAX_TRANSCRIPTION_PROMPT_CHARS = parseInt(process.env.AI_MAX_TRANSCRIPTION_PROMPT_CHARS || "800", 10);
const MAX_SYSTEM_PROMPT_CHARS = parseInt(process.env.AI_MAX_SYSTEM_PROMPT_CHARS || "22000", 10);
const DEFAULT_MAX_TOOL_CALLS = parseInt(process.env.AI_MAX_TOOL_CALLS || "40", 10);
const DEFAULT_MENU_CACHE_MS = parseInt(process.env.AI_MENU_CACHE_MS || "30000", 10);
const INTENT_ROUTER_ENABLED = process.env.AI_INTENT_ROUTER_ENABLED !== "0";
const DETERMINISTIC_TTS_ENABLED = process.env.AI_DETERMINISTIC_TTS_ENABLED !== "0";
const DETERMINISTIC_TTS_MODEL = process.env.AI_DETERMINISTIC_TTS_MODEL || "tts-1";
const DETERMINISTIC_TTS_VOICE = process.env.AI_DETERMINISTIC_TTS_VOICE || "alloy";
const DETERMINISTIC_TTS_SPEED = parseFloat(process.env.AI_DETERMINISTIC_TTS_SPEED || "1");

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
    class RoutedAgent extends voice.Agent {
      constructor(opts, routing) {
        super(opts);
        this._routing = routing;
      }

      async onUserTurnCompleted(_chatCtx, userMessage) {
        if (!this._routing?.enabled) return;
        const transcript = typeof userMessage?.content === "string" ? userMessage.content : "";
        const route = getDeterministicReply(transcript, { chatCtx: this.session.chatCtx });
        if (!route) return;

        if (!this._routing.ttsEnabled) {
          console.warn(`⚠️ [${INSTANCE_ID}] Deterministic route matched (${route.id}) but TTS disabled.`);
          return;
        }

        try {
          let reply = route.reply;
          if (route.id === "repeat_summary" && typeof this._routing.getOrderSummary === "function") {
            reply = this._routing.getOrderSummary();
          }
          console.log(`🧭 [${INSTANCE_ID}] Deterministic route: ${route.id} -> "${reply}"`);
          this.session.say(reply, { addToChatCtx: true });
          throw new voice.StopResponse();
        } catch (err) {
          if (err instanceof voice.StopResponse) throw err;
          console.error("Deterministic reply failed; falling back to LLM:", err.message || err);
        }
      }
    }
    
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

    const planLimits = getPlanLimits(restaurantConfig.subscriptionPlan);
    const { planKey, monthlyMinutes, maxCallSeconds } = planLimits;
    const modelRouting = getModelRouting(planKey, maxCallSeconds);
    let usageExceeded = false;

    if (restaurantConfig.id && monthlyMinutes >= 0) {
        try {
            const usageStatus = await getUsageStatus(prisma, restaurantConfig, planLimits);
            usageExceeded = usageStatus.usageExceeded;
            if (usageExceeded) {
                console.warn(`⚠️ [${INSTANCE_ID}] Usage limit reached: ${usageStatus.usedMinutes}/${monthlyMinutes} minutes for plan ${planKey}.`);
            }
        } catch (err) {
            console.error("⚠️ Usage limit check failed; allowing call to proceed:", err.message);
        }
    }

    // Normalize Clover Config for downstream tools
    if (restaurantConfig.id) {
        const cloverConfig = restaurantConfig.cloverMerchantId ? {
            merchantId: restaurantConfig.cloverMerchantId,
            apiKey: restaurantConfig.cloverApiKey,
            ecommerceToken: restaurantConfig.cloverEcommerceToken,
            environment: restaurantConfig.cloverEnvironment || "production"
        } : restaurantConfig.clover;
        restaurantConfig.clover = cloverConfig;
    }

    // Load Menu & Config
    let initialMenu = [];
    let menuLoadSuccess = false;

    if (!usageExceeded) {
        try {
            if (restaurantConfig.id) {
               if (restaurantConfig.clover?.apiKey && restaurantConfig.clover?.merchantId) {
                   const menuData = await getMenu(restaurantConfig.clover, restaurantConfig.id);
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
    } else {
        console.warn(`⚠️ [${INSTANCE_ID}] Usage exceeded; skipping menu load.`);
    }

    // Wait for room connection
    await connectPromise;
    console.log(`🔗 [${INSTANCE_ID}] Connected to room: ${ctx.room.name}`);

    // Cleanup Listeners
    let callTimeoutHandle = null;
    let callStartedAt = null;
    let usagePersisted = false;
    const usageCollector = new metrics.UsageCollector();

    const effectiveMaxSessionDurationMs = modelRouting.maxSessionDurationMs || null;

    const getUsageSnapshot = () => {
        const summary = usageCollector.getSummary();
        const durationMs = callStartedAt ? Math.max(0, Date.now() - callStartedAt) : 0;
        const totalTokens = summary.llmPromptTokens + summary.llmCompletionTokens;
        const tokensPerMinute = durationMs > 0 ? Math.round((totalTokens / (durationMs / 60000)) * 100) / 100 : 0;
        return {
            ...summary,
            totalTokens,
            tokensPerMinute,
            durationMs
        };
    };

    const persistCallUsage = async (reason) => {
        if (usagePersisted) return;
        usagePersisted = true;
        if (!prisma || !callRecord?.id) return;

        const snapshot = getUsageSnapshot();
        try {
            await prisma.call.update({
                where: { id: callRecord.id },
                data: {
                    duration: Math.round(snapshot.durationMs / 1000),
                    endedAt: new Date(),
                    aiUsage: {
                        reason,
                        llmPromptTokens: snapshot.llmPromptTokens,
                        llmPromptCachedTokens: snapshot.llmPromptCachedTokens,
                        llmCompletionTokens: snapshot.llmCompletionTokens,
                        totalTokens: snapshot.totalTokens,
                        tokensPerMinute: snapshot.tokensPerMinute,
                        sttAudioDurationMs: snapshot.sttAudioDurationMs,
                        ttsCharactersCount: snapshot.ttsCharactersCount
                    },
                    modelConfig: {
                        planKey,
                        realtimeModel: modelRouting.realtimeModel,
                        transcriptionModel: modelRouting.transcriptionModel,
                        temperature: modelRouting.temperature,
                        maxResponseOutputTokens: modelRouting.maxResponseOutputTokens,
                        maxSessionDurationMs: effectiveMaxSessionDurationMs
                    }
                }
            });
        } catch (err) {
            console.error("❌ Failed to persist call usage:", err.message);
        }
    };

    ctx.room.on("disconnected", async () => {
        console.log(`🔌 [${INSTANCE_ID}] Room Disconnected. Cleaning up...`);
        await persistCallUsage("Room Disconnected");
        if (callTimeoutHandle) clearTimeout(callTimeoutHandle);
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
    const lastUserTranscriptRef = { text: "", createdAt: 0 };
    const finalCustomerDetails = {
        name: customerName || "Guest",
        phone: customerPhone || "Unknown"
    };
    const getOrderSummary = () => {
        if (!sessionCart.length) {
            return "I don't have any items in your order yet. What would you like to add?";
        }
        const summary = sessionCart.map(item => `${item.qty} ${item.name}`).join(", ");
        const totalCents = sessionCart.reduce((acc, item) => acc + ((item.price || 0) * item.qty), 0);
        const totalText = totalCents > 0 ? ` The total so far is $${(totalCents / 100).toFixed(2)}.` : "";
        return `Here is your order: ${summary}.${totalText} Is that correct?`;
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
        menuLoadSuccess, // Pass strict flag
        lastUserTranscriptRef,
        maxToolCalls: DEFAULT_MAX_TOOL_CALLS,
        menuCacheMs: DEFAULT_MENU_CACHE_MS
    });

    const systemPromptBase = usageExceeded
        ? `You are the answering system for ${restaurantConfig.name}.
CRITICAL: The customer's plan has reached its monthly minutes.
Instructions:
1. Apologize briefly.
2. Say their plan limit has been reached for this billing period.
3. Ask them to contact support or upgrade.
4. Say "Goodbye" and call 'hangUp'.`
        : createRestaurantPrompt({
            restaurantConfig,
            initialMenu,
            cuisineProfile,
            customerDetails: finalCustomerDetails,
            menuLoadSuccess // Pass strict flag
        });
    const systemPrompt = truncateText(systemPromptBase, MAX_SYSTEM_PROMPT_CHARS, "\n...[PROMPT TRUNCATED]");

    const selectedVoice = getVoiceFromSelection(restaurantConfig.voiceSelection);
    const deterministicTts = DETERMINISTIC_TTS_ENABLED
        ? new openai.TTS({
            model: DETERMINISTIC_TTS_MODEL,
            voice: DETERMINISTIC_TTS_VOICE,
            speed: DETERMINISTIC_TTS_SPEED
        })
        : undefined;
    if (DETERMINISTIC_TTS_ENABLED && !deterministicTts) {
        console.warn(`⚠️ [${INSTANCE_ID}] Deterministic TTS enabled but failed to initialize.`);
    }

    // 3. Initialize OpenAI Realtime Model
    console.log(`🤖 [${INSTANCE_ID}] Initializing OpenAI Realtime Model with Voice: ${selectedVoice?.id}`);
    console.log(`🧭 [${INSTANCE_ID}] Model routing: plan=${planKey}, realtime=${modelRouting.realtimeModel}, stt=${modelRouting.transcriptionModel}, temp=${modelRouting.temperature}, maxOut=${modelRouting.maxResponseOutputTokens}, maxSessionMs=${effectiveMaxSessionDurationMs ?? "default"}, intentRouter=${INTENT_ROUTER_ENABLED}, deterministicTts=${!!deterministicTts}`);
    
    if (!selectedVoice?.id) throw new Error("Voice Selection Failed");

    // --- PREPARE TRANSCRIPTION HINTS ---
    // OpenAI Realtime/Whisper uses a 'prompt' string instead of explicit keyword boosting
    // OPTIMIZATION: Use extracted keywords instead of full list to save tokens (~90% reduction)
    const menuKeywords = initialMenu.length > 0 ? extractMenuKeywords(initialMenu) : "";
    
    const transcriptionPromptRaw = menuKeywords 
        ? `Vocabulary: ${menuKeywords}. Context: Restaurant ordering for ${restaurantConfig.name}.`
        : `Context: Restaurant ordering for ${restaurantConfig.name}.`;
    const transcriptionPrompt = truncateText(transcriptionPromptRaw, MAX_TRANSCRIPTION_PROMPT_CHARS, "...");

    console.log(`📝 [${INSTANCE_ID}] Transcription Prompt: ${transcriptionPrompt.substring(0, 100)}...`);

    const maxSessionDurationMs = effectiveMaxSessionDurationMs || undefined;
    const maxResponseOutputTokens = modelRouting.maxResponseOutputTokens > 0 ? modelRouting.maxResponseOutputTokens : undefined;

    const model = new openai.realtime.RealtimeModel({
        model: modelRouting.realtimeModel,
        inputAudioTranscription: { 
            model: modelRouting.transcriptionModel,
            prompt: transcriptionPrompt // GUIDE THE MODEL WITH MENU ITEMS
        },
        instructions: systemPrompt,
        voice: selectedVoice.id,
        modalities: ["audio", "text"],
        toolChoice: "auto",
        temperature: modelRouting.temperature,
        ...(maxSessionDurationMs ? { maxSessionDuration: maxSessionDurationMs } : {}),
        ...(maxResponseOutputTokens ? { maxResponseOutputTokens } : {})
    });

    // 4. Initialize Voice Agent & Session
    // We must create AgentSession manually because accessing agent.session throws if not managed by Worker
    const restaurantAgent = new RoutedAgent({
        llm: model,
        instructions: systemPrompt,
        tools: tools,
        tts: deterministicTts
    }, {
        enabled: INTENT_ROUTER_ENABLED,
        ttsEnabled: !!deterministicTts,
        getOrderSummary
    });

    const session = new voice.AgentSession({
        llm: model,
        instructions: systemPrompt,
        tools: tools,
        tts: deterministicTts
    });
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
        if (!ev) return;
        const transcript = typeof ev.transcript === "string" ? ev.transcript : "";
        if (!transcript && !ev.isFinal) return;
        lastUserTranscriptRef.text = transcript;
        lastUserTranscriptRef.createdAt = ev.createdAt || Date.now();
    });
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
        usageCollector.collect(ev.metrics);
    });

    // 5. Start Session
    try {
        console.log(`🚀 [${INSTANCE_ID}] Starting Realtime Session via AgentSession...`);
        
        // Start the high-level AgentSession
        await session.start({ agent: restaurantAgent, room: ctx.room });
        callStartedAt = Date.now();
        
        const initialGreeting = usageExceeded
            ? `Hello${customerName && customerName !== "Guest" ? " " + customerName : ""}. I'm sorry, but your plan has reached its monthly minutes for this billing period. Please contact support or upgrade your plan. Goodbye.`
            : `Hello${customerName && customerName !== "Guest" ? " " + customerName : ""}! Welcome to ${restaurantConfig.name}. Would you like to place an order for pickup or delivery?`;
        
        // Send initial greeting (Realtime API pattern requires explicit item creation)
        session.chatCtx.addMessage({
            role: "assistant",
            content: initialGreeting
        });
        
        // Trigger response generation for the greeting
        session.generateReply();

        const hardStopSeconds = usageExceeded ? Math.min(30, maxCallSeconds) : maxCallSeconds;
        if (hardStopSeconds > 0) {
            callTimeoutHandle = setTimeout(async () => {
                console.warn(`⏱️ [${INSTANCE_ID}] Call duration cap reached (${hardStopSeconds}s). Ending call.`);
                await persistCallUsage("Call duration cap reached");
                try {
                    await finalizeSession(
                        "Call duration cap reached",
                        sessionCart,
                        finalCustomerDetails,
                        restaurantConfig.id,
                        callRecord?.id
                    );
                } catch (err) {
                    console.error("Finalize error during timeout:", err);
                }
                try {
                    await roomService.deleteRoom(ctx.room.name);
                } catch (err) {
                    console.error("Room close failed during timeout:", err);
                    ctx.room.disconnect();
                }
            }, hardStopSeconds * 1000);
        }

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
