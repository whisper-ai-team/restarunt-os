// vadConfig.js - Voice Activity Detection configuration
import * as silero from "@livekit/agents-plugin-silero";

// -----------------------------
// GLOBAL SINGLETONS
// -----------------------------
export const vadLoadPromise = silero.VAD.load({
  minSpeechDuration: 0.1, 
  minSilenceDuration: 0.8, // Increased from 0.6s to reduce accidental cut-offs
  threshold: 0.5, // Increased from 0.3 to be less sensitive to background noise
});
