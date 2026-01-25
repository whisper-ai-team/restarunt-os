// services/email-service/index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import twilio from "twilio";
import sgMail from "@sendgrid/mail";
import { buildOrderTemplateData } from "./templates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We'll write logs to the parent project's root for now, or a local log file.
// Let's keep it local to the service to be independent? Or shared?
// Initial implementation used "../sms_logs.txt".
// Let's use a log file inside this service for independence.
const LOG_FILE = path.join(__dirname, "sms_logs.txt");

// Initialize Clients
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
const sendgridFromName = process.env.SENDGRID_FROM_NAME || "Restaurant OS";
const sendgridReplyTo = process.env.SENDGRID_REPLY_TO || null;

if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

let twilioClient;
if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
}

function normalizePhoneE164(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const onlyNums = digits.replace(/\D/g, "");
  if (onlyNums.length === 10) return `+1${onlyNums}`;
  if (onlyNums.length > 10) return `+${onlyNums}`;
  return digits;
}

/**
 * Sends an SMS notification.
 */
export async function sendSMS(phone, message) {
  const normalizedPhone = normalizePhoneE164(phone);
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] TO: ${normalizedPhone} | MSG: ${message}\n`;
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    // console.warn("⚠️ Failed to write to SMS log:", err.message);
  }

  if (twilioClient && (fromNumber || messagingServiceSid)) {
    try {
      const payload = {
        body: message,
        to: normalizedPhone
      };
      if (messagingServiceSid) {
        payload.messagingServiceSid = messagingServiceSid;
      } else {
        payload.from = fromNumber;
      }
      const result = await twilioClient.messages.create(payload);
      console.log(`📱 [TWILIO SMS SENT] SID: ${result.sid} | TO: ${phone}`);
      return result;
    } catch (err) {
      console.error(`❌ Twilio Error: ${err.message}`);
    }
  } else {
      console.log(`📱 [SMS SIMULATED] ${phone}: ${message}`);
  }
}

/**
 * Sends a generic email.
 */
export async function sendEmail(to, subject, text) {
  if (!sendgridApiKey || !sendgridFromEmail) {
    console.warn("⚠️ SendGrid not configured.");
    return null;
  }
  if (!to) {
    console.warn("⚠️ Missing recipient email.");
    return null;
  }

  const msg = {
    to,
    from: { email: sendgridFromEmail, name: sendgridFromName },
    subject,
    text
  };
  if (sendgridReplyTo) msg.replyTo = sendgridReplyTo;

  try {
    const result = await sgMail.send(msg);
    console.log(`📧 [SENDGRID] Email sent to ${to}`);
    return result;
  } catch (err) {
    console.error("❌ SendGrid error:", err.message);
    return null;
  }
}

/**
 * Sends a dynamic template email via SendGrid.
 */
export async function sendTemplateEmail(to, templateId, data) {
  if (!sendgridApiKey || !sendgridFromEmail) {
    console.warn("⚠️ SendGrid not configured.");
    return null;
  }
  
  const msg = {
    to,
    from: { email: sendgridFromEmail, name: sendgridFromName },
    templateId,
    dynamicTemplateData: data || {}
  };
  if (sendgridReplyTo) msg.replyTo = sendgridReplyTo;

  try {
    const result = await sgMail.send(msg);
    console.log(`📧 [SENDGRID] Template email sent to ${to}`);
    return result;
  } catch (err) {
    console.error("❌ SendGrid template error:", err.message);
    return null;
  }
}

/**
 * Sends an Order Confirmation Email using SendGrid Dynamic Templates.
 */
export async function sendOrderTemplateEmail({ to, order, restaurant, items, customerDetails, paymentUrl }) {
    const templateId = process.env.SENDGRID_ORDER_TEMPLATE_ID;
    if (!templateId) {
      console.warn("⚠️ SENDGRID_ORDER_TEMPLATE_ID not set. Skipping order template email.");
      return null;
    }
    
    // Use the template helper
    const data = buildOrderTemplateData({ order, restaurant, items, customerDetails, paymentUrl });
    
    // Reuse the generic sender
    return sendTemplateEmail(to, templateId, data);
}
