// services/stripePaymentService.js
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export function isStripeConfigured() {
  return !!stripe;
}

export async function createStripeCheckoutSession(order, items, customerDetails, restaurantName, stripeAccountId) {
  if (!stripe) {
    console.warn("⚠️ Stripe not configured. Set STRIPE_SECRET_KEY.");
    return null;
  }

  const successUrl = process.env.STRIPE_SUCCESS_URL || "https://example.com/success";
  const cancelUrl = process.env.STRIPE_CANCEL_URL || "https://example.com/cancel";

  const lineItems = (items || []).map((item) => ({
    quantity: item.qty || item.quantity || 1,
    price_data: {
      currency: "usd",
      unit_amount: item.price,
      product_data: {
        name: item.name
      }
    }
  }));

  // Fallback: single line item if cart is empty or malformed
  if (lineItems.length === 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: order.totalAmount,
        product_data: {
          name: restaurantName ? `Order from ${restaurantName}` : "Restaurant Order"
        }
      }
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerDetails?.email || undefined,
    metadata: {
      orderId: order.id,
      customerPhone: customerDetails?.phone || ""
    }
  }, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);

  return {
    sessionId: session.id,
    url: session.url
  };
}

export async function parseStripeWebhook(req) {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
}
