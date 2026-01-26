// agentUtils.js - Utility functions for the voice agent
import { DateTime } from "luxon";
import natural from "natural";

// --- TIMEZONE & BUSINESS HOURS UTILS ---
export function isOpen(businessHours, timezone) {
  if (!businessHours || Object.keys(businessHours).length === 0) return true; // Default to open if not configured
  
  const tz = timezone || "America/New_York";
  const now = DateTime.now().setZone(tz);
  const day = now.weekdayLong.toLowerCase(); // monday, tuesday...
  
  const schedule = businessHours[day];
  if (!schedule || schedule.closed) return false;
  
  const openTime = DateTime.fromFormat(schedule.open, "HH:mm", { zone: tz });
  const closeTime = DateTime.fromFormat(schedule.close, "HH:mm", { zone: tz });
  
  // Handle overnight hours (e.g. 11 PM to 2 AM)
  if (closeTime < openTime) {
      return (now >= openTime) || (now <= closeTime);
  }
  
  return now >= openTime && now <= closeTime;
}

// Enterprise PII Redaction Utility
export function redact(text) {
  if (typeof text !== "string") return text;
  // Mask 10+ digit numbers (Phones) and obvious names from transcripts
  return text.replace(/\+?\d{10,15}/g, "[PHONE_REDACTED]")
             .replace(/\b(Customer Name|Guest Name)\b/gi, "[NAME_REDACTED]");
}

// Phonetic matcher instance
export const metaphone = new natural.DoubleMetaphone();

// Instance identifier for multi-worker debugging
export const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();

// Heartbeat to confirm process is alive
export function startHeartbeat() {
  setInterval(() => {
    console.log(`💓 [${INSTANCE_ID}] Heartbeat: Worker ${process.pid} is alive and waiting for calls...`);
  }, 30000);
}

export function truncateText(text, maxChars, suffix = "...") {
  if (typeof text !== "string") return text;
  if (!maxChars || maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  const safeLimit = Math.max(0, maxChars - suffix.length);
  return text.slice(0, safeLimit) + suffix;
}

/**
 * Compacts the menu into a token-efficient Markdown format for the System Prompt.
 * Prevents "Menu Blindness" by fitting 200+ items into context.
 */
export function formatMenuForPrompt(items) {
  if (!items || items.length === 0) return "No menu items available.";

  // 1. Group by Category
  const categories = {};
  items.forEach(item => {
    const catName = item.categories && item.categories.length > 0 
        ? item.categories[0].name 
        : "Main";
    
    if (!categories[catName]) categories[catName] = [];
    categories[catName].push(item);
  });

  // 2. Build String
  let output = [];
  const sortedCats = Object.keys(categories).sort();

  for (const cat of sortedCats) {
    output.push(`### ${cat.toUpperCase()}`);
    const catItems = categories[cat];
    
    catItems.forEach(item => {
       const priceStr = item.price ? `($${(item.price / 100).toFixed(0)})` : "";
       // Truncate description to save tokens
       let desc = item.description ? `: ${item.description.substring(0, 40)}...` : ""; 
       // Clean up title
       const cleanName = item.name.replace(/\s+/g, " ").trim();
       
       output.push(`- ${cleanName} ${priceStr}${desc}`);
    });
    output.push(""); // Newline between categories
  }

  // 3. Safety Check: If too long, return a truncated version with a warning
  // 1 token ~= 4 chars. 100k tokens is huge, but let's be safe (~15k chars).
  const finalStr = output.join("\n");
  if (finalStr.length > 20000) {
      console.warn(`⚠️ [MENU] Menu Prompt Context too large (${finalStr.length} chars). Truncating.`);
      return finalStr.substring(0, 20000) + "\n...[MENU TRUNCATED - USE SEARCH TOOL]...";
  }

  return finalStr;
}

/**
 * EXTRACTS KEYWORDS for Input Transcription Prompt (Whisper).
 * Logic:
 * 1. Tokenizes all item names
 * 2. Removes common stop words (chicken, curry, rice, etc - keep unique ones)
 * 3. Keeps specific ethnic terms (Tikka, Masala, Biryani, Chettinad, Guntur)
 * 4. Deduplicates
 */
export function extractMenuKeywords(items) {
    if (!items || items.length === 0) return "";

    const stopWords = new Set(["with", "and", "the", "a", "an", "or", "combo", "special", "plate", "bowl", "side", "extra", "large", "medium", "small", "regular", "full", "half", "pcs", "piece", "pieces"]);
    
    // Terms we explicitly want to KEEP because they are hard to spell/hear
    // (Actually, we want to keep almost everything properly noun-based)
    const uniqueTerms = new Set();

    items.forEach(item => {
        // "Chicken Chettinad" -> ["Chicken", "Chettinad"]
        const parts = item.name.split(/[\s\-\(\)]+/); 
        parts.forEach(p => {
            const clean = p.trim().replace(/[^a-zA-Z]/g, ""); // Remove non-alpha
            if (clean.length > 2 && !stopWords.has(clean.toLowerCase())) {
                uniqueTerms.add(clean);
            }
        });
        
        // Also add category names
        if (Array.isArray(item.categories)) {
            item.categories.forEach(c => {
                 if (!c.name) return;
                 const catParts = c.name.split(/[\s\-]+/);
                 catParts.forEach(cp => {
                     const cleanC = cp.trim().replace(/[^a-zA-Z]/g, "");
                     if (cleanC.length > 2 && !stopWords.has(cleanC.toLowerCase())) {
                         uniqueTerms.add(cleanC);
                     }
                 });
            });
        }
    });

    return Array.from(uniqueTerms).sort().join(", ");
}
