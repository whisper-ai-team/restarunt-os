// send_dummy_payment_test.js
import "dotenv/config";
import { createPaymentLink } from "./services/cloverPaymentService.js";
import { sendSMS } from "./services/notificationService.js";

async function runTest() {
  const phone = "+12013444638";
  console.log(`🚀 Starting Dummy Payment Test for: ${phone}`);

  // 1. Mock Credentials (from ENV)
  const credentials = {
    merchantId: process.env.CLOVER_MERCHANT_ID,
    ecommToken: process.env.CLOVER_ECOMMERCE_TOKEN // User may have this in .env
  };

  if (!credentials.ecommToken) {
    console.warn("⚠️ CLOVER_ECOMMERCE_TOKEN is missing in .env. Using mock link for SMS test.");
  }

  // 2. Mock Cart
  const cart = [
    { name: "Dummy Pizza", price: 1200, qty: 1 },
    { name: "Dummy Soda", price: 300, qty: 1 }
  ];

  // 3. Generate Link (or mock it)
  let paymentUrl = "https://clover.com/p/dummy-link-123";
  if (credentials.ecommToken) {
    console.log("💳 Generating REAL Clover Payment Link...");
    paymentUrl = await createPaymentLink(cart, { name: "Test User", phone }, credentials);
  } else {
    console.log("🧪 Using MOCK Payment Link.");
  }

  if (!paymentUrl) {
    console.error("❌ Failed to generate payment URL.");
    return;
  }

  // 4. Send SMS
  const message = `Thanks for your order! Please pay $15.00 using this secure link: ${paymentUrl}`;
  console.log(`📡 Sending SMS: "${message}"`);
  
  const result = await sendSMS(phone, message);
  if (result && result.sid) {
    console.log(`✅ SUCCESS: Payment SMS sent! SID: ${result.sid}`);
  } else {
    console.log("ℹ️ SMS processed (likely simulated or log-only).");
  }
}

runTest();
