// voiceMap.js
import fs from "fs";
import path from "path";

// 1. The List of Voices
const PROFESSIONAL_VOICES = [
  { name: "Naina", id: "6BZyx2XekeeXOkTVn8un" },
  { name: "Sia", id: "6JsmTroalVewG1gA6Jmw" },
  { name: "Zane", id: "7DkaWvcqvBstUe3167oW" },
  { name: "Ranbir", id: "9PvnT6XRzlljoaDG6Knu" },
  { name: "Simran", id: "9w21nMuk8CWXIME31V1S" },
  { name: "Deepu Nair", id: "KBQXDWhJb2zREeOq95rU" },
  { name: "Indian Storyteller", id: "Rk0hF1X0z2RQCmWH9SCb" },
  { name: "Amit Gupta", id: "SV61h9yhBg4i91KIBwdz" },
  { name: "Leónidas", id: "YKrm0N1EAM9Bw27j8kuD" },
  { name: "Rahul Bharadwaj", id: "u7bRcYbD7visSINTyAT8" },
  { name: "Naresh", id: "y6Ao4Y93UrnTbmzdVlFc" },
];

// 2. File to store the current index
const STATE_FILE = path.resolve("./voice_state.json");

function getNextRotatedVoice() {
  let currentIndex = -1;

  // A. Try to read the last index from the file
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf8");
      currentIndex = JSON.parse(data).index;
    }
  } catch (err) {
    // If file error, start from scratch
    currentIndex = -1;
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

  console.log(
    `🎙️ Call #${currentIndex + 1}: Switching voice to ${selected.name}`
  );
  return selected;
}

export { getNextRotatedVoice };
