// cuisines/cuisineRegistry.js

export const CUISINE_PROFILES = {
  indian: {
    name: "Indian",
    phoneticCorrections: {
      bone: "goan",
      cone: "goan",
      gourd: "goan",
      gone: "goan",
      biden: "baingan",
      byun: "baingan",
      bertha: "bharta",
      barra: "vada",
      power: "pav",
      pao: "pav",
      butter: "pakora",
      batura: "bhatura",
      hakka: "schezwan",
      manchurian: "gobhi manchurian",
      curry: "kadai",
      pan: "paneer",
      pen: "paneer",
      shahi: "shahi paneer",
      malay: "malai",
      costa: "pista", // Fixes "Malay Costa" -> "Malai Pista"
      pasta: "pista", // Common mishearing
    },
    personaInstructions: "Use warm, hospitable language. Mention spice levels if appropriate. Use 'Namaste' as a greeting.",
    preferredVoices: ["nova", "shimmer", "alloy"],
    upsellItems: {
      drinks: ["Mango Lassi", "Masala Chai"],
      sides: ["Garlic Naan", "Vegetable Samosas"],
      desserts: ["Gulab Jamun", "Kulfi"]
    },
  },
  chinese: {
    name: "Chinese",
    phoneticCorrections: {
      dimsum: "dim sum",
      shrimp: "prawn",
      "chow mein": "chowmein",
      zhao: "xiao",
    },
    personaInstructions: "Be efficient and polite. Ask about rice or noodle preferences. Mention tea options if asked.",
    preferredVoices: ["alloy", "shimmer", "nova"],
    upsellItems: {
      drinks: ["Bubble Tea", "Jasmine Tea"],
      sides: ["Vegetable Spring Rolls", "Hot & Sour Soup"],
      desserts: ["Fried Bananas", "Sesame Balls"]
    },
  },
  american: {
    name: "American",
    phoneticCorrections: {
      burger: "hamburger",
      fries: "french fries",
    },
    personaInstructions: "Be friendly and upbeat. Always ask about condiments or 'making it a meal'.",
    preferredVoices: ["nova", "alloy", "onyx"],
    upsellItems: {
      drinks: ["Milkshake", "Craft Soda"],
      sides: ["Seasoned Fries", "Onion Rings"],
      desserts: ["Apple Pie", "Chocolate Brownie"]
    },
  },
  mexican: {
    name: "Mexican",
    phoneticCorrections: {
      guac: "guacamole",
      queso: "cheese",
      taco: "tacos",
    },
    personaInstructions: "Be vibrant and helpful. Ask about salsa preference (mild, medium, or hot).",
    preferredVoices: ["shimmer", "nova", "fable"],
    upsellItems: {
      drinks: ["Agua Fresca", "Horchata"],
      sides: ["Extra Guacamole", "Queso Fundido"],
      desserts: ["Churros", "Tres Leches Cake"]
    },
  },
  italian: {
    name: "Italian",
    phoneticCorrections: {
      pasta: "pastas",
      pizza: "pizzas",
    },
    personaInstructions: "Be passionate about the ingredients. Mention daily specials or pasta types clearly.",
    preferredVoices: ["echo", "onyx", "alloy"],
    upsellItems: {
      drinks: ["Glass of House Chianti", "Espresso"],
      sides: ["Garlic Bread with Cheese", "Caprese Salad"],
      desserts: ["Tiramisu", "Panna Cotta"]
    },
  },
};

/**
 * Gets the cuisine profile based on a keyword or restaurant name.
 * @param {string} cuisineType - The type of cuisine (e.g., 'indian', 'chinese').
 * @returns {Object} The cuisine profile.
 */
export function getCuisineProfile(cuisineType = "general") {
  const type = cuisineType.toLowerCase();
  return CUISINE_PROFILES[type] || CUISINE_PROFILES.american; // Default to American if not found
}
