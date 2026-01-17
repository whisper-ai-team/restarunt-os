// services/notificationService.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import twilio from "twilio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, "../sms_logs.txt");

// Initialize Twilio client (will fail gracefully if keys are missing until user adds them)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient;
if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
}

/**
 * Sends an SMS notification using Twilio, with local logging for fallback.
 * @param {string} phone - Target phone number.
 * @param {string} message - Message content.
 */
export async function sendSMS(phone, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] TO: ${phone} | MSG: ${message}\n`;
  
  // 1. Always log to file for history
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.warn("⚠️ Failed to write to SMS log:", err.message);
  }

  // 2. Try real Twilio delivery
  if (twilioClient && fromNumber) {
    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: phone
      });
      console.log(`📱 [TWILIO SMS SENT] SID: ${result.sid} | TO: ${phone}`);
      return result;
    } catch (err) {
      console.error(`❌ Twilio Error: ${err.message}`);
    }
  }

  // 3. Fallback: Log to console if simulation or error
  console.log(`📱 [SMS SIMULATED] ${phone}: ${message}`);
}

/**
 * Sends a structured order confirmation SMS.
 * @param {string} phone - Customer phone number.
 * @param {string} restaurantName - Name of the restaurant.
 * @param {Array} items - List of ordered items.
 * @param {number} totalCents - Total order value in cents.
 */
export async function sendOrderConfirmation(phone, restaurantName, items, totalCents) {
  const total = (totalCents / 100).toFixed(2);
  const itemSummary = items.map(i => `${i.qty}x ${i.name}`).join(", ");
  const message = `Thanks for ordering from ${restaurantName}! Your order (${itemSummary}) for $${total} is confirmed and being prepared. Track here: https://bit.ly/track-order-123`;
  
  await sendSMS(phone, message);
}
