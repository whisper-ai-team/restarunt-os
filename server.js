require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { WebhookReceiver, AgentDispatchClient } = require("livekit-server-sdk");
const { getRestaurantByPhone } = require("./restaurantConfig");

const app = express();
const port = process.env.PORT || 3000;

// Initialize LiveKit Clients
const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

const dispatchClient = new AgentDispatchClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Middleware to capture raw body for webhook verification
app.use(bodyParser.raw({ type: "application/webhook+json" }));

// --- THE CORE LOGIC ---
app.post("/api/webhook", async (req, res) => {
  try {
    // Note: For Production, uncomment the line below to verify security signatures
    // const event = receiver.receive(req.body, req.headers["authorization"]);

    // For Testing: Manual parsing
    const event = JSON.parse(req.body.toString());

    console.log(`Received Event: ${event.event}`);

    // 2. Listen for "SIP Inbound Trunk Received"
    if (event.event === "sip_inbound_trunk_received") {
      const sipEvent = event.sip;

      // The number the user dialed (The Restaurant's Number)
      const dialedNumber = sipEvent.to;

      // CRITICAL FIX: Use the Room Name LiveKit created!
      // The Dispatch Rule created this room. We must join IT, not create a new one.
      const existingRoomName = sipEvent.roomName;

      console.log(`📞 Incoming call to: ${dialedNumber}`);
      console.log(`🏠 Caller is waiting in room: ${existingRoomName}`);

      // 3. Database Lookup (Who is this?)
      const restaurant = getRestaurantByPhone(dialedNumber);

      if (!restaurant) {
        console.error("❌ Unknown Phone Number - No Config Found");
        return res.status(200).send();
      }

      console.log(`✅ Identify: Call is for ${restaurant.name}`);

      // 4. Create the Dispatch (Launch the Agent)
      const dispatch = await dispatchClient.createDispatch(
        existingRoomName, // <--- CHANGED: Join the existing room
        "universal-restaurant-agent",
        {
          metadata: JSON.stringify({
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            systemPrompt: restaurant.systemPrompt,
            voiceId: restaurant.voiceId,
            menu: restaurant.menuSummary,
          }),
        }
      );

      console.log(
        `🚀 Agent Dispatched to room ${existingRoomName}! Dispatch ID: ${dispatch.id}`
      );
    }

    res.status(200).send("ok");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Error processing webhook");
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
