// voiceMap.js
import fs from "fs";
import path from "path";

// 1. The List of High-Performance OpenAI Voices
const PROFESSIONAL_VOICES = [
  { name: "Nova", id: "nova", tags: ["female", "energetic", "hospitality"] },
  { name: "Shimmer", id: "shimmer", tags: ["female", "soft", "clear"] },
  { name: "Alloy", id: "alloy", tags: ["neutral", "balanced", "professional"] },
  { name: "Echo", id: "echo", tags: ["male", "warm", "deep"] },
  { name: "Onyx", id: "onyx", tags: ["male", "authoritative", "confidence"] },
  { name: "Fable", id: "fable", tags: ["neutral", "dynamic", "storyteller"] },
];

const STATE_FILE = path.resolve("./voice_state.json");

/**
 * Gets the next voice in the list using a persistent file.
 */
function getNextRotatedVoice() {
  let currentIndex = -1;
  try {
    if (fs.existsSync(STATE_FILE)) {
      currentIndex = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")).index;
    }
  } catch (err) {
    currentIndex = -1;
  }

  currentIndex++;
  const voiceIndex = currentIndex % PROFESSIONAL_VOICES.length;

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ index: currentIndex }));
  } catch (err) {}

  const selected = PROFESSIONAL_VOICES[voiceIndex];
  console.log(`🔄 [VOICE] Selected ${selected.name} (${selected.id}) via rotation.`);
  return selected;
}

/**
 * Selects voice based on Metadata preferences or falls back to Rotation.
 */
export function getVoiceFromSelection(selection) {
  if (!selection || (Array.isArray(selection) && selection.length === 0)) {
    return getNextRotatedVoice();
  }

  const preferences = Array.isArray(selection) ? selection : [selection];
  const candidatePool = PROFESSIONAL_VOICES.filter((voice) => {
    return preferences.some((pref) => {
      const p = pref.toString().toLowerCase().trim();
      return (
        voice.id === p || 
        voice.name.toLowerCase().includes(p) || 
        voice.tags.some((tag) => tag.includes(p))
      );
    });
  });

  if (candidatePool.length > 0) {
    const selected = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    console.log(`🎯 [VOICE] Targeted: ${selected.name}`);
    return selected;
  }

  return getNextRotatedVoice();
}
