// services/order-service/index.js
import { createStripeCheckoutSession } from "../payment-service/index.js";
import { sendOrderTemplateEmail } from "../email-service/index.js";
import { sendOrderConfirmation } from "../notificationService.js";

/**
 * Orchestrates the full order creation flow.
 * 1. Persists to DB (via injected prismaDelegate or similar)
 * 2. Generates Payment Link (via Payment Service)
 * 3. Sends Notifications (via Email Service & Notification Service)
 * 
 * @param {object} orderData - The raw order data from the API/Agent
 * @param {object} dependencies - { prisma, restaurantConfig }
 */
export async function processOrder(orderData, { prisma, restaurantConfig }) {
  const { 
    customerName, 
    customerPhone, 
    customerEmail, // NEW: Mandatory email
    items, 
    totalAmount, 
    cloverOrderId, 
    restaurantId, 
    orderType, 
    deliveryAddress, 
    deliveryInstructions 
  } = orderData;

  // 1. Persist Order
  // Ensure integer cents
  const finalTotal = Math.round(totalAmount);
  
  let order = await prisma.order.create({
    data: {
      customerName,
      customerPhone,
      customerEmail: customerEmail || null, // Persist email
      orderType: orderType || "pickup",
      deliveryAddress: deliveryAddress || null,
      deliveryInstructions: deliveryInstructions || null,
      totalAmount: finalTotal,
      cloverOrderId: cloverOrderId || null,
      restaurantId,
      items: {
        create: items.map((item) => ({
           name: item.name,
           quantity: item.qty || item.quantity,
           price: item.price,
           notes: item.notes || "",
        })),
      },
    },
    include: { items: true, restaurant: true },
  });
  
  console.log(`📝 [OrderService] Created Order #${order.id}`);

  // 2. Generate Payment Link (Stripe)
  let paymentUrl = null;
  // Check if Tools/Config allows Stripe
  // We look at restaurantConfig.tools.stripe or default to process.env
  const isStripeEnabled = process.env.STRIPE_SECRET_KEY && (restaurantConfig.tools?.stripe?.enabled !== false);
  
  if (isStripeEnabled) {
    try {
        const stripeResult = await createStripeCheckoutSession(
            order,
            items,
            { name: customerName, phone: customerPhone, email: customerEmail },
            order.restaurant?.name,
            order.restaurant?.stripeAccountId
        );
        
        if (stripeResult?.url) {
            paymentUrl = stripeResult.url;
            order = await prisma.order.update({
                where: { id: order.id },
                data: {
                    paymentUrl,
                    paymentProvider: "stripe",
                    paymentStatus: "PENDING",
                    paymentReference: stripeResult.sessionId
                },
                include: { items: true, restaurant: true } // re-fetch with updates
            });
            console.log(`💸 [OrderService] Generated Payment Link: ${paymentUrl}`);
        }
    } catch (err) {
        console.error("❌ [OrderService] Payment Link Generation Failed:", err.message);
    }
  }

  // 3. Send Notifications
  // A. SMS/WhatsApp Confirmation (Mandatory)
  try {
      // Logic handled by notificationService (sends SMS + WhatsApp if enabled)
      await sendOrderConfirmation(
        customerPhone, 
        order.restaurant?.name, 
        items, 
        finalTotal
      );
  } catch (err) {
      console.error("❌ [OrderService] Notification Failed:", err.message);
  }

  // B. Email Confirmation (Mandatory if email exists)
  if (customerEmail) {
      try {
          await sendOrderTemplateEmail({
              to: customerEmail,
              order,
              restaurant: order.restaurant,
              items: items,
              customerDetails: { name: customerName, phone: customerPhone, email: customerEmail },
              paymentUrl
          });
          console.log(`📧 [OrderService] Email Sent to ${customerEmail}`);
      } catch (err) {
          console.error("❌ [OrderService] Email Failed:", err.message);
      }
  } else {
      console.warn("⚠️ [OrderService] No email provided for this order. Skipped email confirmation.");
  }

  return order;
}
