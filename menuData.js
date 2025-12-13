// menuData.js

// This is the "Brain" of your menu operations.
// Updated to include High-Value Regional Terms for Deepgram Optimization.

export const masterMenu = [
  // --- MAHARASHTRA ---
  {
    id: "mh_001",
    name: "Vada Pav",
    region: "Maharashtra",
    synonyms: ["Indian Burger", "Wada Pao", "Vada Pao"],
    keywords: ["Vada Pav:15.0", "Wada Pao:15.0", "Batata Vada:15.0"],
    description:
      "Spicy potato fritter sandwiched in a bread bun with chutneys.",
  },
  {
    id: "mh_002",
    name: "Misal Pav",
    region: "Maharashtra",
    synonyms: ["Misal"],
    keywords: ["Misal Pav:15.0", "Missal:15.0", "Spicy Sprouts:10.0"],
    description:
      "Spicy moth bean curry topped with farsan and served with bread.",
  },
  {
    id: "mh_003",
    name: "Puran Poli",
    region: "Maharashtra",
    synonyms: ["Sweet Roti", "Holige"],
    keywords: ["Puran Poli:15.0", "Pooran Poli:15.0", "Holige:15.0"],
    description: "Sweet flatbread stuffed with lentils and jaggery.",
  },

  // --- SOUTH INDIA (Tamil/Kerala/Karnataka/Andhra) ---
  {
    id: "si_001",
    name: "Idli Sambar",
    region: "South India",
    synonyms: ["Steamed Rice Cakes", "Idli"],
    keywords: ["Idli:10.0", "Idly:10.0", "Sambar:10.0"],
    description: "Steamed rice cakes served with lentil stew.",
  },
  {
    id: "si_002",
    name: "Masala Dosa",
    region: "South India",
    synonyms: ["Dosai", "Dosa"],
    keywords: ["Dosa:10.0", "Dosai:15.0", "Masala Dosa:10.0"],
    description: "Crispy rice crepe filled with spiced potato mash.",
  },
  {
    id: "si_003",
    name: "Avial",
    region: "Kerala",
    synonyms: ["Coconut Stew"],
    keywords: ["Avial:20.0", "Aviyal:20.0"],
    description:
      "Thick mixture of vegetables and coconut, seasoned with coconut oil.",
  },

  // --- SPECIAL & TOUGH WORDS ---
  {
    id: "si_special_01",
    name: "Gongura Pickle/Mutton",
    region: "Andhra",
    keywords: ["Gongura:20.0", "Sorrel Leaves:10.0"],
    description: "Spicy sorrel leaves preparation.",
  },
  {
    id: "si_special_02",
    name: "Ulavacharu",
    region: "Andhra",
    keywords: ["Ulavacharu:20.0", "Ulava Charu:20.0", "Horse Gram:10.0"],
    description: "Traditional horse gram soup/curry.",
  },
  {
    id: "si_special_03",
    name: "Pesarattu",
    region: "Andhra",
    keywords: ["Pesarattu:20.0", "Moong Dal Dosa:10.0"],
    description: "Green gram crepe.",
  },
  {
    id: "si_special_04",
    name: "Natukodi Pulusu",
    region: "Andhra",
    keywords: ["Natukodi:20.0", "Natu Kodi:20.0", "Pulusu:15.0"],
    description: "Country chicken curry.",
  },
  {
    id: "si_special_05",
    name: "Gutthi Vankaya",
    region: "Andhra",
    keywords: ["Gutthi Vankaya:20.0", "Gutti Vankaya:20.0"],
    description: "Stuffed eggplant curry.",
  },
  {
    id: "si_special_06",
    name: "Qubani Ka Meetha",
    region: "Hyderabad",
    keywords: ["Qubani:20.0", "Meetha:15.0", "Khubani:20.0"],
    description: "Apricot dessert.",
  },

  // --- FIX FOR FISH CURRY ---
  {
    id: "si_special_fix_01",
    name: "Fish Curry Goan", // Must match Clover Name exactly
    region: "Goa",
    // Expanded synonyms to catch "Bone", "Cone", and short forms like "Goan"
    synonyms: [
      "Fish Bone Curry",
      "Fish Cone Curry",
      "Goan Fish Curry",
      "Goan Curry",
      "Fish Goan",
      "Goan",
      "Fish Curry",
    ],
    keywords: ["Goan:20.0", "Fish Curry:15.0"],
    description: "Traditional spicy and tangy fish curry from Goa.",
  },

  {
    id: "si_special_07",
    name: "Double Ka Meetha",
    region: "Hyderabad",
    keywords: ["Double Ka Meetha:20.0", "Bread Halwa:15.0"],
    description: "Bread pudding dessert.",
  },
  {
    id: "si_special_08",
    name: "Mirchi Bhajji",
    region: "Andhra",
    keywords: ["Mirchi_Bhajji:20.0", "Mirchi:15.0", "Bhajji:15.0"],
    description: "Chili fritters.",
  },
  {
    id: "si_special_09",
    name: "Punugulu",
    region: "Andhra",
    keywords: ["Punugulu:20.0", "Punukulu:20.0"],
    description: "Deep fried rice batter snack.",
  },
  {
    id: "si_special_10",
    name: "Chettinad",
    region: "Tamil Nadu",
    keywords: ["Chettinad:20.0", "Chettinadu:20.0"],
    description: "Spicy aromatic cuisine style.",
  },

  // --- GUJARAT ---
  {
    id: "gj_001",
    name: "Thepla",
    region: "Gujarat",
    synonyms: ["Methi Na Thepla"],
    keywords: ["Thepla:15.0", "Methi Thepla:15.0"],
    description: "Spiced flatbread made with fenugreek leaves.",
  },
  {
    id: "gj_002",
    name: "Dhokla",
    region: "Gujarat",
    synonyms: ["Khaman"],
    keywords: ["Dhokla:15.0", "Khaman:15.0"],
    description: "Steamed savory cake made from gram flour.",
  },

  // --- NORTH INDIA ---
  {
    id: "ni_001",
    name: "Dal Makhani",
    region: "North India",
    synonyms: ["Black Lentil Curry", "Makhani"],
    keywords: ["Dal Makhani:15.0", "Makhani:15.0", "Kaali Dal:10.0"],
    description: "Creamy black lentils cooked with butter and cream.",
  },
  {
    id: "ni_002",
    name: "Hyderabadi Biryani",
    region: "Andhra/Telangana",
    synonyms: ["Dum Biryani", "Chicken Biryani"],
    keywords: ["Biryani:10.0", "Dum Biryani:15.0", "Hyderabadi:15.0"],
    description: "Fragrant basmati rice cooked with spiced meat and saffron.",
  },
  // Sweets
  {
    id: "sw_001",
    name: "Rasmalai",
    region: "Bengal/North",
    keywords: ["Rasmalai:15.0", "Ras Malai:15.0"],
    description: "Cheese dumplings in cream milk.",
  },
  {
    id: "sw_002",
    name: "Gulab Jamun",
    region: "North",
    keywords: ["Gulab Jamun:15.0", "Jamun:15.0"],
    description: "Fried milk solids in sugar syrup.",
  },
];

// Helper function to extract just the text for the LLM
export function getMenuSummary() {
  return masterMenu
    .map((item) => `- ${item.name} (${item.region}): ${item.description}`)
    .join("\n");
}

// Helper function to extract keywords for Deepgram
export function getDeepgramKeywords() {
  // Returns format expected by LiveKit Deepgram plugin: [[term, score], [term, score]]
  return masterMenu.flatMap((item) =>
    item.keywords.map((kw) => {
      const parts = kw.split(":");
      // Parse "Word:Score" -> ["Word", Score]
      if (parts.length === 2) {
        return [parts[0], parseFloat(parts[1])];
      }
      return [kw, 10.0];
    })
  );
}
