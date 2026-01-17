
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixPhoneNumber() {
console.log("Fixing phone number collision...");
try {
  // Find Bharat Bistro by the conflicting number
  const conflicting = await prisma.restaurant.findFirst({
    where: { phoneNumber: "+12013444638" }
  });

  if (conflicting) {
    console.log(`Found conflicting restaurant: ${conflicting.name} (${conflicting.id})`);
    
    // Update it to a dummy number
    await prisma.restaurant.update({
        where: { id: conflicting.id },
        data: { phoneNumber: "+15551112222" } 
    });
    console.log("✅ Updated Bharat Bistro phone to +15551112222");
    
    // Update MOCK_DB in config/agentConfig.js manually? No, that's code. 
    // This DB change is enough to stop the 'Self-Healing' logic from finding it.
  } else {
    console.log("No conflict found.");
  }
} catch(e) {
  console.error(e);
} finally {
  await prisma.$disconnect();
}
}

fixPhoneNumber();
