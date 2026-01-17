
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MY_PHONE = '+18639009879'; // Your personal number

async function switchRestaurant() {
    const target = process.argv[2]; // e.g., "pizza", "indian", "italian", "pulcinella"
    
    if (!target) {
        console.log("Usage: node scripts/switch_restaurant.js <pizza|indian|italian|pulcinella>");
        process.exit(1);
    }

    console.log(`🔄 Switching main phone line (${MY_PHONE}) to ${target}...`);

    let restaurantId = '';
    if (target.includes('pizza')) restaurantId = 'pizza-repo-001';
    else if (target.includes('indian')) restaurantId = 'indian-repo-001';
    else if (target.includes('pulcinella')) restaurantId = 'italian-pulcinella';
    else if (target.includes('italian')) restaurantId = 'italian-generic-002';
    else {
        console.error("❌ Unknown target. Use: pizza, indian, italian, pulcinella");
        process.exit(1);
    }

    // 1. Find the restaurant currently holding your phone number
    const currentHolder = await prisma.restaurant.findUnique({
        where: { phoneNumber: MY_PHONE }
    });

    // 2. Find the target restaurant
    const targetRestaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId }
    });

    if (!targetRestaurant) {
        console.error(`❌ Target restaurant ${restaurantId} not found.`);
        process.exit(1);
    }

    if (currentHolder && currentHolder.id === targetRestaurant.id) {
        console.log(`✅ You are already connected to ${targetRestaurant.name}.`);
        process.exit(0);
    }

    // 3. Swap logic
    // We need to give the current holder a temporary/fake number to free up yours.
    if (currentHolder) {
        const fakeNum = `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`;
        console.log(`   Releasing ${MY_PHONE} from ${currentHolder.name} (assigning ${fakeNum})...`);
        await prisma.restaurant.update({
            where: { id: currentHolder.id },
            data: { phoneNumber: fakeNum }
        });
    }

    // 4. Assign your number to target
    // Warning: If target's old number is needed, we could save it, but random is fine for test.
    console.log(`   Assigning ${MY_PHONE} to ${targetRestaurant.name}...`);
    await prisma.restaurant.update({
        where: { id: targetRestaurant.id },
        data: { phoneNumber: MY_PHONE }
    });

    console.log(`\n✅ SUCCESS! Calls from ${MY_PHONE} will now go to: ${targetRestaurant.name}`);
}

switchRestaurant()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
