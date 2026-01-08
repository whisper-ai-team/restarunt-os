
import { generateSTTKeywords } from "../utils/sttHelpers.js";

// Mock config if needed, or rely on actual
// We need to mock COMMON_WORD_BLACKLIST if we can't import it easily without side effects
// But assuming relative import works if we use --experimental-vm-modules or similar in Jest
// For now, let's mock the params passed in.

describe("STT Keyword Generation (Zero-Breakage)", () => {
    const mockMenuItems = [
        { name: "Butter Chicken" },
        { name: "Naan" }, // Short word, might be skipped
        { name: "Gulab Jamun" },
        { name: "Rice" }, // Short, common
        { name: "Chicken Tikka Masala" }
    ];

    const mockCuisineProfile = {
        phoneticCorrections: {
            "biryani": "biryani"
        }
    };

    // We need to make sure the helper imports the config correctly.
    // If unit testing ESM is tricky, we might need to adjust jest config.
    // Assuming standard ESM support or transform.

    test("should boost multi-word menu items", () => {
        const keywords = generateSTTKeywords(mockMenuItems, mockCuisineProfile);
        expect(keywords).toContain("butter chicken");
        expect(keywords).toContain("gulab jamun");
        expect(keywords).toContain("chicken tikka masala");
    });

    test("should skip short single words like 'Rice'", () => {
        const keywords = generateSTTKeywords(mockMenuItems, mockCuisineProfile);
        expect(keywords).not.toContain("rice");
        expect(keywords).not.toContain("naan"); // < 5 chars
    });

    test("should include phonetic aliases", () => {
        const keywords = generateSTTKeywords(mockMenuItems, mockCuisineProfile);
        expect(keywords).toContain("biryani");
    });

    test("should flatten complex names correctly", () => {
         const keywords = generateSTTKeywords([{name: "Paneer Tikka (Spicy)"}], mockCuisineProfile);
         expect(keywords).toContain("paneer"); // >= 5 chars
         expect(keywords).toContain("paneer tikka (spicy)"); // full phrase?
         // Actually implementation cleans special chars for individual words:
         // "Paneer" -> "paneer" (ok), "Tikka" -> "tikka" (5 chars), "Spicy" -> "spicy" (5 chars)
         expect(keywords.some(k => k.includes("tikka"))).toBe(true);
    });
});
