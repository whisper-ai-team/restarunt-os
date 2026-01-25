// services/email-service/templates.js

function formatMoney(cents) {
  if (cents === null || cents === undefined) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildOrderTemplateData({ order, restaurant, items, customerDetails, paymentUrl }) {
  const isDelivery = String(order?.orderType || customerDetails?.orderType).toLowerCase() === "delivery";
  const customerName = customerDetails?.name || order?.customerName || "Customer";
  const customerPhone = customerDetails?.phone || order?.customerPhone || "";
  const customerEmail = customerDetails?.email || order?.customerEmail || "";
  
  // Format Currency
  const fmt = (cents) => (cents != null ? `$${(cents / 100).toFixed(2)}` : "$0.00");

  // 1. Map Items (Strict Match)
  const mappedItems = (items || []).map((item) => {
    const qty = item.qty || item.quantity || 1;
    const unitPrice = item.price || 0;
    const comments = item.notes || "";
    // Future: Extract options/modifiers if available in cart
    const options = item.modifiers ? item.modifiers.map(m => `${m.name} ${fmt(m.price)}`) : [];

    return {
      qty,
      name: item.name,
      price: fmt(unitPrice * qty), // Total price for line item or unit price? Template implies line price often, but verify. Kept as per example likely unit * qty
      options,
      comments
    };
  });

  // 2. Calculate Totals
  const subtotalCents = (items || []).reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);
  const totalCents = order?.totalAmount ?? subtotalCents;
  const taxCents = Math.round(subtotalCents * 0.08); // Estimate 8% tax for display if not provided
  const platformFeeCents = 100; // Fixed $1.00 fee example
  const deliveryFeeCents = isDelivery ? 500 : 0; // Fixed $5.00 delivery fee example
  
  // Recalculate total for display consistency
  const finalTotalCents = subtotalCents + taxCents + platformFeeCents + deliveryFeeCents; // Simple calc for template display
  
  // 3. Construct Base Object
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const templateData = {
    order: {
      number: order?.id ? `O-${order.id.toString().slice(-5)}` : "O-12345",
      sourceLabel: "Voice Order", 
      manageUrl: paymentUrl || "https://restaurant.com/orders",
      printUrl: ""
    },
    customer: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      callUrl: `tel:${customerPhone.replace(/\D/g, '')}`
    },
    items: mappedItems,
    totals: {
      subtotal: fmt(subtotalCents),
      tax: fmt(taxCents),
      platformFee: fmt(platformFeeCents),
      deliveryFee: isDelivery ? fmt(deliveryFeeCents) : "$0.00",
      total: fmt(finalTotalCents)
    },
    company: { address: restaurant?.address || "Restaurant OS, Miami, FL" },
    unsubscribe: { url: "" },
    preferences: { url: "" }
  };

  // 4. Conditional Objects
  if (isDelivery) {
    templateData.delivery = {
      prepareBy: `${todayDate} ${timeStr}`,
      provider: "In-House",
      phone: customerPhone,
      address: {
        line1: order?.deliveryAddress || customerDetails?.address || "Address Pending",
        line2: "", // Apt/Suite not explicitly parsed yet
        city: restaurant?.city || "",
        state: restaurant?.state || "",
        zip: restaurant?.zipCode || ""
      },
      instructions: order?.deliveryInstructions || customerDetails?.deliveryInstructions || ""
    };
    templateData.tracking = { url: paymentUrl }; // Use payment link as tracking anchor for now
  } else {
    templateData.pickup = { 
      time: `${todayDate} ${timeStr} (Est. 20m)` 
    };
    templateData.prep = { text: "Start now (est. 20–25 min)" };
    templateData.restaurant = {
      name: restaurant?.name || "Restaurant",
      phone: restaurant?.phone || "",
      callUrl: `tel:${(restaurant?.phone || "").replace(/\D/g, '')}`,
      address: {
        line1: restaurant?.address || "",
        city: restaurant?.city || "",
        state: restaurant?.state || "",
        zip: restaurant?.zipCode || ""
      }
    };
  }

  return templateData;
}
