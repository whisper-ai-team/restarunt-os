// services/handoffService.js - Logic for bridging calls to human staff
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

/**
 * Transfers an active call to a human staff member using Twilio redirect.
 * @param {string} callSid - The Twilio Call SID to redirect.
 * @param {string} staffPhone - The phone number to transfer to.
 */
export async function transferCallToStaff(callSid, staffPhone) {
    if (!twilioClient) {
        throw new Error("Twilio client not initialized. Check TWILIO_ACCOUNT_SID and AUTH_TOKEN.");
    }

    console.log(`🔀 [HANDOFF] Redirecting call ${callSid} to ${staffPhone}...`);

    try {
        // We use the Programmable Voice 'update' method to change the call's TwiML
        // This effectively 'Redirects' the call to a new Dial instruction.
        const response = await twilioClient.calls(callSid).update({
            twiml: `<Response><Dial>${staffPhone}</Dial></Response>`,
        });

        console.log(`✅ [HANDOFF] Call ${callSid} successfully redirected. SID: ${response.sid}`);
        return response;
    } catch (err) {
        console.error(`❌ [HANDOFF] Failed to redirect call ${callSid}:`, err.message);
        throw err;
    }
}
