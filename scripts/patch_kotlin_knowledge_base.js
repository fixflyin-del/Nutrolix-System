const fs = require('fs');
const path = require('path');

// 1. UPDATE FoodAiKnowledgeBase.kt
const ktPath = path.join(__dirname, '../app/src/main/java/com/example/data/FoodAiKnowledgeBase.kt');
let ktContent = fs.readFileSync(ktPath, 'utf8');

// Replace model name from gemini-3.5-flash to gemini-2.5-flash
ktContent = ktContent.replace(/gemini-3\.5-flash/g, 'gemini-2.5-flash');

// Add Refined Sugar, Jaggery, Honey, Maida to BUILTIN_FOODS
const newBuiltins = `    // 0. REFINED WHITE SUGAR
    FoodAiDetail(
      id = "refined_sugar",
      nameEn = "Refined White Sugar (Chini / Sucrose)",
      nameHi = "सफेद रिफाइंड चीनी (Refined Sugar)",
      category = "Refined Simple Carbohydrate & Sweetener",
      verdictTag = "⚠️ 0/100 Nutrition • High GI Empty Calories",
      topBenefitTitle = "Sabse Bada Fayda: Apatkaal Me Instant Glucose (Hypoglycemia Emergency Only)",
      topBenefitDesc = "Refined sugar has virtually ZERO vitamins, minerals, protein or dietary fiber. Its only clinical utility is rapidly raising blood glucose in severe acute hypoglycemia (sudden sugar crash/blackout) or extreme endurance fuel. In all other scenarios, it is an inflammatory empty calorie food.",
      otherBenefits = listOf(
        "Immediate carbohydrate absorption directly into the bloodstream without digestive delay.",
        "Useful in emergency ORS (Oral Rehydration Solution) along with salt in acute diarrhea/dehydration.",
        "Culinary texture, sweetness, and shelf-life preservation in bakery formulations."
      ),
      nutrients = FoodNutrientProfile(
        calories = 387.0,
        protein = 0.0,
        carbs = 100.0,
        fats = 0.0,
        fiber = 0.0,
        sugar = 100.0,
        calciumMg = 1.0,
        ironMg = 0.05,
        magnesiumMg = 0.0,
        potassiumMg = 2.0,
        zincMg = 0.0,
        vitaminA = "0 IU (Nil)",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Nil"
      ),
      whoShouldEat = listOf(
        "Patients experiencing severe sudden hypoglycemia (blood sugar < 60 mg/dL).",
        "Marathon runners or long-distance cyclists during mid-race glycogen depletion.",
        "Individuals recovering from acute clinical dehydration as part of medical ORS."
      ),
      whenToAvoid = listOf(
        "Diabetic & Pre-diabetic individuals (causes dangerous sudden hyperglycemia).",
        "Individuals with Non-Alcoholic Fatty Liver Disease (fructose accelerates de-novo lipogenesis).",
        "Children & Adults with dental caries, hyperactivity or obesity.",
        "Strictly avoid before bedtime as it disrupts growth hormone secretion and restorative sleep."
      ),
      avoidWith = listOf(
        "High Saturated Fats (Deep-fried sweets): Accelerates visceral fat deposition and metabolic syndrome.",
        "Carbonated Cola / Sodas: Massive liquid sugar bolus severely stresses pancreas and beta cells.",
        "High Sodium Processed Foods: Increases vascular arterial tension and spikes blood pressure."
      )
    ),

    // 0B. DESI JAGGERY
    FoodAiDetail(
      id = "jaggery",
      nameEn = "Desi Jaggery (Gud / Gur)",
      nameHi = "देसी गुड़ (Desi Jaggery)",
      category = "Unrefined Natural Cane Sugar",
      verdictTag = "⭐⭐⭐ Mineral-Rich Natural Sweetener",
      topBenefitTitle = "Sabse Bada Fayda: Respiratory Cleansing & Non-Heme Iron Replenishment",
      topBenefitDesc = "Unlike refined sugar, authentic unrefined jaggery contains bioavailable non-heme iron (11mg/100g), magnesium, and potassium. In traditional Ayurvedic medicine, it acts as a pulmonary expellant that cleanses particulate matter from the respiratory tract.",
      otherBenefits = listOf(
        "Stimulates digestive enzymes (Agni) when consumed in a small coin-sized piece post lunch.",
        "High potassium and magnesium content helps relieve muscle cramps.",
        "Assists hemoglobin synthesis in mild iron-deficiency anemia.",
        "Contains phenolic antioxidants derived from raw sugar cane molasses."
      ),
      nutrients = FoodNutrientProfile(
        calories = 383.0,
        protein = 0.4,
        carbs = 98.0,
        fats = 0.1,
        fiber = 0.0,
        sugar = 85.0,
        calciumMg = 80.0,
        ironMg = 11.0,
        magnesiumMg = 160.0,
        potassiumMg = 1050.0,
        zincMg = 0.2,
        vitaminA = "Trace",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Trace B1, B2"
      ),
      whoShouldEat = listOf(
        "Individuals with low hemoglobin or mild nutritional anemia.",
        "People exposed to heavy air pollution or seasonal cold/cough.",
        "Those looking to substitute chemically bleached white sugar with unrefined sweetening."
      ),
      whenToAvoid = listOf(
        "Diabetic patients (Jaggery is ~85% sucrose and raises blood sugar almost as fast as sugar).",
        "Individuals suffering from active intestinal warm infestations or chronic inflammation.",
        "Excessive summer intake (has a warm thermal potency / Ushna Virya)."
      ),
      avoidWith = listOf(
        "Do NOT boil with cow milk (acidic minerals can curdle milk proteins into hard-to-digest toxins).",
        "Fish or sour citrus fruits (Viruddha Aahar)."
      )
    ),

    // 0C. MAIDA
    FoodAiDetail(
      id = "maida",
      nameEn = "Maida (All-Purpose Refined Wheat Flour)",
      nameHi = "मैदा (Refined Wheat Flour)",
      category = "Refined Cereal Flour (Stripped Starch)",
      verdictTag = "⚠️ 15/100 Low Nutrient • Stripped Endosperm",
      topBenefitTitle = "Sabse Bada Fayda: High Gluten Elasticity for Bakery (Zero Fiber / Poor Nutrition)",
      topBenefitDesc = "Maida is produced by stripping whole wheat grains of their nutrient-rich bran and germ, leaving only pure endosperm starch bleached with chemical agents. It provides rapid culinary elasticity but lacks dietary fiber and essential minerals.",
      otherBenefits = listOf(
        "Provides smooth malleable dough for pastry, samosa crusts, and thin noodles.",
        "Easily gelatinizes at cooking temperatures for sauce thickening.",
        "Extended commercial shelf life compared to whole wheat flour (bran oils removed)."
      ),
      nutrients = FoodNutrientProfile(
        calories = 364.0,
        protein = 10.3,
        carbs = 76.3,
        fats = 0.98,
        fiber = 0.3,
        sugar = 0.3,
        calciumMg = 20.0,
        ironMg = 1.2,
        magnesiumMg = 22.0,
        potassiumMg = 107.0,
        zincMg = 0.7,
        vitaminA = "0 IU",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Trace Thiamine"
      ),
      whoShouldEat = listOf(
        "Only for occasional culinary celebrations in strictly controlled portions.",
        "Individuals needing very low-residue diets post gastrointestinal surgeries."
      ),
      whenToAvoid = listOf(
        "Constipation and Irritable Bowel Syndrome (lacks fiber and forms adhesive mass in gut).",
        "Diabetics, PCOS, and insulin resistant individuals (causes massive immediate insulin spike).",
        "Individuals targeting weight loss or cardiovascular health."
      ),
      avoidWith = listOf(
        "Deep-fried trans-fats (Bhature, Samosa, Donuts): Severe arterial inflammation.",
        "High Sugar Syrups (Jalebi, Gulab Jamun): Severe dual assault on liver glycogen and pancreas."
      )
    ),

    // 1. COW GHEE`;

ktContent = ktContent.replace('    // 1. COW GHEE', newBuiltins);

// Update synthesizeFoodEntry in FoodAiKnowledgeBase.kt
const newSynthesizer = `  private fun synthesizeFoodEntry(query: String): FoodAiDetail {
    val q = query.lowercase().trim()
    val capitalized = query.replaceFirstChar { it.uppercase() }

    // 1. SUGARS / SWEETS / CONFECTIONERY
    if (Regex("sugar|candy|syrup|jelly|mithai|sweet|caramel|halwa|laddu|ladoo|jalebi|rasgulla|barfi|gulab jamun|chikki|cake|pastry|sucrose|glucose|fructose").containsMatchIn(q)) {
      return FoodAiDetail(
        id = q.replace(" ", "_"),
        nameEn = "$capitalized (Refined Sweetener / Confectionery)",
        nameHi = "$capitalized (मीठा / शर्करा युक्त खाद्य)",
        category = "Concentrated Simple Sugars & Sweetener",
        verdictTag = "⚠️ High GI Empty Calories • Minimize Intake",
        topBenefitTitle = "Sabse Bada Fayda: Rapid Blood Sugar Spike (Instant Glucose for Hypoglycemia Only)",
        topBenefitDesc = "$capitalized is composed primarily of simple sucrose or concentrated sugars. It provides virtually no dietary fiber, negligible essential vitamins, and zero structural protein. Its sole biochemical utility is supplying quick immediate cellular energy during acute sugar crashes or extreme endurance fatigue.",
        otherBenefits = listOf(
          "Rapidly replenishes depleted glycogen stores during prolonged endurance athletics.",
          "Improves taste and culinary sweetness in confectionery formulations.",
          "Acts as a short-term emergency energy substrate."
        ),
        nutrients = FoodNutrientProfile(
          calories = 387.0,
          protein = 0.2,
          carbs = 99.0,
          fats = 0.1,
          fiber = 0.0,
          sugar = 98.0,
          calciumMg = 2.0,
          ironMg = 0.1,
          magnesiumMg = 1.0,
          potassiumMg = 5.0,
          zincMg = 0.05,
          vitaminA = "0 IU",
          vitaminC = "0 mg",
          vitaminD = "0 mcg",
          vitaminBComplex = "Nil"
        ),
        whoShouldEat = listOf(
          "Endurance athletes during mid-race exhaustion.",
          "Anyone experiencing acute medical hypoglycemia (shaking, sweating, sugar crash)."
        ),
        whenToAvoid = listOf(
          "Diabetics and pre-diabetics (causes sudden severe glycemic spike).",
          "Individuals with Fatty Liver, high triglycerides, or obesity.",
          "Children with dental cavities or hyperactivity.",
          "Avoid eating right before bedtime."
        ),
        avoidWith = listOf(
          "Deep fried saturated fats (accelerates arterial plaque and visceral fat).",
          "Sugary caffeinated soft drinks."
        )
      )
    }

    // 2. ULTRA-PROCESSED PACKAGED JUNK / FRIED SNACKS / FAST FOOD
    if (Regex("chips|kurkure|crisps|fries|french fries|samosa|kachori|pakora|bhujia|namkeen|burger|momos|noodles|maggi|instant noodles|biscuit|cookie|puff").containsMatchIn(q)) {
      return FoodAiDetail(
        id = q.replace(" ", "_"),
        nameEn = "$capitalized (Packaged Fried Snack / Fast Food)",
        nameHi = "$capitalized (तले हुए स्नैक्स / जंक फूड)",
        category = "Ultra-Processed Deep Fried Food",
        verdictTag = "🚫 10/100 High Risk • High Sodium & Saturated Fat",
        topBenefitTitle = "Sabse Bada Fayda: Hyper-Palatable Crunch Only (Zero Health Benefit)",
        topBenefitDesc = "$capitalized is industrially processed using refined flour, commercial refined palm oil, and heavy sodium seasonings. It provides high calorie density with negligible micronutrients, elevated trans-fats, and thermal oxidation byproducts.",
        otherBenefits = listOf(
          "Convenient packaged ready-to-eat snack.",
          "Provides high temporary caloric density in survival situations."
        ),
        nutrients = FoodNutrientProfile(
          calories = 530.0,
          protein = 6.0,
          carbs = 55.0,
          fats = 33.0,
          fiber = 1.8,
          sugar = 2.5,
          calciumMg = 25.0,
          ironMg = 1.5,
          magnesiumMg = 30.0,
          potassiumMg = 450.0,
          zincMg = 0.8,
          vitaminA = "Degraded",
          vitaminC = "0 mg",
          vitaminD = "0 mcg",
          vitaminBComplex = "Trace"
        ),
        whoShouldEat = listOf(
          "Occasional social treat only. Not recommended for any daily nutritional or fitness goal."
        ),
        whenToAvoid = listOf(
          "Hypertension, heart disease, high LDL cholesterol, and atherosclerosis.",
          "Individuals with GERD, acid reflux, or liver inflammation.",
          "Growing children (habituation to synthetic flavor enhancers suppresses wholesome appetite)."
        ),
        avoidWith = listOf(
          "Sugary carbonated sodas or alcohol (multiplies cardiovascular and hepatic stress).",
          "Late night snacking."
        )
      )
    }

    // 3. WHOLESOME NATURAL FOOD FALLBACK
    return FoodAiDetail(
      id = q.replace(" ", "_"),
      nameEn = capitalized,
      nameHi = "$capitalized (प्राकृतिक खाद्य पदार्थ)",
      category = "Wholesome Natural Food",
      verdictTag = "⭐⭐⭐⭐ Whole Food Nutrition",
      topBenefitTitle = "Sabse Bada Fayda: Cellular Nourishment & Natural Micronutrient Balance",
      topBenefitDesc = "$capitalized provides natural macronutrients, dietary fiber, and cellular minerals essential for biological metabolism, muscular energy repair, and metabolic homeostasis.",
      otherBenefits = listOf(
        "Delivers unrefined, bioavailable vitamins and essential minerals.",
        "Supports balanced gut microbiota diversity through natural dietary fiber.",
        "Free from industrial synthetic trans-fats and chemical flavor enhancers."
      ),
      nutrients = FoodNutrientProfile(
        calories = 145.0,
        protein = 5.2,
        carbs = 24.0,
        fats = 2.8,
        fiber = 3.6,
        sugar = 2.1,
        calciumMg = 40.0,
        ironMg = 1.8,
        magnesiumMg = 32.0,
        potassiumMg = 290.0,
        zincMg = 0.9,
        vitaminA = "120 IU",
        vitaminC = "12.0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Natural B-Complex"
      ),
      whoShouldEat = listOf(
        "Active individuals and families seeking balanced whole-food nourishment.",
        "Individuals focusing on preventive cardiovascular and digestive wellness."
      ),
      whenToAvoid = listOf(
        "Limit portions late at night before sleep.",
        "Consume freshly prepared and properly washed."
      ),
      avoidWith = listOf(
        "Avoid washing down with ice-cold carbonated artificial sodas or excessive trans-fat oils."
      )
    )
  }`;

ktContent = ktContent.replace(
  /private fun synthesizeFoodEntry\(query: String\): FoodAiDetail \{[\s\S]*?\n  \}/,
  newSynthesizer
);

fs.writeFileSync(ktPath, ktContent, 'utf8');
console.log('Successfully updated FoodAiKnowledgeBase.kt!');

// 2. UPDATE AiFoodScreen.kt (SLIM HEADER & REMOVE TOP EMPTY SPACE)
const screenPath = path.join(__dirname, '../app/src/main/java/com/example/ui/screens/AiFoodScreen.kt');
let screenContent = fs.readFileSync(screenPath, 'utf8');

// Replace LazyColumn padding to remove top empty space
screenContent = screenContent.replace(
  /contentPadding = PaddingValues\(16\.dp\),\s*verticalArrangement = Arrangement\.spacedBy\(16\.dp\)/,
  `contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 6.dp, bottom = 14.dp),\n      verticalArrangement = Arrangement.spacedBy(10.dp)`
);

fs.writeFileSync(screenPath, screenContent, 'utf8');
console.log('Successfully updated AiFoodScreen.kt!');
