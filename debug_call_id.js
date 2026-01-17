
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const callId = "cmk1q0o5j00019k1a5hm5ddns"; // User provided ID
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
  console.log("Transcript Count:", Array.isArray(call.transcript) ? call.transcript.length : 0);
  console.log("Transcript Raw:", JSON.stringify(call.transcript, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
