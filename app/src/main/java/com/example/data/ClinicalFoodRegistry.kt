package com.example.data

object ClinicalFoodRegistry {

  val ALL_FOODS: List<FoodAiDetail> = listOf(
    // -------------------------------------------------------------
    // FRUITS (फल)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "mango",
      nameEn = "Fresh Mango (Aam / Alphonso / Dasheri)",
      nameHi = "ताजा आम (Mango / फलों का राजा)",
      category = "Tropical Nutrient-Rich Fruit",
      verdictTag = "⭐⭐⭐⭐ Rich in Carotenoids & Vitamin C",
      topBenefitTitle = "Sabse Bada Fayda: Beta-Carotene Eye Protection & Amylase Digestive Enzymes",
      topBenefitDesc = "Mango is packed with provitamin A (Beta-carotene) and digestive amylase enzymes. Amylases break down complex carbs into easily assimilable simple sugars, while high lutein and zeaxanthin protect retinal macular cells from oxidative damage.",
      otherBenefits = listOf(
        "Provides 60% of daily Vitamin C requirement in 100g, supporting skin collagen and immunity.",
        "Bioactive mangiferin polyphenol protects liver cells against oxidative stress.",
        "Tartaric and malic acid maintain bodily alkaline reserve balance.",
        "High natural hydration and electrolyte content combats seasonal summer heat stroke."
      ),
      nutrients = FoodNutrientProfile(
        calories = 60.0,
        protein = 0.8,
        carbs = 15.0,
        fats = 0.4,
        fiber = 1.6,
        sugar = 13.7,
        calciumMg = 11.0,
        ironMg = 0.16,
        magnesiumMg = 10.0,
        potassiumMg = 168.0,
        zincMg = 0.09,
        vitaminA = "1082 IU (High)",
        vitaminC = "36.4 mg (60% DV)",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 43mcg, B6 0.12mg"
      ),
      whoShouldEat = listOf(
        "Children and students needing vision protection and natural cognitive energy.",
        "Individuals recovering from dehydration or physical fatigue.",
        "Anyone seeking radiant skin collagen and immune resistance."
      ),
      whenToAvoid = listOf(
        "Diabetics should limit portion to 1/2 small cup and never consume as liquid juice.",
        "Avoid consuming right after heavy lunch or late at night (causes excess caloric and sugar load)."
      ),
      avoidWith = listOf(
        "Avoid eating with cold milk or curd (combining sour fruit acids with dairy disrupts digestive Agni).",
        "Avoid drinking cold water immediately after eating mangoes."
      )
    ),

    FoodAiDetail(
      id = "banana",
      nameEn = "Ripe Banana (Kela)",
      nameHi = "पका केला (Banana)",
      category = "Potassium-Dense Energy Fruit",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Instant Athletic Energy",
      topBenefitTitle = "Sabse Bada Fayda: Rapid Electrolyte Replenishment (Potassium 358mg) & Cramp Defense",
      topBenefitDesc = "Bananas contain high bioavailable potassium and magnesium along with a tripartite sugar blend (fructose, glucose, sucrose). It rapidly normalizes neuromuscular transmission, prevents painful athletic muscle cramps, and buffers stomach acids.",
      otherBenefits = listOf(
        "High Vitamin B6 (0.4mg per 100g) assists neurotransmitter synthesis (serotonin and dopamine).",
        "Natural pectin and fructooligosaccharides (FOS) act as food for beneficial gut probiotics.",
        "Protects stomach lining against acidic ulceration by stimulating mucus production.",
        "Easily digestible energy ideal for pre-workout and post-workout fuel."
      ),
      nutrients = FoodNutrientProfile(
        calories = 89.0,
        protein = 1.1,
        carbs = 22.8,
        fats = 0.3,
        fiber = 2.6,
        sugar = 12.2,
        calciumMg = 5.0,
        ironMg = 0.26,
        magnesiumMg = 27.0,
        potassiumMg = 358.0,
        zincMg = 0.15,
        vitaminA = "64 IU",
        vitaminC = "8.7 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Vitamin B6 0.37mg (28% DV), Folate 20mcg"
      ),
      whoShouldEat = listOf(
        "Athletes, gym-goers, and runners before and after intensive workouts.",
        "Individuals suffering from stomach acidity, heartburn, or acute diarrhea (BRAT diet).",
        "Anyone dealing with elevated blood pressure (high potassium blunts sodium)."
      ),
      whenToAvoid = listOf(
        "Advanced chronic kidney disease patients on strict potassium restrictions.",
        "Strictly avoid cold refrigerated bananas late at night if prone to bronchial congestion."
      ),
      avoidWith = listOf(
        "Avoid blending with cold curd or yogurt (Viruddha Aahar that aggravates Kapha and mucous).",
        "Do not consume with heavy fatty meals."
      )
    ),

    FoodAiDetail(
      id = "apple",
      nameEn = "Fresh Apple (Seb)",
      nameHi = "ताजा सेब (Apple)",
      category = "Pectin-Rich Antioxidant Fruit",
      verdictTag = "⭐⭐⭐⭐⭐ Cardiovascular & Gut Champion",
      topBenefitTitle = "Sabse Bada Fayda: Soluble Pectin Fiber Sinks LDL Cholesterol & Stabilizes Glucose",
      topBenefitDesc = "Apples are one of nature's greatest sources of prebiotic soluble Pectin fiber and Quercetin bioflavonoids. Pectin forms a protective gel in the intestinal tract that traps excess dietary cholesterol and delays glucose uptake, dramatically reducing arterial plaque formation.",
      otherBenefits = listOf(
        "Quercetin in the peel protects brain neurons and pulmonary lung airways from inflammatory damage.",
        "Epicatechin polyphenols lower systolic blood pressure and improve endothelial arterial flexibility.",
        "Supports healthy microbiome: feeds Faecalibacterium prausnitzii to generate gut-healing butyrate.",
        "Low glycemic index and high water content provide long-lasting mental satiety."
      ),
      nutrients = FoodNutrientProfile(
        calories = 52.0,
        protein = 0.3,
        carbs = 13.8,
        fats = 0.2,
        fiber = 2.4,
        sugar = 10.4,
        calciumMg = 6.0,
        ironMg = 0.12,
        magnesiumMg = 5.0,
        potassiumMg = 107.0,
        zincMg = 0.04,
        vitaminA = "54 IU",
        vitaminC = "4.6 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Vitamin K 2.2mcg, Folate 3mcg"
      ),
      whoShouldEat = listOf(
        "Individuals with elevated LDL cholesterol or heart disease risk.",
        "Diabetics and weight-management enthusiasts seeking safe sweet crunch.",
        "Anyone dealing with sluggish digestion or irregular bowel movements."
      ),
      whenToAvoid = listOf(
        "FODMAP-sensitive IBS individuals during acute digestive flares (fructose and sorbitol content).",
        "Always wash thoroughly to remove external paraffin fruit wax before eating with skin."
      ),
      avoidWith = listOf(
        "Avoid drinking water immediately after eating apples (causes rapid fermentation and bloating).",
        "Do not peel off the skin unless medically required."
      )
    ),

    FoodAiDetail(
      id = "papaya",
      nameEn = "Ripe Papaya (Papita)",
      nameHi = "पका पपीता (Papaya)",
      category = "Digestive Enzyme-Rich Superfruit",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Gastrointestinal Healer",
      topBenefitTitle = "Sabse Bada Fayda: Papain Proteolytic Enzyme Cures Constipation & Protein Bloating",
      topBenefitDesc = "Papaya contains Papain, a potent digestive proteolytic enzyme capable of tenderizing and breaking down tough protein molecules in minutes. Combined with high soluble fiber and 88% structured water, it provides unmatched relief from chronic constipation and acid reflux.",
      otherBenefits = listOf(
        "Delivers 60.9mg Vitamin C per 100g (100% of daily requirement), building leukocyte defense.",
        "High carotenoid lycopene and beta-carotene content scavenges cellular free radicals.",
        "Ayurvedic mild laxative that soothes hemorrhoids and intestinal inflammatory irritation.",
        "Low calories (43 kcal) and low glycemic load make it an exceptional diabetic-friendly fruit."
      ),
      nutrients = FoodNutrientProfile(
        calories = 43.0,
        protein = 0.5,
        carbs = 10.8,
        fats = 0.3,
        fiber = 1.7,
        sugar = 7.8,
        calciumMg = 20.0,
        ironMg = 0.25,
        magnesiumMg = 21.0,
        potassiumMg = 182.0,
        zincMg = 0.08,
        vitaminA = "950 IU",
        vitaminC = "60.9 mg (101% DV)",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 37mcg, Vitamin E 0.3mg"
      ),
      whoShouldEat = listOf(
        "People with chronic constipation, piles, slow digestion, or severe protein bloating.",
        "Those recovering from viral fever, dengue (papaya supports platelet vitality), or liver weakness.",
        "Diabetic individuals desiring nutritious low-calorie fruit portions."
      ),
      whenToAvoid = listOf(
        "Pregnant women must strictly avoid raw/unripe green papaya (contains high latex that triggers uterine contractions).",
        "Severe active acute diarrhea (papain increases bowel motility)."
      ),
      avoidWith = listOf(
        "Avoid mixing with citrus lemons or oranges (excess combined acidity causes gastric irritation).",
        "Avoid eating with eggs or dairy."
      )
    ),

    FoodAiDetail(
      id = "guava",
      nameEn = "Fresh Guava (Amrood)",
      nameHi = "ताजा अमरूद (Guava)",
      category = "High-Vitamin C & Prebiotic Superfruit",
      verdictTag = "⭐⭐⭐⭐⭐ King of Natural Vitamin C & Fiber",
      topBenefitTitle = "Sabse Bada Fayda: 228mg Vitamin C (400% Daily Value!) & 5.4g Gut Fiber",
      topBenefitDesc = "Guava is the undisputed whole-food champion of Vitamin C, containing 4 times more than oranges (228mg vs 53mg). Combined with 5.4g of dense soluble and insoluble dietary fiber per 100g, it supercharges cellular immune phagocytes and regulates blood glucose.",
      otherBenefits = listOf(
        "Low glycemic index and high dietary fiber prevent post-prandial glycemic spikes.",
        "High potassium and soluble fiber protect cardiovascular health and lower systolic BP.",
        "Antimicrobial tannins in guava leaf and fruit inhibit gut pathogen proliferation.",
        "Relieves chronic constipation when consumed with its ripe edible seeds."
      ),
      nutrients = FoodNutrientProfile(
        calories = 68.0,
        protein = 2.6,
        carbs = 14.3,
        fats = 0.95,
        fiber = 5.4,
        sugar = 8.9,
        calciumMg = 18.0,
        ironMg = 0.26,
        magnesiumMg = 22.0,
        potassiumMg = 417.0,
        zincMg = 0.23,
        vitaminA = "624 IU",
        vitaminC = "228.3 mg (380% DV!)",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 49mcg, Niacin 1.1mg"
      ),
      whoShouldEat = listOf(
        "Diabetic and pre-diabetic patients needing a nutrient-dense, low GI sweet fruit.",
        "Individuals looking to rapidly boost immune white blood cells and resist seasonal flu.",
        "Anyone suffering from slow bowel transit and high cholesterol."
      ),
      whenToAvoid = listOf(
        "Avoid unripe hard rock guavas on an empty stomach if suffering from hyperacidity.",
        "Avoid eating late at night if prone to dental sensitivity."
      ),
      avoidWith = listOf(
        "Avoid eating with bananas or heavy dairy."
      )
    ),

    FoodAiDetail(
      id = "pomegranate",
      nameEn = "Fresh Pomegranate (Anar)",
      nameHi = "ताजा अनार (Pomegranate)",
      category = "Polyphenol & Hemoglobin Superfood",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Blood & Cardiovascular Tonic",
      topBenefitTitle = "Sabse Bada Fayda: Punicalagins Super-Antioxidant Clears Arterial Nitric Oxide",
      topBenefitDesc = "Pomegranates contain punicalagins and punicic acid, antioxidant compounds with triple the potency of green tea or red wine. Clinical research shows regular intake prevents arterial LDL oxidation, reduces carotid artery thickness, and improves myocardial blood circulation.",
      otherBenefits = listOf(
        "Promotes erythropoiesis and assists iron bioavailability for increasing hemoglobin levels.",
        "Urolithin A precursor produced in gut microbiome stimulates mitophagy (cellular anti-aging).",
        "Inhibits inflammatory enzymes (cyclooxygenase) in osteoarthritic cartilage.",
        "Improves athletic VO2 efficiency and post-exercise oxygen transport."
      ),
      nutrients = FoodNutrientProfile(
        calories = 83.0,
        protein = 1.7,
        carbs = 18.7,
        fats = 1.2,
        fiber = 4.0,
        sugar = 13.7,
        calciumMg = 10.0,
        ironMg = 0.3,
        magnesiumMg = 12.0,
        potassiumMg = 236.0,
        zincMg = 0.35,
        vitaminA = "Trace",
        vitaminC = "10.2 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 38mcg, Vitamin K 16.4mcg"
      ),
      whoShouldEat = listOf(
        "Individuals with anemia, fatigue, pale skin, or low hemoglobin counts.",
        "Hypertensive and cardiac patients looking to improve vascular elasticity.",
        "Endurance athletes and elderly individuals seeking anti-inflammatory cellular longevity."
      ),
      whenToAvoid = listOf(
        "Patients taking prescription blood thinners or ACE inhibitors should consult a physician.",
        "Avoid pre-packaged strained sugary juice; always eat whole arils with seed fiber."
      ),
      avoidWith = listOf(
        "Do not combine with antacids or high calcium milk simultaneously."
      )
    ),

    FoodAiDetail(
      id = "watermelon",
      nameEn = "Fresh Watermelon (Tarbooz)",
      nameHi = "ताजा तरबूज (Watermelon)",
      category = "L-Citrulline Hydration Superfruit",
      verdictTag = "⭐⭐⭐⭐ Cellular Hydration & Nitric Oxide",
      topBenefitTitle = "Sabse Bada Fayda: L-Citrulline Vasodilation & 92% Cellular Hydration",
      topBenefitDesc = "Watermelon is 92% biologically structured cellular water rich in the amino acid L-Citrulline. L-Citrulline converts directly into L-Arginine in the kidneys, surging Nitric Oxide levels to dilate blood vessels, drop blood pressure, and relieve muscular soreness.",
      otherBenefits = listOf(
        "Contains 40% more Lycopene than raw tomatoes, shielding skin against UV photo-damage.",
        "Natural potassium and magnesium balance cellular osmotic pressure during heat exhaustion.",
        "Super low calorie density (only 30 kcal per 100g), creating fullness without caloric guilt.",
        "Supports renal filtration and natural uric acid flushing."
      ),
      nutrients = FoodNutrientProfile(
        calories = 30.0,
        protein = 0.6,
        carbs = 7.6,
        fats = 0.15,
        fiber = 0.4,
        sugar = 6.2,
        calciumMg = 7.0,
        ironMg = 0.24,
        magnesiumMg = 10.0,
        potassiumMg = 112.0,
        zincMg = 0.1,
        vitaminA = "569 IU",
        vitaminC = "8.1 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "L-Citrulline, Lycopene 4532mcg"
      ),
      whoShouldEat = listOf(
        "Athletes suffering from post-workout muscle soreness (DOMS).",
        "Anyone working outdoors in summer heat seeking heatstroke prevention.",
        "People wanting natural kidney detox and blood pressure optimization."
      ),
      whenToAvoid = listOf(
        "Avoid eating large bowls late at night (diuretic effect disrupts sleep cycles).",
        "Diabetics should eat modest portions paired with a few nuts to buffer the glycemic response."
      ),
      avoidWith = listOf(
        "NEVER drink water right after eating watermelon (severely dilutes digestive enzymes).",
        "Never eat watermelon with dairy, milk, or heavy protein."
      )
    ),

    // -------------------------------------------------------------
    // VEGETABLES (सब्जियां)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "tomato",
      nameEn = "Ripe Tomato (Tamatar)",
      nameHi = "ताजा टमाटर (Tomato)",
      category = "Lycopene Antioxidant Vegetable-Fruit",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Lycopene & Prostate Protector",
      topBenefitTitle = "Sabse Bada Fayda: Bioavailable Lycopene Protects Heart, Prostate & Skin",
      topBenefitDesc = "Tomatoes are nature's preeminent source of Lycopene, a carotenoid antioxidant that neutralizes singlet oxygen free radicals. Cooking tomatoes with healthy fats (like mustard oil or ghee) increases Lycopene bioavailability by 300%, offering proven clinical defense against prostate enlargement and cardiovascular plaque.",
      otherBenefits = listOf(
        "Ultra-low in calories (only 18 kcal per 100g) and low glycemic load.",
        "Rich in natural potassium, Folate, and Vitamin C for arterial wall integrity.",
        "Chlorogenic acid and caffeic acid protect against cellular mutagens and carcinogens.",
        "High natural glutamates provide rich umami culinary flavor without artificial MSG."
      ),
      nutrients = FoodNutrientProfile(
        calories = 18.0,
        protein = 0.9,
        carbs = 3.9,
        fats = 0.2,
        fiber = 1.2,
        sugar = 2.6,
        calciumMg = 10.0,
        ironMg = 0.27,
        magnesiumMg = 11.0,
        potassiumMg = 237.0,
        zincMg = 0.17,
        vitaminA = "833 IU",
        vitaminC = "13.7 mg (23% DV)",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 15mcg, Lycopene 3025mcg"
      ),
      whoShouldEat = listOf(
        "Men over 40 aiming for prostate health and urinary flow maintenance.",
        "Individuals aiming for cardiovascular protection and lower oxidized LDL levels.",
        "Anyone on weight-loss or low-calorie nutrition protocols."
      ),
      whenToAvoid = listOf(
        "Patients with active calcium oxalate kidney stones should limit raw tomato seeds.",
        "Individuals with acute GERD or acid reflux flares."
      ),
      avoidWith = listOf(
        "Avoid eating with raw cucumber simultaneously in large amounts.",
        "Avoid pairing with high-starch white flour pastries."
      )
    ),

    FoodAiDetail(
      id = "onion",
      nameEn = "Red Onion (Pyaz)",
      nameHi = "लाल प्याज (Onion)",
      category = "Allicin & Quercetin Prebiotic Vegetable",
      verdictTag = "⭐⭐⭐⭐ Anti-Inflammatory & Gut Prebiotic",
      topBenefitTitle = "Sabse Bada Fayda: Quercetin Bioflavonoid & Organic Sulfur Compounds",
      topBenefitDesc = "Red onions are concentrated in Quercetin and organosulfur compounds (allyl propyl disulfide). These act as natural antihistamines, reduce blood platelet aggregation, and feed beneficial Bifidobacteria via rich inulin prebiotics.",
      otherBenefits = listOf(
        "Helps regulate blood sugar: sulfur compounds stimulate insulin synthesis in pancreas.",
        "Inulin prebiotic fiber promotes short-chain fatty acid production in the gut.",
        "Natural antibacterial against oral Streptococcus mutans and common pathogens.",
        "Reduces LDL cholesterol and triglycerides in hyperlipidemic individuals."
      ),
      nutrients = FoodNutrientProfile(
        calories = 40.0,
        protein = 1.1,
        carbs = 9.3,
        fats = 0.1,
        fiber = 1.7,
        sugar = 4.2,
        calciumMg = 23.0,
        ironMg = 0.21,
        magnesiumMg = 10.0,
        potassiumMg = 146.0,
        zincMg = 0.17,
        vitaminA = "Trace",
        vitaminC = "7.4 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 19mcg, B6 0.12mg"
      ),
      whoShouldEat = listOf(
        "People wanting to improve gut microbiome diversity and reduce blood pressure.",
        "Individuals with seasonal allergies, asthma, or bronchial inflammation.",
        "Diabetic patients needing natural post-meal glucose modulation."
      ),
      whenToAvoid = listOf(
        "Individuals with severe SIBO or IBS on low-FODMAP diet (fructans cause gas and bloating).",
        "Those with active acid reflux before bedtime."
      ),
      avoidWith = listOf(
        "Avoid eating with cold milk (classic incompatible food combination in Ayurveda)."
      )
    ),

    FoodAiDetail(
      id = "lady_finger",
      nameEn = "Lady Finger / Okra (Bhindi)",
      nameHi = "ताजा भिंडी (Bhindi / Okra)",
      category = "Mucilage-Rich Blood Sugar Regulator",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Diabetic & Gut Shield",
      topBenefitTitle = "Sabse Bada Fayda: Natural Soluble Mucilage Traps Dietary Glucose & Cholesterol",
      topBenefitDesc = "Bhindi is rich in viscous mucilage (soluble fibers and pectin) that coats the intestinal mucosal wall. This slows carbohydrate absorption, blunting post-meal sugar spikes, while simultaneously binding bile acids to clear excess blood cholesterol through excretion.",
      otherBenefits = listOf(
        "Supplies 82mg of bioavailable Calcium per 100g, supporting skeletal bone density.",
        "Rich in Folate (88 mcg - 22% DV), vital for fetal neural tube development during pregnancy.",
        "High polyphenols and flavonoids reduce oxidative fatigue and support hepatic function.",
        "Ultra-low in calories (33 kcal per 100g), making it a weight-loss staple."
      ),
      nutrients = FoodNutrientProfile(
        calories = 33.0,
        protein = 1.9,
        carbs = 7.5,
        fats = 0.19,
        fiber = 3.2,
        sugar = 1.5,
        calciumMg = 82.0,
        ironMg = 0.62,
        magnesiumMg = 57.0,
        potassiumMg = 299.0,
        zincMg = 0.43,
        vitaminA = "716 IU",
        vitaminC = "23.0 mg (38% DV)",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 88mcg, Vitamin K 53mcg"
      ),
      whoShouldEat = listOf(
        "Type 2 diabetics seeking proven food-based glycemic control.",
        "Pregnant women needing natural dietary Folate and bioavailable calcium.",
        "Anyone aiming for lower cholesterol and gut barrier nourishment."
      ),
      whenToAvoid = listOf(
        "Patients prone to calcium oxalate kidney stones should consume in moderation.",
        "Avoid deep frying into greasy chips which degrades the delicate mucilage."
      ),
      avoidWith = listOf(
        "Avoid pairing with heavy unsoaked pulses that induce simultaneous flatulence."
      )
    ),

    FoodAiDetail(
      id = "bitter_gourd",
      nameEn = "Bitter Gourd (Karela)",
      nameHi = "ताजा करेला (Karela)",
      category = "Natural Plant Insulin & Blood Purifier",
      verdictTag = "⭐⭐⭐⭐⭐ Clinical Anti-Diabetic Gold Standard",
      topBenefitTitle = "Sabse Bada Fayda: Charantin & Polypeptide-p Act as Biological Plant Insulin",
      topBenefitDesc = "Karela contains three active anti-diabetic compounds: Charantin, Vicine, and Polypeptide-p (plant insulin). Polypeptide-p mimics human insulin, binding insulin receptors and activating AMP-activated protein kinase (AMPK) to facilitate cellular glucose uptake into muscles.",
      otherBenefits = listOf(
        "Powerful hepatic detoxifier: stimulates liver enzymes and bile secretion.",
        "Provides 84mg Vitamin C per 100g (140% DV), defending against skin boils and infections.",
        "Ayurvedic Tikta Rasa: clears excess Pitta, purifies blood, and reduces inflammatory skin acne.",
        "Lowers elevated serum triglycerides and low-density lipoprotein (LDL) cholesterol."
      ),
      nutrients = FoodNutrientProfile(
        calories = 17.0,
        protein = 1.0,
        carbs = 3.7,
        fats = 0.17,
        fiber = 2.8,
        sugar = 0.6,
        calciumMg = 19.0,
        ironMg = 0.43,
        magnesiumMg = 17.0,
        potassiumMg = 296.0,
        zincMg = 0.8,
        vitaminA = "471 IU",
        vitaminC = "84.0 mg (140% DV)",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 72mcg, Riboflavin"
      ),
      whoShouldEat = listOf(
        "Type 2 diabetic and pre-diabetic patients seeking to lower HbA1c levels.",
        "Individuals with fatty liver, sluggish digestion, or recurring skin acne and boils.",
        "Those on strict fat-loss and metabolic health protocols."
      ),
      whenToAvoid = listOf(
        "Pregnant women must strictly avoid excessive karela (contains emmenagogues).",
        "Diabetics on heavy allopathic insulin should monitor blood sugar to prevent acute hypoglycemia."
      ),
      avoidWith = listOf(
        "Avoid drinking raw milk right after eating bitter karela."
      )
    ),

    FoodAiDetail(
      id = "bottle_gourd",
      nameEn = "Bottle Gourd (Lauki / Ghiya / Dudhi)",
      nameHi = "ताजी लौकी / घीया (Lauki)",
      category = "Cooling Alkaline Renal Vegetable",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Detox & Liver Soother",
      topBenefitTitle = "Sabse Bada Fayda: 96% Alkaline Water Soothes Acidity, Liver & Kidneys",
      topBenefitDesc = "Lauki is composed of 96% structured biological water with an alkaline pH. It neutralizes gastric hyperacidity, cleanses urinary tract pathways, and promotes cardiac health without adding any dietary fat or heavy calories.",
      otherBenefits = listOf(
        "Only 14 calories per 100g, making it one of the lightest foods for gut convalescence.",
        "Promotes tranquil sleep and calms neuro-irritability when consumed as a warm evening soup.",
        "Supports liver cell regeneration post jaundice or viral fever.",
        "Rich in soluble fiber that regulates bowel movement without producing gas or bloating."
      ),
      nutrients = FoodNutrientProfile(
        calories = 14.0,
        protein = 0.6,
        carbs = 3.4,
        fats = 0.02,
        fiber = 0.5,
        sugar = 2.0,
        calciumMg = 26.0,
        ironMg = 0.2,
        magnesiumMg = 11.0,
        potassiumMg = 150.0,
        zincMg = 0.7,
        vitaminA = "Trace",
        vitaminC = "10.1 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Thiamine B1, Niacin, Folate"
      ),
      whoShouldEat = listOf(
        "Individuals recovering from illness, surgery, stomach infection, or severe acidity.",
        "Hypertensive and cardiac patients seeking natural sodium-flushing hydration.",
        "Anyone targeting sustainable, healthy fat loss."
      ),
      whenToAvoid = listOf(
        "CRITICAL SAFETY WARNING: NEVER consume bitter tasting bottle gourd (toxic Cucurbitacin).",
        "Severe cold congestion in the dead of winter."
      ),
      avoidWith = listOf(
        "Do not combine with sour citrus fruits or fermented dairy."
      )
    ),

    FoodAiDetail(
      id = "carrot",
      nameEn = "Fresh Carrot (Gajar)",
      nameHi = "ताजा गाजर (Carrot)",
      category = "Provitamin A Carotenoid Champion",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Eye & Retinal Protector",
      topBenefitTitle = "Sabse Bada Fayda: Beta-Carotene Converts to Retinol for Night Vision & Epithelial Health",
      topBenefitDesc = "Carrots are nature's premier root source of Beta-Carotene (835 mcg per 100g). In the body, this converts into Retinol (Vitamin A), essential for synthesizing Rhodopsin in the retina, preventing night blindness, and shielding macular pigments.",
      otherBenefits = listOf(
        "High pectin fiber binds bile acids, naturally reducing serum LDL cholesterol.",
        "Lutein and Zeaxanthin filter damaging blue light from digital smartphone screens.",
        "Falcarinol polyacetylene compound exhibits protective anti-tumor activity in clinical models.",
        "Provides crisp satisfying crunch with only 41 kcal per 100g."
      ),
      nutrients = FoodNutrientProfile(
        calories = 41.0,
        protein = 0.9,
        carbs = 9.6,
        fats = 0.24,
        fiber = 2.8,
        sugar = 4.7,
        calciumMg = 33.0,
        ironMg = 0.3,
        magnesiumMg = 12.0,
        potassiumMg = 320.0,
        zincMg = 0.24,
        vitaminA = "16706 IU (334% DV!)",
        vitaminC = "5.9 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Vitamin K 13.2mcg, B6 0.14mg"
      ),
      whoShouldEat = listOf(
        "Students, programmers, and professionals with high daily screen time.",
        "Children needing vision development and natural immunity against infections.",
        "Individuals looking to improve skin radiance and mucosal barrier strength."
      ),
      whenToAvoid = listOf(
        "Consuming extreme quantities (>1 kg/day) can cause harmless yellowing of palms (Carotenemia).",
        "Diabetics should prefer eating raw whole carrots rather than strained concentrated juice."
      ),
      avoidWith = listOf(
        "Always consume with a drop of healthy fat (ghee or oil) to absorb fat-soluble Vitamin A.",
        "Avoid pairing with overly sweet processed desserts."
      )
    ),

    FoodAiDetail(
      id = "beetroot",
      nameEn = "Fresh Beetroot (Chukandar)",
      nameHi = "ताजा चुकंदर (Beetroot)",
      category = "Inorganic Nitrate & Stamina Tuber",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Stamina & Nitric Oxide Surger",
      topBenefitTitle = "Sabse Bada Fayda: Dietary Nitrates Convert to Nitric Oxide, Dropping BP & Boosting Stamina",
      topBenefitDesc = "Beetroot is densely loaded with natural dietary inorganic Nitrates (NO3-). Oral and intestinal bacteria reduce these nitrates into Nitric Oxide (NO), a powerful signaling gas that dilates arterial walls, lowers systolic blood pressure by 4-10 mmHg, and increases athletic mitochondrial efficiency.",
      otherBenefits = listOf(
        "Betalain pigments (Betacyanin) provide deep red antioxidant protection for liver detox pathways.",
        "Boosts oxygen uptake and VO2 max, enabling runners and cyclists to train 15% longer.",
        "Supports cerebral perfusion: increases blood flow to the frontal cortex in aging adults.",
        "Contains bioavailable non-heme iron and Folate for red blood cell synthesis."
      ),
      nutrients = FoodNutrientProfile(
        calories = 43.0,
        protein = 1.6,
        carbs = 9.6,
        fats = 0.17,
        fiber = 2.8,
        sugar = 6.8,
        calciumMg = 16.0,
        ironMg = 0.8,
        magnesiumMg = 23.0,
        potassiumMg = 325.0,
        zincMg = 0.35,
        vitaminA = "33 IU",
        vitaminC = "4.9 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 109mcg (27% DV), Betalains"
      ),
      whoShouldEat = listOf(
        "Cardiovascular and hypertensive patients seeking natural blood pressure reduction.",
        "Endurance athletes, runners, and cyclists seeking peak athletic stamina.",
        "Individuals with anemia or low red blood cell counts."
      ),
      whenToAvoid = listOf(
        "Individuals with a history of calcium oxalate kidney stones (high in oxalates).",
        "Harmless condition note: may cause temporary reddish urine or stool (Beeturia)."
      ),
      avoidWith = listOf(
        "Avoid using chemical antiseptic mouthwashes immediately before or after eating beets."
      )
    ),

    // -------------------------------------------------------------
    // GRAINS & CEREALS (अनाज & मिलेट्स)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "white_rice",
      nameEn = "Cooked White Rice (Chawal)",
      nameHi = "पका हुआ सफेद चावल (White Rice)",
      category = "Easily Digestible Carbohydrate",
      verdictTag = "⭐⭐⭐ Clean Glycogen Energy • Easy on Gut",
      topBenefitTitle = "Sabse Bada Fayda: Ultra-Gentle Hypoallergenic Energy for Convalescence",
      topBenefitDesc = "Cooked white rice is nature's cleanest, most hypoallergenic source of immediate glucose. Free from irritable lectins and anti-nutrients found in raw bran, it digests effortlessly, providing direct glycogen replenishment for tired muscles without taxing inflamed intestines.",
      otherBenefits = listOf(
        "Gold standard staple for gastrointestinal upset, food poisoning, or Crohn's flares.",
        "Completely gluten-free: safe for Celiac disease and gluten-sensitive enteropathy.",
        "Pairs synergistically with dals (pulses) to provide a 100% complete essential amino acid profile.",
        "Provides quick post-workout glycogen replenishment for high-intensity athletes."
      ),
      nutrients = FoodNutrientProfile(
        calories = 130.0,
        protein = 2.7,
        carbs = 28.2,
        fats = 0.28,
        fiber = 0.4,
        sugar = 0.1,
        calciumMg = 10.0,
        ironMg = 0.2,
        magnesiumMg = 12.0,
        potassiumMg = 35.0,
        zincMg = 0.49,
        vitaminA = "0 IU",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Thiamine B1, Niacin B3"
      ),
      whoShouldEat = listOf(
        "Athletes needing fast, easily digested post-training carbohydrate replenishment.",
        "Individuals recovering from stomach flu, diarrhea, IBS flares, or surgery.",
        "Anyone pairing with dal, vegetables, or ghee for a balanced traditional meal."
      ),
      whenToAvoid = listOf(
        "Sedentary individuals with uncontrolled Type 2 diabetes (consume in measured portions with dal and salad).",
        "Avoid eating large heaps of hot white rice alone without protein or fiber."
      ),
      avoidWith = listOf(
        "Avoid eating with sugary syrup or deep fried oily gravies.",
        "Do not leave cooked rice at room temperature for hours."
      )
    ),

    FoodAiDetail(
      id = "brown_rice",
      nameEn = "Cooked Brown Rice (Bhura Chawal)",
      nameHi = "भूरा चावल (Brown Rice)",
      category = "Whole Grain Complex Cereal",
      verdictTag = "⭐⭐⭐⭐ High Manganese & Slow-Release Fiber",
      topBenefitTitle = "Sabse Bada Fayda: Intact Bran Layer Provides Slow-Release Glycemic Balance",
      topBenefitDesc = "Unlike polished white rice, brown rice retains its nutrient-dense outer bran and germ layer. This delivers 1.8g of prebiotic dietary fiber and 88% of daily Manganese requirement per 100g, slowing glucose absorption and supporting antioxidant superoxide dismutase (SOD) enzymes.",
      otherBenefits = listOf(
        "Rich in Ferulic acid and phenolic antioxidants that suppress cellular inflammation.",
        "High magnesium content (43mg) improves cellular insulin sensitivity.",
        "Promotes sustained satiety, preventing between-meal snacking.",
        "Assists in maintaining bowel regularity through whole grain bulk."
      ),
      nutrients = FoodNutrientProfile(
        calories = 111.0,
        protein = 2.6,
        carbs = 23.0,
        fats = 0.9,
        fiber = 1.8,
        sugar = 0.4,
        calciumMg = 10.0,
        ironMg = 0.42,
        magnesiumMg = 43.0,
        potassiumMg = 86.0,
        zincMg = 0.63,
        vitaminA = "0 IU",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Manganese 0.9mg (45% DV), Thiamine B1, B6"
      ),
      whoShouldEat = listOf(
        "Diabetics and insulin-resistant individuals managing glycemic response.",
        "Individuals seeking whole grain cardiovascular protection and weight control.",
        "Active individuals desiring steady, prolonged physical energy."
      ),
      whenToAvoid = listOf(
        "Individuals with acute colitis, Crohn's flares, or severe indigestion.",
        "Always soak thoroughly for 2-4 hours before cooking to reduce natural phytates."
      ),
      avoidWith = listOf(
        "Avoid unwashed raw brown rice."
      )
    ),

    FoodAiDetail(
      id = "ragi",
      nameEn = "Ragi / Nachni (Finger Millet)",
      nameHi = "रागी / नाचनी (Finger Millet)",
      category = "High-Calcium Ancient Super-Millet",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Bone & Calcium Champion",
      topBenefitTitle = "Sabse Bada Fayda: Highest Calcium of All Grains (344mg!) For Osteoporosis & Bones",
      topBenefitDesc = "Ragi is the undisputed calcium king of the cereal kingdom, packing a staggering 344mg of Calcium per 100g—more than 3 times that of cow's milk and 10 times that of rice or wheat! It is indispensable for strengthening bone mineral density, preventing osteopenia, and nourishing growing infants.",
      otherBenefits = listOf(
        "Rich in polyphenols and high dietary fiber (11.5g per 100g) with an exceptionally low glycemic response.",
        "100% naturally gluten-free grain, gentle on sensitive digestive tracts.",
        "Abundant in the essential amino acid Methionine, absent in most polished cereals.",
        "High iron content (3.9mg) assists hemoglobin synthesis in nutritional anemia."
      ),
      nutrients = FoodNutrientProfile(
        calories = 328.0,
        protein = 7.3,
        carbs = 72.0,
        fats = 1.3,
        fiber = 11.5,
        sugar = 0.6,
        calciumMg = 344.0,
        ironMg = 3.9,
        magnesiumMg = 137.0,
        potassiumMg = 408.0,
        zincMg = 2.3,
        vitaminA = "42 IU",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Thiamine B1 0.42mg, Niacin 1.1mg"
      ),
      whoShouldEat = listOf(
        "Post-menopausal women and elderly individuals prone to bone fractures and osteoporosis.",
        "Growing children, toddlers, and infants as first weaning porridge (Ragi mudde/kheer).",
        "Diabetics aiming to replace high-GI wheat and white rice."
      ),
      whenToAvoid = listOf(
        "Individuals with severe active kidney stones or severe hypercalcemia.",
        "Consume cooked well with moisture (ragi is naturally drying if eaten dry)."
      ),
      avoidWith = listOf(
        "Do not consume raw unroasted flour."
      )
    ),

    // -------------------------------------------------------------
    // DALS & PULSES (दालें & फलियां)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "moong_dal",
      nameEn = "Yellow Moong Dal (Split Green Gram)",
      nameHi = "पीली मूंग दाल (Moong Dal)",
      category = "Tridoshic Light Plant Protein",
      verdictTag = "⭐⭐⭐⭐⭐ Gold Standard Digestible Protein",
      topBenefitTitle = "Sabse Bada Fayda: 24g High Plant Protein With Zero Gas & Bloating",
      topBenefitDesc = "Moong Dal is clinically regarded as the lightest, most bioavailable pulse in the human diet. Packing 24g of protein per 100g, it contains minimal flatulence-inducing oligosaccharides, making it the supreme choice for convalescence, muscle repair, and sensitive digestive systems.",
      otherBenefits = listOf(
        "Tremendous Folate powerhouse (625 mcg per 100g - 156% DV!), essential for DNA synthesis.",
        "Potassium-dense (1246mg per 100g), effectively counteracting vascular fluid retention.",
        "Ayurvedic Tridoshic food: balances Vata, Pitta, and Kapha simultaneously.",
        "Rich in resistant starch and polyphenols that nourish Bifidobacteria in the gut."
      ),
      nutrients = FoodNutrientProfile(
        calories = 347.0,
        protein = 24.0,
        carbs = 59.0,
        fats = 1.2,
        fiber = 16.3,
        sugar = 6.6,
        calciumMg = 132.0,
        ironMg = 6.7,
        magnesiumMg = 189.0,
        potassiumMg = 1246.0,
        zincMg = 2.7,
        vitaminA = "114 IU",
        vitaminC = "4.8 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 625mcg (156% DV!), Thiamine 0.62mg"
      ),
      whoShouldEat = listOf(
        "Vegetarians, fitness enthusiasts, and elderly individuals seeking easy-to-digest protein.",
        "Pregnant and lactating mothers needing dense Folate and iron nutrition.",
        "Patients recovering from fever, surgery, or gastrointestinal distress (Moong Khichdi)."
      ),
      whenToAvoid = listOf(
        "Severe acute uric acid gout flare-ups (moderation advised).",
        "Always soak for at least 20 minutes before pressure cooking."
      ),
      avoidWith = listOf(
        "Avoid mixing with curd at night."
      )
    ),

    FoodAiDetail(
      id = "toor_dal",
      nameEn = "Toor Dal / Arhar Dal (Pigeon Pea)",
      nameHi = "अरहर / तूर दाल (Toor Dal)",
      category = "High-Protein Indian Staple Pulse",
      verdictTag = "⭐⭐⭐⭐ Daily Dietary Protein Foundation",
      topBenefitTitle = "Sabse Bada Fayda: 22g Lean Protein & Complex Dietary Energy For Satiety",
      topBenefitDesc = "Toor Dal is the daily protein backbone of Indian nutrition. It provides 21.7g of plant protein and 15g of dietary fiber per 100g, ensuring prolonged amino acid availability for cellular tissue maintenance while preventing sudden glycemic crashes.",
      otherBenefits = listOf(
        "Extremely rich in Folate (456 mcg per 100g - 114% DV), critical for maternal health.",
        "High potassium and magnesium content supports cardiovascular muscle function.",
        "When paired with rice (Dal-Chawal), supplies all essential amino acids (methionine + lysine).",
        "Lowers serum total and LDL cholesterol through high soluble fiber excretion."
      ),
      nutrients = FoodNutrientProfile(
        calories = 343.0,
        protein = 21.7,
        carbs = 62.8,
        fats = 1.5,
        fiber = 15.0,
        sugar = 3.0,
        calciumMg = 130.0,
        ironMg = 5.2,
        magnesiumMg = 183.0,
        potassiumMg = 1392.0,
        zincMg = 2.7,
        vitaminA = "Trace",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 456mcg (114% DV), Thiamine 0.64mg"
      ),
      whoShouldEat = listOf(
        "Families seeking affordable, complete daily protein nutrition.",
        "Expectant mothers needing natural Folate to prevent birth defects.",
        "Diabetics and weight-conscious individuals wanting slow-burning complex carbs."
      ),
      whenToAvoid = listOf(
        "Individuals prone to flatulence should always cook with hing (asafoetida), jeera, and haldi.",
        "Severe kidney disease on restricted potassium protocols."
      ),
      avoidWith = listOf(
        "Avoid eating unsoaked or undercooked toor dal."
      )
    ),

    FoodAiDetail(
      id = "chana_dal",
      nameEn = "Chana Dal (Split Bengal Gram)",
      nameHi = "चना दाल (Chana Dal)",
      category = "Lowest GI High-Fiber Pulse",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Diabetic & Satiety Pulse",
      topBenefitTitle = "Sabse Bada Fayda: Lowest Glycemic Index (GI 28) & 18g Fiber For Diabetic Control",
      topBenefitDesc = "Chana Dal boasts the lowest glycemic index among all culinary pulses (GI 28). Its complex starch structure and massive 18g dietary fiber delay gastric digestion, preventing insulin spikes and maintaining steady, clean cellular energy for hours.",
      otherBenefits = listOf(
        "Provides 20.8g of muscle-building plant protein per 100g.",
        "High soluble fiber binds intestinal bile acids to reduce circulating serum cholesterol.",
        "Rich in zinc (2.8mg) and magnesium (160mg), aiding testosterone and immune cellular health.",
        "Promotes sustained metabolic fullness, suppressing cravings and emotional overeating."
      ),
      nutrients = FoodNutrientProfile(
        calories = 372.0,
        protein = 20.8,
        carbs = 60.0,
        fats = 5.6,
        fiber = 18.0,
        sugar = 4.0,
        calciumMg = 160.0,
        ironMg = 5.3,
        magnesiumMg = 160.0,
        potassiumMg = 850.0,
        zincMg = 2.8,
        vitaminA = "Trace",
        vitaminC = "1.0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 320mcg, Thiamine 0.48mg"
      ),
      whoShouldEat = listOf(
        "Type 2 diabetics and insulin-resistant individuals seeking glycemic balance.",
        "Individuals on weight loss programs needing high satiety protein.",
        "Anyone wanting strong bone and teeth mineral support."
      ),
      whenToAvoid = listOf(
        "Acute hyperuricemia (gout flare-up).",
        "Always soak for at least 1 hour before cooking to reduce phytates."
      ),
      avoidWith = listOf(
        "Avoid combining with heavy cream or trans-fat deep frying."
      )
    ),

    FoodAiDetail(
      id = "rajma",
      nameEn = "Red Kidney Beans (Rajma)",
      nameHi = "राजमा (Red Kidney Beans)",
      category = "Dense Protein & Fiber Super-Legume",
      verdictTag = "⭐⭐⭐⭐ Complete Plant Power & Gut Champion",
      topBenefitTitle = "Sabse Bada Fayda: 24g Protein & 24.9g Prebiotic Fiber For Heart & Colon",
      topBenefitDesc = "Rajma is a nutritional heavyweight delivering 24g of plant protein and an astounding 24.9g of prebiotic fiber per 100g. Its rich red anthocyanins scavenge free radicals, while fermentable fibers produce short-chain fatty acids that fortify colon epithelial barriers.",
      otherBenefits = listOf(
        "Rich in Molybdenum (cell detox cofactor) and bioavailable non-heme Iron (8.2mg).",
        "Lowers LDL cholesterol and post-prandial glycemic excursions.",
        "Pairs with rice (Rajma-Chawal) to form a complete PDCAAS amino acid profile.",
        "Improves insulin sensitivity in long-term clinical trials."
      ),
      nutrients = FoodNutrientProfile(
        calories = 333.0,
        protein = 24.0,
        carbs = 60.0,
        fats = 0.8,
        fiber = 24.9,
        sugar = 2.2,
        calciumMg = 143.0,
        ironMg = 8.2,
        magnesiumMg = 140.0,
        potassiumMg = 1406.0,
        zincMg = 2.8,
        vitaminA = "0 IU",
        vitaminC = "4.5 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Folate 394mcg (98% DV), Vitamin K 19mcg"
      ),
      whoShouldEat = listOf(
        "Fitness enthusiasts, vegetarians, and bodybuilders building dense muscle mass.",
        "Individuals with elevated LDL cholesterol seeking natural fiber reduction.",
        "People wanting to improve bowel microbiome health."
      ),
      whenToAvoid = listOf(
        "CRITICAL: NEVER consume raw or undercooked rajma (toxic Phytohaemagglutinin).",
        "Individuals with acute flatulence should temper with ginger, garlic, and hing."
      ),
      avoidWith = listOf(
        "Do not eat with heavy dairy cream."
      )
    ),

    // -------------------------------------------------------------
    // DAIRY & ANIMAL PROTEIN (डेयरी & प्रोटीन)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "cow_milk",
      nameEn = "Fresh Cow Milk (Doodh)",
      nameHi = "ताजा गाय का दूध (Cow Milk)",
      category = "Complete Liquid Nutrient & Bone Builder",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Skeletal & Brain Nourisher",
      topBenefitTitle = "Sabse Bada Fayda: 120mg Bioavailable Calcium & Complete Whey/Casein Protein",
      topBenefitDesc = "Cow milk provides an ideal physiological ratio of Casein (80%) and fast-digesting Whey (20%) proteins containing all 9 essential amino acids. Its calcium-to-phosphorus ratio ensures maximal bone mineral absorption, preventing osteoporosis and dental decay.",
      otherBenefits = listOf(
        "Contains Vitamin B12 (0.45 mcg per 100ml), crucial for myelin sheath and nerve transmission.",
        "Natural Conjugated Linoleic Acid (CLA) and Vitamin D3 support immune vitality.",
        "Ayurvedic Ojas enhancer: induces restful sleep when consumed warm with a pinch of haldi or nutmeg.",
        "Electrolyte-rich liquid hydration that rehydrates the body faster than plain water post-workout."
      ),
      nutrients = FoodNutrientProfile(
        calories = 62.0,
        protein = 3.2,
        carbs = 4.8,
        fats = 3.6,
        fiber = 0.0,
        sugar = 4.8,
        calciumMg = 120.0,
        ironMg = 0.03,
        magnesiumMg = 11.0,
        potassiumMg = 140.0,
        zincMg = 0.38,
        vitaminA = "126 IU",
        vitaminC = "1.0 mg",
        vitaminD = "1.2 mcg",
        vitaminBComplex = "Vitamin B12 0.45mcg, Riboflavin B2 0.18mg"
      ),
      whoShouldEat = listOf(
        "Growing children and adolescents for skeletal height and bone density.",
        "Athletes seeking complete overnight muscle protein synthesis (casein).",
        "Anyone needing clean dietary calcium and B12."
      ),
      whenToAvoid = listOf(
        "Individuals with diagnosed clinical Lactose Intolerance or cow milk protein allergy.",
        "Active acute asthma with heavy bronchial phlegm."
      ),
      avoidWith = listOf(
        "NEVER combine with sour citrus fruits, melons, or salty snacks (Classic Viruddha Aahar).",
        "Avoid drinking with fish or non-veg meats."
      )
    ),

    FoodAiDetail(
      id = "curd",
      nameEn = "Fresh Curd / Dahi (Yogurt)",
      nameHi = "ताजा दही (Curd / Yogurt)",
      category = "Probiotic Living Gut Healer",
      verdictTag = "⭐⭐⭐⭐⭐ Billions of Live Probiotic Cultures",
      topBenefitTitle = "Sabse Bada Fayda: Lactobacillus Probiotics Restore Colon Microbiome & Immunity",
      topBenefitDesc = "Fresh homemade curd contains billions of live lactic acid bacteria (Lactobacillus acidophilus and bulgaricus). These probiotic cultures colonize the intestinal mucosal barrier, crowding out pathogenic pathogens, producing bacteriocins, and optimizing systemic immunity.",
      otherBenefits = listOf(
        "Lactic acid fermentation breaks down lactose, making curd well-tolerated by lactose-sensitive people.",
        "Provides 121mg of easily absorbed Calcium and bioavailable phosphorus per 100g.",
        "Cooling digestive tonic that soothes stomach burn, dysentery, and antibiotic-induced gut damage.",
        "Assists in natural synthesis of B-complex vitamins inside the human intestinal tract."
      ),
      nutrients = FoodNutrientProfile(
        calories = 61.0,
        protein = 3.5,
        carbs = 4.7,
        fats = 3.3,
        fiber = 0.0,
        sugar = 4.7,
        calciumMg = 121.0,
        ironMg = 0.05,
        magnesiumMg = 12.0,
        potassiumMg = 155.0,
        zincMg = 0.52,
        vitaminA = "99 IU",
        vitaminC = "0.5 mg",
        vitaminD = "0.1 mcg",
        vitaminBComplex = "Vitamin B12 0.38mcg, Riboflavin 0.14mg"
      ),
      whoShouldEat = listOf(
        "Anyone experiencing sluggish digestion, gut dysbiosis, or following a course of antibiotics.",
        "Individuals with mild lactose sensitivity looking for safe dairy calcium and protein.",
        "People wanting to improve skin clarity and digestive agility."
      ),
      whenToAvoid = listOf(
        "Ayurvedic classical guideline: avoid consuming sour curd late at night (clogs micro-circulatory channels).",
        "Active acute cough, cold, or sinus congestion flares."
      ),
      avoidWith = listOf(
        "Do NOT heat curd directly (cooking destroys beneficial probiotic cultures).",
        "Avoid combining with fish or milk."
      )
    ),

    FoodAiDetail(
      id = "paneer",
      nameEn = "Fresh Paneer (Indian Cottage Cheese)",
      nameHi = "ताजा पनीर (Paneer)",
      category = "Concentrated Slow-Release Casein Protein",
      verdictTag = "⭐⭐⭐⭐⭐ Pure Muscle & Bone Powerhouse",
      topBenefitTitle = "Sabse Bada Fayda: 18.3g Slow-Release Casein Protein & 480mg Massive Calcium",
      topBenefitDesc = "Fresh Paneer is one of the richest whole-food vegetarian sources of concentrated Casein protein (18.3g) and bioavailable calcium (480mg per 100g). Casein forms a sustained gel in the stomach that releases amino acids gradually over 6-8 hours, preventing muscular catabolism during overnight fasting.",
      otherBenefits = listOf(
        "Very low in carbohydrates (only 2.5g), making it ideal for keto, diabetic, and low-carb diets.",
        "Concentrated calcium protects teeth enamel and fortifies bone matrix against fractures.",
        "Contains healthy milk lipids and Conjugated Linoleic Acid (CLA) for hormone synthesis.",
        "Provides substantial sustained satiety, stopping untimely hunger pangs."
      ),
      nutrients = FoodNutrientProfile(
        calories = 265.0,
        protein = 18.3,
        carbs = 2.5,
        fats = 20.8,
        fiber = 0.0,
        sugar = 2.5,
        calciumMg = 480.0,
        ironMg = 0.2,
        magnesiumMg = 25.0,
        potassiumMg = 135.0,
        zincMg = 1.8,
        vitaminA = "680 IU",
        vitaminC = "0 mg",
        vitaminD = "0.5 mcg",
        vitaminBComplex = "Vitamin B12 1.4mcg (58% DV)"
      ),
      whoShouldEat = listOf(
        "Vegetarian bodybuilders, athletes, and gym-goers seeking dense, slow-digesting protein.",
        "Diabetics and individuals on ketogenic or low-carbohydrate nutrition.",
        "Children and adolescents requiring concentrated calcium for bone growth."
      ),
      whenToAvoid = listOf(
        "Severe lactose intolerance or milk protein allergy.",
        "Sedentary individuals with high lipid restrictions should choose low-fat paneer portions."
      ),
      avoidWith = listOf(
        "Avoid deep-frying in reused trans-fat vegetable oils.",
        "Do not combine with sour citrus."
      )
    ),

    FoodAiDetail(
      id = "whole_egg",
      nameEn = "Whole Farm Egg (Anda)",
      nameHi = "पूरा अंडा (Egg)",
      category = "100 Biological Value Complete Protein",
      verdictTag = "⭐⭐⭐⭐⭐ Gold Standard Protein & Brain Choline",
      topBenefitTitle = "Sabse Bada Fayda: Perfect 100 Biological Value Protein & 250mg Brain Choline",
      topBenefitDesc = "Eggs are nature's undisputed benchmark of protein quality with a Biological Value of 100. Containing all 9 essential amino acids in perfect human proportions, the yolk provides 250mg of Choline—the critical precursor for acetylcholine, the neurotransmitter governing memory, focus, and hepatic fat metabolism.",
      otherBenefits = listOf(
        "Supplies Lutein and Zeaxanthin in bioavailable lipid matrix, protecting retinal macular vision.",
        "Rich in Vitamin B12, Riboflavin, Folate, and natural Vitamin D3.",
        "Raises beneficial HDL cholesterol and transforms small dense LDL into benign large buoyant LDL.",
        "High satiety quotient: consuming eggs at breakfast reduces caloric intake over the next 36 hours."
      ),
      nutrients = FoodNutrientProfile(
        calories = 143.0,
        protein = 12.6,
        carbs = 0.7,
        fats = 9.5,
        fiber = 0.0,
        sugar = 0.4,
        calciumMg = 50.0,
        ironMg = 1.75,
        magnesiumMg = 12.0,
        potassiumMg = 126.0,
        zincMg = 1.3,
        vitaminA = "540 IU",
        vitaminC = "0 mg",
        vitaminD = "82 IU",
        vitaminBComplex = "Choline 250mg, Vitamin B12 1.1mcg, Riboflavin 0.45mg"
      ),
      whoShouldEat = listOf(
        "Athletes, fitness professionals, and anyone aiming to build lean muscle mass.",
        "Pregnant women needing Choline for fetal brain development and neural tube closure.",
        "Seniors fighting sarcopenia (age-related muscle loss) and cognitive decline."
      ),
      whenToAvoid = listOf(
        "Individuals with diagnosed clinical egg white allergy (Albumin allergy).",
        "Never consume raw unpasteurized eggs (risk of Salmonella)."
      ),
      avoidWith = listOf(
        "Avoid consuming with raw unheated milk simultaneously.",
        "Do not over-fry in burned vegetable fats."
      )
    ),

    // -------------------------------------------------------------
    // NUTS & SEEDS (ड्राई फ्रूट्स & बीज)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "almonds",
      nameEn = "Soaked Almonds (Badam)",
      nameHi = "भीगे बादाम (Almonds)",
      category = "Vitamin E & Brain Neuro-Protective Nut",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Neuro & Cardiovascular Shield",
      topBenefitTitle = "Sabse Bada Fayda: 25.6mg Vitamin E (170% DV!) Protects Brain & Arterial Walls",
      topBenefitDesc = "Almonds are the richest whole-food tree nut source of natural d-alpha-tocopherol (Vitamin E). Packing 25.6mg per 100g, it halts oxidative degradation of brain neuron lipids and guards cardiovascular endothelial tissue against arterial plaque formation.",
      otherBenefits = listOf(
        "Delivers 21.2g of plant protein and 12.5g of prebiotic fiber per 100g.",
        "High bioavailable Magnesium (270mg) improves cellular insulin signaling and lowers blood pressure.",
        "When soaked overnight, removes enzyme-inhibiting phytic acid, multiplying nutrient absorption.",
        "Monounsaturated oleic acid profile optimizes HDL-to-LDL cholesterol ratio."
      ),
      nutrients = FoodNutrientProfile(
        calories = 579.0,
        protein = 21.2,
        carbs = 21.6,
        fats = 49.9,
        fiber = 12.5,
        sugar = 4.4,
        calciumMg = 264.0,
        ironMg = 3.7,
        magnesiumMg = 270.0,
        potassiumMg = 733.0,
        zincMg = 3.1,
        vitaminA = "1 IU",
        vitaminC = "0 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Vitamin E 25.6mg (170% DV!), Riboflavin 1.1mg, Niacin 3.6mg"
      ),
      whoShouldEat = listOf(
        "Students, researchers, and professionals seeking enhanced mental focus and memory recall.",
        "Cardiac patients and diabetics wanting stable glycemic control and arterial health.",
        "Individuals looking to improve hair follicle strength and skin glow."
      ),
      whenToAvoid = listOf(
        "Individuals with documented tree nut anaphylactic allergies.",
        "Limit to 6-10 soaked almonds daily (high calorie density)."
      ),
      avoidWith = listOf(
        "Avoid eating unsoaked dry raw skins in excessive quantities."
      )
    ),

    FoodAiDetail(
      id = "walnuts",
      nameEn = "Raw Walnuts (Akhrot)",
      nameHi = "अखरोट (Walnuts)",
      category = "Plant-Based Omega-3 Brain Nut",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Plant Omega-3 ALA Champion",
      topBenefitTitle = "Sabse Bada Fayda: 9.1g Plant Omega-3 (ALA) Protects Cognitive Function & Heart",
      topBenefitDesc = "Walnuts look remarkably like the human brain for good reason: they are the only tree nut rich in Alpha-Linolenic Acid (ALA Omega-3, 9.1g per 100g). ALA suppresses neuro-inflammation in the hippocampus, lowers arterial C-reactive protein (CRP), and preserves memory retention.",
      otherBenefits = listOf(
        "Rich in ellagitannins which gut bacteria metabolize into anti-inflammatory Urolithins.",
        "Contains natural bioavailable Melatonin, supporting circadian sleep rhythm regulation.",
        "Reduces diastolic blood pressure and improves vascular flow-mediated dilation.",
        "Supplies 15.2g of complete plant protein and 6.7g of digestive fiber."
      ),
      nutrients = FoodNutrientProfile(
        calories = 654.0,
        protein = 15.2,
        carbs = 13.7,
        fats = 65.2,
        fiber = 6.7,
        sugar = 2.6,
        calciumMg = 98.0,
        ironMg = 2.9,
        magnesiumMg = 158.0,
        potassiumMg = 441.0,
        zincMg = 3.1,
        vitaminA = "20 IU",
        vitaminC = "1.3 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Omega-3 ALA 9.1g, Vitamin B6 0.54mg, Folate 98mcg"
      ),
      whoShouldEat = listOf(
        "Individuals seeking protection against Alzheimer's, memory decline, and cognitive fatigue.",
        "Cardiovascular patients aiming to reduce systemic arterial inflammation.",
        "Vegetarians and vegans needing dense plant-based Omega-3 fatty acids."
      ),
      whenToAvoid = listOf(
        "Tree nut allergies.",
        "Avoid rancid or stale walnuts (polyunsaturated omega-3 fats oxidize if exposed to heat/sunlight)."
      ),
      avoidWith = listOf(
        "Avoid deep roasting at high temperatures."
      )
    ),

    // -------------------------------------------------------------
    // HERBS & SPICES (जड़ी-बूटी & मसाले)
    // -------------------------------------------------------------
    FoodAiDetail(
      id = "haldi",
      nameEn = "Turmeric Root Powder (Haldi)",
      nameHi = "हल्दी (Turmeric)",
      category = "Curcumin Anti-Inflammatory Rasayana",
      verdictTag = "⭐⭐⭐⭐⭐ Supreme Cellular Anti-Inflammatory",
      topBenefitTitle = "Sabse Bada Fayda: Curcumin Inhibits NF-kB Inflammation Cascade & Joint Pain",
      topBenefitDesc = "Haldi contains Curcumin, a polyphenol that directly inhibits the Master Inflammatory Switch NF-kB at the genetic level. It rivals pharmaceutical anti-inflammatory agents without ulcerogenic side effects, providing proven relief in rheumatoid arthritis and systemic inflammation.",
      otherBenefits = listOf(
        "Surges Brain-Derived Neurotrophic Factor (BDNF), encouraging new neural connections.",
        "Powerful hepatic antioxidant: stimulates phase-II detox enzymes and gallbladder motility.",
        "Topical and internal antimicrobial: accelerates wound healing and clears blood toxins.",
        "Improves vascular endothelial function, supporting healthy arterial blood pressure."
      ),
      nutrients = FoodNutrientProfile(
        calories = 312.0,
        protein = 7.8,
        carbs = 64.9,
        fats = 3.2,
        fiber = 21.1,
        sugar = 3.2,
        calciumMg = 182.0,
        ironMg = 41.4,
        magnesiumMg = 193.0,
        potassiumMg = 2080.0,
        zincMg = 4.5,
        vitaminA = "Trace",
        vitaminC = "25.9 mg",
        vitaminD = "0 mcg",
        vitaminBComplex = "Curcuminoids 3-5%, B6 1.8mg"
      ),
      whoShouldEat = listOf(
        "Individuals suffering from joint pain, arthritis, stiffness, or chronic inflammation.",
        "People wanting to protect cardiovascular and brain neuro-cognitive health.",
        "Anyone seeking strong seasonal immune resistance (Golden Turmeric Milk)."
      ),
      whenToAvoid = listOf(
        "Patients with acute active gallbladder obstruction.",
        "Those on high-dose prescription blood thinners prior to major surgical procedures."
      ),
      avoidWith = listOf(
        "CRITICAL: Always consume haldi with black pepper (Piperine increases curcumin bioavailability by 2000%!) and healthy fat (ghee/oil)."
      )
    )
  )
}
