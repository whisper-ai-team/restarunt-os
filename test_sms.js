// test_sms.js
import "dotenv/config";
import { sendSMS } from "./services/notificationService.js";

async function runTest() {
  console.log("🚀 Starting SMS Integration Test...");
  
  const testPhone = "+12013444638"; // Placeholder, but valid format
  const testMessage = "Test message from Restaurant OS. If you see this, Twilio is LIVE! 🚀";

  console.log(`📡 Attempting to send SMS to: ${testPhone}`);
  
  try {
    const result = await sendSMS(testPhone, testMessage);
    
    if (result && result.sid) {
      console.log("✅ SUCCESS: Real Twilio message sent!");
      console.log(`   Message SID: ${result.sid}`);
    } else {
      console.log("ℹ️ INFO: Message was processed but likely SIMULATED (check .env for TWILIO keys).");
    }
  } catch (err) {
    console.error("❌ FAILED: SMS test errored:", err.message);
  }
}

runTest();
