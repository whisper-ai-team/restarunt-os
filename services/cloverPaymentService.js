// services/cloverPaymentService.js
import fetch from "node-fetch";

/**
 * Generates a Clover Hosted Checkout link for an order.
 * @param {Object} cart - The session cart items.
 * @param {Object} customerDetails - Name and phone of customer.
 * @param {Object} credentials - Merchant credentials (apiKey, merchantId, ecommToken, environment).
 * @returns {Promise<string>} - The payment URL.
 */
export async function createPaymentLink(cart, customerDetails, credentials) {
  const { merchantId, ecommToken, environment } = credentials;
  
  if (!ecommToken) {
    console.warn("⚠️ No Clover Ecommerce Token found. Skipping link generation.");
    return null;
  }

  const baseUrl = environment === "prod" 
    ? "https://api.clover.com" 
    : "https://apisandbox.dev.clover.com";

  const url = `${baseUrl}/invoicingcheckoutservice/v1/checkouts`;
  
  // Format cart for Clover Ecommerce API
  const lineItems = cart.map(item => ({
    name: item.name,
    unitPrice: item.price,
    quantity: item.qty
  }));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Clover-Merchant-Id": merchantId,
        "Authorization": `Bearer ${ecommToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer: {
          firstName: customerDetails.name?.split(" ")[0] || "Customer",
          lastName: customerDetails.name?.split(" ").slice(1).join(" ") || "Phone",
          phoneNumber: customerDetails.phone
        },
        shoppingCart: {
          lineItems: lineItems
        },
        redirectUrls: {
            success: "https://example.com/success", // TODO: Replace with real dashboard success page
            failure: "https://example.com/failure"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.ok.text();
      console.error(`❌ Clover Ecomm Error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    return data.href; // This is the payment link
  } catch (err) {
    console.error("❌ Failed to create Clover payment link:", err.message);
    return null;
  }
}
