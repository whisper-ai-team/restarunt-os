
import { DIETARY_MAP } from "../config/agentConfig.js";

/**
 * Checks if an item is safe for a given allergy/restriction.
 * @param {string} itemName - The name of the menu item
 * @param {string} allergy - The allergy or restriction (e.g. "nuts", "shellfish")
 * @returns {Object} { safe: boolean, reason: string | null }
 */
export function checkDietarySafety(itemName, allergy) {
    if (!itemName || !allergy) return { safe: true, reason: null };

    const query = itemName.toLowerCase();
    const restriction = allergy.toLowerCase();

    // Match restriction to DIETARY_MAP keys
    let mapKey = null;
    if (restriction.includes("nut")) mapKey = "nuts";
    else if (restriction.includes("dairy") || restriction.includes("milk") || restriction.includes("lactose")) mapKey = "dairy";
    else if (restriction.includes("gluten") || restriction.includes("wheat")) mapKey = "gluten";
    else if (restriction.includes("shell") || restriction.includes("shrimp") || restriction.includes("prawn")) mapKey = "shellfish";
    else if (restriction.includes("vegan") || restriction.includes("vegetarian")) mapKey = "vegan_unfriendly";

    if (mapKey && DIETARY_MAP[mapKey]) {
        const highRiskItems = DIETARY_MAP[mapKey];
        const matchingIngredient = highRiskItems.find(risk => query.includes(risk));
        
        if (matchingIngredient) {
            return {
                safe: false, 
                reason: `Item "${itemName}" contains "${matchingIngredient}", which is a risk for ${allergy} allergies.`
            };
        }
    }

    return { safe: true, reason: null };
}

/**
 * Validates an item against a list of active allergies.
 * @param {string} itemName 
 * @param {Array<string>} activeAllergies 
 * @returns {Object} { safe: boolean, details: string }
 */
export function validateOrder(itemName, activeAllergies) {
    if (!activeAllergies || activeAllergies.length === 0) return { safe: true };

    for (const allergy of activeAllergies) {
        const check = checkDietarySafety(itemName, allergy);
        if (!check.safe) {
            return { safe: false, reason: check.reason };
        }
    }
    return { safe: true };
}
