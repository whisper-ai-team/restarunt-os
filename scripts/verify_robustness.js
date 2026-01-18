
import { MenuMatcher } from "../utils/menuMatcher.js";

// Mock Menu
const menuItems = [
    { name: "Malai Kofta", phoneticName: "Muh-lie Kof-tuh" },
    { name: "Butter Chicken" },
    { name: "Fish Curry" }
];

console.log("🔍 ROBUSTNESS VERIFICATION...");

// Case 1: Green Light (Strong Match)
// "Malay Costa" -> 0.56 -> Match
const strongInput = "Malay Costa";
const strongResult = MenuMatcher.findMatch(strongInput, menuItems);
console.log(`\n🟢 Input: "${strongInput}"`);
if (strongResult.match) console.log(`   ✅ Matched: "${strongResult.match.name}" (Score: ${strongResult.match.score?.toFixed(2)})`);
else console.log(`   ❌ Failed (Unexpected)`);

// Case 2: Yellow Light (Suggestion)
// "Mulai" -> Should be suggestive of "Malai Kofta" but maybe not weak enough?
// Let's try something that scores ~0.4. "Kofta" alone?
const mediumInput = "Kofta"; 
const mediumResult = MenuMatcher.findMatch(mediumInput, menuItems);

console.log(`\n🟡 Input: "${mediumInput}"`);
if (mediumResult.match) {
    console.log(`   ⚠️ Direct Match (Score: ${mediumResult.match.score?.toFixed(2)}) - Maybe too strong?`);
} else if (mediumResult.suggestions && mediumResult.suggestions.length > 0) {
    console.log(`   ✅ Suggestions Found: ${mediumResult.suggestions.map(s => s.name).join(", ")}`);
} else {
    console.log(`   ❌ No Suggestions (Failed)`);
}

// Case 3: Red Light (No Match)
const weakInput = "Burger";
const weakResult = MenuMatcher.findMatch(weakInput, menuItems);
console.log(`\n🔴 Input: "${weakInput}"`);
if (!weakResult.match && (!weakResult.suggestions || weakResult.suggestions.length === 0)) {
    console.log(`   ✅ Correctly Rejected.`);
} else {
    console.log(`   ❌ Unexpected Match/Suggestion.`);
}
