// scripts/verify-integration.js
import { processOrder } from "../services/order-service/index.js";
import { PrismaClient } from "@prisma/client";
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
    console.log("🔍 Verifying Order Service Integration...");

    // Mock Data
    const mockOrder = {
        customerName: "Test User",
        customerPhone: "+15550001234",
        customerEmail: "test@example.com", // Valid email
        items: [
            { name: "Butter Chicken", qty: 1, price: 1500 },
            { name: "Naan", qty: 2, price: 300 }
        ],
        totalAmount: 2100,
        restaurantId: "italian-pulcinella", // Ensure this ID exists or use a valid one
        orderType: "pickup"
    };

    // Mock Dependencies
    const mockConfig = {
        name: "Test Restaurant",
        stripeAccountId: null, // Test platform account
        tools: {
            stripe: { enabled: true },
            email: { enabled: true }
        }
    };

    try {
        // 1. Check if restaurant exists (optional, or just use mock ID if DB constraint allows)
        // We'll skip DB constraints for this unit-like test if we mock prisma, but we are using real prisma.
        // Let's get a real restaurant ID first.
        const restaurant = await prisma.restaurant.findFirst();
        if (restaurant) {
            mockOrder.restaurantId = restaurant.id;
            mockConfig.name = restaurant.name;
        }

        console.log(`📦 Processing Order for ${mockConfig.name}...`);
        
        // EXECUTE
        const result = await processOrder(mockOrder, { prisma, restaurantConfig: mockConfig });
        
        console.log("✅ Order Processed Successfully!");
        console.log(`   ID: ${result.id}`);
        console.log(`   Payment URL: ${result.paymentUrl || 'N/A'}`);
        console.log(`   Email Sent: ${mockOrder.customerEmail} (Check SendGrid logs)`);
        
        if (result.paymentUrl) {
            console.log("   ✅ Stripe Integration works.");
        } else {
             console.warn("   ⚠️ No Payment URL generated (Check STRIPE_SECRET_KEY)");
        }

    } catch (err) {
        console.error("❌ Verification Failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
