
import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The Menu (Target)
const TARGET = "Malai Kofta - Vegetarian meatballs in creamy cashew sauce";

// The Problem Inputs
const INPUTS = [
    "Malay Costa",
    "Mala Costa",
    "Veggie Balls", // Improved capability check
    "Burger"        // Control: Should be low match
];

async function getEmbedding(text) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
    });
    return response.data[0].embedding;
}

// Cosine Similarity Function
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runProof() {
    console.log("🧠 GENERATING VECTORS (PROOF OF CONCEPT)...");
    console.log(`🎯 TARGET: "${TARGET}"`);
    console.log("------------------------------------------------");

    try {
        const targetVector = await getEmbedding(TARGET);

        for (const input of INPUTS) {
            const inputVector = await getEmbedding(input);
            const score = cosineSimilarity(targetVector, inputVector);
            
            // Traffic Light
            let icon = "🔴";
            if (score > 0.5) icon = "🟢"; // Embeddings usually score lower than 1.0, 0.5 is often a cutoff for 'related'
            else if (score > 0.3) icon = "🟡";

            console.log(`${icon} Input: "${input}" \t-> Similarity: ${score.toFixed(4)}`);
        }

    } catch (e) {
        console.error("❌ API Error:", e.message);
    }
}

runProof();
