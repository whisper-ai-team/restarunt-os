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
    
    // 2. Clear Old Data (To ensure ID = Slug)
    console.log(`   Resetting Restaurant ${r.id}...`);
    try {
        const preFetch = await prisma.restaurant.findUnique({ where: { slug: r.id }});
        if (preFetch) {
            await prisma.menuItem.deleteMany({ where: { restaurantId: preFetch.id } });
            await prisma.restaurant.delete({ where: { id: preFetch.id } });
        }
    } catch (e) { console.log("   (Cleanup warning: " + e.message + ")"); }

    // 3. Create Fresh
    let fakePhone = `+155500099${index.toString().padStart(2, '0')}`;
    if (r.id === 'italian-pulcinella') fakePhone = '+12182315338';
    if (r.id === 'pizza-repo-001') fakePhone = '+15014642149';
    
    console.log(`   Creating Restaurant (ID: ${r.id})...`);
    
    const restaurant = await prisma.restaurant.create({
      data: {
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
        isActive: true,
        autoPrint: false
      }
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
  }
  
  console.log("\n✅ Seed Complete!");
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
