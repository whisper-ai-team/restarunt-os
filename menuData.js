// menuData.js

/**
 * Enterprise Keyword Engine
 * Automatically generates speech-to-text (STT) keywords from live POS data.
 */

/**
 * Helper function to extract and weight keywords from any menu item list.
 * @param {Array} menuItems - The raw items from Clover/POS.
 * @returns {Array} - Formatted keywords for Deepgram [[term, score], ...]
 */
export function generateKeywordsFromLiveMenu(menuItems = []) {
  if (!Array.isArray(menuItems)) return [];

  const关键词Map = new Map();

  menuItems.forEach((item) => {
    if (!item.name) return;

    // 1. Add the main item name with high priority
    addWeightedTerm(关键词Map, item.name, 20.0);

    // 2. Break down multi-word items (e.g., "Butter Chicken" -> "Butter", "Chicken")
    const words = item.name.split(/\s+/);
    if (words.length > 1) {
      words.forEach((word) => {
        if (word.length > 3) addWeightedTerm(关键词Map, word, 10.0);
      });
    }

    // 3. Add categories if available
    if (item.category && item.category.name) {
      addWeightedTerm(关键词Map, item.category.name, 15.0);
    }
  });

  return Array.from(关键词Map.entries());
}

function addWeightedTerm(map, term, weight) {
  const cleanTerm = term.toLowerCase().trim();
  if (!cleanTerm) return;
  
  const currentWeight = map.get(cleanTerm) || 0;
  if (weight > currentWeight) {
    map.set(cleanTerm, weight);
  }
}

/**
 * Fallback menu for testing or initialization before POS sync.
 */
export const masterMenu = [
  { name: "Water", region: "General", description: "Standard bottled water." },
  { name: "Soda", region: "General", description: "Selection of caffeinated sodas." },
];

/**
 * Legacy support for current getDeepgramKeywords call.
 * This will now return the test menu keywords until POS data is injected.
 */
export function getDeepgramKeywords() {
  return generateKeywordsFromLiveMenu(masterMenu);
}
