// menuData.js

// This is the "Brain" of your menu operations.
// Optimized for Deepgram Speech-to-Text with regional synonyms.

export const masterMenu = [
  // ==========================================
  // --- MAHARASHTRA (WEST) ---
  // ==========================================
  {
    id: "mh_001",
    name: "Vada Pav",
    region: "Maharashtra",
    synonyms: ["Indian Burger", "Wada Pao", "Vada Pao", "Batata Vada"],
    keywords: ["Vada Pav:20.0", "Wada Pao:15.0", "Batata Vada:15.0"],
    description:
      "Spicy potato fritter sandwiched in a bread bun with chutneys.",
  },
  {
    id: "mh_002",
    name: "Misal Pav",
    region: "Maharashtra",
    synonyms: ["Misal", "Kolhapuri Misal"],
    keywords: ["Misal Pav:20.0", "Missal:15.0", "Spicy Sprouts:10.0"],
    description:
      "Spicy moth bean curry topped with farsan and served with bread.",
  },
  {
    id: "mh_003",
    name: "Puran Poli",
    region: "Maharashtra",
    synonyms: ["Sweet Roti", "Holige", "Obbattu"],
    keywords: ["Puran Poli:20.0", "Pooran Poli:15.0", "Holige:15.0"],
    description: "Sweet flatbread stuffed with lentils and jaggery.",
  },
  {
    id: "mh_004",
    name: "Pav Bhaji",
    region: "Maharashtra",
    synonyms: ["Bhaji Pav"],
    keywords: ["Pav Bhaji:20.0", "Bhaji:15.0", "Mashed Veggies:10.0"],
    description:
      "Spicy mashed vegetable curry served with buttered soft bread rolls.",
  },
  {
    id: "mh_005",
    name: "Kanda Poha",
    region: "Maharashtra",
    synonyms: ["Pohe", "Poha"],
    keywords: ["Kanda Poha:20.0", "Poha:20.0", "Flattened Rice:10.0"],
    description:
      "Flattened rice cooked with onions, mustard seeds, and turmeric.",
  },
  {
    id: "mh_006",
    name: "Sabudana Khichdi",
    region: "Maharashtra",
    synonyms: ["Sago Khichdi"],
    keywords: ["Sabudana:20.0", "Sago:15.0", "Tapioca:10.0"],
    description:
      "Tapioca pearls cooked with peanuts and green chilies, popular during fasting.",
  },

  // ==========================================
  // --- SOUTH INDIA (Tamil/Kerala/Karnataka/Andhra) ---
  // ==========================================
  {
    id: "si_001",
    name: "Idli Sambar",
    region: "South India",
    synonyms: ["Steamed Rice Cakes", "Idli"],
    keywords: ["Idli:20.0", "Idly:20.0", "Sambar:15.0"],
    description: "Steamed rice cakes served with lentil stew.",
  },
  {
    id: "si_002",
    name: "Masala Dosa",
    region: "South India",
    synonyms: ["Dosai", "Dosa", "Paper Roast"],
    keywords: ["Dosa:20.0", "Dosai:15.0", "Masala Dosa:20.0"],
    description: "Crispy rice crepe filled with spiced potato mash.",
  },
  {
    id: "si_003",
    name: "Medu Vada",
    region: "South India",
    synonyms: ["Ulavacharu Vada", "Urad Dal Vada"],
    keywords: ["Medu Vada:20.0", "Vada:15.0", "Fritter:10.0"],
    description: "Crispy doughnut-shaped lentil fritters.",
  },
  {
    id: "si_004",
    name: "Uttapam",
    region: "South India",
    synonyms: ["Oothappam", "Indian Pizza"],
    keywords: ["Uttapam:20.0", "Oothappam:15.0", "Onion Uttapam:15.0"],
    description:
      "Thick rice pancake topped with onions, tomatoes, and chilies.",
  },
  {
    id: "si_005",
    name: "Curd Rice",
    region: "Tamil Nadu",
    synonyms: ["Thayir Sadam", "Yogurt Rice"],
    keywords: ["Curd Rice:20.0", "Thayir Sadam:20.0", "Yogurt Rice:15.0"],
    description: "Soft cooked rice mixed with yogurt and tempered spices.",
  },
  {
    id: "si_006",
    name: "Chicken 65",
    region: "Tamil Nadu",
    synonyms: ["Spicy Chicken Fry"],
    keywords: ["Chicken 65:20.0", "Sixty Five:15.0"],
    description: "Spicy, deep-fried chicken dish originating from Chennai.",
  },
  {
    id: "si_007",
    name: "Pongal",
    region: "Tamil Nadu",
    synonyms: ["Ven Pongal", "Khara Pongal"],
    keywords: ["Pongal:20.0", "Ven Pongal:15.0"],
    description:
      "Comforting rice and lentil porridge seasoned with black pepper and cumin.",
  },
  {
    id: "si_008",
    name: "Kerala Parotta",
    region: "Kerala",
    synonyms: ["Malabar Parotta", "Barota"],
    keywords: ["Parotta:20.0", "Kerala Parotta:20.0", "Malabar:15.0"],
    description: "Layered flaky flatbread made from refined flour.",
  },
  {
    id: "si_009",
    name: "Appam with Stew",
    region: "Kerala",
    synonyms: ["Palappam"],
    keywords: ["Appam:20.0", "Stew:15.0", "Coconut Milk:10.0"],
    description:
      "Bowl-shaped rice pancakes served with vegetable or chicken stew.",
  },
  {
    id: "si_010",
    name: "Puttu and Kadala",
    region: "Kerala",
    synonyms: ["Steam Cake"],
    keywords: ["Puttu:20.0", "Kadala Curry:20.0"],
    description:
      "Steamed cylinders of ground rice and coconut served with black chickpea curry.",
  },
  {
    id: "si_011",
    name: "Bisi Bele Bath",
    region: "Karnataka",
    synonyms: ["Sambar Rice"],
    keywords: ["Bisi Bele Bath:20.0", "BBB:10.0", "Hot Lentil Rice:10.0"],
    description: "Spicy, rice-based dish with lentils and vegetables.",
  },
  {
    id: "si_012",
    name: "Mysore Pak",
    region: "Karnataka",
    synonyms: ["Mysore Paak"],
    keywords: ["Mysore Pak:20.0", "Sweet:10.0"],
    description: "Rich sweet dish made of ghee, sugar, and gram flour.",
  },
  // --- ANDHRA SPECIALTIES ---
  {
    id: "si_special_01",
    name: "Gongura Mutton",
    region: "Andhra",
    keywords: ["Gongura:20.0", "Sorrel Leaves:10.0", "Mutton:15.0"],
    description: "Spicy mutton curry cooked with sour sorrel leaves.",
  },
  {
    id: "si_special_02",
    name: "Ulavacharu",
    region: "Andhra",
    keywords: ["Ulavacharu:20.0", "Ulava Charu:20.0", "Horse Gram:10.0"],
    description: "Thick traditional horse gram soup/curry.",
  },
  {
    id: "si_special_03",
    name: "Pesarattu",
    region: "Andhra",
    keywords: ["Pesarattu:20.0", "Moong Dal Dosa:10.0"],
    description: "Whole green gram crepe, often served with upma.",
  },
  {
    id: "si_special_04",
    name: "Natukodi Pulusu",
    region: "Andhra",
    keywords: ["Natukodi:20.0", "Natu Kodi:20.0", "Pulusu:15.0"],
    description: "Traditional spicy country chicken curry.",
  },
  {
    id: "si_special_05",
    name: "Gutthi Vankaya",
    region: "Andhra",
    keywords: ["Gutthi Vankaya:20.0", "Gutti Vankaya:20.0", "Brinjal:10.0"],
    description: "Stuffed eggplant curry.",
  },
  {
    id: "si_special_06",
    name: "Hyderabadi Biryani",
    region: "Telangana",
    synonyms: ["Dum Biryani", "Chicken Biryani"],
    keywords: ["Biryani:20.0", "Dum Biryani:15.0", "Hyderabadi:20.0"],
    description:
      "World-famous basmati rice cooked with spiced meat and saffron.",
  },
  {
    id: "si_special_07",
    name: "Double Ka Meetha",
    region: "Hyderabad",
    keywords: ["Double Ka Meetha:20.0", "Bread Halwa:15.0"],
    description: "Rich bread pudding dessert fried in ghee.",
  },
  {
    id: "si_special_08",
    name: "Haleem",
    region: "Hyderabad",
    keywords: ["Haleem:20.0", "Mutton Stew:10.0"],
    description: "Slow-cooked stew of meat, lentils, and wheat.",
  },

  // ==========================================
  // --- GOA (WEST) ---
  // ==========================================
  {
    id: "goa_001",
    name: "Goan Fish Curry",
    region: "Goa",
    synonyms: ["Fish Curry", "Xitti Kodi"],
    keywords: ["Goan:20.0", "Fish Curry:20.0", "Coconut Curry:10.0"],
    description: "Tangy and spicy fish curry made with coconut and kokum.",
  },
  {
    id: "goa_002",
    name: "Chicken Xacuti",
    region: "Goa",
    synonyms: ["Shakuti"],
    keywords: ["Xacuti:20.0", "Shakuti:15.0", "Spicy Chicken:10.0"],
    description: "Chicken curry prepared with roasted spices and coconut.",
  },
  {
    id: "goa_003",
    name: "Pork Vindaloo",
    region: "Goa",
    synonyms: ["Vindalu"],
    keywords: ["Vindaloo:20.0", "Vindalu:15.0", "Spicy Pork:10.0"],
    description:
      "Fiery curry marinated with vinegar, sugar, ginger, and spices.",
  },

  // ==========================================
  // --- GUJARAT (WEST) ---
  // ==========================================
  {
    id: "gj_001",
    name: "Thepla",
    region: "Gujarat",
    synonyms: ["Methi Na Thepla"],
    keywords: ["Thepla:20.0", "Methi Thepla:15.0"],
    description: "Spiced flatbread made with fenugreek leaves.",
  },
  {
    id: "gj_002",
    name: "Dhokla",
    region: "Gujarat",
    synonyms: ["Khaman", "Khaman Dhokla"],
    keywords: ["Dhokla:20.0", "Khaman:20.0", "Sponge Snack:10.0"],
    description: "Steamed savory sponge cake made from fermented batter.",
  },
  {
    id: "gj_003",
    name: "Undhiyu",
    region: "Gujarat",
    synonyms: ["Mixed Veg"],
    keywords: ["Undhiyu:20.0", "Winter Veg:10.0"],
    description:
      "Mixed vegetable casserole traditionally cooked upside down underground.",
  },
  {
    id: "gj_004",
    name: "Khandvi",
    region: "Gujarat",
    synonyms: ["Patuli"],
    keywords: ["Khandvi:20.0", "Gram Flour Rolls:10.0"],
    description:
      "Yellow, tightly rolled bite-sized pieces made of gram flour and yogurt.",
  },

  // ==========================================
  // --- NORTH INDIA (Punjab/Delhi/UP/Kashmir) ---
  // ==========================================
  {
    id: "ni_001",
    name: "Butter Chicken",
    region: "North India",
    synonyms: ["Murgh Makhani", "Chicken Makhani"],
    keywords: ["Butter Chicken:20.0", "Makhani:20.0", "Murgh:15.0"],
    description: "Chicken cooked in a mildly spiced tomato and cream gravy.",
  },
  {
    id: "ni_002",
    name: "Dal Makhani",
    region: "North India",
    synonyms: ["Black Lentil Curry", "Makhani"],
    keywords: ["Dal Makhani:20.0", "Kaali Dal:15.0", "Black Lentil:10.0"],
    description: "Creamy black lentils cooked slow with butter and cream.",
  },
  {
    id: "ni_003",
    name: "Chole Bhature",
    region: "North India",
    synonyms: ["Chana Bhatura"],
    keywords: ["Chole:20.0", "Bhature:20.0", "Chana:15.0"],
    description: "Spicy chickpea curry served with fried leavened bread.",
  },
  {
    id: "ni_004",
    name: "Rogan Josh",
    region: "Kashmir",
    synonyms: ["Mutton Rogan Josh"],
    keywords: ["Rogan Josh:20.0", "Kashmiri Mutton:15.0"],
    description: "Aromatic lamb curry colored with Kashmiri red chilies.",
  },
  {
    id: "ni_005",
    name: "Palak Paneer",
    region: "North India",
    synonyms: ["Saag Paneer"],
    keywords: ["Palak:20.0", "Paneer:20.0", "Spinach Cheese:10.0"],
    description: "Cottage cheese cubes in a thick paste of pureed spinach.",
  },
  {
    id: "ni_006",
    name: "Aloo Paratha",
    region: "North India",
    synonyms: ["Stuffed Paratha"],
    keywords: ["Aloo Paratha:20.0", "Parantha:15.0", "Potato Bread:10.0"],
    description: "Whole wheat flatbread stuffed with spiced mashed potatoes.",
  },
  {
    id: "ni_007",
    name: "Tandoori Chicken",
    region: "North India",
    synonyms: ["Tandoori"],
    keywords: ["Tandoori:20.0", "Roast Chicken:10.0"],
    description:
      "Chicken marinated in yogurt and spices, roasted in a clay oven.",
  },
  {
    id: "ni_008",
    name: "Rajma Chawal",
    region: "North India",
    synonyms: ["Kidney Beans Rice"],
    keywords: ["Rajma:20.0", "Chawal:15.0", "Kidney Beans:10.0"],
    description: "Red kidney bean curry served with steamed rice.",
  },
  {
    id: "ni_009",
    name: "Kadhi Pakora",
    region: "North India",
    synonyms: ["Kadhi Chawal"],
    keywords: ["Kadhi:20.0", "Pakora:15.0", "Yogurt Curry:10.0"],
    description: "Fried onion fritters in a tangy yogurt-based curry.",
  },
  {
    id: "ni_010",
    name: "Sarson Ka Saag",
    region: "Punjab",
    synonyms: ["Mustard Greens"],
    keywords: ["Sarson:20.0", "Saag:20.0", "Makki Ki Roti:15.0"],
    description:
      "Mustard greens cooked with spices, often eaten with corn flatbread.",
  },
  {
    id: "ni_011",
    name: "Malai Kofta",
    region: "North India",
    synonyms: ["Veg Kofta"],
    keywords: ["Malai Kofta:20.0", "Kofta:15.0", "Creamy Balls:5.0"],
    description:
      "Potato and paneer balls deep fried and served in a creamy gravy.",
  },
  {
    id: "ni_012",
    name: "Litti Chokha",
    region: "Bihar",
    keywords: ["Litti:20.0", "Chokha:20.0", "Sattu:15.0"],
    description:
      "Whole wheat balls stuffed with sattu flour, served with mashed veggies.",
  },

  // ==========================================
  // --- EAST INDIA (Bengal/Odisha) ---
  // ==========================================
  {
    id: "ei_001",
    name: "Machher Jhol",
    region: "West Bengal",
    synonyms: ["Fish Curry Bengal"],
    keywords: ["Machher Jhol:20.0", "Maach:15.0", "Fish Stew:10.0"],
    description: "Traditional Bengali spicy fish stew.",
  },
  {
    id: "ei_002",
    name: "Kosha Mangsho",
    region: "West Bengal",
    synonyms: ["Mutton Curry"],
    keywords: ["Kosha:20.0", "Mangsho:20.0", "Mutton Fry:10.0"],
    description: "Spicy Bengali mutton curry with thick gravy.",
  },
  {
    id: "ei_003",
    name: "Rosogolla",
    region: "West Bengal",
    synonyms: ["Rasgulla"],
    keywords: ["Rosogolla:20.0", "Rasgulla:20.0", "Syrup Ball:10.0"],
    description: "Spongy cottage cheese balls soaked in sugar syrup.",
  },
  {
    id: "ei_004",
    name: "Mishti Doi",
    region: "West Bengal",
    synonyms: ["Sweet Yogurt"],
    keywords: ["Mishti Doi:20.0", "Sweet Curd:15.0"],
    description: "Fermented sweet yogurt.",
  },
  {
    id: "ei_005",
    name: "Luchi Alur Dom",
    region: "West Bengal",
    keywords: ["Luchi:20.0", "Alur Dom:20.0", "Puri:10.0"],
    description: "Deep-fried flatbread served with spicy potato curry.",
  },

  // ==========================================
  // --- NORTH EAST INDIA ---
  // ==========================================
  {
    id: "ne_001",
    name: "Momos",
    region: "North East/Himalayan",
    synonyms: ["Dim Sum", "Dumplings"],
    keywords: ["Momos:20.0", "Dumplings:15.0", "Steamed Momo:15.0"],
    description: "Steamed dumplings filled with meat or vegetables.",
  },
  {
    id: "ne_002",
    name: "Thukpa",
    region: "North East/Himalayan",
    synonyms: ["Noodle Soup"],
    keywords: ["Thukpa:20.0", "Noodle Soup:15.0"],
    description: "Hot noodle soup with mixed vegetables or meat.",
  },

  // ==========================================
  // --- STREET FOOD (CHAAT) ---
  // ==========================================
  {
    id: "st_001",
    name: "Pani Puri",
    region: "Pan-India",
    synonyms: ["Gol Gappa", "Puchka", "Water Balls"],
    keywords: ["Pani Puri:20.0", "Gol Gappa:20.0", "Puchka:20.0"],
    description:
      "Hollow crispy puri filled with flavored water and potato mash.",
  },
  {
    id: "st_002",
    name: "Samosa",
    region: "Pan-India",
    synonyms: ["Singara"],
    keywords: ["Samosa:20.0", "Singara:15.0", "Aloo Samosa:15.0"],
    description: "Deep fried pastry with a savory filling of spiced potatoes.",
  },
  {
    id: "st_003",
    name: "Bhel Puri",
    region: "Mumbai",
    keywords: ["Bhel:20.0", "Bhel Puri:20.0", "Puffed Rice:10.0"],
    description:
      "Savory snack made of puffed rice, vegetables, and tangy tamarind sauce.",
  },
  {
    id: "st_004",
    name: "Dahi Vada",
    region: "North India",
    synonyms: ["Dahi Bhalla"],
    keywords: ["Dahi Vada:20.0", "Dahi Bhalla:20.0", "Yogurt Vada:15.0"],
    description:
      "Fried lentil balls soaked in thick yogurt and topped with chutneys.",
  },

  // ==========================================
  // --- BREADS & RICE ---
  // ==========================================
  {
    id: "br_001",
    name: "Garlic Naan",
    region: "North India",
    keywords: ["Naan:20.0", "Garlic Naan:20.0", "Tandoori Bread:10.0"],
    description: "Leavened flatbread topped with garlic and coriander.",
  },
  {
    id: "br_002",
    name: "Jeera Rice",
    region: "North India",
    keywords: ["Jeera Rice:20.0", "Cumin Rice:15.0"],
    description: "Basmati rice flavored with cumin seeds.",
  },
  {
    id: "br_003",
    name: "Roomali Roti",
    region: "North India",
    keywords: ["Roomali:20.0", "Rumali:20.0", "Handkerchief Bread:10.0"],
    description: "Thin, soft flatbread folded like a handkerchief.",
  },

  // ==========================================
  // --- DESSERTS ---
  // ==========================================
  {
    id: "sw_001",
    name: "Gulab Jamun",
    region: "North",
    keywords: ["Gulab Jamun:20.0", "Jamun:15.0"],
    description: "Deep-fried milk solids soaked in sugary syrup.",
  },
  {
    id: "sw_002",
    name: "Rasmalai",
    region: "Bengal/North",
    keywords: ["Rasmalai:20.0", "Ras Malai:15.0"],
    description: "Soft paneer dumplings immersed in sweetened, thickened milk.",
  },
  {
    id: "sw_003",
    name: "Gajar Ka Halwa",
    region: "North",
    synonyms: ["Carrot Halwa"],
    keywords: ["Gajar Halwa:20.0", "Carrot Pudding:15.0"],
    description:
      "Sweet dessert pudding made with grated carrots, milk, and nuts.",
  },
  {
    id: "sw_004",
    name: "Kaju Katli",
    region: "North",
    synonyms: ["Kaju Barfi"],
    keywords: ["Kaju Katli:20.0", "Cashew Fudge:10.0"],
    description: "Diamond-shaped sweet made from cashew nuts and sugar.",
  },
  {
    id: "sw_005",
    name: "Jalebi",
    region: "Pan-India",
    keywords: ["Jalebi:20.0", "Zalebi:15.0"],
    description: "Spiral shaped crispy sweet dipped in sugar syrup.",
  },
  {
    id: "sw_006",
    name: "Kulfi",
    region: "North",
    keywords: ["Kulfi:20.0", "Indian Ice Cream:10.0"],
    description: "Traditional dense Indian ice cream.",
  },

  // ==========================================
  // --- BEVERAGES ---
  // ==========================================
  {
    id: "bev_001",
    name: "Masala Chai",
    region: "Pan-India",
    synonyms: ["Tea", "Chai"],
    keywords: ["Chai:20.0", "Tea:15.0", "Masala Chai:20.0"],
    description: "Spiced milk tea.",
  },
  {
    id: "bev_002",
    name: "Lassi",
    region: "Punjab",
    synonyms: ["Sweet Lassi", "Salted Lassi"],
    keywords: ["Lassi:20.0", "Yogurt Drink:10.0"],
    description: "Creamy, frothy yogurt-based drink.",
  },
  {
    id: "bev_003",
    name: "Filter Coffee",
    region: "South India",
    synonyms: ["Kaapi", "Madras Coffee"],
    keywords: ["Filter Coffee:20.0", "Kaapi:20.0", "Coffee:15.0"],
    description: "Strong milky coffee made with a stainless steel filter.",
  },
];

// Helper function to extract just the text for the LLM context
export function getMenuSummary() {
  return masterMenu
    .map((item) => `- ${item.name} (${item.region}): ${item.description}`)
    .join("\n");
}

// Helper function to extract keywords for Deepgram
export function getDeepgramKeywords() {
  // Returns format expected by LiveKit Deepgram plugin: [[term, score], [term, score]]
  // Handles explicit "Term:Score" and default weighting
  return masterMenu.flatMap((item) => {
    // 1. Process explicit keywords field
    const explicitKeywords = item.keywords.map((kw) => {
      const parts = kw.split(":");
      if (parts.length === 2) {
        return [parts[0], parseFloat(parts[1])];
      }
      return [kw, 10.0];
    });

    // 2. Automatically add Name and Synonyms if not already covered, with a default boost
    const nameEntry = [item.name, 15.0];

    // Combine and remove duplicates (simple logic)
    return [...explicitKeywords, nameEntry];
  });
}
