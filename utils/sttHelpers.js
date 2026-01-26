
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
export function generateSTTKeywords(menuItems, cuisineProfile = {}) {
    try {
        const keywords = new Set();
        const blacklist = new Set((COMMON_WORD_BLACKLIST || []).map(w => String(w).toLowerCase()));
        
        // Process top 150 items to fit within typical STT limits
        menuItems.slice(0, 150).forEach(item => {
            // 1. Exact Name
            if (item.name) {
                const fullName = item.name.toLowerCase().trim();
                const isSingleWord = fullName.split(/\s+/).length === 1;
                const isBlacklisted = blacklist.has(fullName);

                if (!isSingleWord || (fullName.length >= 5 && !isBlacklisted)) {
                    keywords.add(fullName);
                }

                // 1b. Tokenize into words (keep only meaningful words)
                const tokens = fullName.split(/[\s\-\(\)]+/).map(t => t.replace(/[^a-z0-9]/g, ""));
                tokens.forEach(token => {
                    if (token.length >= 5 && !blacklist.has(token)) {
                        keywords.add(token);
                    }
                });
            }
            
            // 2. Phonetic Name (if available from Sentinel)
            if (item.phoneticName) keywords.add(item.phoneticName.toLowerCase());
            
            // 3. AI STT Keywords (The Gold Mine)
            if (item.sttKeywords && Array.isArray(item.sttKeywords)) {
                item.sttKeywords.forEach(k => {
                    const val = String(k || "").toLowerCase().trim();
                    if (val.length > 2 && !blacklist.has(val)) {
                        keywords.add(val);
                    }
                });
            }
        });

        // 4. Cuisine phonetic corrections (aliases)
        if (cuisineProfile && cuisineProfile.phoneticCorrections) {
            Object.entries(cuisineProfile.phoneticCorrections).forEach(([badWord, goodWord]) => {
                const key = String(badWord || "").toLowerCase().trim();
                const val = String(goodWord || "").toLowerCase().trim();
                if (key.length > 2 && !blacklist.has(key)) keywords.add(key);
                if (val.length > 2 && !blacklist.has(val)) keywords.add(val);
            });
        }

        // Convert to array and filter validity
        return Array.from(keywords)
            .filter(k => k && k.length > 2) // Basic sanity check
            .slice(0, 190); // Cap at 190 to stay safely under limit (LiveKit/Deepgram limits vary)
    } catch (err) {
        console.error(`⚠️ Keyword generation failed: ${err.message}`);
        return [];
    }
}
