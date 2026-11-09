const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
let content = fs.readFileSync(serverPath, 'utf8');

const targetStart = '// -------------------------------------------------------------\n// Universal Food Intelligence Knowledge Base & Gemini Resolver\n// -------------------------------------------------------------';
const targetEnd = 'function callGeminiFoodAiLookup(apiKey, foodQuery) {';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start or end index:", startIndex, endIndex);
  process.exit(1);
}

const replacement = `// -------------------------------------------------------------
// Universal Food Intelligence Knowledge Base & Gemini Resolver
// -------------------------------------------------------------
const { CLINICAL_FOOD_DATABASE, classifyUnknownFoodItem } = require('./scripts/clinical_food_db');
const BUILTIN_FOOD_ENTRIES = CLINICAL_FOOD_DATABASE;

async function resolveFoodAiData(rawQuery, apiKey) {
  const raw = (rawQuery || '').trim();
  const q = raw.toLowerCase().replace(/analyse|analyze|benefits of|benefit of|nutrition of|details of|about/gi, '').trim();
  if (!q) return BUILTIN_FOOD_ENTRIES.cow_ghee;

  // 1. Explicit Direct Key Check
  if (BUILTIN_FOOD_ENTRIES[q]) return BUILTIN_FOOD_ENTRIES[q];

  // 2. High-Priority Keyword Normalization
  if (/refined sugar|white sugar|sugar|chini|cheeni|sakkar|sugar crystals/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.refined_sugar;
  }
  if (/jaggery|gud|gur|desi jaggery|cane jaggery/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.jaggery;
  }
  if (/honey|shahad|madhu/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.honey;
  }
  if (/maida|refined flour|all purpose flour/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.maida;
  }
  if (/cow ghee|desi ghee|ghee|clarified butter/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.cow_ghee;
  }
  if (/soya|soybean|soyabean|bhatma/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.soyabeans;
  }
  if (/wheat|gehu|atta|whole wheat/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.wheat;
  }
  if (/bajra|pearl millet/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.bajra;
  }
  if (/anjeer|fig|figs/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.anjeer;
  }
  if (/palak|spinach/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.palak;
  }
  if (/dhaniya|coriander|cilantro/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.dhaniya;
  }
  if (/potato chips|chips|kurkure|lays|bingo|namkeen/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.potato_chips;
  }
  if (/potato|aloo|alu/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.potato;
  }
  if (/pizza|burger/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.pizza;
  }
  if (/ashwagandha|asgandh/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.ashwagandha;
  }
  if (/makhana|fox nut|lotus seed/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.makhana;
  }

  // 3. Substring search in builtin items
  for (const key of Object.keys(BUILTIN_FOOD_ENTRIES)) {
    const item = BUILTIN_FOOD_ENTRIES[key];
    if (item.nameEn.toLowerCase().includes(q) || item.nameHi.toLowerCase().includes(q) || key.includes(q)) {
      return item;
    }
  }

  // 4. Try Gemini 3.5 Flash if valid API key is present
  if (apiKey && apiKey !== 'YOUR_GEMINI_KEY') {
    try {
      const geminiResult = await callGeminiFoodAiLookup(apiKey, raw);
      if (geminiResult && geminiResult.topBenefitTitle) {
        return geminiResult;
      }
    } catch (err) {
      console.warn("Gemini food lookup fallback to clinical classifier:", err.message);
    }
  }

  // 5. Intelligent Biochemical Classifier for Unlisted Foods (100% Honest Science)
  return classifyUnknownFoodItem(raw);
}

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(serverPath, content, 'utf8');
console.log("Successfully replaced BUILTIN_FOOD_ENTRIES in server.js!");
