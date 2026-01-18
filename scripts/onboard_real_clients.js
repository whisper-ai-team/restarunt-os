import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Real Data Onboarding...");

  // 1. Pulcinella Pizza & Pasta
  // ID: NVA2D9TDW89Y1
  // API: 00d85386-5a64-c2e8-9978-db68765f1c4b
  console.log("🍕 Upserting Pulcinella Pizza & Pasta...");
  const pulcinella = await prisma.restaurant.upsert({
    where: { slug: "pulcinella-pizza" },
    update: {
      name: "Pulcinella Pizza & Pasta",
      cloverMerchantId: "NVA2D9TDW89Y1",
      cloverApiKey: "00d85386-5a64-c2e8-9978-db68765f1c4b",
      cloverEnvironment: "sandbox", 
    },
    create: {
      name: "Pulcinella Pizza & Pasta",
      slug: "pulcinella-pizza",
      phoneNumber: "+18639009879", // User provided for testing
      cloverMerchantId: "NVA2D9TDW89Y1",
      cloverApiKey: "00d85386-5a64-c2e8-9978-db68765f1c4b",
      cloverEnvironment: "sandbox",
      address: "Unknown Address",
      city: "Unknown City",
      state: "NJ",
      zipCode: "00000",
      cuisineType: "Italian",
      voiceSelection: "alloy"
    }
  });
  console.log(`✅ Pulcinella ID: ${pulcinella.id}`);

  // 2. Domions Pizza
  // ID: F3JYNA54NKEF1
  // API: 7f88802b-8917-7770-0920-0d3c7d61305b
  console.log("🍕 Upserting Domions Pizza...");
  const domions = await prisma.restaurant.upsert({
    where: { slug: "domions-pizza" },
    update: {
      name: "Domions Pizza",
      phoneNumber: "+18639009879", // User provided for testing
      cloverMerchantId: "F3JYNA54NKEF1",
      cloverApiKey: "7f88802b-8917-7770-0920-0d3c7d61305b",
      cloverEnvironment: "sandbox",
    },
    create: {
      name: "Domions Pizza",
      slug: "domions-pizza",
      phoneNumber: "+18639009879", // User provided for testing
      cloverMerchantId: "F3JYNA54NKEF1",
      cloverApiKey: "7f88802b-8917-7770-0920-0d3c7d61305b",
      cloverEnvironment: "sandbox",
      address: "Unknown Address",
      city: "Unknown City",
      state: "NJ",
      zipCode: "00000",
      cuisineType: "Pizza",
      voiceSelection: "echo"
    }
  });
  console.log(`✅ Domions ID: ${domions.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
