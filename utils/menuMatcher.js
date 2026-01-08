import { metaphone } from "./agentUtils.js";
import Fuse from "fuse.js";

// --- CONFIGURATION ---
const WEIGHTS = {
  PHONETIC: 0.4,
  KEYWORD: 0.4,
  TOKEN: 0.2
};

const THRESHOLDS = {
  MIN_SCORE: 0.78,
  AMBIGUOUS_MARGIN: 0.10
};

/**
 * Normalizes text for comparison (Indian accent friendly)
 * @param {string} text 
 */
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
    .replace(/\s{2,}/g, " ") // Collapse spaces
    .replace(/ph/g, "f") // Indian accent normalization
    .replace(/kh/g, "k")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .trim();
}

/**
 * Calculates Jaccard Similarity between two token sets
 */
function calculateTokenScore(transcript, target) {
  const transTokens = new Set(normalizeText(transcript).split(" "));
  const targetTokens = new Set(normalizeText(target).split(" "));
  
  if (targetTokens.size === 0) return 0;
  
  let intersection = 0;
  transTokens.forEach(t => {
    if (targetTokens.has(t)) intersection++;
  });
  
  return intersection / (transTokens.size + targetTokens.size - intersection);
}

/**
 * Levenshtein Distance Algorithm
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculates Phonetic Similarity (0-1) using Hybrid Logic
 */
function calculatePhoneticScore(transcript, targetPhoneticName) {
  if (!targetPhoneticName) return 0;
  const tNorm = normalizeText(transcript);
  const pNorm = normalizeText(targetPhoneticName);
  
  if (tNorm === pNorm) return 1.0;
  
  // 1. Levenshtein Similarity
  const dist = levenshtein(tNorm, pNorm);
  const maxLength = Math.max(tNorm.length, pNorm.length);
  const levScore = 1 - (dist / maxLength);
  
  // 2. Metaphone Boost (Optional check)
  let metaBonus = 0;
  try {
     const tCodes = metaphone.process(tNorm);
     const pCodes = metaphone.process(pNorm);
     if (tCodes[0] && pCodes[0] && tCodes[0] === pCodes[0]) metaBonus = 0.1;
  } catch(e) {}
  
  return Math.min(levScore + metaBonus, 1.0);
}

export const MenuMatcher = {
  /**
   * Finds the best match for a user query against the menu
   * @param {string} transcript - What the user said
   * @param {Array} menuItems - Enriched menu items
   */
  findMatch(transcript, menuItems) {
    const candidates = menuItems.map(item => {
      // 1. Phonetic Score
      // Use the AI-provided phonetic name if available, else original name
      let phoneticScore = calculatePhoneticScore(transcript, item.phoneticName || item.name);
      
      // 2. Keyword Score (SttKeywords from Sentinel)
      let keywordScore = 0;
      if (item.sttKeywords && item.sttKeywords.length > 0) {
        // Exact match on any keyword is huge
        const normTrans = normalizeText(transcript);
        if (item.sttKeywords.some(k => normalizeText(k) === normTrans)) {
          keywordScore = 1.0;
        } else if (item.sttKeywords.some(k => normalizeText(k).includes(normTrans))) {
          keywordScore = 0.8;
        }
      } else {
        // Fallback: Name match
        if (normalizeText(item.name).includes(normalizeText(transcript))) keywordScore = 0.6;
      }

      // 3. Token Score
      let tokenScore = calculateTokenScore(transcript, item.name);

      // Weighted Final Score
      const finalScore = (
        (phoneticScore * WEIGHTS.PHONETIC) +
        (keywordScore * WEIGHTS.KEYWORD) +
        (tokenScore * WEIGHTS.TOKEN)
      );

      return { item, score: finalScore, debug: { phoneticScore, keywordScore, tokenScore } };
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
