
// tests/simulate_sip_hangup.js
import { createRestaurantTools } from '../agent/tools.js';

// Mock Dependencies
const mockConfig = {
    id: 123,
    name: "Mock Restaurant",
    clover: { apiKey: "test", merchantId: "test" }
};
const mockRoom = {
    disconnect: () => console.log("[MOCK] Local Disconnect Triggered (Fallback path)")
};
const mockCustomer = { name: "Test User", phone: "555-1234" };

// Mock SIP Close Callback
const mockCloseRoom = async () => {
    console.log("⚡️ [MOCK] API Delete Room Callback Triggered! (SIP Hard Hangup)");
    return true;
};

// Test
(async () => {
    console.log("--- Testing SIP Hangup Flow ---");
    
    // 1. Create Tools
    const tools = createRestaurantTools({
        restaurantConfig: mockConfig,
        activeRoom: mockRoom,
        customerDetails: mockCustomer,
        sessionCart: [],
        callRecord: {},
        finalizeCallback: () => console.log("[MOCK] Finalize OK"),
        closeRoomCallback: mockCloseRoom, 
        cuisineProfile: { name: "Generic" },
        activeAllergies: new Set(),
        menuLoadSuccess: true
    });

    // 2. Execute Hangup
    console.log("Invoking hangUp tool...");
    const result = await tools.hangUp.execute({});
    console.log(`Result: ${result}`);

    // 3. Wait for async timeout (1.5s in code)
    console.log("Waiting for timeout...");
    setTimeout(() => {
        console.log("--- Test Complete ---");
    }, 2000);
})();
