import { OpenAI } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MENU_INTELLIGENCE_MODEL = process.env.AI_MENU_INTELLIGENCE_MODEL || "gpt-4o";

// Schema for Chef Intelligence
const MenuItemAnalysisSchema = z.object({
  dietary_tags: z.array(z.string()).describe("List of allergens and dietary features: nuts, dairy, gluten, shellfish, vegan, vegetarian, pork, beef"),
  ingredients_implied: z.array(z.string()).describe("List of key ingredients implied by the name/cuisine (e.g. 'cashew paste' for Korma)"),
  phonetic_correction: z.string().describe("The item name in lowercase, cleaned for STT matching (e.g. 'butter chicken')"),
  stt_keywords: z.array(z.string()).describe("List of 2-3 alternate phonetic spellings or synonyms for Speech-to-Text boosting")
});

const BatchAnalysisSchema = z.object({
  items: z.array(z.object({
    originalName: z.string(),
    analysis: MenuItemAnalysisSchema
  }))
});

export const MenuIntelligenceService = {
  /**
   * Enriches a list of menu items with AI intelligence
   * @param {string} restaurantId 
   * @param {Array<{name: string, price: number, id: string, description?: string, category?: string}>} cloverItems 
   */
  async enrichMenu(restaurantId, cloverItems) {
    if (!cloverItems || cloverItems.length === 0) return;

    // 1. Filter items that need processing (simple diff or just process all for now)
    // For "best ever" robustness, we process all to ensure latest intelligence
    const itemsToProcess = cloverItems.map(i => ({ 
      name: i.name, 
      description: i.description,
      id: i.id // Clover ID
    }));

    console.log(`🧠 [MenuSentinel] analyzing ${itemsToProcess.length} items...`);

    // 2. Process in batches of 20 to avoid token limits
    const batchSize = 20;
    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);
      await this.processBatch(restaurantId, batch);
    }
    
    console.log(`🧠 [MenuSentinel] Enrichment Complete.`);
  },

  async processBatch(restaurantId, batch) {
    try {
      const prompt = `
      You are the "Menu Intelligence Sentinel". Analyze these menu items for a restaurant.
      CONTEXT: These items might be Indian, Mexican, Chinese, etc. Use your knowledge of global cuisine.
      
      TASK:
      For each item, identify:
      1. Hidden Allergens (nuts in Korma/Pasanda/Pesto, gluten in Tempura/Naan, shellfish in Laksa).
      2. Implied Ingredients.
      3. STT Keywords (how a user might say it, or common mishearings).
      
      ITEMS:
      ${JSON.stringify(batch.map(b => `${b.name} (${b.description || ''})`))}
      `;

      const completion = await openai.chat.completions.create({
        model: MENU_INTELLIGENCE_MODEL,
        messages: [
            { role: "system", content: "You represent strict food safety data. Output Valid JSON only." }, 
            { role: "user", content: prompt + "\n\nOUTPUT FORMAT: Return a JSON object with a single key 'items'. Each item MUST have: 'originalName' (exact match), 'analysis' object with keys: 'dietary_tags' (array of strings), 'ingredients_implied' (array of strings), 'phonetic_correction' (STRING, single value), 'stt_keywords' (array of strings)." }
        ],
        response_format: { type: "json_object" },
      });

      const resContent = completion.choices[0].message.content;
      if (!resContent) throw new Error("Empty OpenAI response");

      let results;
      try {
        results = JSON.parse(resContent);
      } catch (e) {
        throw new Error("Failed to parse OpenAI JSON: " + resContent);
      }

      // Upsert into DB
      const items = results.items || [];
      for (const result of items) {
        // Validation Guard
        if (!result.originalName) {
            console.warn(`⚠️ [MenuSentinel] Skipping item with missing originalName`);
            continue;
        }

        // Safe Type Casting (Fix Prisma Error)
        const analysis = result.analysis || {};
        const safePhonetic = Array.isArray(analysis.phonetic_correction) 
            ? analysis.phonetic_correction[0] 
            : (analysis.phonetic_correction || "");

        // Find matching original item from batch
        const originalItem = batch.find(b => 
            b.name === result.originalName || 
            (result.originalName && result.originalName.includes(b.name)) ||
            (b.name && b.name.includes(result.originalName))
        );
        
        if (originalItem) {
          // 1. Ensure MenuItem exists
          const menuItem = await prisma.menuItem.upsert({
            where: {
              restaurantId_cloverId: {
                restaurantId,
                cloverId: originalItem.id
              }
            },
            create: {
              restaurantId,
              cloverId: originalItem.id,
              name: originalItem.name,
              price: 0, 
              description: originalItem.description,
              hidden: false
            },
            update: {
              name: originalItem.name // Sync name update
            }
          });

          // 2. Upsert Intelligence
          await prisma.menuItemIntelligence.upsert({
            where: { menuItemId: menuItem.id },
            create: {
              menuItemId: menuItem.id,
              dietaryTags: analysis.dietary_tags || [],
              ingredients: analysis.ingredients_implied || [],
              phoneticName: safePhonetic,
              sttKeywords: analysis.stt_keywords || []
            },
            update: {
              dietaryTags: analysis.dietary_tags || [],
              ingredients: analysis.ingredients_implied || [],
              phoneticName: safePhonetic,
              sttKeywords: analysis.stt_keywords || [],
              processedAt: new Date()
            }
          });
          
          // console.log(`   ✅ Enriched: ${originalItem.name} -> [${(analysis.dietary_tags || []).join(", ")}]`);
        }
      }

    } catch (err) {
      console.error(`❌ [MenuSentinel] Batch failed:`, err);
    }
  },

  /**
   * Merges DB intelligence into the in-memory Clover items
   */
  async mergeIntelligence(restaurantId, cloverItems) {
    // 1. Fetch all intelligence for this restaurant
    const intelligence = await prisma.menuItem.findMany({
      where: { restaurantId },
      include: { intelligence: true }
    });
    
    // 2. Create a lookup map by Clover ID (or Name if ID missing)
    const map = new Map();
    intelligence.forEach(dbItem => {
      if (dbItem.cloverId) map.set(dbItem.cloverId, dbItem.intelligence);
      map.set(dbItem.name.toLowerCase(), dbItem.intelligence);
    });

    // 3. Attach to clover items
    return cloverItems.map(item => {
      const intel = map.get(item.id) || map.get(item.name.toLowerCase());
      if (intel) {
        return {
          ...item,
          // Attach helpful metadata for the agent
          dietaryTags: intel.dietaryTags,
          ingredients: intel.ingredients,
          sttKeywords: intel.sttKeywords,
          phoneticName: intel.phoneticName
        };
      }
      return item;
    });
  }
};
