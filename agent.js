// agent.js - Main entry point for the Restaurant OS Voice Agent
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Google Cloud credentials (Used for STT only)
import { readFileSync } from "node:fs";
let googleCredentials = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    googleCredentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
  } catch (err) {}
}

import {
  defineAgent,
  cli,
  WorkerOptions,
  initializeLogger,
  voice,
} from "@livekit/agents";

import * as openai from "@livekit/agents-plugin-openai";
import * as deepgram from "@livekit/agents-plugin-deepgram";

// Import our modular components
import { isOpen, redact, INSTANCE_ID, startHeartbeat } from "./utils/agentUtils.js";
import { generateSTTKeywords } from "./utils/sttHelpers.js";
import { MOCK_DB, parseJobMetadata, COMMON_WORD_BLACKLIST } from "./config/agentConfig.js";
import { vadLoadPromise } from "./config/vadConfig.js";
import { getMenu } from "./services/cloverService.js";
import { finalizeSession } from "./services/sessionManager.js";
import { RestaurantAgent } from "./agent/RestaurantAgent.js";

import { getVoiceFromSelection } from "./voiceMap.js";
import { getCuisineProfile } from "./cuisines/cuisineRegistry.js";
import { sendSMS } from "./services/notificationService.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

process.setMaxListeners(50);
initializeLogger({ level: "info", destination: "stdout" });

console.log("🚀 Restaurant AI Agent Starting...");
console.log("📋 Google Credentials:", googleCredentials ? "✅ Loaded" : "❌ Not found");

// Start heartbeat monitoring
startHeartbeat();

// -----------------------------
// MAIN ENTRY
// -----------------------------
const agent = defineAgent({
  name: "restaurant-os-agent",

  entry: async (ctx) => {
    console.log("🔌 Parallel Boot: Connecting room & loading menu...");
    
    // 1. Kick off parallel tasks immediately
    const connectPromise = ctx.connect();
    
    // DEBUG: Log all available metadata sources
    console.log("🔍 DEBUG ctx.job:", JSON.stringify({
      metadata: ctx.job?.metadata,
      dispatchMetadata: ctx.job?.dispatch?.metadata,
      agentDispatchId: ctx.job?.dispatchId,
      room: ctx.job?.room?.name,
      namespace: ctx.job?.namespace
    }, null, 2));
    
    // Try multiple metadata sources
    const rawMetadata = ctx.job?.metadata || ctx.job?.dispatch?.metadata || "";
    console.log(`📋 Raw metadata string: "${rawMetadata}"`);
    
    const metadataDetails = parseJobMetadata(rawMetadata); // Local parse
    const menuPromise = getMenu(metadataDetails.clover, metadataDetails.id);
    
    await connectPromise;
    console.log("✅ Connected to LiveKit room");

    console.log("⏳ Waiting for caller...");
    const participant = await ctx.waitForParticipant();
    console.log(`👤 Caller Connected: ${participant.identity}`);
    
    console.log(`[DEBUG] Step 1: Loading Cuisine Profile...`);
    // 2. Load Enterprise Cuisine Profile
    const cuisineType = metadataDetails.cuisine || "indian"; 
    let cuisineProfile = getCuisineProfile(cuisineType);
    
    console.log(`🌍 [${INSTANCE_ID}] Cuisine Profile Loaded: ${cuisineProfile.name}`);

    console.log(`[DEBUG] Step 2: Resolving Menu Promise...`);
    // 3. Resolve background tasks
    const restaurantConfig = metadataDetails;
    
    // Aggressive Context Lookup with Retry
    // FORCE lookup if it's a SIP room (starts with call-) OR ID is missing
    const isSipRoom = ctx.job?.room?.name?.startsWith("call-");
    
    if ((isSipRoom || !restaurantConfig.id || !restaurantConfig.twilioCallSid) && ctx.job?.room?.name) {
       let attempts = 0;
       const maxAttempts = 3; // Increased for SIP resolution stability
       
       while (attempts < maxAttempts) {
         try {
           const roomName = ctx.job.room.name;
           console.log(`🌐 [${INSTANCE_ID}] Fetching latest Context for room: ${roomName} (Attempt ${attempts + 1}/${maxAttempts})`);
           const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
           const res = await fetch(`${apiUrl}/api/internal/room-context/${encodeURIComponent(roomName)}`);
           
           if (res.ok) {
              const context = await res.json();
              
              // If it's a fallback but we're in a SIP room, keep retrying to find the real mapping
              // Unless it's our last attempt
              if (context.isFallback && isSipRoom && attempts < maxAttempts - 1) {
                  console.log(`⚠️ [${INSTANCE_ID}] Received fallback context. Waiting for real SIP mapping...`);
              } else {
                  Object.assign(restaurantConfig, context); 
                  console.log(`✅ [${INSTANCE_ID}] Context Resolved via API. ID: ${restaurantConfig.id}, Name: ${restaurantConfig.name}`);

                  if (context.cuisineType) {
                      console.log(`🔄 [${INSTANCE_ID}] Updating Cuisine Profile to: ${context.cuisineType}`);
                      cuisineProfile = getCuisineProfile(context.cuisineType);
                  }
                  break; // Successful (or final fallback) resolution
              }
           } else {
               console.warn(`⚠️ [${INSTANCE_ID}] Context API attempt ${attempts + 1} failed with status ${res.status}`);
           }
         } catch(e) { 
           console.error(`❌ [${INSTANCE_ID}] Context Fetch Attempt ${attempts + 1} Failed`, e); 
         }
         
         attempts++;
         if (attempts < maxAttempts) {
           console.log(`⏳ [${INSTANCE_ID}] Retrying context fetch in 1.5s...`);
           await new Promise(resolve => setTimeout(resolve, 1500));
         }
       }
    }

    // ULTIMATE SECURITY: Fail Closed
    // No default tenant allowed. If ID is missing, we must end the call for safety.
    if (!restaurantConfig.id) {
        console.error("🚨 CRITICAL SECURITY ERROR: Restaurant ID missing after all lookups. Failing closed.");
        
        await connectPromise;
        const failureMessage = "We're sorry, our system is currently undergoing maintenance. Please try calling back later. Goodbye!";
        
        // Removed disconnect call to prevent mutex errors
        return; 
    }

    // 4. CHECK BUSINESS HOURS & AUTO-REJECT
    const isOpenNow = isOpen(restaurantConfig.businessHours, restaurantConfig.timezone);
    if (!isOpenNow && restaurantConfig.voiceSelection !== "test_mode") { // Allow bypass for testing if needed
        console.log(`⛔ [${INSTANCE_ID}] Restaurant is CLOSED (Schedule: ${JSON.stringify(restaurantConfig.businessHours)}). Auto-declining.`);
        
        // Connect just to say we are closed
        await connectPromise;
        
        // Let agent handle closed state through instructions
        console.log(`🔒 [${INSTANCE_ID}] Proceeding with CLOSED state instructions.`);
    }

    const { items: menuItems } = await menuPromise;
    console.log(`[DEBUG] Step 2b: Menu Promise Resolved. Items: ${menuItems ? menuItems.length : 0}`);

    const menuSummary = menuItems
      .slice(0, 150) // Show first 150 items to LLM (was 50)
      .map((i) => `- ${i.name} ($${((i.price || 0) / 100).toFixed(2)})`)
      .join("\n");
      
    console.log(`🚀 [${INSTANCE_ID}] Data ready. Menu items: ${menuItems.length}`);

    const callerPhone = participant.identity.replace("sip_", "");
    let customerDetails = { name: "Guest", phone: callerPhone };
    if (MOCK_DB[callerPhone]) {
      customerDetails = { name: MOCK_DB[callerPhone].name, phone: callerPhone };
    }
    console.log(`[DEBUG] Step 3: Customer Identified as ${customerDetails.name}`);

    let sessionCart = [];
    let isFinalized = false;

    let initialGreeting = restaurantConfig.greeting || "Hello! Welcome to our restaurant. How may I help you today?";
    
    // Personalize if known customer
    if (customerDetails.name !== "Guest") {
        const greetingPrefix = cuisineType === 'indian' ? "Namaste" : "Hello";
        initialGreeting = `${greetingPrefix} ${customerDetails.name}! Welcome back to ${restaurantConfig.name}.`;
    }

    // Safety check: ensure string
    if (!initialGreeting || initialGreeting === "null") {
        initialGreeting = "Hello! Welcome to our restaurant. How may I help you today?";
    }

    // LOGGING: Start Call
    let callRecord = null;
    try {
        if (restaurantConfig.id) {
           callRecord = await prisma.call.create({
             data: {
               restaurantId: restaurantConfig.id,
               customerPhone: callerPhone,
               status: "ongoing",
               twilioCallSid: metadataDetails.twilioCallSid || restaurantConfig.twilioCallSid
             }
           });
           console.log(`📞 Call Logged: ${callRecord.id}`);
        } else {
           console.warn("⚠️ No Restaurant ID - cannot log call.");
        }
    } catch (e) { 
        console.error("❌ CRITICAL: Call Log Start Failed!", e);
        console.error("   Details:", {
            restaurantId: restaurantConfig.id,
            customerPhone: callerPhone,
            error: e.message
        });
    }

    // 4. Generate STT Keywords Dynamically from menu
    // 4. Generate STT Keywords Dynamically from menu
    console.log(`[DEBUG] Step 3a: Generating keywords from menu...`);
    
    let deepgramKeywords = []; 
    
    try {
      const rawKeywords = generateSTTKeywords(menuItems);
      // Format for Deepgram adapter: Must be Array<[string, boost?]>
      // e.g. [["samosa"], ["biryani"]]
      deepgramKeywords = rawKeywords.map(word => [word]);
      
      console.log(`🛰️  [${INSTANCE_ID}] Injected ${deepgramKeywords.length} keywords from Menu Intelligence.`);
    } catch (err) {
      console.error(`⚠️ Keyword generation failed: ${err.message}`);
      deepgramKeywords = [];
    }

    // Transcript Logger - MUST be declared before finalize() for proper scope
    const transcriptLog = [];
    let restaurantAgent = null;
    let session = null; // Declare early for visibility in finalize

    // Helper to finalize session and log to DB
    const finalize = async (reason) => {
      console.log(`🛑 [${INSTANCE_ID}] Finalizing session. Reason: ${reason} (Transcript length: ${transcriptLog.length})`);
      if (isFinalized) return;
      isFinalized = true;
      
      // FLUSH DELAY: Give events a split second to finish emitting before we commit to DB
      await new Promise(r => setTimeout(r, 1000));

      // --- EXHAUSTIVE RECOVERY ---
      if (transcriptLog.length === 0) {
          console.log(`🔍 [${INSTANCE_ID}] Deep Searching for history...`);
          const possiblePaths = [
              { name: 'session.history', data: session?.history?.messages },
              { name: 'session._chatCtx', data: session?._chatCtx?.messages },
              { name: 'session.chat_ctx', data: session?.chat_ctx?.messages },
              { name: 'agent.chat_ctx', data: restaurantAgent?.chat_ctx?.messages },
              { name: 'session.llm.chat_ctx', data: session?.llm?.chat_ctx?.messages }
          ];

          for (const path of possiblePaths) {
              if (path.data && path.data.length > 0) {
                  console.log(`🎯 [${INSTANCE_ID}] Found history in ${path.name} (${path.data.length} items)`);
                  path.data.forEach(msg => {
                      if (msg.role === 'user' || msg.role === 'assistant') {
                          let text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(c => c.text || "").join(" ") : "");
                          if (text && text.trim()) {
                              transcriptLog.push({ role: msg.role === 'assistant' ? 'agent' : 'user', text: redact(text), time: new Date() });
                          }
                      }
                  });
                  break; 
              }
          }
      }

      // LOGGING: Final DB Save
      if (callRecord) {
         try {
             const duration = Math.round((Date.now() - callRecord.createdAt.getTime()) / 1000);
             const hasInteraction = transcriptLog.length > 0 || duration > 10;
             
             let finalStatus = "missed";
             if (sessionCart.length > 0) finalStatus = "order_placed";
             else if (reason === "Caller Hangup" || hasInteraction) finalStatus = "completed";
             
             // Fix summary to include Price for Dashboard visibility
             const totalCents = sessionCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
             const summaryText = sessionCart.length > 0 
                ? `Order Placed: $${(totalCents/100).toFixed(2)} (${sessionCart.length} items)` 
                : (hasInteraction ? "Call completed" : "Missed call");

             console.log(`💾 [${INSTANCE_ID}] Saving ${transcriptLog.length} items to DB. Status: ${finalStatus}. Summary: ${summaryText}`);
             
             await prisma.call.update({
                 where: { id: callRecord.id },
                 data: {
                   endedAt: new Date(),
                   status: finalStatus,
                   duration: duration,
                   transcript: transcriptLog,
                   summary: summaryText
                 }
             });
             console.log(`✅ [${INSTANCE_ID}] DB Save Complete.`);
         } catch(e) { console.error(`❌ [${INSTANCE_ID}] DB Save Failed:`, e); }
      }

      // Use restaurantConfig.id OR fall back to callRecord.restaurantId (which was set successfully)
      const restId = restaurantConfig?.id || callRecord?.restaurantId;
      console.log(`🔍 [finalize] restaurantId = ${restId}`);
      await finalizeSession(reason, sessionCart, customerDetails, restId, callRecord?.id);

      // --- DYNAMIC POST-CALL PROMOTION ---
      try {
        const notifs = restaurantConfig.notificationConfig;
        // Only send if configured AND call was meaningful (Order Placed or Completed)
        if (notifs && notifs.customMessage && (sessionCart.length > 0 || reason === "Caller Hangup")) {
             console.log(`📨 [${INSTANCE_ID}] Preparing Post-Call SMS...`);
             let promoMessage = notifs.customMessage;
             
             if (notifs.promotions && notifs.promotions.length > 0) {
                 promoMessage += "\n\n🌟 Special Offers:\n" + notifs.promotions.map(p => "• " + p).join("\n");
             }
             
             await sendSMS(customerDetails.phone, promoMessage);
             console.log(`✅ [${INSTANCE_ID}] Post-Call SMS Sent.`);
        }
      } catch (promoErr) {
        console.error(`⚠️ Failed to send post-call SMS: ${promoErr.message}`);
      }
    };

    const onHangup = async () => await finalize("Caller Hangup");
    const onRoomClose = async () => await finalize("Room Closed");
    
    // Use 'once' to prevent double-firing, though our boolean guard handles it
    ctx.room.once("participant_disconnected", onHangup);
    ctx.room.once("disconnected", onRoomClose);

    console.log(`[DEBUG] Step 3b: Awaiting VAD Load...`);
    let vadModel;
    try {
      // Race VAD load against a 5s timeout
      vadModel = await Promise.race([
        vadLoadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("VAD Load Timeout")), 5000))
      ]);
      console.log(`[DEBUG] Step 4: VAD Model Loaded`);
    } catch (err) {
      console.error(`🚨 [CRITICAL] VAD Failed to Load: ${err.message}`);
      throw err; 
    }
    
    const selectedVoice = getVoiceFromSelection(restaurantConfig.voiceSelection);
    console.log(`[DEBUG] Step 5: Voice Selected: ${selectedVoice.id}`);

    // Assign to outer let variable reference
    restaurantAgent = new RestaurantAgent({
      restaurantConfig,
      initialMenu: menuSummary,
      activeRoom: ctx.room,
      cuisineProfile,
      customerDetails,
      sessionCart,
      callRecord,
      finalizeCallback: finalize // Pass local finalize function to agent
    });
    console.log(`[DEBUG] Step 6: Restaurant Agent Instantiated`);

    console.log(`🎤 [${INSTANCE_ID}] Pipeline ready. Voice: ${selectedVoice.name} (${selectedVoice.id})`);

    session = new voice.AgentSession({
      vad: vadModel,
      stt: new deepgram.STT({
        model: "nova-2",
        language: "en-IN",
        keywords: deepgramKeywords, // Re-enabled with proper formatting
        smartFormat: true,
        endpointing: 150,
        interimResults: true,
        utteranceEndMs: 800,
      }),
      llm: new openai.LLM({ model: "gpt-4o-mini" }),
      tts: new openai.TTS({ 
        voice: selectedVoice.id, 
        model: "tts-1",
        speed: restaurantConfig.voiceSpeed || 1.0
      }),
    });

    console.log(`✅ [${INSTANCE_ID}] Session Initialized with OpenAI Voice: ${selectedVoice.name}`);

    // Add comprehensive logs for speech events
    session.on("user_started_speaking", () => {
      console.log("🎤 User started speaking...");
    });

    session.on("user_stopped_speaking", () => {
      console.log("🎤 User stopped speaking.");
    });

    // Generic Transcription Listener (Often more robust than user_started/stopped)
    session.on("transcription", (trans) => {
        console.log(`📝 [${INSTANCE_ID}] [RAW] session:transcription:`, JSON.stringify(trans));
    });

    // --- ULTRA-ROBUST ROOM-LEVEL LISTENER ---
    // If AgentSession events fail, the Room will still see the text.
    ctx.room.on("transcriptionReceived", (transcriptions, participant) => {
        console.log(`📝 [${INSTANCE_ID}] [ROOM EVENT] Received from ${participant?.identity || 'unknown'}`);
        transcriptions.forEach(t => {
            const text = redact(t.text || "");
            if (!text.trim()) return;
            
            const role = (participant?.identity?.includes('agent') || participant?.identity === ctx.room.localParticipant.identity) ? 'agent' : 'user';
            
            console.log(`   [ROOM TRANSCRIPT] ${role.toUpperCase()}: "${text}"`);
            
            // Check for duplicates before pushing
            const isDuplicate = transcriptLog.some(existing => existing.text === text && existing.role === role);
            if (!isDuplicate) {
                transcriptLog.push({ role, text, time: new Date() });
                
                // Real-time Save
                if (callRecord) {
                    prisma.call.update({
                        where: { id: callRecord.id },
                        data: { transcript: transcriptLog }
                    }).catch(() => {});
                }
            }
        });
    });

    // Transcript event handlers (using correct event names for @livekit/agents v1.x)
    session.on("user_input_transcribed", (ev) => {
      console.log(`📝 [${INSTANCE_ID}] [DEBUG] User Input Transcribed. isFinal: ${ev.isFinal}, text: "${ev.transcript}"`);
      
      if (ev.isFinal) {
        const text = redact(ev.transcript || "");
        if (text.trim()) {
            console.log(`📝 [${INSTANCE_ID}] Pushing User Final: "${text}"`);
            transcriptLog.push({ role: "user", text, time: new Date() });
            
            // --- AUTO-SAVE ON EVERY TURN ---
            if (callRecord) {
                prisma.call.update({
                    where: { id: callRecord.id },
                    data: { transcript: transcriptLog }
                }).catch(() => {});
            }
        }
      }
    });

    session.on("conversation_item_added", (ev) => {
      const msg = ev.item;
      console.log(`💬 [${INSTANCE_ID}] Conversation Item Added. Role: ${msg.role}`);
      
      if (msg.role === 'assistant') {
        const text = redact(typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(c => typeof c === 'string' ? c : (c.text || "")).join(" ") : ""));
        if (text.trim()) {
            // Check for duplicates
            const isDuplicate = transcriptLog.some(existing => existing.text === text && existing.role === 'agent');
            if (!isDuplicate) {
                console.log(`🤖 [${INSTANCE_ID}] Pushing Agent Final: "${text}"`);
                transcriptLog.push({ role: "agent", text, time: new Date() });
                
                // --- AUTO-SAVE ON EVERY TURN ---
                if (callRecord) {
                    prisma.call.update({
                        where: { id: callRecord.id },
                        data: { transcript: transcriptLog }
                    }).catch(() => {});
                }
            }
        }
      }
    });

    session.on("agent_started_speaking", () => {
      console.log("🗣️  Agent started speaking...");
    });

    session.on("agent_stopped_speaking", () => {
      console.log("🗣️  Agent stopped speaking.");
    });

    // Add error listener to session for unexpected failures
    session.on("error", (err) => {
      console.error("🚨 Session error event:", err);
    });

    try {
      console.log(`🎬 [${INSTANCE_ID}] Starting agent session...`);
      
      // DIAGNOSTIC: Log session properties to find where chat history is hidden
      console.log(`🔍 [${INSTANCE_ID}] Session properties:`, Object.keys(session).filter(k => !k.startsWith('_')));

      // --- THE "DIFFERENT ROUTE": BACKGROUND AUTO-SAVE ---
      // Instead of waiting for the end, we poll the session context every 5 seconds.
      const autoSaveInterval = setInterval(async () => {
          if (isFinalized) return;
          
          const activeHistory = session?.history?.messages || session?._chatCtx?.messages;
          if (!activeHistory || activeHistory.length <= transcriptLog.length) return;

          console.log(`💾 [${INSTANCE_ID}] Auto-saving transcript snapshot (${activeHistory.length} messages)...`);
          const newTrace = [];
          activeHistory.forEach(msg => {
              if (msg.role === 'user' || msg.role === 'assistant') {
                  let text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(c => c.text || "").join(" ") : "");
                  if (text && text.trim()) {
                      newTrace.push({ role: msg.role === 'assistant' ? 'agent' : 'user', text: redact(text), time: new Date() });
                  }
              }
          });

          if (newTrace.length > 0 && callRecord) {
              try {
                  await prisma.call.update({
                      where: { id: callRecord.id },
                      data: { transcript: newTrace }
                  });
              } catch (e) {
                  console.error(`⚠️ [${INSTANCE_ID}] Auto-save failed:`, e.message);
              }
          }
      }, 5000);

      await session.start({ agent: restaurantAgent, room: ctx.room });
      console.log(`✅ [${INSTANCE_ID}] Session started successfully`);
      
      console.log(`🗣️  Generating greeting: "${initialGreeting}"`);
      await session.generateReply({
        instructions: `Say exactly: "${initialGreeting}"`,
      });
      
      await new Promise((resolve) => ctx.room.on("disconnected", resolve));
      clearInterval(autoSaveInterval);
    } catch (err) {
      // Silence known shutdown errors
      if (err?.code === 'APIUserAbortError' || err?.message?.includes('aborted')) {
          console.log("ℹ️ Session ended normally (User Abort / Hangup).");
      } else {
          console.error("❌ Unexpected Session Error:", err);
      }
    } finally {
      // Ensure finalize runs even if we crash out of the session
      if (!isFinalized) await finalize("Session Ended (Finally Block)");
      
      ctx.room.off("participant_disconnected", onHangup);
      ctx.room.off("disconnected", onRoomClose);
    }
  },
});

export default agent;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
}
