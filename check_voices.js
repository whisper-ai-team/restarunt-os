require("dotenv").config();
const { ElevenLabsClient } = require("elevenlabs");

const client = new ElevenLabsClient({ apiKey: process.env.ELEVEN_API_KEY });

async function listVoices() {
  try {
    const response = await client.voices.getAll();
    console.log("=== YOUR AVAILABLE VOICES ===");
    response.voices.forEach((v) => {
      console.log(
        `Name: ${v.name.padEnd(20)} | ID: ${v.voice_id} | Category: ${
          v.category
        }`
      );
    });
    console.log("=============================");
  } catch (error) {
    console.error("Error fetching voices:", error.message);
  }
}

listVoices();
