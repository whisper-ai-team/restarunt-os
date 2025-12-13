// voiceMap.js
import fs from "fs";
import path from "path";

// 1. The List of Voices (Added 'tags' for smart filtering)
const PROFESSIONAL_VOICES = [
  {
    name: "Naina",
    id: "6BZyx2XekeeXOkTVn8un",
    tags: ["indian", "female", "soft"],
  },
  {
    name: "Sia",
    id: "6JsmTroalVewG1gA6Jmw",
    tags: ["indian", "female", "energetic"],
  },
  {
    name: "Zane",
    id: "7DkaWvcqvBstUe3167oW",
    tags: ["american", "male", "deep"],
  },
  {
    name: "Ranbir",
    id: "9PvnT6XRzlljoaDG6Knu",
    tags: ["indian", "male", "professional"],
  },
  {
    name: "Simran",
    id: "9w21nMuk8CWXIME31V1S",
    tags: ["indian", "female", "formal"],
  },
  {
    name: "Deepu Nair",
    id: "KBQXDWhJb2zREeOq95rU",
    tags: ["indian", "male", "casual"],
  },
  {
    name: "Indian Storyteller",
    id: "Rk0hF1X0z2RQCmWH9SCb",
    tags: ["indian", "male", "narrative"],
  },
  {
    name: "Amit Gupta",
    id: "SV61h9yhBg4i91KIBwdz",
    tags: ["indian", "male", "soft"],
  },
  {
    name: "Leónidas",
    id: "YKrm0N1EAM9Bw27j8kuD",
    tags: ["spanish", "male", "deep"],
  },
  {
    name: "Rahul Bharadwaj",
    id: "u7bRcYbD7visSINTyAT8",
    tags: ["indian", "male", "energetic"],
  },
  {
    name: "Naresh",
    id: "y6Ao4Y93UrnTbmzdVlFc",
    tags: ["indian", "male", "older"],
  },
  {
    name: "Venkat",
    id: "hsV8MXdu9On4AMWma9xC",
    tags: ["indian", "male", "professional"],
  },
  { name: "RAJ", id: "hsV8MXdu9On4AMWma9xC", tags: ["indian", "male", "loud"] },
];

// 2. File to store the current index
const STATE_FILE = path.resolve("./voice_state.json");

/**
 * Gets the next voice in the list using a persistent file.
 */
function getNextRotatedVoice() {
  let currentIndex = -1;

  // A. Try to read the last index from the file
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf8");
      currentIndex = JSON.parse(data).index;
    }
  } catch (err) {
    currentIndex = -1; // Reset on error
  }

  // B. Increment the index
  currentIndex++;

  // C. Calculate the actual array position (Loop back if at the end)
  const voiceIndex = currentIndex % PROFESSIONAL_VOICES.length;

  // D. Save the new index back to the file
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ index: currentIndex }));
  } catch (err) {
    console.error("⚠️ Could not save voice state:", err);
  }

  const selected = PROFESSIONAL_VOICES[voiceIndex];
  console.log(`🔄 Rotation: Call #${currentIndex + 1} -> ${selected.name}`);
  return selected;
}

/**
 * Main Entry Point: Selects voice based on Metadata preferences.
 * Falls back to Rotation if no preference is found.
 * @param {string|string[]} selection - ID, Tag, or Array of preferences.
 */
export function getVoiceFromSelection(selection) {
  // 1. If no selection provided, ROTATE.
  if (!selection || (Array.isArray(selection) && selection.length === 0)) {
    return getNextRotatedVoice();
  }

  // 2. Normalize input to an array
  const preferences = Array.isArray(selection) ? selection : [selection];

  // 3. Find matches
  const candidatePool = PROFESSIONAL_VOICES.filter((voice) => {
    return preferences.some((pref) => {
      const p = pref.toLowerCase().trim();
      return (
        voice.id === pref || // Exact ID match
        voice.name.toLowerCase().includes(p) || // Name match
        voice.tags.some((tag) => tag.includes(p)) // Tag/Style match
      );
    });
  });

  // 4. If we found specific matches, pick one randomly.
  if (candidatePool.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidatePool.length);
    const selected = candidatePool[randomIndex];
    console.log(
      `🎯 Targeted Selection: ${selected.name} (Matched: ${preferences})`
    );
    return selected;
  }

  // 5. If specific selection failed (e.g. typo in ID), fallback to ROTATION.
  console.warn(
    "⚠️ No voices matched the preferences. Falling back to rotation."
  );
  return getNextRotatedVoice();
}
