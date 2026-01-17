// google-tts-config.js
// Configuration helper for Google Cloud TTS

import "dotenv/config";

export function getGoogleTTSConfig() {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    console.warn("⚠️  GOOGLE_CLOUD_API_KEY not found in .env");
    console.warn("   Falling back to OpenAI TTS");
    return null;
  }
  
  // Set the environment variable that Google Cloud client library expects
  process.env.GOOGLE_API_KEY = apiKey;
  
  return {
    voice: "en-IN-Neural2-B", // Male Indian English
    languageCode: "en-IN",
    speakingRate: 1.0,
    pitch: 0.0,
  };
}

// Test if Google Cloud TTS is configured
export function isGoogleTTSAvailable() {
  return !!process.env.GOOGLE_CLOUD_API_KEY;
}
