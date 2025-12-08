// This simulates your SQL Database
// We map a "Phone Number" (SIP Trunk) to a specific Restaurant Config
const restaurants = [
  {
    id: "rest_101",
    phoneNumber: "+17867338796", // <--- The number user dials
    name: "Spicy Bites Hyderabad",
    voiceId: "cartesia_indian_female", // Placeholder ID
    systemPrompt:
      "You are Riya, a friendly host at Spicy Bites. We serve authentic Hyderabadi Dum Biryani. Always suggest 'Double Masala'.",
    menuSummary:
      "Chicken Biryani ($15), Mutton Biryani ($18), Chicken 65 ($10), Double Ka Meetha ($6).",
  },
  {
    id: "rest_102",
    phoneNumber: "+1201344786",
    name: "Royal Taj North Indian",
    voiceId: "11labs_deep_male",
    systemPrompt:
      "You are Raj, a polite waiter at Royal Taj. Speak elegantly. Upsell Butter Naan with every curry.",
    menuSummary:
      "Butter Chicken ($16), Dal Makhani ($12), Garlic Naan ($4), Mango Lassi ($5).",
  },
];

// Helper to find restaurant by phone
function getRestaurantByPhone(number) {
  // In production, this would be: await db.query('SELECT * FROM restaurants WHERE phone = $1', [number])
  return restaurants.find((r) => r.phoneNumber === number);
}

module.exports = { getRestaurantByPhone };
