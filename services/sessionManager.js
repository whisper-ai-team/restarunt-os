// sessionManager.js - Session lifecycle management
import { PrismaClient } from "@prisma/client";
import { sendOrderConfirmation, sendSMS } from "./notificationService.js";
import { createPaymentLink } from "./cloverPaymentService.js";

const prisma = new PrismaClient();

// -----------------------------
// SESSION FINALIZATION
// -----------------------------
export async function finalizeSession(reason, sessionCart, customerDetails, restaurantId, callRecordId) {
  if (!sessionCart || sessionCart.length === 0) {
    console.log(`🏁 Call ended (${reason}). No order placed.`);
    return null;
  }
  console.log("------------------------------------------------");
  console.log(`💾 SAVING ORDER FOR: ${customerDetails.name}`);
  sessionCart.forEach((item) => {
    console.log(
      `   - ${item.qty}x ${item.name} ($${(item.price / 100).toFixed(2)})`
    );
  });
  console.log("------------------------------------------------");

  // Calculate total
  const totalAmount = sessionCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Validate restaurantId
  if (!restaurantId) {
    console.error("❌ Cannot save order: restaurantId is missing");
    return null;
  }

  try {
    // Create order in local database
    const order = await prisma.order.create({
      data: {
        customerName: customerDetails.name || "Phone Customer",
        customerPhone: customerDetails.phone || "Unknown",
        status: "PENDING",
        totalAmount,
        cloverOrderId: customerDetails.cloverOrderId || null,
        restaurant: {
          connect: { id: restaurantId }
        },
        items: {
          create: sessionCart.map(item => ({
            name: item.name,
            quantity: item.qty,
            price: item.price,
            notes: item.notes || ""
          }))
        }
      },
      include: { items: true }
    });

    console.log(`✅ Order saved to DB: ${order.id} (${order.items.length} items, $${(totalAmount / 100).toFixed(2)})`);

    // --- PHASE 6: TEXT-TO-PAY ---
    try {
        const fullConfig = await import("../restaurantConfig.js").then(m => m.getRestaurantConfigInternal(restaurantId));
        if (fullConfig && fullConfig.clover?.ecommToken) {
            console.log(`💳 [PHASE 6] Generating Payment Link for Order: ${order.id}`);
            const paymentUrl = await createPaymentLink(sessionCart, customerDetails, fullConfig.clover);
            
            if (paymentUrl) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { paymentUrl }
                });
                console.log(`🔗 Payment Link Generated & Saved: ${paymentUrl}`);
                
                // Send SMS with Link
                const smsMessage = `Thanks for ordering from ${fullConfig.name}! Total: $${(totalAmount/100).toFixed(2)}. Please pay here to confirm: ${paymentUrl}`;
                await sendSMS(customerDetails.phone, smsMessage);
            }
        } else {
            // Fallback to standard confirmation if no payment setup
            await sendOrderConfirmation(customerDetails.phone, fullConfig.name || "Restaurant", sessionCart, totalAmount);
        }
    } catch (payErr) {
        console.error("⚠️ Failed to generate/send payment link:", payErr.message);
    }

    // Link order to call record if provided
    if (callRecordId) {
      await prisma.call.update({
        where: { id: callRecordId },
        data: { orderId: order.id }
      });
      console.log(`🔗 Order linked to call: ${callRecordId}`);
    }

    return order;
  } catch (err) {
    console.error("❌ Failed to save order to DB:", err);
    return null;
  }
}
