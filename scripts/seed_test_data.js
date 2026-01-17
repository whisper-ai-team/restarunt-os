import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../restaurant_test_data.json');
const FIXTURES_DIR = path.join(__dirname, '../tests/fixtures');

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Starting Seed Process for Test Restaurants...");
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  for (const [index, r] of data.restaurants.entries()) {
    console.log(`\nProcessing [${r.cuisine}] ${r.name}...`);
    
    // 1. Load Fixture
    const fixturePath = path.join(FIXTURES_DIR, `${r.id}.json`);
    if (!fs.existsSync(fixturePath)) {
      console.warn(`⚠️  Skipping ${r.id}: Fixture not found`);
      continue;
    }
    const menuData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    
    // 2. Remove Delete Logic (Handled by Upsert or skip to preserve FKs)
    
    // 3. Upsert Restaurant
    let fakePhone = `+155500099${index.toString().padStart(2, '0')}`;
    if (r.id === 'italian-pulcinella') fakePhone = '+15014642149';
    if (r.id === 'pizza-repo-001') fakePhone = '+17867338796';
    if (r.id === 'indian-repo-001') fakePhone = '+12182315338';
    
    try {
        console.log(`   Upserting Restaurant (ID: ${r.id})...`);

        // Check for phone collision and release if necessary
        const existingHolder = await prisma.restaurant.findUnique({
            where: { phoneNumber: fakePhone }
        });
        
        if (existingHolder && existingHolder.id !== r.id) {
            console.log(`   ⚠️  Phone ${fakePhone} is held by ${existingHolder.name} (${existingHolder.id}). Releasing it...`);
            const tempPhone = `${fakePhone}-OLD-${Math.floor(Math.random() * 1000)}`;
            await prisma.restaurant.update({
                where: { id: existingHolder.id },
                data: { phoneNumber: tempPhone }
            });
        }
        
        const restaurantData = {
            id: r.id, // FORCE ID TO MATCH SLUG
            name: r.name,
            slug: r.id,
            phoneNumber: fakePhone,
            address: "123 Test St, Test City, TS 99999",
            city: "Test City",
            state: "TS",
            zipCode: "99999",
            country: "US",
            cuisineType: r.cuisine,
            
            // Mock Credentials
            cloverMerchantId: r.merchant_id,
            cloverApiKey: "TEST_MODE_KEY", 
            cloverEnvironment: "sandbox", 
            
            aiName: "TestBot",
            greeting: r.greeting,
            isActive: true,
            autoPrint: false
        };

        const restaurant = await prisma.restaurant.upsert({
            where: { id: r.id },
            update: restaurantData,
            create: restaurantData
        });
    
        // 4. Process Items
        const items = menuData.items || [];
        const categories = menuData.categories || {};
        
        const itemCategoryMap = {};
        Object.values(categories).forEach(cat => {
          if (cat.items && Array.isArray(cat.items)) {
            cat.items.forEach(itemId => {
              itemCategoryMap[itemId] = cat.name;
            });
          }
        });
        
        console.log(`   Seeding ${items.length} menu items...`);
        
        const itemData = items
            .filter(i => i.name)
            .map(item => ({
                restaurantId: restaurant.id,
                cloverId: item.id,
                name: item.name,
                price: item.price || 0,
                description: item.description || "",
                available: item.available !== false,
                hidden: item.hidden === true,
                category: itemCategoryMap[item.id] || "General"
            }));
    
        if (itemData.length > 0) {
            await prisma.menuItem.createMany({ data: itemData, skipDuplicates: true });
        }
        
        console.log(`   ✅ Successfully synced ${itemData.length} items`);
    } catch (err) {
        console.error(`   ❌ Failed to seed ${r.id}: ${err.message}`);
    }
  }
  
  console.log("\n✅ Seed Complete!");
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
