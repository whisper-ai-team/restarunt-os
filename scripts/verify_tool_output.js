
import { MenuMatcher } from "../utils/menuMatcher.js";

// Mock Menu
const menuItems = [
    { name: "Malai Kofta", phoneticName: "Muh-lie Kof-tuh", price: 1800, description: "Vegetarian meatballs in creamy sauce" },
    { name: "Butter Chicken", price: 2000 },
    { name: "Fish Curry", price: 2200 }
];

console.log("🔍 SEARCH TOOL LOGIC SIMULATION...");
console.log("-----------------------------------");

// ---------------------------------------------------------
// MOCK implementation of the searchMenu tool logic (from agent/tools.js)
// ---------------------------------------------------------
function mockSearchMenuTool(query) {
    console.log(`\n🤖 Tool execution for query: "${query}"`);
    
    // 1. Match
    const matchResult = MenuMatcher.findMatch(query, menuItems);

    // 2. Ambiguous
    if (matchResult.ambiguous) {
        const [a, b] = matchResult.ambiguous;
        return `System: Found multiple items. Ask user: "Did you mean ${a.name} or ${b.name}?"`;
    }
  
    // 3. High Confidence Match
    if (matchResult.match) {
        const item = matchResult.match;
        const price = item.price ? `$${(item.price / 100).toFixed(2)}` : "Price varies";
        return `System: Found "${item.name}" (${price}). Description: ${item.description || "No description"}. You can answer the user's question now.`;
    }

    // 4. Medium Confidence (Suggestions) - THE FIX
    if (matchResult.suggestions && matchResult.suggestions.length > 0) {
        const names = matchResult.suggestions.map(s => s.name).join('" or "');
        return `System: No exact match for "${query}", but found similar items: "${names}". Ask the user: "Did you mean ${names}?"`;
    }

    // 5. No Match
    return `System: I searched the menu for "${query}" but found no matching items. Apologize to the user.`;
}

// ---------------------------------------------------------
// TEST CASES
// ---------------------------------------------------------

// 1. Strong Match (Green)
const out1 = mockSearchMenuTool("Malay Costa");
console.log(`👉 LLM SEES: ${out1}`);

// 2. Weak Match / Suggestion (Yellow)
// Testing a deliberately "bad" input to trigger suggestion if possible
// "Mala" might be too short, check "Kofta"
const out2 = mockSearchMenuTool("Kofta"); 
console.log(`👉 LLM SEES: ${out2}`);

// 3. No Match (Red)
const out3 = mockSearchMenuTool("Burger");
console.log(`👉 LLM SEES: ${out3}`);
