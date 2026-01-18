
import { MenuMatcher } from "../utils/menuMatcher.js";

const menuItems = [
    { name: "Malai Kofta", phoneticName: "Muh-lie Kof-tuh" },
    { name: "Masala Soda" }, // The false contender
    { name: "Masala Tea" }
];

const INPUT = "Malay Costa";

console.log("🔍 SCORING DEBUGGER");
console.log(`Input: "${INPUT}"`);
console.log("-".repeat(40));

const results = MenuMatcher.findMatch(INPUT, menuItems);

console.log("\n--- DETAILED CANDIDATE TRACE ---");
// We need to inspect the 'candidates' property which my modified MenuMatcher returns
if (results.candidates) {
    results.candidates.forEach(c => {
        console.log(`Item: "${c.item.name}"`);
        console.log(`   Final Score: ${c.score.toFixed(4)}`);
        console.log(`   Detailed Breakout:`, c.debug);
        console.log("-");
    });
}

console.log("\n--- FINAL VERDICT ---");
if (results.match) console.log(`✅ MATCH: ${results.match.name}`);
else if (results.ambiguous) console.log(`⚖️ AMBIGUOUS: ${results.ambiguous[0].name} vs ${results.ambiguous[1].name}`);
else console.log(`❌ NO MATCH`);
