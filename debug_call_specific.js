
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const callId = "cmk1rj5d500019kbhguwf0xq6";
  const call = await prisma.call.findUnique({
    where: { id: callId }
  });

  if (!call) {
    console.log("Call not found.");
    return;
  }

  console.log("Call ID:", call.id);
  console.log("Status:", call.status);
  console.log("Duration:", call.duration);
  console.log("Transcript:", JSON.stringify(call.transcript, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
