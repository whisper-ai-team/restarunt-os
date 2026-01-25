import "dotenv/config";

const baseUrl = process.env.TEST_EMAIL_BASE_URL || "http://localhost:3001";
const restaurantId = process.env.TEST_EMAIL_RESTAURANT_ID || "test";
const email = process.env.TEST_EMAIL_TO || "iventraus@gmail.com";
const subject = process.env.TEST_EMAIL_SUBJECT || "Test Email";
const message = process.env.TEST_EMAIL_MESSAGE || "SendGrid test from local";
const templateId = process.env.TEST_EMAIL_TEMPLATE_ID || "";
const templateDataRaw = process.env.TEST_EMAIL_TEMPLATE_DATA || "";

const url = `${baseUrl}/api/restaurants/${restaurantId}/test-email`;

async function run() {
  const body = { email };
  if (templateDataRaw) {
    let parsed;
    try {
      parsed = JSON.parse(templateDataRaw);
    } catch (e) {
      console.error("Invalid TEST_EMAIL_TEMPLATE_DATA JSON");
      process.exit(1);
    }
    body.templateData = parsed;
    if (templateId) body.templateId = templateId;
  } else {
    body.subject = subject;
    body.message = message;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(text);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
