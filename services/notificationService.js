// services/notificationService.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import twilio from "twilio";
import sgMail from "@sendgrid/mail";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, "../sms_logs.txt");

// Initialize Twilio client (will fail gracefully if keys are missing until user adds them)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const whatsappFromNumber = process.env.TWILIO_WHATSAPP_NUMBER || fromNumber; // Dedicated Sender or fallback
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// ...



// SendGrid setup
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
 * Sends an SMS notification using Twilio, with local logging for fallback.
 * @param {string} phone - Target phone number.
 * @param {string} message - Message content.
 */
export async function sendSMS(phone, message) {
  const normalizedPhone = normalizePhoneE164(phone);
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] TO: ${normalizedPhone} | MSG: ${message}\n`;
  
  // 1. Always log to file for history
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.warn("⚠️ Failed to write to SMS log:", err.message);
  }

  // 2. Try real Twilio delivery
  if (twilioClient && fromNumber) {
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
  }

  // 3. Fallback: Log to console if simulation or error
  console.log(`📱 [SMS SIMULATED] ${phone}: ${message}`);
}

/**
 * Sends a WhatsApp notification using Twilio.
 * @param {string} phone - Target phone number.
 * @param {string} message - Message content.
 */
export async function sendWhatsApp(phone, message) {
  const normalizedPhone = normalizePhoneE164(phone);
  console.log(`💬 [DEBUG] Attempting WhatsApp. From: ${whatsappFromNumber || "NULL"}, To: ${normalizedPhone}, Client: ${!!twilioClient}`);
  
  if (twilioClient && whatsappFromNumber) {
    try {
      // WhatsApp requires "whatsapp:" prefix for both From and To
      // Ensure the configured FROM number supports WhatsApp
      const payload = {
        body: message,
        from: `whatsapp:${whatsappFromNumber}`,
        to: `whatsapp:${normalizedPhone}`
      };
      
      const result = await twilioClient.messages.create(payload);
      console.log(`💬 [TWILIO WHATSAPP SENT] SID: ${result.sid} | TO: ${phone}`);
      return result;
    } catch (err) {
      console.error(`❌ Twilio WhatsApp Error: ${err.message}`);
      // Fallback or just log? We'll just log for now.
    }
  } else {
      console.warn("⚠️ [DEBUG] WhatsApp skipped. Missing Client or Number.");
  }
}

/**
 * Sends a structured order confirmation SMS and/or WhatsApp.
 * @param {string} phone - Customer phone number.
 * @param {string} restaurantName - Name of the restaurant.
 * @param {Array} items - List of ordered items.
 * @param {number} totalCents - Total order value in cents.
 */
export async function sendOrderConfirmation(phone, restaurantName, items, totalCents) {
  const total = (totalCents / 100).toFixed(2);
  const itemSummary = items.map(i => `${i.qty}x ${i.name}`).join(", ");
  const message = `Thanks for ordering from ${restaurantName}! Your order (${itemSummary}) for $${total} is confirmed and being prepared. Track here: https://bit.ly/track-order-123`;
  
  // Send SMS (Always)
  await sendSMS(phone, message);
  
  // Send WhatsApp (Try parallel)
  // Logic: Check if we should send WhatsApp (e.g. if configured or always try)
  // For now, we attempt it. If the number isn't a WhatsApp user or sender not enabled, it will log error but not break flow.
  await sendWhatsApp(phone, message);
}

/**
 * Sends an email via SendGrid.
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} text - Plain text body.
 */
export async function sendEmail(to, subject, text) {
  if (!sendgridApiKey || !sendgridFromEmail) {
    console.warn("⚠️ SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.");
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
  if (sendgridReplyTo) {
    msg.replyTo = sendgridReplyTo;
  }

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
 * @param {string} to - Recipient email.
 * @param {string} templateId - SendGrid dynamic template ID.
 * @param {object} data - Dynamic template data.
 */
export async function sendTemplateEmail(to, templateId, data) {
  if (!sendgridApiKey || !sendgridFromEmail) {
    console.warn("⚠️ SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.");
    return null;
  }
  if (!to) {
    console.warn("⚠️ Missing recipient email.");
    return null;
  }
  if (!templateId) {
    console.warn("⚠️ Missing SendGrid template ID.");
    return null;
  }

  const msg = {
    to,
    from: { email: sendgridFromEmail, name: sendgridFromName },
    templateId,
    dynamicTemplateData: data || {}
  };
  if (sendgridReplyTo) {
    msg.replyTo = sendgridReplyTo;
  }

  try {
    const result = await sgMail.send(msg);
    console.log(`📧 [SENDGRID] Template email sent to ${to}`);
    return result;
  } catch (err) {
    console.error("❌ SendGrid template error:", err.message);
    return null;
  }
}

function formatMoney(cents) {
  if (cents === null || cents === undefined) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildOrderTemplateData({ order, restaurant, items, customerDetails, paymentUrl }) {
  const isDelivery = (order?.orderType || customerDetails?.orderType) === "delivery";
  const customerName = customerDetails?.name || order?.customerName || "Customer";
  const customerPhone = customerDetails?.phone || order?.customerPhone || "";

  const mappedItems = (items || []).map((item) => {
    const qty = item.qty || item.quantity || 1;
    const unitPrice = item.price || 0;
    return {
      qty,
      name: item.name,
      total: formatMoney(unitPrice * qty),
      modifiers: item.modifiers || [],
      notes: item.notes || ""
    };
  });

  const subtotalCents = (items || []).reduce((sum, item) => {
    const qty = item.qty || item.quantity || 1;
    return sum + (item.price || 0) * qty;
  }, 0);

  const totalCents = order?.totalAmount ?? subtotalCents;

  return {
    isDelivery,
    order: {
      number: order?.id || order?.orderNumber || "Order",
      source: "PHONE"
    },
    customer: {
      name: customerName,
      phone: customerPhone
    },
    prep: { minutes: 25, text: "25–35 min" },
    eta: { text: "Arrives soon" },
    tracking: {
      url: order?.trackingUrl || "",
      note: "Tracking updates refresh every few minutes."
    },
    receipt: {
      url: order?.receiptUrl || ""
    },
    restaurant: {
      name: restaurant?.name || "Restaurant",
      phone: restaurant?.phoneNumber || restaurant?.phone || "",
      callUrl: restaurant?.phoneNumber ? `tel:${restaurant.phoneNumber}` : "",
      address: {
        line1: restaurant?.address || "",
        line2: "",
        city: restaurant?.city || "",
        state: restaurant?.state || "",
        zip: restaurant?.zipCode || ""
      }
    },
    delivery: {
      name: customerName,
      address: {
        line1: order?.deliveryAddress || "",
        line2: "",
        city: restaurant?.city || "",
        state: restaurant?.state || "",
        zip: restaurant?.zipCode || ""
      },
      instructions: order?.deliveryInstructions || ""
    },
    pickup: {
      instructions: "Bring ID if required.",
      code: ""
    },
    items: mappedItems,
    payment: {
      subtotal: formatMoney(subtotalCents),
      discount: "",
      deliveryFee: "",
      taxes: "",
      tip: "",
      total: formatMoney(totalCents),
      method: "",
      last4: ""
    },
    paymentLink: paymentUrl || "",
    support: { url: "" },
    company: { address: "" },
    unsubscribe: { url: "" },
    preferences: { url: "" }
  };
}

export async function sendOrderTemplateEmail({ to, order, restaurant, items, customerDetails, paymentUrl }) {
  const templateId = process.env.SENDGRID_ORDER_TEMPLATE_ID;
  if (!templateId) {
    console.warn("⚠️ SENDGRID_ORDER_TEMPLATE_ID not set. Skipping order template email.");
    return null;
  }
  const data = buildOrderTemplateData({ order, restaurant, items, customerDetails, paymentUrl });
  return sendTemplateEmail(to, templateId, data);
}
