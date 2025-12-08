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
} = livekit;

// Plugin imports
const openai = require("@livekit/agents-plugin-openai");
const deepgram = require("@livekit/agents-plugin-deepgram");
const elevenlabs = require("@livekit/agents-plugin-elevenlabs");

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
console.log("=======================================");

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
    const menuText = config.menu || "Menu is not available right now.";

    // 3) Wait for SIP caller to join
    console.log("⏳ Waiting for human caller to join SIP...");
    const participant = await ctx.waitForParticipant();
    console.log("👤 Human Caller Detected:", participant.identity);

    // 4) Define the voice Agent (behavior / instructions)
    const restaurantAgent = new voice.Agent({
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
        - If caller says "butter chicken", "biryani", "tandoori", etc., map to the closest item.
        - Offer 1–2 suggestions, not a long list.
        - If item is not in the menu text, say:
          "I don’t see that exact item on today’s menu, but we have something similar: ..."
    
        **Order Flow**
        - For orders, follow this sequence:
          1) Ask what they’d like to order.
          2) For each item: confirm size (if applicable), spice level, and quantity.
          3) At the end, repeat the full order slowly.
          4) Confirm pickup/delivery time and phone number if needed.
    
        **Rules**
        - Keep responses short and clear for phone audio.
        - Never guess about prices or availability if not in context; say you'll confirm with staff.
        - If caller sounds confused, slow down and rephrase simply.
        ${systemPromptText}
      `,
    });

    // 5) Configure the AgentSession: STT + LLM + TTS
    const session = new voice.AgentSession({
      // Deepgram STT – can bias to Indian English if you want
      stt: new deepgram.STT({
        // language: "en-IN", // uncomment if your Deepgram plan supports it
      }),

      // OpenAI LLM
      llm: new openai.LLM({
        model: "gpt-4o-mini",
      }),

      // ElevenLabs TTS with Indian-style voice
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
