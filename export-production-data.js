import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function exportData() {
  console.log('📦 Exporting production data from restaurant-os-backend...\n');

  try {
    // Export all data
    const data = {
      restaurants: await prisma.restaurant.findMany({
        include: {
          orders: {
            include: {
              items: true,
            },
          },
          calls: true,
          menuItems: {
            include: {
              intelligence: true,
            },
          },
          printers: true,
          reviews: true,
          feedback: true,
        },
      }),
    };

    // Calculate stats
    const stats = {
      restaurants: data.restaurants.length,
      orders: data.restaurants.reduce((sum, r) => sum + r.orders.length, 0),
      orderItems: data.restaurants.reduce((sum, r) => 
        sum + r.orders.reduce((oSum, o) => oSum + o.items.length, 0), 0),
      calls: data.restaurants.reduce((sum, r) => sum + r.calls.length, 0),
      menuItems: data.restaurants.reduce((sum, r) => sum + r.menuItems.length, 0),
      reviews: data.restaurants.reduce((sum, r) => sum + r.reviews.length, 0),
      feedback: data.restaurants.reduce((sum, r) => sum + r.feedback.length, 0),
    };

    // Save to file
    const exportPath = path.join(__dirname, 'production-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));

    console.log('✅ Export complete!\n');
    console.log(`📄 Saved to: ${exportPath}`);
    console.log(`📊 Export Statistics:`);
    console.log(`  - Restaurants: ${stats.restaurants}`);
    console.log(`  - Orders: ${stats.orders}`);
    console.log(`  - Order Items: ${stats.orderItems}`);
    console.log(`  - Calls: ${stats.calls}`);
    console.log(`  - Menu Items: ${stats.menuItems}`);
    console.log(`  - Reviews: ${stats.reviews}`);
    console.log(`  - Feedback: ${stats.feedback}`);
    console.log(`\n💾 File size: ${(fs.statSync(exportPath).size / 1024 / 1024).toFixed(2)} MB`);

    return exportPath;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportData()
  .then((path) => {
    console.log(`\n✨ Next steps:`);
    console.log(`1. Review the exported data: cat ${path} | head -100`);
    console.log(`2. Import to account-svc: cd ../bestorant-account-svc && node import-data.js ${path}`);
    console.log(`3. Import to voice-svc: cd ../bestorant-voice-svc && node import-voice-data.js ${path}`);
  })
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
