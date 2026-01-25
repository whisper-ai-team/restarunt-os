import { metaphone } from "./agentUtils.js";
import Fuse from "fuse.js";

// --- CONFIGURATION ---
const WEIGHTS = {
  PHONETIC: 0.5, // Reduced from 0.7 to avoid "Masala" vs "Malay" false positives
  KEYWORD: 0.1,
  TOKEN: 0.4     // Increased from 0.1: Now uses Fuzzy Word Matching so it's very reliable
};

const THRESHOLDS = {
  MIN_SCORE: 0.55, // Relaxed heavily for "Kosta" vs "Kofta"
  AMBIGUOUS_MARGIN: 0.08,
  SUGGESTION_MIN: 0.35
};

const STOP_WORDS = new Set(["pickup", "delivery", "order", "help", "menu", "status", "cancel", "stop", "agent", "human", "checkout", "bill"]);

// --- HELPER FUNCTIONS ---

function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

/**
 * Calculates a score based on phonetic similarity (Metaphone + Levenshtein)
 */
function calculatePhoneticScore(transcript, target) {
  // metaphone is an instance of DoubleMetaphone, use .process()
  // .process() returns [primary, secondary]
  const transCodes = metaphone.process(normalizeText(transcript));
  const targetCodes = metaphone.process(normalizeText(target));

  // Handle both array/string returns just in case
  const transCode = Array.isArray(transCodes) ? transCodes[0] : transCodes;
  const targetCode = Array.isArray(targetCodes) ? targetCodes[0] : targetCodes;

  if (!transCode || !targetCode) return 0;

  // Exact Phonetic Match
  if (transCode === targetCode) return 1.0;
  if (transCode.includes(targetCode) || targetCode.includes(transCode)) return 0.8;

  // Levenshtein on Phonetic Codes (e.g. KST vs KFT)
  const distance = levenshteinDistance(transCode, targetCode);
  const maxLength = Math.max(transCode.length, targetCode.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity; 
}

/**
 * Calculates a score based on word matching (Jaccard-ish)
 */
/**
 * Calculates a score based on Fuzzy Token Matching (Levenshtein on words)
 * Handles "Malay" -> "Malai" (High) vs "Malay" -> "Masala" (Low)
 */
function calculateTokenScore(transcript, target) {
  const transTokens = normalizeText(transcript).split(/\s+/);
  const targetTokens = normalizeText(target).split(/\s+/);

  let totalMatchScore = 0;

  for (const tToken of transTokens) {
    let bestTokenScore = 0;
    
    for (const tgtToken of targetTokens) {
      // 1. Exact Match
      if (tToken === tgtToken) {
        bestTokenScore = 1.0;
        break;
      }
      
      // 2. Levenshtein Match
      const dist = levenshteinDistance(tToken, tgtToken);
      const outputLen = Math.max(tToken.length, tgtToken.length);
      const similarity = 1 - (dist / outputLen);
      
      // Threshold for "This word is the same"
      if (similarity > 0.6 && similarity > bestTokenScore) {
        bestTokenScore = similarity;
      }
    }
    totalMatchScore += bestTokenScore;
  }

  // Normalize by length of the LONGER string (penalize missing words)
  const maxTokens = Math.max(transTokens.length, targetTokens.length);
  return totalMatchScore / maxTokens;
}

// Levenshtein Implementation (Standard)
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}


export const MenuMatcher = {
  /**
   * Finds the best match for a user query against the menu
   * @param {string} transcript - What the user said
   * @param {Array} menuItems - Enriched menu items
   */
  findMatch(transcript, menuItems) {
    // 0. STOP WORD CHECK (Prevent "Pickup" -> "Gobi 65")
    if (STOP_WORDS.has(normalizeText(transcript))) {
        console.log(`🛡️ [MenuMatcher] Blocked Stop Word: "${transcript}"`);
        return { match: null, ambiguous: null, suggestions: [], candidates: [] };
    }

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
      console.log(`🛡️ [MenuMatcher] No strong match (${top1?.score?.toFixed(2)} < ${THRESHOLDS.MIN_SCORE})`);
      
      // NEW: "Yellow Light" Logic - Return suggestions if reasonable confidence
      // This catches "Malay Costa" scoring 0.40 - 0.54
      if (top1 && top1.score >= THRESHOLDS.SUGGESTION_MIN) {
          console.log(`💡 [MenuMatcher] Found Suggestions: ${top1.item.name} (${top1.score.toFixed(2)})`);
          return { 
              match: null, 
              ambiguous: null, 
              suggestions: candidates.filter(c => c.score >= THRESHOLDS.SUGGESTION_MIN).slice(0, 2).map(c => c.item),
              candidates: candidates.slice(0,3) 
          };
      }

      return { match: null, ambiguous: null, suggestions: [], candidates: candidates.slice(0,3) };
    }

    // Gate 1.5: Perfect Match Override
    if (top1.score >= 1.0) {
        console.log(`✅ [MenuMatcher] Perfect Match Override: "${top1.item.name}"`);
        return { match: top1.item, ambiguous: null, suggestions: [], candidates: candidates.slice(0,3) };
    }

    // Gate 2: Ambiguity Margin
    if (top2 && (top1.score - top2.score) < THRESHOLDS.AMBIGUOUS_MARGIN) {
      console.log(`🛡️ [MenuMatcher] Ambiguous: "${top1.item.name}" vs "${top2.item.name}" (Margin: ${(top1.score - top2.score).toFixed(2)})`);
      return { match: null, ambiguous: [top1.item, top2.item], suggestions: [], candidates: candidates.slice(0,3) };
    }

    // Success (Green Light)
    console.log(`✅ [MenuMatcher] Match: "${top1.item.name}" (Score: ${top1.score.toFixed(2)})`);
    return { match: top1.item, ambiguous: null, suggestions: [], candidates: candidates.slice(0,3) };
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
