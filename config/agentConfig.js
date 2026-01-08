// agentConfig.js - Configuration management for the voice agent

// -----------------------------
// CONFIGURATION & CORRECTIONS
// -----------------------------
export const CONFIG = {
  cloverBaseUrl:
    process.env.CLOVER_BASE_URL || "https://apisandbox.dev.clover.com",
  menuCacheTtl: 10 * 60 * 1000,
};

export const MOCK_DB = {
  "+15712799105": { name: "Venkat", lastOrder: "Hyderabadi Biryani" },
  "+12013444638": { name: "Venkat", lastOrder: "Masala Dosa" },
};

// --- NEW STRUCTURAL DIETARY INTELLIGENCE ---
export const DIETARY_MAP = {
  nuts: ["korma", "massaman", "pesto", "satay", "pad thai", "cashew", "almond", "walnut", "peanut", "butter chicken"], // Added butter chicken (often uses cashew paste)
  dairy: ["korma", "paneer", "malai", "butter chicken", "cream", "cheese", "alfredo", "milk", "yogurt", "shake", "smoothie"],
  gluten: ["naan", "bread", "bun", "pasta", "pizza", "ravioli", "samosa", "tempura", "noodle", "tortilla", "wrap"],
  shellfish: ["prawn", "shrimp", "lobster", "crab", "mussel", "scallop"],
  vegan_unfriendly: ["chicken", "lamb", "beef", "pork", "egg", "fish", "dairy", "honey", "paneer"]
};

// Common English words that should NEVER be boosted as STT keywords
// These words sound too similar to menu items and cause hallucinations
export const COMMON_WORD_BLACKLIST = [
  'naan', // Sounds like "a/an"
  'nan', // Alternative spelling
  'the', 'and', 'with', 'for', 'from',
  'order', 'please', 'like', 'want', 'would',
  'have', 'some', 'many', 'more', 'that',
  'this', 'what', 'when', 'where', 'which'
];

export function parseJobMetadata(metadataString) {
  let data = {};
  try {
    data = JSON.parse(metadataString || "{}");
    console.log("📋 Parsed Job Metadata:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("⚠️ Failed to parse metadata:", metadataString);
  }
  
  // Handle nested restaurantConfig object from server.js dispatch
  const config = data.restaurantConfig || data;
  
  return {
    id: data.restaurantId || config.id,
    name: data.restaurantName || config.name || "Bharat Bistro",
    greeting: config.greeting || "Namaste! Welcome to Bharat Bistro.",
    instructions: config.systemPrompt || "",
    info: {
      address: config.location?.address || config.address || "123 Curry Lane",
      hours: config.hours || "11 AM - 10 PM",
      phone: config.phoneNumber || config.phone || "555-0199",
    },
    voiceSelection: config.voiceSelection || data.voices || data.voiceId || null,
    clover: { 
      apiKey: config.cloverApiKey || data.cloverApiKey, 
      merchantId: config.cloverMerchantId || data.cloverMerchantId 
    },
    printing: config.printing || {},
    cuisine: config.cuisineType || "indian"
  };
}
