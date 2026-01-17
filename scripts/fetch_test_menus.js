import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../restaurant_test_data.json');
const FIXTURES_DIR = path.join(__dirname, '../tests/fixtures');

// Ensure fixtures dir exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

async function fetchAndSaveMenus() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  console.log(`🚀 Starting ingestion of ${data.restaurants.length} menus...`);

  for (const restaurant of data.restaurants) {
    try {
      console.log(`\n📥 Fetching [${restaurant.cuisine}] ${restaurant.name}...`);
      console.log(`   URL: ${restaurant.api_url}`);
      
      const response = await fetch(restaurant.api_url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const menuData = await response.json();
      
      // Save raw snapshot
      const filename = `${restaurant.id}.json`;
      const filePath = path.join(FIXTURES_DIR, filename);
      
      fs.writeFileSync(filePath, JSON.stringify(menuData, null, 2));
      console.log(`   ✅ Saved to tests/fixtures/${filename} (${(fs.statSync(filePath).size / 1024).toFixed(2)} KB)`);
      
      // Analyze structure briefly
      const categories = menuData.categories || [];
      const items = menuData.items || []; // Some endpoints return items flat, others nested
      console.log(`   📊 Stats: ${categories.length} categories found.`);
      
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }
}

fetchAndSaveMenus();
