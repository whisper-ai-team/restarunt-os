
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignNumber() {
    const target = process.argv[2]; // e.g., "indian"
    const phone = process.argv[3];  // e.g., "+12013444638"
    
    if (!target || !phone) {
        console.log("Usage: node scripts/assign_number.js <pizza|indian|italian|pulcinella> <phone_number>");
        process.exit(1);
    }

    let restaurantId = '';
    if (target.includes('pizza')) restaurantId = 'pizza-repo-001';
    else if (target.includes('indian')) restaurantId = 'indian-repo-001';
    else if (target.includes('pulcinella')) restaurantId = 'italian-pulcinella';
    else if (target.includes('italian')) restaurantId = 'italian-generic-002';
    else {
        console.error("❌ Unknown target. Use: pizza, indian, italian, pulcinella");
        process.exit(1);
    }

    console.log(`🔄 Assigning ${phone} to ${target} (${restaurantId})...`);

    // 1. Release phone from anyone holding it
    const holder = await prisma.restaurant.findUnique({ where: { phoneNumber: phone } });
    if (holder) {
        if (holder.id === restaurantId) {
             console.log("✅ Already assigned.");
             process.exit(0);
        }
        console.log(`   Releasing from ${holder.name}...`);
        await prisma.restaurant.update({
            where: { id: holder.id },
            data: { phoneNumber: `${phone}-OLD-${Math.floor(Math.random()*1000)}` }
        });
    }

    // 2. Assign to target
    await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { phoneNumber: phone }
    });

    console.log(`✅ Success! ${phone} -> ${restaurantId}`);
}

assignNumber()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
