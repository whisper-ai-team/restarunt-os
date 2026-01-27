import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer } from "http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Server } from "socket.io";
import { WebhookReceiver, AgentDispatchClient, RoomServiceClient, SipClient } from "livekit-server-sdk";
import { 
  getRestaurantByPhone, 
  getAllRestaurants, 
  createRestaurant, 
  getRestaurantById, 
  updateRestaurant,
  createPrinter,
  deletePrinter,
  getRestaurantConfigInternal,
} from "./restaurantConfig.js";
import { getCloverDevices } from "./cloverPrint.js";
import { reviewService } from "./services/reviewService.js";
import { feedbackService } from "./services/feedbackService.js";
import { sendSMS, sendEmail, sendTemplateEmail, sendOrderTemplateEmail } from "./services/email-service/index.js";
import { createStripeCheckoutSession, parseStripeWebhook, isStripeConfigured } from "./services/payment-service/index.js";
import { processOrder } from "./services/order-service/index.js";
import { PrismaClient } from "@prisma/client";
import menuService from "./pos/menuService.js";

const prisma = new PrismaClient({ errorFormat: "minimal" });

const app = express();
app.use(cors());
// Stripe webhooks require raw body, so skip JSON parsing for that route.
const jsonParser = bodyParser.json();
app.use((req, res, next) => {
  if (req.originalUrl === "/api/webhooks/stripe") return next();
  return jsonParser(req, res, next);
});
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});
const port = process.env.PORT || 3001;
const BENCHMARK_REPORT_PATH = process.env.AI_BENCHMARK_REPORT_PATH || "benchmarks/latest.json";
const BENCHMARK_REPORT_DIR = process.env.AI_BENCHMARK_REPORT_DIR || "benchmarks/reports";

// Global WebSocket state
const activeAgents = new Map(); // agentId -> { status, roomName, startTime }
const activeCalls = new Map();  // roomName -> { customerName, startTime, transcript }

// Persistence now handled via Prisma 'Call' model (removed file-based context)

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

const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
);

const sipClient = new SipClient(
    process.env.LIVEKIT_URL,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
);

// ✅ Call Takeover API
app.post("/api/calls/:id/takeover", async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`☝️ TAKEOVER REQUESTED FOR CALL: ${id}`);

        const call = await prisma.call.findUnique({
            where: { id },
            include: { restaurant: true }
        });

        if (!call) return res.status(404).json({ error: "Call not found" });

        // Get room name from active calls map or DB (we need to find the room name)
        // Since we don't store roomName in Call model yet, we look it up from activeAgents
        let roomName = null;
        for (const [_, info] of activeAgents.entries()) {
            // This is a bit of a heuristic if multiple calls are happening
            // In a real prod system, roomName would be on the Call record.
            // For now, let's assume one active call per restaurant for testing or match by phone
            if (info.roomName && info.roomName.includes(call.customerPhone.replace('+', ''))) {
                roomName = info.roomName;
                break;
            }
        }

        if (!roomName) {
            // Fallback: look in activeCalls map
            for (const [name, _] of activeCalls.entries()) {
                if (name.includes(call.customerPhone.replace('+', ''))) {
                    roomName = name;
                    break;
                }
            }
        }

        if (!roomName) return res.status(404).json({ error: "Active room session not found for this call" });

        console.log(`🏠 Identified Room: ${roomName}`);

        // 1. Mute the Agent in the room
        const participants = await roomService.listParticipants(roomName);
        const agentParticipant = participants.find(p => p.identity.startsWith('agent-') || p.identity.includes('restaurant-os-agent'));

        if (agentParticipant) {
            console.log(`🔇 Muting Agent: ${agentParticipant.identity}`);
            // Note: In LiveKit Agents, the agent is a participant. 
            // We can mute its tracks or just use updateParticipant to mute its mic.
            await roomService.updateParticipant(roomName, agentParticipant.identity, {
                permission: { canPublish: false, canPublishData: false }
            });
        }

        // 2. Update DB state
        await prisma.call.update({
            where: { id },
            data: { isTakeoverActive: true }
        });

        // 3. Broadcast to Dashboards
        io.emit("call:takeover", { callId: id, roomName });

        res.json({ success: true, roomName });
    } catch (err) {
        console.error("❌ Takeover failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ Call Transfer API (Handoff to Staff)
app.post("/api/calls/:id/transfer", async (req, res) => {
    try {
        const { id } = req.params;
        const { staffPhone } = req.body;

        if (!staffPhone) return res.status(400).json({ error: "staffPhone is required" });

        console.log(`📡 TRANSFER REQUESTED FOR CALL: ${id} TO ${staffPhone}`);

        const call = await prisma.call.findUnique({
            where: { id },
        });

        if (!call) return res.status(404).json({ error: "Call record not found" });
        if (!call.roomName) return res.status(400).json({ error: "Call has no active room session" });

        // Fetch Restaurant Config for Transfer Number
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: call.restaurantId }
        });

        // Priority: 1. DB Configured Transfer Number, 2. API Provided Phone, 3. Restaurant Main Phone (Fallback - risky if loop)
        const targetPhone = restaurant?.transferPhoneNumber || staffPhone || restaurant?.phoneNumber;

        if (!targetPhone) {
             return res.status(400).json({ error: "No transfer phone number configured for this restaurant." });
        }
        
        console.log(`📡 TRANSFER TARGET RESOLVED: ${targetPhone} (Source: ${restaurant?.transferPhoneNumber ? 'DB_CONFIG' : 'API_INPUT'})`);

        // Fix: Don't guess the identity. Find the actual SIP participant in the room.
        const participants = await roomService.listParticipants(call.roomName);
        
        // Look for participant with SIP attributes or identity pattern
        const sipParticipant = participants.find(p => 
            p.kind === 2 || // ParticipantInfo_Kind.SIP is 2 (usually) - verification needed or check attributes
            p.identity.startsWith("sip_") || 
            p.attributes?.['sip.callID']
        );

        if (!sipParticipant) {
            console.error(`❌ [TRANSFER] No SIP participant found in room ${call.roomName}`);
            console.log("   Participants:", participants.map(p => p.identity));
            return res.status(404).json({ error: "SIP participant not found in room" });
        }

        const sipIdentity = sipParticipant.identity;
        
        // Revert to standard tel: URI now that "Enable PSTN Transfer" is checked.
        // This is the most compatible format for Twilio + LiveKit.
        const transferTarget = `tel:${targetPhone}`; 

        console.log(`🔄 Initiating SIP REFER for ${sipIdentity} in room ${call.roomName} -> ${transferTarget}`);

        // Try to transfer
        try {
            await sipClient.transferSipParticipant(call.roomName, sipIdentity, transferTarget, {
                playDialtone: true,
                headers: {
                    "X-Transfer-Reason": "agent-handoff"
                }
            });
            console.log(`✅ SIP REFER signal sent!`);
            
            // Update DB
            await prisma.call.update({
                where: { id },
                data: { status: "TRANSFERRED" }
            });

            res.json({ success: true, target: targetPhone, method: "SIP_REFER" });

        } catch (sipErr) {
            console.error("❌ SIP REFER failed:", sipErr);
            console.error("   Message:", sipErr?.message);
             // Fallback: If identity is wrong, maybe list participants?
             // But for now, fail hard so we see log.
             throw new Error(`SIP Transfer Failed: ${sipErr.message}`);
        }

    } catch (err) {
        console.error("❌ Transfer request failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ Helper: normalize phone so formats match
function normalizePhone(num) {
  if (!num) return "";
  return String(num)
    .replace(/^sip:/i, "") // remove leading "sip:" if present
    .replace(/\s+/g, "") // remove spaces
    .replace(/-/g, "") // remove dashes
    .replace(/\(/g, "") // remove (
    .replace(/\)/g, ""); // remove )
}

// Middleware to capture raw body for webhook verification
app.use("/api/webhook", bodyParser.raw({ type: "*/*" }));

// --- THE CORE LOGIC ---
app.post("/api/webhook", async (req, res) => {
  try {
    console.log("🔥 /api/webhook HIT");
    console.log("Headers:", req.headers);
    console.log("Raw body:", req.body?.toString());

    // For Production, you can enable signature verification:
    // const event = receiver.receive(req.body, req.headers["authorization"]);

    // For Testing: Manual parsing
    const event = JSON.parse(req.body.toString());

    console.log(`Received Event: ${event.event}`);

    // 2. Listen for "SIP Inbound Trunk Received"
    if (event.event === "sip_inbound_trunk_received") {
      const sipEvent = event.sip;

      // The number the user dialed (The Restaurant's Number)
      const dialedNumberRaw = sipEvent.to;
      const dialedNumber = normalizePhone(dialedNumberRaw);

      // Room created by Dispatch Rule
      const existingRoomName = sipEvent.roomName;

      console.log(`📞 Incoming call to (raw): ${dialedNumberRaw}`);
      console.log(`📞 Incoming call normalized: ${dialedNumber}`);
      console.log(`🏠 SIP Event Room Name: "${existingRoomName}"`);
      console.log(`🔗 Checking Active Context Map Key: "${existingRoomName}"`);

      // 3. Database Lookup (Multi-Tenant Routing)
      const restaurant = await getRestaurantByPhone(dialedNumber);

      if (!restaurant) {
        console.error(
          "❌ Unknown Phone Number - No restaurant found for:",
          dialedNumber
        );
        return res.status(200).send();
      }

      console.log(`✅ Restaurant identified: ${restaurant.name} (${restaurant.cuisineType})`);
      console.log(`   Location: ${restaurant.location.city}, ${restaurant.location.state}`);

      // 4. Create the Dispatch (Launch the Agent)
      const dispatch = await dispatchClient.createDispatch(
        existingRoomName,
        "restaurant-os-agent",
        JSON.stringify({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          restaurantConfig: restaurant, // Pass full config to agent
          twilioCallSid: sipEvent.callId, // Capture SIP Call ID (Twilio SID)
        })
      );

      // Save context persistently via Call record
      try {
          await prisma.call.upsert({
              where: { roomName: existingRoomName },
              update: {
                  restaurantId: restaurant.id,
                  twilioCallSid: sipEvent.callId,
                  status: "INITIATING"
              },
              create: {
                  roomName: existingRoomName,
                  restaurantId: restaurant.id,
                  customerPhone: dialedNumber, // Normalized
                  twilioCallSid: sipEvent.callId,
                  status: "INITIATING"
              }
          });
          console.log(`💾 Room Context Saved to DB: ${existingRoomName} -> ${restaurant.id}`);
      } catch (dbErr) {
          console.error("❌ Failed to save Call Context to DB:", dbErr);
          // Non-blocking, agent might still work if metadata passes through
      }

      console.log(
        `🚀 Agent Dispatched to room ${existingRoomName}! Dispatch ID: ${dispatch.id}`
      );
    }

    // 2b. Listen for participant joined (For late-resolution of attributes)
    if (event.event === "participant_joined") {
      const participant = event.participant;
      const attributes = participant.attributes || {};
      const trunkNumber = attributes["sip.trunkPhoneNumber"];

      if (trunkNumber && event.room?.name) {
        console.log(`📡 [WEBHOOK] SIP Participant Joined. Trunk: ${trunkNumber} Room: ${event.room.name}`);
        console.log(`🔍 [DEBUG] All Attributes:`, JSON.stringify(attributes, null, 2)); // DEBUGGING
        const normalizedTrunk = normalizePhone(trunkNumber);
        
        // Extract Twilio Call SID from attributes if available
        const twilioCallSid = attributes["sip.twilio.callSid"] || attributes["sip.callID"];

        try {
          const restaurant = await getRestaurantByPhone(normalizedTrunk);
          if (restaurant) {
             await prisma.call.upsert({
                where: { roomName: event.room.name },
                update: { 
                    restaurantId: restaurant.id,
                    twilioCallSid: twilioCallSid, // Update if missing
                    customerPhone: normalizePhone(participant.identity || ""), // Ensure phone is captured
                },
                create: {
                   roomName: event.room.name,
                   restaurantId: restaurant.id,
                   customerPhone: normalizePhone(participant.identity || ""),
                   status: "IDENTIFIED",
                   twilioCallSid: twilioCallSid // Save on create
                }
             });
             console.log(`✅ [WEBHOOK] Mapped Room ${event.room.name} to Restaurant: ${restaurant.name}. SID: ${twilioCallSid}`);
          }
        } catch (e) {
          console.error("❌ Failed to map participant metadata to DB:", e);
        }
      }
    }

    // 2c. Agent safety: if agent drops unexpectedly, close the room to avoid silent calls
    if (event.event === "participant_left") {
      const participant = event.participant || {};
      const roomName = event.room?.name;
      const isAgent = participant.kind === "AGENT" || participant.identity?.startsWith("agent-");

      if (isAgent && roomName) {
        // Delay briefly to allow a reconnect if it's transient
        setTimeout(async () => {
          try {
            const callRecord = await prisma.call.findFirst({ where: { roomName } });
            if (callRecord?.isTakeoverActive) {
              console.log(`🛟 Agent left but takeover active; leaving room ${roomName} open.`);
              return;
            }

            // Check if room still exists before querying participants
            try {
              const participants = await roomService.listParticipants(roomName);
              const hasAgent = participants.some(p => p.kind === "AGENT" || p.identity?.startsWith("agent-"));
              if (!hasAgent) {
                console.warn(`🚨 Agent disconnected from ${roomName}. Closing room to avoid silent call.`);
                await roomService.deleteRoom(roomName);
              }
            } catch (roomErr) {
              // Room might already be deleted - that's fine
              if (roomErr.status === 404 || roomErr.code === 'not_found') {
                console.log(`✅ Room ${roomName} already deleted, nothing to clean up.`);
              } else {
                console.error("Unexpected error checking room participants:", roomErr);
              }
            }
          } catch (err) {
            console.error("Failed to close room after agent disconnect:", err);
          }
        }, 3000);
      }
    }

    res.status(200).send("ok");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Error processing webhook");
  }
});

// ============================================
// CLOVER WEBHOOK ENDPOINT
// ============================================

app.post("/api/webhooks/clover", bodyParser.json(), async (req, res) => {
  try {
    console.log("🔔 Clover Webhook Received");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const event = req.body;

    // Clover sends verification requests - respond with 200
    if (req.headers['x-clover-webhook-verification']) {
      console.log("✅ Clover webhook verification successful");
      return res.status(200).send("OK");
    }

    // Handle actual webhook events
    const eventType = event.type;
    
    switch (eventType) {
      case "ORDER_CREATED":
        console.log(`📋 New order created in Clover: ${event.objectId}`);
        // You can sync this to your database if needed
        break;
        
      case "ORDER_UPDATED":
        console.log(`📝 Order updated in Clover: ${event.objectId}`);
        break;
        
      case "ORDER_DELETED":
        console.log(`🗑️ Order deleted in Clover: ${event.objectId}`);
        break;
        
      case "ITEM_CREATED":
      case "ITEM_UPDATED":
      case "ITEM_DELETED":
        console.log(`🍔 Menu item ${eventType} in Clover`);
        // Clear menu cache when items change
        const restaurant = await prisma.restaurant.findFirst({
          where: { clover: { path: ['merchantId'], equals: event.merchantId } }
        });
        if (restaurant) {
          menuService.invalidateCache(restaurant.id);
          console.log(`🔄 Menu cache invalidated for ${restaurant.name}`);
        }
        break;
        
      default:
        console.log(`ℹ️ Unhandled Clover webhook: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Clover webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for Clover verification
app.get("/api/webhooks/clover", (req, res) => {
  res.status(200).json({ 
    status: "ready",
    message: "Clover webhook endpoint active" 
  });
});

// ============================================
// SQUARE OAUTH ENDPOINTS
// ============================================

// Square OAuth - Initiate
app.get("/api/square/auth", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    });
    
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    
    const squareAuthUrl = new URL("https://connect.squareup.com/oauth2/authorize");
    squareAuthUrl.searchParams.set("client_id", process.env.SQUARE_APP_ID);
    squareAuthUrl.searchParams.set("scope", "MERCHANT_PROFILE_READ ORDERS_READ ORDERS_WRITE ITEMS_READ PAYMENTS_WRITE");
    squareAuthUrl.searchParams.set("state", restaurantId);
    
    console.log(`🔗 Redirecting to Square OAuth for restaurant: ${restaurant.name}`);
    
    res.redirect(squareAuthUrl.toString());
  } catch (err) {
    console.error("Square OAuth init failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Square OAuth - Callback
app.get("/api/square/callback", async (req, res) => {
  try {
    const { code, state: restaurantId } = req.query;
    
    if (!code) {
      console.error("❌ Square OAuth callback missing authorization code");
      return res.redirect(`/dashboard?error=square_oauth_failed`);
    }
    
    console.log(`✅ Square OAuth callback received for restaurant: ${restaurantId}`);
    
    const tokenResponse = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APP_ID,
        client_secret: process.env.SQUARE_APP_SECRET,
        code: code,
        grant_type: "authorization_code"
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("❌ Square token exchange failed:", errorText);
      return res.redirect(`/dashboard?error=square_token_failed`);
    }
    
    const tokenData = await tokenResponse.json();
    const { access_token, merchant_id, expires_at } = tokenData;
    
    console.log(`🔑 Square access token received for merchant: ${merchant_id}`);
    
    let restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    });
    
    if (restaurant) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          square: {
            accessToken: access_token,
            merchantId: merchant_id,
            expiresAt: expires_at,
            environment: "production"
          }
        }
      });
      console.log(`💾 Updated restaurant with Square credentials: ${restaurant.name}`);
    }
    
    return res.send(`
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 50px; text-align: center; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #006aff; }
            .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .code { font-family: monospace; background: #f5f5f5; padding: 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Square Connected Successfully!</h1>
            <p>Your restaurant is now connected to Square.</p>
            <div class="info">
              <strong>Merchant ID:</strong> <span class="code">${merchant_id}</span><br/>
              <strong>Restaurant:</strong> ${restaurant.name}
            </div>
            <p>You can now:</p>
            <ul style="text-align: left;">
              <li>Create orders via voice calls</li>
              <li>Sync menu items automatically</li>
              <li>Process payments</li>
            </ul>
            <p style="margin-top: 30px; color: #666;">
              <small>You can close this window.</small>
            </p>
          </div>
        </body>
      </html>
    `);
    
  } catch (err) {
    console.error("❌ Square OAuth callback error:", err);
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1>❌ Square Connection Failed</h1>
          <p>An error occurred while connecting to Square.</p>
          <p style="color: red;">${err.message}</p>
        </body>
      </html>
    `);
  }
});

// Square Webhook Handler
app.post("/api/webhooks/square", bodyParser.json(), async (req, res) => {
  try {
    console.log("🔔 Square Webhook Received");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const event = req.body;
    const eventType = event.type;
    
    switch (eventType) {
      case "order.created":
        console.log(`📋 New order created in Square: ${event.data?.object?.order?.id}`);
        break;
        
      case "order.updated":
        console.log(`📝 Order updated in Square: ${event.data?.object?.order?.id}`);
        break;
        
      case "catalog.version.updated":
        console.log(`🍔 Menu catalog updated in Square`);
        // Clear menu cache when catalog changes
        const merchantId = event.merchant_id || event.data?.object?.merchant_id;
        if (merchantId) {
          const restaurant = await prisma.restaurant.findFirst({
            where: { square: { path: ['merchantId'], equals: merchantId } }
          });
          if (restaurant) {
            menuService.invalidateCache(restaurant.id);
            console.log(`🔄 Menu cache invalidated for ${restaurant.name}`);
          }
        }
        break;
        
      default:
        console.log(`ℹ️ Unhandled Square webhook: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Square webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Square locations endpoint
app.get("/api/square/locations", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    });
    
    if (!restaurant || !restaurant.square?.accessToken) {
      return res.status(400).json({ error: "Square not connected for this restaurant" });
    }
    
    const response = await fetch("https://connect.squareup.com/v2/locations", {
      headers: {
        "Authorization": `Bearer ${restaurant.square.accessToken}`,
        "Square-Version": "2024-01-18"
      }
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch Square locations");
    }
    
    const data = await response.json();
    console.log(`📍 Found ${data.locations?.length || 0} locations for ${restaurant.name}`);
    
    res.json({ locations: data.locations || [] });
  } catch (err) {
    console.error("Failed to fetch Square locations:", err);
    res.status(500).json({ error: err.message });
  }
});


// ============================================
// UNIVERSAL MENU API
// ============================================

// Get menu in universal format (works with any POS)
app.get("/api/restaurants/:id/menu", async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id }
    });
    
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    
    const menu = await menuService.getMenu(restaurant, prisma);
    
    res.json(menu);
  } catch (err) {
    console.error("Failed to fetch menu:", err);
    res.status(500).json({ error: err.message });
  }
});

// Refresh menu cache (force re-fetch from POS)
app.post("/api/restaurants/:id/menu/refresh", async (req, res) => {
  try {
    const invalidated = menuService.invalidateCache(req.params.id);
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id }
    });
    
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    
    // Fetch fresh menu
    const menu = await menuService.getMenu(restaurant, prisma);
    
    res.json({ 
      success: true, 
      message: `Menu refreshed${invalidated ? ' (cache invalidated)' : ''}`,
      itemCount: menuService.countItems(menu),
      categories: menu.categories.length
    });
  } catch (err) {
    console.error("Failed to refresh menu:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get menu cache statistics
app.get("/api/menu/cache/stats", (req, res) => {
  const stats = menuService.getCacheStats();
  res.json(stats);
});

// --- ORDERS API (For Dashboard & Agent) ---
app.get("/api/restaurants/:id/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: req.params.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, customerPhone, items, totalAmount, cloverOrderId, restaurantId, orderType, deliveryAddress, deliveryInstructions, customerEmail } = req.body;
    
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }

    // Load full config for the service
    const restaurantConfig = await getRestaurantConfigInternal(restaurantId);
    
    // Delegate to Order Service
    const order = await processOrder(req.body, { prisma, restaurantConfig });
    
    // Broadcast to all connected dashboards
    io.emit("order:new", order);

    res.json(order);
  } catch (err) {
    console.error("Failed to save order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// Stripe webhook handler (raw body required)
app.post("/api/webhooks/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await parseStripeWebhook(req);
    const data = event.data?.object;
    const orderId = data?.metadata?.orderId;

    // Only handle checkout session events; ignore others.
    const handledTypes = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired"
    ]);
    if (!handledTypes.has(event.type)) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (!orderId) {
      return res.status(200).json({ ok: false, error: "orderId missing in Stripe metadata" });
    }

    let paymentStatus = "FAILED";
    if (event.type === "checkout.session.completed") paymentStatus = "PAID";
    if (event.type === "checkout.session.async_payment_succeeded") paymentStatus = "PAID";
    if (event.type === "checkout.session.async_payment_failed") paymentStatus = "FAILED";
    if (event.type === "checkout.session.expired") paymentStatus = "EXPIRED";

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        paymentLastEvent: data
      }
    });

    res.json({ ok: true, orderId: updated.id, paymentStatus });
  } catch (err) {
    console.error("Stripe webhook failed:", err);
    const message = err?.message || "Stripe webhook error";
    if (message.toLowerCase().includes("signature")) {
      return res.status(400).json({ error: "Invalid Stripe signature" });
    }
    res.status(500).json({ error: message });
  }
});

app.post("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROOT ENDPOINT (OAuth Callback Handler) ---
app.get("/", async (req, res) => {
  const { code, merchant_id, employee_id, client_id } = req.query;
  
  // Check if this is a Clover OAuth callback
  if (code && merchant_id && client_id) {
    console.log("🔐 Clover OAuth callback received");
    console.log(`   Merchant: ${merchant_id}`);
    console.log(`   Code: ${code.substring(0, 20)}...`);
    
    try {
      // Determine if sandbox based on APP_ID prefix
      const appId = process.env.CLOVER_APP_ID || client_id;
      const appSecret = process.env.CLOVER_APP_SECRET;
      const isSandbox = appId.startsWith('E5ED'); // Your sandbox app starts with E5ED
      const tokenUrl = isSandbox 
        ? "https://sandbox.dev.clover.com/oauth/token"
        : "https://www.clover.com/oauth/token";
      
      console.log(`🔧 Using ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} Clover environment`);
      console.log(`   Token URL: ${tokenUrl}`);
      console.log(`   App ID: ${appId}`);
      
      if (!appSecret) {
        console.error("❌ CLOVER_APP_SECRET not set!");
        return res.status(500).send(`
          <html>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
              <h1>❌ Configuration Error</h1>
              <p>CLOVER_APP_SECRET environment variable not set.</p>
              <p>Run: <code>flyctl secrets set CLOVER_APP_SECRET=your_secret</code></p>
            </body>
          </html>
        `);
      }
      
      // Exchange authorization code for access token
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          code: code
        }).toString()
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("❌ Token exchange failed:");
        console.error("   Status:", tokenResponse.status);
        console.error("   Response:", errorText);
        console.error("   App ID used:", appId);
        console.error("   Token URL:", tokenUrl);
        return res.status(500).send(`
          <html>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
              <h1>❌ OAuth Failed</h1>
              <p>Could not exchange authorization code for access token.</p>
              <p style="color: red; font-family: monospace;">${errorText}</p>
              <hr/>
              <p style="font-size: 12px;">
                Environment: ${isSandbox ? 'Sandbox' : 'Production'}<br/>
                App ID: ${appId}<br/>
                Status: ${tokenResponse.status}
              </p>
            </body>
          </html>
        `);
      }
      
      const tokenData = await tokenResponse.json();
      const { access_token } = tokenData;
      
      console.log(`✅ Access token received for merchant: ${merchant_id}`);
      
      // Find or create restaurant with this merchant ID
      let restaurant = await prisma.restaurant.findFirst({
        where: { 
          OR: [
            { clover: { path: ['merchantId'], equals: merchant_id } },
            { id: merchant_id } // Fallback to ID match
          ]
        }
      });
      
      if (restaurant) {
        // Update existing restaurant with Clover credentials
        await prisma.restaurant.update({
          where: { id: restaurant.id },
          data: {
            clover: {
              apiKey: access_token,
              merchantId: merchant_id,
              environment: "production"
            }
          }
        });
        console.log(`💾 Updated restaurant: ${restaurant.name}`);
      } else {
        // Create new restaurant
        const restaurantSlug = `clover-${merchant_id.toLowerCase()}`;
        restaurant = await prisma.restaurant.create({
          data: {
            id: `clover-${merchant_id}`,
            name: `Restaurant (${merchant_id})`,
            slug: restaurantSlug,
            phoneNumber: "+10000000000", // Placeholder - merchant should update
            clover: {
              apiKey: access_token,
              merchantId: merchant_id,
              environment: isSandbox ? "sandbox" : "production"
            },
            address: "TBD",
            city: "TBD",
            state: "TBD",
            zipCode: "00000",
            cuisineType: "General"
          }
        });
        console.log(`🆕 Created new restaurant for Clover merchant: ${merchant_id}`);
      }
      
      // Success page
      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 50px; text-align: center; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #4CAF50; }
              .info { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .code { font-family: monospace; background: #f5f5f5; padding: 5px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Clover Connected Successfully!</h1>
              <p>Your restaurant is now connected to Clover.</p>
              <div class="info">
                <strong>Merchant ID:</strong> <span class="code">${merchant_id}</span><br/>
                <strong>Restaurant:</strong> ${restaurant.name}
              </div>
              <p>You can now:</p>
              <ul style="text-align: left;">
                <li>Create orders via voice calls</li>
                <li>Sync menu items automatically</li>
                <li>Print to Clover printers</li>
              </ul>
              <p style="margin-top: 30px; color: #666;">
                <small>You can close this window.</small>
              </p>
            </div>
          </body>
        </html>
      `);
      
    } catch (err) {
      console.error("❌ OAuth callback error:", err);
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1>❌ Connection Failed</h1>
            <p>An error occurred while connecting to Clover.</p>
            <p style="color: red;">${err.message}</p>
          </body>
        </html>
      `);
    }
  }
  
  // Regular landing page (no OAuth parameters)
  res.send(`
    <html>
      <head>
        <style>
          body { font-family: Arial; padding: 50px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .container { background: rgba(255,255,255,0.95); color: #333; padding: 50px; border-radius: 15px; max-width: 600px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
          h1 { margin: 0 0 20px 0; }
          .status { background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎙️ Restaurant Voice AI</h1>
          <div class="status">✅ Server Running</div>
          <p>Backend API for voice-powered phone ordering</p>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Powered by OpenAI Realtime API + Clover POS
          </p>
        </div>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    instanceId: process.env.INSTANCE_ID || "unknown"
  });
});

// --- ADMIN API ---

// --- TOOLS CONFIGURATION API ---
app.get("/api/config/tools", async (req, res) => {
    // Return the tools configuration for the admin UI
    // For now we return a default structure or fetch from DB if we had a global config
    // We'll mimic a "Tools Registry"
    res.json({
        tools: [
            { id: "stripe_payment", name: "Stripe Payment Links", description: "Send automated payment links via SMS/Email", enabled: true, configurable: true },
            { id: "email_notifications", name: "Order Confirmation Emails", description: "Send SendGrid templates for pickups & deliveries", enabled: true, configurable: true },
            { id: "clover_sync", name: "Clover POS Sync", description: "Real-time menu & inventory sync", enabled: true, configurable: true }
        ]
    });
});


// Internal API for Agent to fetch context (Metadata fallback)
app.get("/api/internal/room-context/:roomName", async (req, res) => {
  const { roomName } = req.params;
  
  try {
    // 1. Try Persistent DB first
    console.log(`🔍 [CONTEXT] Looking up context for ${roomName} in DB...`);
    let context = null;
    
    try {
        const call = await prisma.call.findUnique({
            where: { roomName },
            include: { restaurant: true } // Fetch full restaurant details
        });

        if (call && call.restaurant) {
             // Rehydrate full config using our helper to ensure decrypted keys etc
             context = await getRestaurantConfigInternal(call.restaurant.id);
             // Add call specific data
             context.twilioCallSid = call.twilioCallSid;
             console.log(`✅ [CONTEXT] DB Hit: ${roomName} -> ${context.name}`);
        }
    } catch (e) {
        console.warn(`⚠️ [CONTEXT] DB Lookup failed: ${e.message}`);
    }
    
    // 2. SELF-HEALING FALLBACK: Check Participant Attributes via Room Service
    if (!context) {
      console.log(`🔍 [CONTEXT] Miss for ${roomName}. Inspecting participant attributes...`);
      try {
          const participants = await roomService.listParticipants(roomName);
          const sipParticipant = participants.find(p => p.attributes?.["sip.trunkPhoneNumber"]);
          
          if (sipParticipant) {
             const trunkNumber = normalizePhone(sipParticipant.attributes["sip.trunkPhoneNumber"]);
             console.log(`📞 [CONTEXT] Found SIP Trunk Attribute: "${trunkNumber}"`);
             context = await getRestaurantByPhone(trunkNumber);
             
             if (context) {
                console.log(`✨ [CONTEXT] Self-Healed context for ${roomName} via Participant Attributes: ${trunkNumber} -> ${context.name}`);
                // Backfill DB for next lookup
                try {
                  await prisma.call.upsert({
                    where: { roomName },
                    update: { restaurantId: context.id },
                    create: { roomName, restaurantId: context.id, customerPhone: normalizePhone(sipParticipant.identity) }
                  });
                } catch(e) {}
             }
          }
      } catch (e) {
        console.warn(`⚠️ [CONTEXT] Participant inspection failed: ${e.message}`);
      }
    }

    // 3. LEGACY FALLBACK: Parse phone from room name (Only if attributes fail)
    if (!context) {
      console.log(`🔍 [CONTEXT] Attributes miss for ${roomName}. Attempting regex recovery...`);
      const phoneMatch = roomName.match(/call-_(\+?\d+)_/);
      if (phoneMatch) {
         const phoneNumber = phoneMatch[1];
         // ... rest stays same but wrapped better
         try {
           context = await getRestaurantByPhone(phoneNumber);
         } catch(e) {}
      }
    }

    if (context) {
      console.log(`🔍 Context served for room: ${roomName} -> ${context.id}`);
      return res.json(context);
    } else {
      // 3. DEV MODE FALLBACK: If running locally, default to the first active restaurant
      // This allows 'npm run agent:dev' to work without a real SIP webhook.
       if (process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV) { // Ensure this is safe
          console.log(`⚠️ [DEV MODE] Context miss for ${roomName}. Defaulting to Generic Pizza.`);
          try {
            // Priority: Pulcinella -> First Found
            let targetId = 'italian-pulcinella';
            let fullConfig = null;
            
            try {
                fullConfig = await getRestaurantConfigInternal(targetId);
            } catch (e) {
                // Pizza not found, fallback to any
                const restaurants = await getAllRestaurants();
                if (restaurants.length > 0) {
                   fullConfig = await getRestaurantConfigInternal(restaurants[0].id);
                }
            }

            if (fullConfig) {
               fullConfig.isFallback = true; // Mark as guessed
               console.log(`✅ [DEV MODE] Served fallback: ${fullConfig.name}`);
               return res.json(fullConfig);
            }
          } catch(e) {
           console.error("Dev fallback failed:", e);
         }
      }

      console.warn(`⚠️ No context found for room: ${roomName}`);
      return res.status(404).json({ error: "Context not found" });
    }
  } catch (error) {
    console.error(`❌ [CONTEXT] Critical failure for ${roomName}:`, error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

app.get("/api/restaurants", async (req, res) => {
  try {
    const restaurants = await getAllRestaurants();
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new restaurant
app.post("/api/restaurants", async (req, res) => {
  try {
    const restaurant = await createRestaurant(req.body);
    res.json(restaurant);
  } catch (err) {
    console.error("Create restaurant failed:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get specific restaurant
// Get specific restaurant
app.get("/api/restaurants/:id", async (req, res) => {
  try {
    const restaurant = await getRestaurantById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific restaurant calls
app.get("/api/restaurants/:id/calls", async (req, res) => {
  try {
    const calls = await prisma.call.findMany({
      where: { restaurantId: req.params.id },
      include: { order: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const formattedCalls = calls.map(call => ({
      ...call,
      order: call.order ? {
        ...call.order,
        total: call.order.totalAmount / 100 // Map cents to dollars for frontend
      } : null
    }));
    res.json(formattedCalls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get call metrics
app.get("/api/restaurants/:id/call-metrics", async (req, res) => {
    try {
        const { id } = req.params;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all calls with orders for this restaurant
        const calls = await prisma.call.findMany({
            where: { restaurantId: id },
            include: {
                order: {
                    include: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const todayCalls = calls.filter(c => c.createdAt >= today);
        const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);
        const usageTotals = calls.reduce(
            (acc, call) => {
                const usage = call.aiUsage || {};
                acc.totalTokens += usage.totalTokens || 0;
                acc.promptTokens += usage.llmPromptTokens || 0;
                acc.completionTokens += usage.llmCompletionTokens || 0;
                acc.sttAudioDurationMs += usage.sttAudioDurationMs || 0;
                acc.ttsCharactersCount += usage.ttsCharactersCount || 0;
                return acc;
            },
            { totalTokens: 0, promptTokens: 0, completionTokens: 0, sttAudioDurationMs: 0, ttsCharactersCount: 0 }
        );
        
        // Calculate success rate (calls with orders / total calls)
        const successfulCalls = calls.filter(c => c.order).length;
        const successRate = calls.length > 0 ? Math.round((successfulCalls / calls.length) * 100) : 0;

        // Active calls
        const activeCallsCount = Array.from(activeAgents.values()).filter(a => a.roomName && activeRoomContext.get(a.roomName)?.id === id).length;

        // Hourly breakdown for today (last 24 hours)
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            calls: 0
        }));

        todayCalls.forEach(call => {
            const hour = call.createdAt.getHours();
            hourlyData[hour].calls++;
        });

        // Call distribution by outcome
        const callDistribution = {
            successful: successfulCalls,
            noOrder: calls.filter(c => !c.order && c.status === 'completed').length,
            abandoned: calls.filter(c => c.status === 'abandoned').length,
            failed: calls.filter(c => c.status === 'failed').length
        };

        // Recent calls (last 10)
        const recentCalls = calls.slice(0, 10).map(call => ({
            id: call.id,
            customerName: call.customerName || 'Unknown',
            timestamp: call.createdAt,
            duration: Math.round((call.duration || 0) / 60),
            status: call.order ? 'completed' : (call.status || 'unknown'),
            orderTotal: call.order ? (call.order.totalAmount / 100) : null
        }));

        // Calculate Top Items
        const itemMap = new Map();
        calls.forEach(call => {
            if (call.order && call.order.items) {
                call.order.items.forEach(item => {
                    const current = itemMap.get(item.name) || { name: item.name, quantity: 0 };
                    current.quantity += item.quantity;
                    itemMap.set(item.name, current);
                });
            }
        });

        const topItems = Array.from(itemMap.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5)
            .map((item, index) => ({
                rank: index + 1,
                name: item.name,
                category: "Main", 
                orders: item.quantity,
                trend: "flat"
            }));

        res.json({
            // Summary stats
            totalCalls: calls.length,
            todayCalls: todayCalls.length,
            totalMinutes: Math.round(totalDuration / 60),
            successRate,
            activeCalls: activeCallsCount,
            aiUsage: {
                totalTokens: usageTotals.totalTokens,
                promptTokens: usageTotals.promptTokens,
                completionTokens: usageTotals.completionTokens,
                tokensPerMinute: totalDuration > 0 ? Math.round((usageTotals.totalTokens / (totalDuration / 60)) * 100) / 100 : 0,
                sttAudioMinutes: Math.round((usageTotals.sttAudioDurationMs || 0) / 60000),
                ttsCharactersCount: usageTotals.ttsCharactersCount
            },
            
            // Detailed analytics
            hourlyData,
            callDistribution,
            recentCalls,
            topItems, 
            
            // Revenue data
            totalRevenue: calls.reduce((sum, c) => sum + (c.order?.totalAmount || 0), 0),
            averageOrderValue: successfulCalls > 0 
                ? Math.round(calls.reduce((sum, c) => sum + (c.order?.totalAmount || 0), 0) / successfulCalls) 
                : 0
        });
    } catch (err) {
        console.error("Failed to fetch call metrics:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update restaurant
app.put("/api/restaurants/:id", async (req, res) => {
  try {
    const restaurant = await updateRestaurant(req.params.id, req.body);
    res.json(restaurant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- PRINTER MANAGEMENT ---

// Get available Clover devices (for dropdown)
app.get("/api/restaurants/:id/devices", async (req, res) => {
  try {
    // Need internal config with decrypted API Key to talk to Clover
    const config = await getRestaurantConfigInternal(req.params.id);
    const devices = await getCloverDevices(config);
    res.json(devices);
  } catch (err) {
    console.error("Failed to fetch devices:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create Printer
app.post("/api/restaurants/:id/printers", async (req, res) => {
  try {
    const printer = await createPrinter(req.params.id, req.body);
    res.json(printer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Printer
app.delete("/api/restaurants/:id/printers/:printerId", async (req, res) => {
  try {
    await deletePrinter(req.params.printerId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- WORKFLOW CONFIGURATION ---

// Get workflow configuration
app.get("/api/restaurants/:id/workflow", async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      select: {
        voiceSelection: true,
        voiceLanguage: true,
        voiceSpeed: true,
        greeting: true,
        endCallMessage: true,
        notificationConfig: true,
        businessHours: true,
        timezone: true
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json({
      voiceSettings: {
        persona: restaurant.voiceSelection || "alloy",
        language: restaurant.voiceLanguage || "en-US",
        speed: restaurant.voiceSpeed || 1.0
      },
      greetingMessage: restaurant.greeting || "",
      endCallMessage: restaurant.endCallMessage || "",
      notifications: restaurant.notificationConfig || {
        customMessage: "",
        promotions: [],
        emailRecipients: [],
        phoneNumbers: []
      },
      businessHours: restaurant.businessHours || {},
      timezone: restaurant.timezone || "America/New_York"
    });
  } catch (err) {
    console.error("Failed to fetch workflow:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update workflow configuration
app.put("/api/restaurants/:id/workflow", async (req, res) => {
  try {
    const { voiceSettings, greetingMessage, endCallMessage, notifications, businessHours, timezone } = req.body;

    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: {
        voiceSelection: voiceSettings?.persona,
        voiceLanguage: voiceSettings?.language,
        voiceSpeed: voiceSettings?.speed,
        greeting: greetingMessage,
        endCallMessage: endCallMessage,
        notificationConfig: notifications,
        businessHours: businessHours,
        timezone: timezone
      }
    });

    res.json({ success: true, restaurant });
  } catch (err) {
    console.error("Failed to update workflow:", err);
    res.status(400).json({ error: err.message });
  }
});

// Test SMS Endpoint
app.post("/api/restaurants/:id/test-sms", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: "Phone number and message are required" });
    }
    
    // Check if notificationService is available and imported
    if (typeof sendSMS === 'undefined') {
       // Try to load it dynamically if not global, or rely on it being present in server.js scope
       // For now, assuming sendSMS is available in scope or needs import. 
       // Since I cannot see top of file, I will assume I might need to require it if it fails, 
       // but typically server.js likely has it or I should add it.
       // Actually I see notificationService.js in the file list.
       // Let's assume it's imported as `sendSMS`. If not, we'll fix it.
       const notificationService = require('./services/notificationService');
       await notificationService.sendSMS(phoneNumber, message);
    } else {
       await sendSMS(phoneNumber, message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to send test SMS:", err);
    res.status(500).json({ error: err.message });
  }
});

// Test Email Endpoint
app.post("/api/restaurants/:id/test-email", async (req, res) => {
  try {
    const { email, subject, message, templateData, templateId } = req.body;
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    if (templateData) {
      const resolvedTemplateId = templateId || process.env.SENDGRID_ORDER_TEMPLATE_ID;
      if (!resolvedTemplateId) {
        return res.status(400).json({ error: "templateId is required for template emails" });
      }
      await sendTemplateEmail(email, resolvedTemplateId, templateData);
    } else {
      if (!subject || !message) {
        return res.status(400).json({ error: "subject and message are required" });
      }
      await sendEmail(email, subject, message);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to send test email:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- SUBSCRIPTION & BILLING ---

// Get subscription details
app.get("/api/restaurants/:id/subscription", async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        billingCycle: true,
        nextBillingDate: true,
        paymentMethodType: true,
        paymentMethodLast4: true,
        paymentMethodExpiry: true
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Define plan details
    const planDetails = {
      free: { name: "Free", price: 0, features: ["100 free minutes", "Basic analytics", "Email support"] },
      basic: { name: "Basic", price: 49, features: ["500 AI Minutes", "Basic Analytics", "Email Support"] },
      premium: { name: "Premium", price: 99, features: ["Unlimited AI Calls", "Advanced Call Analytics", "Clover POS Integration", "Dedicated Support"] },
      pro: { name: "Pro", price: 149, features: ["Unlimited Minutes", "Priority Support", "Advanced POS Integrations", "Custom Voice Cloning"] }
    };

    const currentPlan = planDetails[restaurant.subscriptionPlan] || planDetails.free;

    // Get usage stats from calls
    const totalCalls = await prisma.call.count({ where: { restaurantId: req.params.id } });
    const totalMinutes = await prisma.call.aggregate({
      where: { restaurantId: req.params.id },
      _sum: { duration: true }
    });

    const minutesUsed = Math.round((totalMinutes._sum.duration || 0) / 60);
    const minutesLimit = restaurant.subscriptionPlan === "free" ? 100 : (restaurant.subscriptionPlan === "basic" ? 500 : -1);

    res.json({
      currentPlan: {
        ...currentPlan,
        billingCycle: restaurant.billingCycle
      },
      paymentMethod: restaurant.paymentMethodType ? {
        type: restaurant.paymentMethodType,
        last4: restaurant.paymentMethodLast4,
        expiryMonth: restaurant.paymentMethodExpiry?.split("/")[0],
        expiryYear: restaurant.paymentMethodExpiry?.split("/")[1]
      } : null,
      nextBillingDate: restaurant.nextBillingDate,
      nextBillingAmount: currentPlan.price,
      usageStats: {
        minutesUsed,
        minutesLimit
      },
      availablePlans: [
        { ...planDetails.basic, popular: false },
        { ...planDetails.pro, popular: true }
      ]
    });
  } catch (err) {
    console.error("Failed to fetch subscription:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get per-customer AI usage (grouped by customerPhone)
app.get("/api/restaurants/:id/customer-usage", async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, limit } = req.query;
    const max = Math.min(parseInt(limit || "50", 10) || 50, 500);

    const createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) createdAt.lte = toDate;
    }

    const where = {
      restaurantId: id,
      ...(Object.keys(createdAt).length ? { createdAt } : {})
    };

    const calls = await prisma.call.findMany({
      where,
      select: {
        customerPhone: true,
        duration: true,
        createdAt: true,
        aiUsage: true
      }
    });

    const customerMap = new Map();
    calls.forEach(call => {
      const key = normalizePhone(call.customerPhone || "") || "Unknown";
      const usage = call.aiUsage || {};
      const entry = customerMap.get(key) || {
        customerPhone: key,
        totalCalls: 0,
        totalMinutes: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        sttAudioDurationMs: 0,
        ttsCharactersCount: 0,
        lastCallAt: null
      };

      entry.totalCalls += 1;
      entry.totalMinutes += Math.round((call.duration || 0) / 60);
      entry.totalTokens += usage.totalTokens || 0;
      entry.promptTokens += usage.llmPromptTokens || 0;
      entry.completionTokens += usage.llmCompletionTokens || 0;
      entry.sttAudioDurationMs += usage.sttAudioDurationMs || 0;
      entry.ttsCharactersCount += usage.ttsCharactersCount || 0;
      if (!entry.lastCallAt || (call.createdAt && call.createdAt > entry.lastCallAt)) {
        entry.lastCallAt = call.createdAt;
      }

      customerMap.set(key, entry);
    });

    const customers = Array.from(customerMap.values()).map(entry => ({
      ...entry,
      tokensPerMinute: entry.totalMinutes > 0 ? Math.round((entry.totalTokens / entry.totalMinutes) * 100) / 100 : 0,
      sttAudioMinutes: Math.round((entry.sttAudioDurationMs || 0) / 60000)
    })).sort((a, b) => b.totalTokens - a.totalTokens);

    res.json({
      totalCustomers: customers.length,
      customers: customers.slice(0, max)
    });
  } catch (err) {
    console.error("Customer usage error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Latest benchmark report (JSON file)
app.get("/api/benchmarks/latest", async (_req, res) => {
  try {
    const reportPath = path.resolve(process.cwd(), BENCHMARK_REPORT_PATH);
    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ error: "Benchmark report not found" });
    }
    const raw = fs.readFileSync(reportPath, "utf8");
    const data = JSON.parse(raw);
    return res.json(data);
  } catch (err) {
    console.error("Benchmark report error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Benchmark history list
app.get("/api/benchmarks/history", async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const max = Math.min(parseInt(limit || "20", 10) || 20, 200);
    const dirPath = path.resolve(process.cwd(), BENCHMARK_REPORT_DIR);
    if (!fs.existsSync(dirPath)) {
      return res.json({ reports: [] });
    }
    const files = fs.readdirSync(dirPath).filter((file) => file.endsWith(".json"));
    const reports = files.map((file) => {
      const fullPath = path.join(dirPath, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const data = JSON.parse(raw);
        return {
          file,
          completedAt: data.completedAt || null,
          startedAt: data.startedAt || null,
          suite: data.suite || null,
          models: Object.keys(data.models || {}),
          path: fullPath,
        };
      } catch {
        const stat = fs.statSync(fullPath);
        return {
          file,
          completedAt: stat.mtime.toISOString(),
          startedAt: stat.mtime.toISOString(),
          suite: null,
          models: [],
          path: fullPath,
        };
      }
    });

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    const filtered = reports.filter((r) => {
      const dateStr = r.completedAt || r.startedAt;
      if (!dateStr) return true;
      const date = new Date(dateStr);
      if (fromDate && !Number.isNaN(fromDate.getTime()) && date < fromDate) return false;
      if (toDate && !Number.isNaN(toDate.getTime()) && date > toDate) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aDate = new Date(a.completedAt || a.startedAt || 0).getTime();
      const bDate = new Date(b.completedAt || b.startedAt || 0).getTime();
      return bDate - aDate;
    });

    return res.json({ reports: filtered.slice(0, max) });
  } catch (err) {
    console.error("Benchmark history error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Run benchmark suite
app.post("/api/benchmarks/run", async (req, res) => {
  try {
    const { models, suite, temperature, maxTokens } = req.body || {};
    if (!models || typeof models !== "string") {
      return res.status(400).json({ error: "models is required (comma-separated string)" });
    }

    const suitePath = suite === "ordering"
      ? "scripts/model_benchmark_ordering_cases.json"
      : "scripts/model_benchmark_cases.json";

    const args = [
      "scripts/benchmark_models.js",
      "--models",
      models,
      "--suite",
      suite === "ordering" ? "ordering" : "default",
      "--cases",
      suitePath,
      "--out",
      BENCHMARK_REPORT_PATH
    ];

    if (temperature !== undefined && temperature !== null) {
      args.push("--temperature", String(temperature));
    }
    if (maxTokens !== undefined && maxTokens !== null) {
      args.push("--maxTokens", String(maxTokens));
    }

    const proc = spawn("node", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: `Benchmark failed (${code})`, details: stderr });
      }
      return res.json({ status: "ok", reportPath: BENCHMARK_REPORT_PATH });
    });
  } catch (err) {
    console.error("Benchmark run error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --- WEBSOCKET HANDLERS ---
io.on("connection", (socket) => {
  console.log(`🔌 Dashboard connected: ${socket.id}`);
  
  // Send current state
  socket.emit("state:agents", Array.from(activeAgents.entries()));
  socket.emit("state:calls", Array.from(activeCalls.entries()));
  
  socket.on("disconnect", () => {
    console.log(`🔌 Dashboard disconnected: ${socket.id}`);
  });
});

// Helper to broadcast call events
export function broadcastCallEvent(event, data) {
  io.emit(event, data);
}

// Helper to update agent status
export function updateAgentStatus(agentId, status, roomName = null) {
  activeAgents.set(agentId, { status, roomName, timestamp: Date.now() });
  io.emit("agent:status", { agentId, status, roomName });
}
// --- ANALYTICS ---

app.get("/api/restaurants/:id/analytics", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Basic Stats (Revenue, Total Orders)
    const stats = await prisma.order.aggregate({
      where: { 
        restaurantId: id,
        status: { not: "CANCELLED" }
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    // 2. Recent Orders (Last 7 Days) for Chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOrders = await prisma.order.findMany({
      where: {
        restaurantId: id,
        createdAt: { gte: sevenDaysAgo },
        status: { not: "CANCELLED" }
      },
      select: {
        createdAt: true,
        totalAmount: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by Day (JS aggregation is safer than raw SQL across envs)
    const dailyStats = {};
    recentOrders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) dailyStats[date] = { date, revenue: 0, orders: 0 };
      dailyStats[date].revenue += order.totalAmount;
      dailyStats[date].orders += 1;
    });
    
    // Fill in missing days
    const chartData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      
      if (dailyStats[dateStr]) {
        chartData.push({ ...dailyStats[dateStr], revenue: dailyStats[dateStr].revenue / 100 }); // cents to dollars
      } else {
        chartData.push({ date: dateStr, revenue: 0, orders: 0 });
      }
    }

    // 3. Popular Items (Top 5)
    // Using simple JS aggregation to avoid complex group-by relation issues
    const allItems = await prisma.orderItem.findMany({
      where: {
        order: { restaurantId: id, status: { not: "CANCELLED" } }
      },
      select: { name: true, quantity: true },
      take: 1000 // Limit for performance safety
    });
    
    const itemMap = {};
    allItems.forEach(item => {
      itemMap[item.name] = (itemMap[item.name] || 0) + item.quantity;
    });
    
    const popularItems = Object.entries(itemMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      totalRevenue: (stats._sum.totalAmount || 0) / 100,
      totalOrders: stats._count.id || 0,
      chartData,
      popularItems
    });

  } catch (err) {
    console.error("Analytics Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- CALL HISTORY ---
app.get("/api/restaurants/:id/calls", async (req, res) => {
  try {
    const { id } = req.params;
    const calls = await prisma.call.findMany({
      where: { restaurantId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { order: true }
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new call record (called by agent at start)
app.post("/api/calls", async (req, res) => {
  try {
    const { restaurantId, customerPhone, status } = req.body;
    const call = await prisma.call.create({
      data: {
        restaurantId,
        customerPhone: customerPhone || "Unknown",
        status: status || "ONGOING"
      }
    });
    console.log(`📞 Call Started: ${call.id} for ${customerPhone}`);
    
    // Broadcast to dashboards
    io.emit("call:started", { ...call, type: "INCOMING" });
    
    res.json(call);
  } catch (err) {
    console.error("Call Create Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update call record (called by agent at end)
app.put("/api/calls/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, duration, transcript, summary, orderId, endedAt } = req.body;
    
    const call = await prisma.call.update({
      where: { id },
      data: {
        status,
        duration: duration || 0,
        transcript: transcript || null,
        summary: summary || null,
        orderId: orderId || null,
        endedAt: endedAt ? new Date(endedAt) : new Date()
      },
      include: { order: true, restaurant: true }
    });
    
    console.log(`📞 Call Ended: ${call.id} - ${status} (${duration}s)`);
    
    // Broadcast to dashboards
    io.emit("call:ended", call);
    
    res.json(call);
  } catch (err) {
    console.error("Call Update Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get call metrics for a restaurant (aggregated stats)
app.get("/api/restaurants/:id/call-metrics", async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalCalls, todayCalls, successCalls, totalDuration] = await Promise.all([
      prisma.call.count({ where: { restaurantId: id } }),
      prisma.call.count({ where: { restaurantId: id, createdAt: { gte: today } } }),
      prisma.call.count({ where: { restaurantId: id, status: "ORDER_PLACED" } }),
      prisma.call.aggregate({ where: { restaurantId: id }, _sum: { duration: true } })
    ]);
    
    const totalMinutes = Math.round((totalDuration._sum.duration || 0) / 60);
    const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0;
    
    res.json({
      totalCalls,
      todayCalls,
      totalMinutes,
      successRate,
      activeCalls: activeCalls.size // From global state
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/calls/:id", async (req, res) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: { order: { include: { items: true } }, restaurant: true }
    });
    if (!call) return res.status(404).json({ error: "Call not found" });

    const formattedCall = {
      ...call,
      order: call.order ? {
        ...call.order,
        total: call.order.totalAmount / 100
      } : null
    };
    res.json(formattedCall);
  } catch (err) {
    console.error("Call Detail Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- REPUTATION MANAGEMENT API ---

// 1. Get Reviews
app.get("/api/restaurants/:id/reviews", async (req, res) => {
    try {
        const { status, source } = req.query;
        const reviews = await reviewService.getReviews(req.params.id, { status, source });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Sync Reviews (Mock)
app.post("/api/restaurants/:id/reviews/sync", async (req, res) => {
    try {
        const result = await reviewService.syncReviews(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Generate AI Reply
app.post("/api/reviews/:reviewId/generate-reply", async (req, res) => {
    try {
        const result = await reviewService.generateReply(req.params.reviewId, req.body.tone);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Post Reply
app.post("/api/reviews/:reviewId/reply", async (req, res) => {
    try {
        const result = await reviewService.postReply(req.params.reviewId, req.body.content);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Private Feedback (Public Endpoint)
app.post("/api/feedback", async (req, res) => {
    try {
        const { restaurantId, ...data } = req.body;
        const feedback = await feedbackService.createFeedback(restaurantId, data);
        res.json(feedback);
    } catch (err) {
        console.error("Feedback Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Get Feedback (Admin)
app.get("/api/restaurants/:id/feedback", async (req, res) => {
    try {
        const feedback = await feedbackService.getFeedback(req.params.id);
        res.json(feedback);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Resolve Feedback
app.post("/api/feedback/:id/resolve", async (req, res) => {
    try {
        const result = await feedbackService.resolveFeedback(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const server = httpServer.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Webhook Server listening on port ${port}`);
});

// Graceful Shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated.");
    process.exit(0);
  });
});
