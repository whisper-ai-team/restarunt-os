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
