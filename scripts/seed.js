// seed.js - Seed development data and encrypt API keys

import { PrismaClient } from '@prisma/client';
import { encrypt } from './encryption.js';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Update Bharat Bistro with encrypted API key
  const encryptedApiKey = encrypt(process.env.CLOVER_API_KEY);
  
  const restaurant = await prisma.restaurant.update({
    where: { id: 'bharat-bistro-001' },
    data: {
      cloverApiKey: encryptedApiKey
    }
  });

  console.log(`✅ Updated ${restaurant.name} with encrypted Clover API key`);
  console.log(`   Phone: ${restaurant.phoneNumber}`);
  console.log(`   Merchant ID: ${restaurant.cloverMerchantId}`);
  console.log(`   Location: ${restaurant.city}, ${restaurant.state}`);

  // Verify encryption works
  const { decrypt } = await import('./encryption.js');
  const decrypted = decrypt(restaurant.cloverApiKey);
  console.log(`🔐 Encryption test: ${decrypted === process.env.CLOVER_API_KEY ? 'PASS' : 'FAIL'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
