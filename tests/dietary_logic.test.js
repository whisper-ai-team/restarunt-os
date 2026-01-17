
import { valid } from "semver";
import { checkDietarySafety, validateOrder } from "../utils/dietaryHelpers.js";

// Mock the config if DIETARY_MAP isn't loaded (depends on test env), 
// but using real one is better if we can import.
// Assuming helper imports real config successfully.

describe("Dietary Safety Logic", () => {
    
    test("should identify nut risks", () => {
        const result = checkDietarySafety("Chicken Korma with Cashews", "Nut Allergy");
        expect(result.safe).toBe(false);
        expect(result.reason).toContain("contains \"korma\""); // or cashew
    });

    test("should allow safe items", () => {
        const result = checkDietarySafety("Plain Rice", "Nut Allergy");
        expect(result.safe).toBe(true);
    });

    test("should handle shellfish", () => {
        const result = checkDietarySafety("Jumbo Prawn Curry", "Shellfish");
        expect(result.safe).toBe(false);
        expect(result.reason).toContain("prawn");
    });
});

describe("Order Validation (Blocker Logic)", () => {
    test("should block order if any active allergy matches", () => {
        const activeAllergies = ["Gluten", "Nuts"];
        
        // Safe item
        const safe = validateOrder("Plain Rice", activeAllergies);
        expect(safe.safe).toBe(true);

        // Unsafe (Nuts)
        const unsafe1 = validateOrder("Cashew Curry", activeAllergies);
        expect(unsafe1.safe).toBe(false);
        expect(unsafe1.reason).toContain("Cashew Curry");

        // Unsafe (Gluten)
        const unsafe2 = validateOrder("Butter Naan", activeAllergies);
        expect(unsafe2.safe).toBe(false);
        expect(unsafe2.reason).toContain("contains \"naan\"");
    });

    test("should pass if no allergies active", () => {
        const safe = validateOrder("Cashew Curry", []);
        expect(safe.safe).toBe(true);
    });
});
