// check_sms_status.js
import "dotenv/config";
import twilio from "twilio";

async function checkStatus() {
  const sid = "SM857ca9ee66dd6bf6cdbc810df830f9eb";
  console.log(`🔍 Checking status for SID: ${sid}`);

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  try {
    const message = await client.messages(sid).fetch();
    console.log(`📈 Status: ${message.status}`);
    console.log(`❌ Error Code: ${message.errorCode}`);
    console.log(`📫 To: ${message.to}`);
    console.log(`📤 From: ${message.from}`);
    console.log(`📋 Body: ${message.body}`);
    if (message.errorMessage) {
      console.log(`❌ Error: ${message.errorMessage}`);
    }
  } catch (err) {
    console.error("❌ Failed to fetch message status:", err.message);
  }
}

checkStatus();
