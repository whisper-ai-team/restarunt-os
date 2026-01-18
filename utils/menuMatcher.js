import { metaphone } from "./agentUtils.js";
import Fuse from "fuse.js";

// --- CONFIGURATION ---
const WEIGHTS = {
  PHONETIC: 0.4,
  KEYWORD: 0.4,
  TOKEN: 0.2
};

const THRESHOLDS = {
  MIN_SCORE: 0.65, // Relaxed from 0.78
  AMBIGUOUS_MARGIN: 0.10
};

// ... (helper functions)

export const MenuMatcher = {
  /**
   * Finds the best match for a user query against the menu
   * @param {string} transcript - What the user said
   * @param {Array} menuItems - Enriched menu items
   */
  findMatch(transcript, menuItems) {
    const candidates = menuItems.map(item => {
      const normItem = normalizeText(item.name);
      const normTrans = normalizeText(transcript);

      // 0. SUBSTRING/PREFIX BOOST (The "Fish Curry" Fix)
      // If the user says "Fish Curry" and item is "Fish Curry Boneless", this should be a match.
      let directMatchBonus = 0;
      if (normItem === normTrans) {
          directMatchBonus = 1.0; // Perfect
      } else if (normItem.startsWith(normTrans) || normTrans.startsWith(normItem)) {
          directMatchBonus = 0.95; // Strong Prefix Match
      } else if (normItem.includes(normTrans)) {
          directMatchBonus = 0.85; // Substring Match
      }

      // 1. Phonetic Score
      let phoneticScore = calculatePhoneticScore(transcript, item.phoneticName || item.name);
      
      // 2. Keyword Score
      let keywordScore = 0;
      if (item.sttKeywords && item.sttKeywords.length > 0) {
        if (item.sttKeywords.some(k => normalizeText(k) === normTrans)) keywordScore = 1.0;
        else if (item.sttKeywords.some(k => normalizeText(k).includes(normTrans))) keywordScore = 0.8;
      }

      // 3. Token Score
      let tokenScore = calculateTokenScore(transcript, item.name);

      // Weighted Final Score
      let finalScore = (
        (phoneticScore * WEIGHTS.PHONETIC) +
        (keywordScore * WEIGHTS.KEYWORD) +
        (tokenScore * WEIGHTS.TOKEN)
      );

      // Apply Override from Direct Match
      if (directMatchBonus > finalScore) {
          finalScore = directMatchBonus;
      }

      return { item, score: finalScore, debug: { phoneticScore, keywordScore, tokenScore, directMatchBonus } };
    });

    // Sort descending
    candidates.sort((a, b) => b.score - a.score);
    
    const top1 = candidates[0];
    const top2 = candidates[1];

    // --- DECISION GATES ---

    // Gate 1: Minimum Score
    if (!top1 || top1.score < THRESHOLDS.MIN_SCORE) {
      console.log(`🛡️ [MenuMatcher] No match passed threshold (${top1?.score?.toFixed(2)} < ${THRESHOLDS.MIN_SCORE})`);
      return { match: null, ambiguous: null, candidates: candidates.slice(0,3) };
    }

    // Gate 2: Ambiguity Margin
    if (top2 && (top1.score - top2.score) < THRESHOLDS.AMBIGUOUS_MARGIN) {
      console.log(`🛡️ [MenuMatcher] Ambiguous: "${top1.item.name}" vs "${top2.item.name}" (Margin: ${(top1.score - top2.score).toFixed(2)})`);
      return { match: null, ambiguous: [top1.item, top2.item], candidates: candidates.slice(0,3) };
    }

    // Success
    console.log(`✅ [MenuMatcher] Match: "${top1.item.name}" (Score: ${top1.score.toFixed(2)})`);
    return { match: top1.item, ambiguous: null, candidates: candidates.slice(0,3) };
  },

  /**
   * Finds loose matches for suggestion purposes (Score 0.4 - 0.77)
   */
  findSuggestions(transcript, menuItems) {
    // Re-use logic but just map scores
    const candidates = menuItems.map(item => {
      let phoneticScore = calculatePhoneticScore(transcript, item.phoneticName || item.name);
      
      let keywordScore = 0;
      if (item.sttKeywords && item.sttKeywords.length > 0) {
        const normTrans = normalizeText(transcript);
        if (item.sttKeywords.some(k => normalizeText(k) === normTrans)) keywordScore = 1.0;
        else if (item.sttKeywords.some(k => normalizeText(k).includes(normTrans))) keywordScore = 0.8;
      } else {
        if (normalizeText(item.name).includes(normalizeText(transcript))) keywordScore = 0.6;
      }

      let tokenScore = calculateTokenScore(transcript, item.name);

      const finalScore = (
        (phoneticScore * WEIGHTS.PHONETIC) +
        (keywordScore * WEIGHTS.KEYWORD) +
        (tokenScore * WEIGHTS.TOKEN)
      );

      return { item, score: finalScore };
    });

    candidates.sort((a, b) => b.score - a.score);
    
    // Return items that are "close but not close enough"
    return candidates
        .filter(c => c.score >= 0.4 && c.score < THRESHOLDS.MIN_SCORE)
        .slice(0, 2)
        .map(c => c.item);
  }
};
