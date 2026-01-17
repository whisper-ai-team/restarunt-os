import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("📱 Updating Phone Numbers...");

  // 1. Pulcinella Pizza
  const p = await prisma.restaurant.update({
    where: { slug: "pulcinella-pizza" },
    data: { phoneNumber: "+15014642149" }
  });
  console.log(`✅ Pulcinella: ${p.phoneNumber}`);

  // 2. Domions Pizza
  const d = await prisma.restaurant.update({
    where: { slug: "domions-pizza" },
    data: { phoneNumber: "+12182315338" }
  });
  console.log(`✅ Domions: ${d.phoneNumber}`);

  // 3. Indian Repo 002 (Handle Typo Fix)
  // Check if "idian-repo-002" exists and rename it, OR just update if "indian-repo-002" exists
  const typoRecord = await prisma.restaurant.findUnique({ where: { slug: "idian-repo-002" } });
  
  if (typoRecord) {
      console.log("🔧 Fixing slug typo: idian-repo-002 -> indian-repo-002");
      const i = await prisma.restaurant.update({
        where: { slug: "idian-repo-002" },
        data: { 
            slug: "indian-repo-002",
            phoneNumber: "+17867338796"
        }
      });
      console.log(`✅ Indian Repo: ${i.slug} / ${i.phoneNumber}`);
  } else {
      // Maybe it's already correct?
       const correctRecord = await prisma.restaurant.findUnique({ where: { slug: "indian-repo-002" } });
       if (correctRecord) {
           const i = await prisma.restaurant.update({
             where: { slug: "indian-repo-002" },
             data: { phoneNumber: "+17867338796" }
           });
           console.log(`✅ Indian Repo (Already named correctly): ${i.phoneNumber}`);
       } else {
           console.warn("⚠️ Could not find 'idian-repo-002' or 'indian-repo-002'");
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
