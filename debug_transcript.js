
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const lastCall = await prisma.call.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!lastCall) {
    console.log("No calls found.");
    return;
  }

  console.log("Last Call ID:", lastCall.id);
  console.log("Transcript Type:", typeof lastCall.transcript);
  console.log("Transcript Value:", JSON.stringify(lastCall.transcript, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
