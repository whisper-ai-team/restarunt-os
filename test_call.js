import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Starting E2E Data Simulation...");
  
  // 1. Get Restaurant
  const restaurant = await prisma.restaurant.findFirst();
  if (!restaurant) throw new Error("No restaurants found! Run onboarding first.");
  console.log(`📍 Using Restaurant: ${restaurant.name} (${restaurant.id})`);

  // 2. Simulate Call Start
  console.log("📞 Simulating Incoming Call...");
  const call = await prisma.call.create({
    data: {
      restaurantId: restaurant.id,
      customerPhone: "+1555" + Math.floor(100000 + Math.random() * 900000), // Random phone
      status: "ONGOING"
    }
  });
  console.log(`   Call ID: ${call.id}`);

  // Simulate duration
  await new Promise(r => setTimeout(r, 1000));

  // 3. Simulate Order
  console.log("🛒 Simulating Order Placement...");
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      customerName: "Test User",
      customerPhone: call.customerPhone,
      totalAmount: 4500, // $45.00
      status: "CONFIRMED",
      items: {
        create: [
            { name: "Butter Chicken", quantity: 2, price: 1800 },
            { name: "Garlic Naan", quantity: 3, price: 300 }
        ]
      },
      calls: { connect: [{ id: call.id }] } // Link to call
    }
  });
  console.log(`   Order Created: ${order.id}`);

  // 4. Simulate Call End
  console.log("✅ Finalizing Call...");
  await prisma.call.update({
    where: { id: call.id },
    data: {
      status: "ORDER_PLACED",
      endedAt: new Date(),
      duration: 125 // 2m 5s
    }
  });
  
  console.log("\n🎉 Simulation Complete!");
  console.log(`👉 View in Dashboard: http://localhost:3001/admin/calls/${call.id}`);
  console.log(`👉 View Restaurant: http://localhost:3001/admin/${restaurant.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
