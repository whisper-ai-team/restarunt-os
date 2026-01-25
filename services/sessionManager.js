// sessionManager.js - Session lifecycle management
import { PrismaClient } from "@prisma/client";
import { sendOrderConfirmation, sendSMS, sendOrderTemplateEmail, sendWhatsApp } from "./notificationService.js";
import { createStripeCheckoutSession, isStripeConfigured } from "./stripePaymentService.js";

const prisma = new PrismaClient();

// -----------------------------
// SESSION FINALIZATION
// -----------------------------
export async function finalizeSession(reason, sessionCart, customerDetails, restaurantId, callRecordId) {
  // Defensive check for non-array cart
  if (!sessionCart || !Array.isArray(sessionCart) || sessionCart.length === 0) {
    console.log(`🏁 Call ended (${reason}). No order placed.`);
    return null;
  }
  const customerName = customerDetails?.name || "Guest";
  console.log("------------------------------------------------");
  console.log(`💾 SAVING ORDER FOR: ${customerName}`);
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
        orderType: customerDetails.orderType || "pickup",
        deliveryAddress: customerDetails.address || null,
        deliveryInstructions: customerDetails.deliveryInstructions || null,
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
        const paymentProvider = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();

        if (paymentProvider === "stripe" && isStripeConfigured()) {
            console.log(`💳 [STRIPE] Generating Checkout Session for Order: ${order.id}`);
            const stripeResult = await createStripeCheckoutSession(
                order,
                sessionCart,
                customerDetails,
                fullConfig?.name,
                fullConfig?.stripeAccountId
            );
            if (stripeResult?.url) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        paymentUrl: stripeResult.url,
                        paymentProvider: "stripe",
                        paymentStatus: "PENDING",
                        paymentReference: stripeResult.sessionId
                    }
                });
                const smsMessage = `Thanks for ordering from ${fullConfig.name}! Total: $${(totalAmount/100).toFixed(2)}. Please pay here to confirm: ${stripeResult.url}`;
                await sendSMS(customerDetails.phone, smsMessage);
                await sendWhatsApp(customerDetails.phone, smsMessage); // Add WhatsApp
                if (customerDetails.email) {
                  await sendOrderTemplateEmail({
                    to: customerDetails.email,
                    order,
                    restaurant: fullConfig,
                    items: sessionCart,
                    customerDetails,
                    paymentUrl: stripeResult.url
                  });
                }
            } else {
                await sendOrderConfirmation(customerDetails.phone, fullConfig.name || "Restaurant", sessionCart, totalAmount);
                // sendOrderConfirmation handles WhatsApp internally now
            }
        } else {
            await sendOrderConfirmation(customerDetails.phone, fullConfig.name || "Restaurant", sessionCart, totalAmount);
            // sendOrderConfirmation handles WhatsApp internally now
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
