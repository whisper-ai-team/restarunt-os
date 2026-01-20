
import { MenuMatcher } from "./menuMatcher.js";

describe("Menu Intelligence & Modifier Verification", () => {
  const mockMenu = [
    {
      name: "Butter Chicken",
      description: "Classic creamy curry",
      price: 1500,
      modifierGroups: [
        {
          name: "Spice Level",
          modifiers: [
            { name: "Mild", price: 0 },
            { name: "Medium", price: 0 },
            { name: "Spicy", price: 0 }
          ]
        }
      ]
    },
    {
      name: "Naan",
      description: "Oven baked bread",
      price: 300,
      modifierGroups: [] // No modifiers
    }
  ];

  test("should find Butter Chicken and include modifierGroups", () => {
    const result = MenuMatcher.findMatch("Butter Chicken", mockMenu);
    
    expect(result.match).toBeDefined();
    expect(result.match.name).toBe("Butter Chicken");
    expect(result.match.modifierGroups).toBeDefined();
    expect(result.match.modifierGroups.length).toBe(1);
    expect(result.match.modifierGroups[0].name).toBe("Spice Level");
  });

  test("should find suggestions for misspelled items", () => {
    const result = MenuMatcher.findSuggestions("Butter Chikan", mockMenu);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe("Butter Chicken");
  });
});
