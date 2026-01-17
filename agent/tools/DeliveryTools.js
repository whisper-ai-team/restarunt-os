// DeliveryTools.js - Tools for handling delivery and address collection
import { llm } from "@livekit/agents";

export const createDeliveryTools = (sessionCart, customerDetails, restaurantConfig) => {
  return {
    setOrderType: llm.tool({
      description: "Set whether the order is for Pickup or Delivery. You MUST ask the customer for this if they haven't specified.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["pickup", "delivery"] }
        },
        required: ["type"],
      },
      execute: async ({ type }) => {
        customerDetails.orderType = type;
        console.log(`🚚 Order Type set to: ${type}`);
        if (type === "delivery") {
          return "System: Order type set to Delivery. You MUST now ask for the delivery address.";
        }
        return "System: Order type set to Pickup. They will pay at the restaurant unless it's a prepaid order.";
      },
    }),

    setDeliveryAddress: llm.tool({
      description: "Set the delivery address for the order. Use this ONLY after the user has specified 'delivery' as the order type.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "The full street address for delivery." }
        },
        required: ["address"],
      },
      execute: async ({ address }) => {
        // Basic validation - check if it looks like an address (has a number)
        if (!/\d/.test(address)) {
          return "System: The address provided seems incomplete. Please ask the customer for a full street address, including the house or building number.";
        }
        
        customerDetails.address = address;
        console.log(`🚚 Delivery Address set to: ${address}`);
        return `System: Address saved as "${address}". Confirm this with the customer and ask if there are any specific delivery instructions or gate codes.`;
      },
    }),
  };
};
