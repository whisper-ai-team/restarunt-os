// scripts/test-menu-matcher.js
import { MenuMatcher } from "../utils/menuMatcher.js";

const mockItems = [
    { name: "Chicken Dum Biryani", price: 1500, description: "Classic" },
    { name: "Chicken Dum Biryani (Regular)", price: 1800, description: "Regular size" },
    { name: "Butter Chicken", price: 1600 },
    { name: "Butter Chicken Cashew", price: 1700 }
];

function test(query) {
    console.log(`\n🔎 Testing: "${query}"`);
    const result = MenuMatcher.findMatch(query, mockItems);
    
    if (result.match) {
        console.log(`✅ Match: "${result.match.name}"`);
    } else if (result.ambiguous) {
        console.log(`⚠️ Ambiguous: "${result.ambiguous[0].name}" vs "${result.ambiguous[1].name}"`);
    } else {
        console.log(`❌ No Match`);
    }
}

// 1. The loop scenario
test("Chicken Dum Biryani");

// 2. The other loop scenario (Butter Chicken)
test("Butter Chicken");

// 3. Explicit disambiguation
test("Butter Chicken Cashew");

// 4. Loose match
test("Chicken Biryani");
