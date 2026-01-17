import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkCalls() {
  const calls = await prisma.call.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(JSON.stringify(calls, null, 2));
  await prisma.$disconnect();
}

checkCalls();
