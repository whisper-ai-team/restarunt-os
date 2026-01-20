
// tests/simulate_hangup.js
import { describe, it } from 'node:test'; // Using built-in test runner for simplicity or just run directly
import assert from 'node:assert';

// Mock objects
const mockFinalizeCallback = async (reason) => {
    console.log(`[MOCK] Finalize Callback triggered. Reason: ${reason}`);
    return true;
};

const mockRoom = {
    disconnect: () => {
        console.log("[MOCK] Room Disconnected Successfully.");
    }
};

// Mock Hangup Tool Logic
async function executeHangUp() {
    console.log("🔌 'hangUp' tool triggered.");
    
    if (mockFinalizeCallback) {
        try {
            await mockFinalizeCallback("Agent Triggered Hangup");
        } catch (err) {
            console.error("Callback failed", err);
        }
    }

    if (mockRoom) {
        setTimeout(() => {
            console.log("🔌 Disconnecting room now (simulated 2s delay).");
            mockRoom.disconnect();
        }, 100); // Shortened for test speed
    }
    return "System: Hanging up call.";
}

// Run Simulation
(async () => {
    console.log("--- Starting Hangup Simulation ---");
    const result = await executeHangUp();
    console.log(`Tool Result: ${result}`);
    console.log("--- Simulation Complete ---");
})();
