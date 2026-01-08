
import { COMMON_WORD_BLACKLIST } from "../config/agentConfig.js";

/**
 * Generates PRECISE STT keywords from Menu Intelligence.
 * Strategy:
 * 1. AI-Generated Keywords: High value synonyms from Sentinel (e.g. "makhani").
 * 2. Phonetic Names: Normalized names for better matching.
 * 3. Exact Dish Names: The ground truth names.
 * 
 * @param {Array} menuItems - Array of enriched menu items
 * @returns {Array} Array of keywords for Deepgram
 */
export function generateSTTKeywords(menuItems) {
    try {
        const keywords = new Set();
        
        // Process top 150 items to fit within typical STT limits
        menuItems.slice(0, 150).forEach(item => {
            // 1. Exact Name
            if (item.name) keywords.add(item.name.toLowerCase());
            
            // 2. Phonetic Name (if available from Sentinel)
            if (item.phoneticName) keywords.add(item.phoneticName.toLowerCase());
            
            // 3. AI STT Keywords (The Gold Mine)
            if (item.sttKeywords && Array.isArray(item.sttKeywords)) {
                item.sttKeywords.forEach(k => keywords.add(k.toLowerCase()));
            }
        });

        // Convert to array and filter validity
        return Array.from(keywords)
            .filter(k => k && k.length > 2) // Basic sanity check
            .slice(0, 190); // Cap at 190 to stay safely under limit (LiveKit/Deepgram limits vary)
    } catch (err) {
        console.error(`⚠️ Keyword generation failed: ${err.message}`);
        return [];
    }
}
