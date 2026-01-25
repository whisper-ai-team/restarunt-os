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
  thai: {
    name: "Thai",
    phoneticCorrections: {
      pad: "pad",
      thai: "thai",
      som: "som",
      tum: "tum",
      panang: "panang",
      massaman: "massaman",
    },
    personaInstructions: "Be warm and attentive. Ask about spice level and rice choice.",
    preferredVoices: ["shimmer", "nova", "alloy"],
    upsellItems: {
      drinks: ["Thai Iced Tea", "Coconut Water"],
      sides: ["Spring Rolls", "Sticky Rice"],
      desserts: ["Mango Sticky Rice", "Coconut Ice Cream"]
    },
  },
  japanese: {
    name: "Japanese",
    phoneticCorrections: {
      ramen: "ramen",
      sashimi: "sashimi",
      nigiri: "nigiri",
      miso: "miso",
      tempura: "tempura",
    },
    personaInstructions: "Be polite and precise. Clarify sashimi vs sushi and ask about wasabi/ginger.",
    preferredVoices: ["alloy", "nova", "echo"],
    upsellItems: {
      drinks: ["Green Tea", "Ramune"],
      sides: ["Edamame", "Miso Soup"],
      desserts: ["Mochi", "Green Tea Ice Cream"]
    },
  },
  korean: {
    name: "Korean",
    phoneticCorrections: {
      bulgogi: "bulgogi",
      kimchi: "kimchi",
      bibimbap: "bibimbap",
      tteokbokki: "tteokbokki",
    },
    personaInstructions: "Be friendly and helpful. Ask about spice level and rice choice.",
    preferredVoices: ["nova", "alloy", "shimmer"],
    upsellItems: {
      drinks: ["Korean Barley Tea", "Sikhye"],
      sides: ["Kimchi", "Pickled Radish"],
      desserts: ["Hotteok", "Bungeoppang"]
    },
  },
  vietnamese: {
    name: "Vietnamese",
    phoneticCorrections: {
      pho: "pho",
      banh: "banh",
      mi: "mi",
      bun: "bun",
      bo: "bo",
    },
    personaInstructions: "Be calm and courteous. Ask about broth choice and spice level.",
    preferredVoices: ["alloy", "shimmer", "nova"],
    upsellItems: {
      drinks: ["Vietnamese Iced Coffee", "Jasmine Tea"],
      sides: ["Spring Rolls", "Fried Egg Rolls"],
      desserts: ["Che Ba Mau", "Coconut Pudding"]
    },
  },
  mediterranean: {
    name: "Mediterranean",
    phoneticCorrections: {
      gyro: "gyro",
      gyros: "gyro",
      hummus: "hummus",
      falafel: "falafel",
      tzatziki: "tzatziki",
    },
    personaInstructions: "Be welcoming and clear. Ask about sauces and side choices.",
    preferredVoices: ["alloy", "echo", "nova"],
    upsellItems: {
      drinks: ["Mint Lemonade", "Iced Tea"],
      sides: ["Greek Salad", "Pita & Hummus"],
      desserts: ["Baklava", "Rice Pudding"]
    },
  },
  middle_eastern: {
    name: "Middle Eastern",
    phoneticCorrections: {
      shawarma: "shawarma",
      shwarma: "shawarma",
      kebab: "kebab",
      kofta: "kofta",
      tabbouleh: "tabbouleh",
    },
    personaInstructions: "Be warm and hospitable. Ask about spice level and sauce preference.",
    preferredVoices: ["shimmer", "alloy", "nova"],
    upsellItems: {
      drinks: ["Mint Tea", "Ayran"],
      sides: ["Hummus", "Fattoush"],
      desserts: ["Baklava", "Basbousa"]
    },
  },
  greek: {
    name: "Greek",
    phoneticCorrections: {
      gyro: "gyro",
      gyros: "gyro",
      souvlaki: "souvlaki",
      tzatziki: "tzatziki",
      spanakopita: "spanakopita",
    },
    personaInstructions: "Be cheerful and clear. Ask about sides and sauces.",
    preferredVoices: ["echo", "alloy", "nova"],
    upsellItems: {
      drinks: ["Lemonade", "Iced Tea"],
      sides: ["Greek Salad", "Pita & Tzatziki"],
      desserts: ["Baklava", "Galaktoboureko"]
    },
  },
  french: {
    name: "French",
    phoneticCorrections: {
      crepe: "crepe",
      crepes: "crepe",
      ratatouille: "ratatouille",
      croissant: "croissant",
    },
    personaInstructions: "Be refined and helpful. Clarify sides and sauces gently.",
    preferredVoices: ["echo", "alloy", "onyx"],
    upsellItems: {
      drinks: ["Cafe Au Lait", "Sparkling Water"],
      sides: ["Side Salad", "Fries"],
      desserts: ["Creme Brulee", "Macarons"]
    },
  },
  caribbean: {
    name: "Caribbean",
    phoneticCorrections: {
      jerk: "jerk",
      plantain: "plantain",
      oxtail: "oxtail",
      callaloo: "callaloo",
    },
    personaInstructions: "Be upbeat and friendly. Ask about spice level and sides.",
    preferredVoices: ["nova", "shimmer", "alloy"],
    upsellItems: {
      drinks: ["Sorrel", "Ginger Beer"],
      sides: ["Plantains", "Rice and Peas"],
      desserts: ["Rum Cake", "Coconut Tart"]
    },
  },
};

const CUISINE_ALIASES = {
  "middle eastern": "middle_eastern",
  "middle-eastern": "middle_eastern",
  mediterranean: "mediterranean",
  med: "mediterranean",
  "greek": "greek",
  "japanese": "japanese",
  "korean": "korean",
  "vietnamese": "vietnamese",
  "thai": "thai",
  "french": "french",
  "caribbean": "caribbean",
  "south asian": "indian",
  "american": "american",
  "mexican": "mexican",
  "italian": "italian",
  "chinese": "chinese",
  "indian": "indian",
};

export function normalizeCuisineKey(cuisineType = "") {
  const raw = String(cuisineType || "").trim().toLowerCase();
  if (!raw) return "american";
  if (CUISINE_PROFILES[raw]) return raw;
  if (CUISINE_ALIASES[raw]) return CUISINE_ALIASES[raw];
  const normalized = raw.replace(/\s+/g, "_");
  if (CUISINE_PROFILES[normalized]) return normalized;
  if (CUISINE_ALIASES[normalized]) return CUISINE_ALIASES[normalized];
  return "american";
}

/**
 * Gets the cuisine profile based on a keyword or restaurant name.
 * @param {string} cuisineType - The type of cuisine (e.g., 'indian', 'chinese').
 * @returns {Object} The cuisine profile.
 */
export function getCuisineProfile(cuisineType = "general") {
  const type = normalizeCuisineKey(cuisineType);
  return CUISINE_PROFILES[type] || CUISINE_PROFILES.american; // Default to American if not found
}
