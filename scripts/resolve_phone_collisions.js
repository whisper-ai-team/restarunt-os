import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🕵️ Checking for Phone Number Collisions...");
  
  const targetNumbers = [
    { slug: "pulcinella-pizza", phone: "+15014642149" },
    { slug: "domions-pizza", phone: "+12182315338" },
    { slug: "indian-repo-002", phone: "+17867338796" } 
  ];

  for (const t of targetNumbers) {
      const existing = await prisma.restaurant.findUnique({
          where: { phoneNumber: t.phone }
      });

      if (existing) {
          console.log(`⚠️ Collision: ${t.phone} is held by ${existing.slug} (ID: ${existing.id})`);
          
          if (existing.slug !== t.slug) {
              console.log(`   🔸 Releasing number from ${existing.slug}...`);
              await prisma.restaurant.update({
                  where: { id: existing.id },
                  data: { phoneNumber: `${t.phone}-archived-${Date.now()}` }
              });
              console.log(`   ✅ Released.`);
          } else {
              console.log(`   ✅ Already assigned to correct slug.`);
          }
      }
  }

  // Now run updates
  console.log("\n🔄 Retrying Updates...");
  
   // 1. Pulcinella Pizza
  await prisma.restaurant.update({
    where: { slug: "pulcinella-pizza" },
    data: { phoneNumber: "+15014642149" }
  });
  console.log(`✅ Pulcinella Updated.`);

  // 2. Domions Pizza
  await prisma.restaurant.update({
    where: { slug: "domions-pizza" },
    data: { phoneNumber: "+12182315338" }
  });
  console.log(`✅ Domions Updated.`);

  // 3. Indian Repo 002 (Slug Swap + Update)
  const typoRecord = await prisma.restaurant.findUnique({ where: { slug: "idian-repo-002" } });
  if (typoRecord) {
      console.log("🔧 Fixing slug: idian-repo-002 -> indian-repo-002");
      await prisma.restaurant.update({
        where: { slug: "idian-repo-002" },
        data: { 
            slug: "indian-repo-002",
            phoneNumber: "+17867338796"
        }
      });
      console.log(`✅ Indian Repo Fixed & Updated.`);
  } else {
      // Check if it already exists correctly
       const correct = await prisma.restaurant.findUnique({ where: { slug: "indian-repo-002" } });
       if (correct) {
            await prisma.restaurant.update({
                where: { slug: "indian-repo-002" },
                data: { phoneNumber: "+17867338796" }
            });
            console.log(`✅ Indian Repo Updated.`);
       }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
