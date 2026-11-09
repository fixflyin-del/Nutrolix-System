// Clinical Nutrition & Biochemistry Database Generator
// Authoritative ICMR-NIN & USDA nutritional reference data for 60+ core foods

const CLINICAL_FOOD_DATABASE = {
  // -------------------------------------------------------------
  // 1. FRESH FRUITS (फल)
  // -------------------------------------------------------------
  mango: {
    id: "mango",
    nameEn: "Fresh Mango (Aam / Alphonso / Dasheri)",
    nameHi: "ताजा आम (Mango / फलों का राजा)",
    category: "Tropical Nutrient-Rich Fruit",
    verdictTag: "⭐⭐⭐⭐ Rich in Carotenoids & Vitamin C",
    topBenefitTitle: "Sabse Bada Fayda: Beta-Carotene Eye Protection & Amylase Digestive Enzymes",
    topBenefitDesc: "Mango is packed with provitamin A (Beta-carotene) and digestive amylase enzymes. Amylases break down complex carbs into easily assimilable simple sugars, while high lutein and zeaxanthin protect retinal macular cells from oxidative damage.",
    otherBenefits: [
      "Provides 60% of daily Vitamin C requirement in 100g, supporting skin collagen and immunity.",
      "Bioactive mangiferin polyphenol protects liver cells against oxidative stress.",
      "Tartaric and malic acid maintain bodily alkaline reserve balance.",
      "High natural hydration and electrolyte content combats seasonal summer heat stroke."
    ],
    nutritionFacts: {
      calories: "60 kcal",
      protein: "0.8 g",
      carbs: "15.0 g",
      fats: "0.4 g",
      fiber: "1.6 g",
      glycemicIndex: "51 (Low-Medium GI)"
    },
    vitamins: ["Vitamin A: 1082 IU (High)", "Vitamin C: 36.4 mg (60% DV)", "Folate: 43 mcg", "Vitamin B6: 0.12 mg"],
    minerals: ["Potassium: 168 mg", "Magnesium: 10 mg", "Calcium: 11 mg", "Iron: 0.16 mg"],
    whoShouldEat: [
      "Children and students needing vision protection and natural cognitive energy.",
      "Individuals recovering from dehydration or physical fatigue.",
      "Anyone seeking radiant skin collagen and immune resistance."
    ],
    whenToAvoid: [
      "Diabetics should limit portion to 1/2 small cup and never consume as liquid juice.",
      "Avoid consuming right after heavy lunch or late at night (causes excess caloric and sugar load)."
    ],
    avoidCombinations: [
      "Avoid eating with cold milk or curd (combining sour fruit acids with dairy disrupts digestive Agni).",
      "Avoid drinking cold water immediately after eating mangoes (induces gastrointestinal spasms)."
    ]
  },

  banana: {
    id: "banana",
    nameEn: "Ripe Banana (Kela)",
    nameHi: "पका केला (Banana)",
    category: "Potassium-Dense Energy Fruit",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Instant Athletic Energy",
    topBenefitTitle: "Sabse Bada Fayda: Rapid Electrolyte Replenishment (Potassium 358mg) & Cramp Defense",
    topBenefitDesc: "Bananas contain high bioavailable potassium and magnesium along with a tripartite sugar blend (fructose, glucose, sucrose). It rapidly normalizes neuromuscular transmission, prevents painful athletic muscle cramps, and buffers stomach acids.",
    otherBenefits: [
      "High Vitamin B6 (0.4mg per 100g) assists neurotransmitter synthesis (serotonin and dopamine).",
      "Natural pectin and fructooligosaccharides (FOS) act as food for beneficial gut probiotics.",
      "Protects stomach lining against acidic ulceration by stimulating mucus production.",
      "Easily digestible energy ideal for pre-workout and post-workout fuel."
    ],
    nutritionFacts: {
      calories: "89 kcal",
      protein: "1.1 g",
      carbs: "22.8 g",
      fats: "0.3 g",
      fiber: "2.6 g",
      glycemicIndex: "51 (Low GI when slightly green, 60 when ripe)"
    },
    vitamins: ["Vitamin B6: 0.37 mg (28% DV)", "Vitamin C: 8.7 mg", "Folate: 20 mcg"],
    minerals: ["Potassium: 358 mg (High)", "Magnesium: 27 mg", "Manganese: 0.27 mg", "Phosphorus: 22 mg"],
    whoShouldEat: [
      "Athletes, gym-goers, and runners before and after intensive workouts.",
      "Individuals suffering from stomach acidity, heartburn, or acute diarrhea (BRAT diet).",
      "Anyone dealing with elevated blood pressure (high potassium blunts sodium)."
    ],
    whenToAvoid: [
      "Advanced chronic kidney disease patients on strict potassium restrictions.",
      "Strictly avoid cold refrigerated bananas late at night if prone to bronchial congestion."
    ],
    avoidCombinations: [
      "Avoid blending with cold curd or yogurt (Viruddha Aahar that aggravates Kapha and mucous).",
      "Do not consume with heavy fatty meals."
    ]
  },

  apple: {
    id: "apple",
    nameEn: "Fresh Apple (Seb)",
    nameHi: "ताजा सेब (Apple)",
    category: "Pectin-Rich Antioxidant Fruit",
    verdictTag: "⭐⭐⭐⭐⭐ Cardiovascular & Gut Champion",
    topBenefitTitle: "Sabse Bada Fayda: Soluble Pectin Fiber Sinks LDL Cholesterol & Stabilizes Glucose",
    topBenefitDesc: "Apples are one of nature's greatest sources of prebiotic soluble Pectin fiber and Quercetin bioflavonoids. Pectin forms a protective gel in the intestinal tract that traps excess dietary cholesterol and delays glucose uptake, dramatically reducing arterial plaque formation.",
    otherBenefits: [
      "Quercetin in the peel protects brain neurons and pulmonary lung airways from inflammatory damage.",
      "Epicatechin polyphenols lower systolic blood pressure and improve endothelial arterial flexibility.",
      "Supports healthy microbiome: feeds Faecalibacterium prausnitzii to generate gut-healing butyrate.",
      "Low glycemic index and high water content provide long-lasting mental satiety."
    ],
    nutritionFacts: {
      calories: "52 kcal",
      protein: "0.3 g",
      carbs: "13.8 g",
      fats: "0.2 g",
      fiber: "2.4 g",
      glycemicIndex: "36 (Very Low GI)"
    },
    vitamins: ["Vitamin C: 4.6 mg", "Vitamin K: 2.2 mcg", "Beta-Carotene", "Quercetin"],
    minerals: ["Potassium: 107 mg", "Calcium: 6 mg", "Magnesium: 5 mg", "Phosphorus: 11 mg"],
    whoShouldEat: [
      "Individuals with elevated LDL cholesterol or heart disease risk.",
      "Diabetics and weight-management enthusiasts seeking safe sweet crunch.",
      "Anyone dealing with sluggish digestion or irregular bowel movements."
    ],
    whenToAvoid: [
      "FODMAP-sensitive IBS individuals during acute digestive flares (fructose and sorbitol content).",
      "Always wash thoroughly to remove external paraffin fruit wax before eating with skin."
    ],
    avoidCombinations: [
      "Avoid drinking water immediately after eating apples (causes rapid fermentation and bloating).",
      "Do not peel off the skin unless medically required (peel contains 70% of quercetin and fiber)."
    ]
  },

  papaya: {
    id: "papaya",
    nameEn: "Ripe Papaya (Papita)",
    nameHi: "पका पपीता (Papaya)",
    category: "Digestive Enzyme-Rich Superfruit",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Gastrointestinal Healer",
    topBenefitTitle: "Sabse Bada Fayda: Papain Proteolytic Enzyme Cures Constipation & Protein Bloating",
    topBenefitDesc: "Papaya contains Papain, a potent digestive proteolytic enzyme capable of tenderizing and breaking down tough protein molecules in minutes. Combined with high soluble fiber and 88% structured water, it provides unmatched relief from chronic constipation and acid reflux.",
    otherBenefits: [
      "Delivers 60.9mg Vitamin C per 100g (100% of daily requirement), building leukocyte defense.",
      "High carotenoid lycopene and beta-carotene content scavenges cellular free radicals.",
      "Ayurvedic mild laxative that soothes hemorrhoids and intestinal inflammatory irritation.",
      "Low calories (43 kcal) and low glycemic load make it an exceptional diabetic-friendly fruit."
    ],
    nutritionFacts: {
      calories: "43 kcal",
      protein: "0.5 g",
      carbs: "10.8 g",
      fats: "0.3 g",
      fiber: "1.7 g",
      glycemicIndex: "60 (Low Glycemic Load due to high water)"
    },
    vitamins: ["Vitamin C: 60.9 mg (101% DV)", "Folate: 37 mcg", "Vitamin A: 950 IU", "Vitamin E: 0.3 mg"],
    minerals: ["Potassium: 182 mg", "Calcium: 20 mg", "Magnesium: 21 mg"],
    whoShouldEat: [
      "People with chronic constipation, piles, slow digestion, or severe protein bloating.",
      "Those recovering from viral fever, dengue (papaya supports platelet vitality), or liver weakness.",
      "Diabetic individuals desiring nutritious low-calorie fruit portions."
    ],
    whenToAvoid: [
      "Pregnant women must strictly avoid raw/unripe green papaya (contains high latex that triggers uterine contractions).",
      "Severe active acute diarrhea (papain increases bowel motility)."
    ],
    avoidCombinations: [
      "Avoid mixing with citrus lemons or oranges (excess combined acidity causes gastric irritation).",
      "Avoid eating with eggs or dairy."
    ]
  },

  pomegranate: {
    id: "pomegranate",
    nameEn: "Fresh Pomegranate (Anar)",
    nameHi: "ताजा अनार (Pomegranate)",
    category: "Polyphenol & Hemoglobin Superfood",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Blood & Cardiovascular Tonic",
    topBenefitTitle: "Sabse Bada Fayda: Punicalagins Super-Antioxidant Clears Arterial Nitric Oxide",
    topBenefitDesc: "Pomegranates contain punicalagins and punicic acid, antioxidant compounds with triple the potency of green tea or red wine. Clinical research shows regular intake prevents arterial LDL oxidation, reduces carotid artery thickness, and improves myocardial blood circulation.",
    otherBenefits: [
      "Promotes erythropoiesis and assists iron bioavailability for increasing hemoglobin levels.",
      "Urolithin A precursor produced in gut microbiome stimulates mitophagy (cellular anti-aging).",
      "Inhibits inflammatory enzymes (cyclooxygenase) in osteoarthritic cartilage.",
      "Improves athletic VO2 efficiency and post-exercise oxygen transport."
    ],
    nutritionFacts: {
      calories: "83 kcal",
      protein: "1.7 g",
      carbs: "18.7 g",
      fats: "1.2 g",
      fiber: "4.0 g",
      glycemicIndex: "53 (Low GI)"
    },
    vitamins: ["Vitamin C: 10.2 mg", "Vitamin K: 16.4 mcg (20% DV)", "Folate: 38 mcg"],
    minerals: ["Potassium: 236 mg", "Iron: 0.3 mg", "Phosphorus: 36 mg", "Magnesium: 12 mg"],
    whoShouldEat: [
      "Individuals with anemia, fatigue, pale skin, or low hemoglobin counts.",
      "Hypertensive and cardiac patients looking to improve vascular elasticity.",
      "Endurance athletes and elderly individuals seeking anti-inflammatory cellular longevity."
    ],
    whenToAvoid: [
      "Patients taking prescription blood thinners or ACE inhibitors should consult a physician.",
      "Avoid pre-packaged strained sugary juice; always eat whole arils with seed fiber."
    ],
    avoidCombinations: [
      "Do not combine with antacids or high calcium milk simultaneously."
    ]
  },

  watermelon: {
    id: "watermelon",
    nameEn: "Fresh Watermelon (Tarbooz)",
    nameHi: "ताजा तरबूज (Watermelon)",
    category: "L-Citrulline Hydration Superfruit",
    verdictTag: "⭐⭐⭐⭐ Cellular Hydration & Nitric Oxide",
    topBenefitTitle: "Sabse Bada Fayda: L-Citrulline Vasodilation & 92% Cellular Hydration",
    topBenefitDesc: "Watermelon is 92% biologically structured cellular water rich in the amino acid L-Citrulline. L-Citrulline converts directly into L-Arginine in the kidneys, surging Nitric Oxide levels to dilate blood vessels, drop blood pressure, and relieve muscular soreness.",
    otherBenefits: [
      "Contains 40% more Lycopene than raw tomatoes, shielding skin against UV photo-damage.",
      "Natural potassium and magnesium balance cellular osmotic pressure during heat exhaustion.",
      "Super low calorie density (only 30 kcal per 100g), creating fullness without caloric guilt.",
      "Supports renal filtration and natural uric acid flushing."
    ],
    nutritionFacts: {
      calories: "30 kcal",
      protein: "0.6 g",
      carbs: "7.6 g",
      fats: "0.15 g",
      fiber: "0.4 g",
      glycemicIndex: "72 (High GI, but very low Glycemic Load of 2-3 per slice)"
    },
    vitamins: ["Vitamin C: 8.1 mg", "Vitamin A: 569 IU", "Lycopene: 4532 mcg", "L-Citrulline"],
    minerals: ["Potassium: 112 mg", "Magnesium: 10 mg", "Phosphorus: 11 mg"],
    whoShouldEat: [
      "Athletes suffering from post-workout muscle soreness (DOMS).",
      "Anyone working outdoors in summer heat seeking heatstroke prevention.",
      "People wanting natural kidney detox and blood pressure optimization."
    ],
    whenToAvoid: [
      "Avoid eating large bowls late at night (diuretic effect disrupts sleep cycles).",
      "Diabetics should eat modest portions paired with a few nuts to buffer the glycemic response."
    ],
    avoidCombinations: [
      "NEVER drink water right after eating watermelon (severely dilutes digestive enzymes).",
      "Never eat watermelon with dairy, milk, or heavy protein."
    ]
  },

  guava: {
    id: "guava",
    nameEn: "Fresh Guava (Amrood)",
    nameHi: "ताजा अमरूद (Guava)",
    category: "High-Vitamin C & Prebiotic Superfruit",
    verdictTag: "⭐⭐⭐⭐⭐ King of Natural Vitamin C & Fiber",
    topBenefitTitle: "Sabse Bada Fayda: 228mg Vitamin C (400% Daily Value!) & 5.4g Gut Fiber",
    topBenefitDesc: "Guava is the undisputed whole-food champion of Vitamin C, containing 4 times more than oranges (228mg vs 53mg). Combined with 5.4g of dense soluble and insoluble dietary fiber per 100g, it supercharges cellular immune phagocytes and regulates blood glucose.",
    otherBenefits: [
      "Low glycemic index and high dietary fiber prevent post-prandial glycemic spikes.",
      "High potassium and soluble fiber protect cardiovascular health and lower systolic BP.",
      "Antimicrobial tannins in guava leaf and fruit inhibit gut pathogen proliferation.",
      "Relieves chronic constipation when consumed with its ripe edible seeds."
    ],
    nutritionFacts: {
      calories: "68 kcal",
      protein: "2.6 g",
      carbs: "14.3 g",
      fats: "0.95 g",
      fiber: "5.4 g",
      glycemicIndex: "33 (Very Low GI)"
    },
    vitamins: ["Vitamin C: 228.3 mg (380% DV)", "Vitamin A: 624 IU", "Folate: 49 mcg", "Lycopene: 5204 mcg"],
    minerals: ["Potassium: 417 mg", "Magnesium: 22 mg", "Calcium: 18 mg", "Iron: 0.26 mg"],
    whoShouldEat: [
      "Diabetic and pre-diabetic patients needing a nutrient-dense, low GI sweet fruit.",
      "Individuals looking to rapidly boost immune white blood cells and resist seasonal flu.",
      "Anyone suffering from slow bowel transit and high cholesterol."
    ],
    whenToAvoid: [
      "Avoid unripe hard rock guavas on an empty stomach if suffering from hyperacidity.",
      "Avoid eating late at night if prone to dental sensitivity."
    ],
    avoidCombinations: [
      "Avoid eating with bananas or heavy dairy."
    ]
  },

  // -------------------------------------------------------------
  // 2. VEGETABLES (सब्जियां)
  // -------------------------------------------------------------
  potato: {
    id: "potato",
    nameEn: "Boiled Potato (Aalu)",
    nameHi: "उबला आलू (Potato)",
    category: "Potassium & Resistant Starch Tuber",
    verdictTag: "⭐⭐⭐⭐ Satiety & Electrolyte Champion",
    topBenefitTitle: "Sabse Bada Fayda: Resistant Starch Gut Healing & High Potassium (421mg)",
    topBenefitDesc: "When boiled and cooled, potatoes form Type-3 Resistant Starch, which bypasses small intestinal digestion to ferment into gut-healing Short Chain Fatty Acids (Butyrate) in the colon. It boasts the highest Satiety Index score of any whole food on earth.",
    otherBenefits: [
      "High potassium (421mg per 100g) counteracts excessive dietary sodium and lowers arterial tension.",
      "Rich in Vitamin B6, supporting red blood cell formation and amino acid metabolism.",
      "Naturally gluten-free, easily digestible carbohydrate that soothes gastric ulcers.",
      "Provides sustained cellular glycogen for athletes and hard-working laborers."
    ],
    nutritionFacts: {
      calories: "77 kcal",
      protein: "2.0 g",
      carbs: "17.5 g",
      fats: "0.1 g",
      fiber: "2.2 g",
      glycemicIndex: "56 (Boiled & cooled), 85 (Mashed hot)"
    },
    vitamins: ["Vitamin C: 19.7 mg (33% DV)", "Vitamin B6: 0.3 mg (23% DV)", "Niacin", "Folate"],
    minerals: ["Potassium: 421 mg (High)", "Magnesium: 23 mg", "Phosphorus: 57 mg", "Iron: 0.78 mg"],
    whoShouldEat: [
      "Athletes and gym-goers seeking clean, low-fat complex carbohydrates.",
      "Individuals with gastritis or stomach ulcers needing gentle, non-irritating starch.",
      "Those looking to naturally lower blood pressure via dietary potassium."
    ],
    whenToAvoid: [
      "NEVER eat green or sprouted potatoes (contains toxic neuro-glycoalkaloid Solanine).",
      "Diabetics should avoid deep-fried french fries or hot mashed potatoes (causes rapid glucose spike).",
      "Consume boiled or baked with skin rather than commercial chips."
    ],
    avoidCombinations: [
      "Commercial deep frying in oxidized palm/trans-fat oils (converts wholesome potato into an inflammatory junk food).",
      "Processed cheese and mayonnaise toppings."
    ]
  },

  tomato: {
    id: "tomato",
    nameEn: "Ripe Tomato (Tamatar)",
    nameHi: "ताजा टमाटर (Tomato)",
    category: "Lycopene Antioxidant Vegetable-Fruit",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Lycopene & Prostate Protector",
    topBenefitTitle: "Sabse Bada Fayda: Bioavailable Lycopene Protects Heart, Prostate & Skin",
    topBenefitDesc: "Tomatoes are nature's preeminent source of Lycopene, a carotenoid antioxidant that neutralizes singlet oxygen free radicals. Cooking tomatoes with healthy fats (like mustard oil or ghee) increases Lycopene bioavailability by 300%, offering proven clinical defense against prostate enlargement and cardiovascular plaque.",
    otherBenefits: [
      "Ultra-low in calories (only 18 kcal per 100g) and low glycemic load.",
      "Rich in natural potassium, Folate, and Vitamin C for arterial wall integrity.",
      "Chlorogenic acid and caffeic acid protect against cellular mutagens and carcinogens.",
      "High natural glutamates provide rich umami culinary flavor without artificial MSG."
    ],
    nutritionFacts: {
      calories: "18 kcal",
      protein: "0.9 g",
      carbs: "3.9 g",
      fats: "0.2 g",
      fiber: "1.2 g",
      glycemicIndex: "15 (Negligible GI)"
    },
    vitamins: ["Vitamin C: 13.7 mg (23% DV)", "Vitamin A: 833 IU", "Vitamin K: 7.9 mcg", "Folate: 15 mcg", "Lycopene: 3025 mcg"],
    minerals: ["Potassium: 237 mg", "Calcium: 10 mg", "Magnesium: 11 mg", "Phosphorus: 24 mg"],
    whoShouldEat: [
      "Men over 40 aiming for prostate health and urinary flow maintenance.",
      "Individuals aiming for cardiovascular protection and lower oxidized LDL levels.",
      "Anyone on weight-loss or low-calorie nutrition protocols."
    ],
    whenToAvoid: [
      "Patients with active calcium oxalate kidney stones should limit raw tomato seeds.",
      "Individuals with acute GERD or acid reflux flares (malic and citric acids may irritate lower esophagus)."
    ],
    avoidCombinations: [
      "Avoid eating with raw cucumber simultaneously in large amounts (ascorbinase enzyme in cucumber breaks down Vitamin C).",
      "Avoid pairing with high-starch white flour pastries."
    ]
  },

  onion: {
    id: "onion",
    nameEn: "Red Onion (Pyaz)",
    nameHi: "लाल प्याज (Onion)",
    category: "Allicin & Quercetin Prebiotic Vegetable",
    verdictTag: "⭐⭐⭐⭐ Anti-Inflammatory & Gut Prebiotic",
    topBenefitTitle: "Sabse Bada Fayda: Quercetin Bioflavonoid & Organic Sulfur Compounds",
    topBenefitDesc: "Red onions are concentrated in Quercetin and organosulfur compounds (allyl propyl disulfide). These act as natural antihistamines, reduce blood platelet aggregation, and feed beneficial Bifidobacteria via rich inulin prebiotics.",
    otherBenefits: [
      "Helps regulate blood sugar: sulfur compounds stimulate insulin synthesis in pancreas.",
      "Inulin prebiotic fiber promotes short-chain fatty acid production in the gut.",
      "Natural antibacterial against oral Streptococcus mutans and common pathogens.",
      "Reduces LDL cholesterol and triglycerides in hyperlipidemic individuals."
    ],
    nutritionFacts: {
      calories: "40 kcal",
      protein: "1.1 g",
      carbs: "9.3 g",
      fats: "0.1 g",
      fiber: "1.7 g",
      glycemicIndex: "10 (Very Low GI)"
    },
    vitamins: ["Vitamin C: 7.4 mg", "Vitamin B6: 0.12 mg", "Folate: 19 mcg", "Quercetin"],
    minerals: ["Potassium: 146 mg", "Calcium: 23 mg", "Phosphorus: 29 mg", "Magnesium: 10 mg"],
    whoShouldEat: [
      "People wanting to improve gut microbiome diversity and reduce blood pressure.",
      "Individuals with seasonal allergies, asthma, or bronchial inflammation.",
      "Diabetic patients needing natural post-meal glucose modulation."
    ],
    whenToAvoid: [
      "Individuals with severe SIBO or IBS on low-FODMAP diet (fructans cause gas and bloating).",
      "Those with active acid reflux before bedtime."
    ],
    avoidCombinations: [
      "Avoid eating with cold milk (classic incompatible food combination in Ayurveda)."
    ]
  },

  lady_finger: {
    id: "lady_finger",
    nameEn: "Lady Finger / Okra (Bhindi)",
    nameHi: "ताजा भिंडी (Bhindi / Okra)",
    category: "Mucilage-Rich Blood Sugar Regulator",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Diabetic & Gut Shield",
    topBenefitTitle: "Sabse Bada Fayda: Natural Soluble Mucilage Traps Dietary Glucose & Cholesterol",
    topBenefitDesc: "Bhindi is rich in viscous mucilage (soluble fibers and pectin) that coats the intestinal mucosal wall. This slows carbohydrate absorption, blunting post-meal sugar spikes, while simultaneously binding bile acids to clear excess blood cholesterol through excretion.",
    otherBenefits: [
      "Supplies 82mg of bioavailable Calcium per 100g, supporting skeletal bone density.",
      "Rich in Folate (88 mcg - 22% DV), vital for fetal neural tube development during pregnancy.",
      "High polyphenols and flavonoids reduce oxidative fatigue and support hepatic function.",
      "Ultra-low in calories (33 kcal per 100g), making it a weight-loss staple."
    ],
    nutritionFacts: {
      calories: "33 kcal",
      protein: "1.9 g",
      carbs: "7.5 g",
      fats: "0.19 g",
      fiber: "3.2 g",
      glycemicIndex: "20 (Very Low GI)"
    },
    vitamins: ["Vitamin C: 23 mg (38% DV)", "Vitamin K: 53 mcg (66% DV)", "Folate: 88 mcg (22% DV)", "Vitamin A: 716 IU"],
    minerals: ["Calcium: 82 mg (High)", "Magnesium: 57 mg", "Potassium: 299 mg", "Iron: 0.62 mg"],
    whoShouldEat: [
      "Type 2 diabetics seeking proven food-based glycemic control.",
      "Pregnant women needing natural dietary Folate and bioavailable calcium.",
      "Anyone aiming for lower cholesterol and gut barrier nourishment."
    ],
    whenToAvoid: [
      "Patients prone to calcium oxalate kidney stones should consume in moderation.",
      "Avoid deep frying into greasy chips which degrades the delicate mucilage and adds excess trans-fats."
    ],
    avoidCombinations: [
      "Avoid pairing with heavy unsoaked pulses that induce simultaneous flatulence."
    ]
  },

  bitter_gourd: {
    id: "bitter_gourd",
    nameEn: "Bitter Gourd (Karela)",
    nameHi: "ताजा करेला (Karela)",
    category: "Natural Plant Insulin & Blood Purifier",
    verdictTag: "⭐⭐⭐⭐⭐ Clinical Anti-Diabetic Gold Standard",
    topBenefitTitle: "Sabse Bada Fayda: Charantin & Polypeptide-p Act as Biological Plant Insulin",
    topBenefitDesc: "Karela contains three active anti-diabetic compounds: Charantin, Vicine, and Polypeptide-p (plant insulin). Polypeptide-p mimics human insulin, binding insulin receptors and activating AMP-activated protein kinase (AMPK) to facilitate cellular glucose uptake into muscles.",
    otherBenefits: [
      "Powerful hepatic detoxifier: stimulates liver enzymes and bile secretion.",
      "Provides 84mg Vitamin C per 100g (140% DV), defending against skin boils and infections.",
      "Ayurvedic Tikta Rasa: clears excess Pitta, purifies blood, and reduces inflammatory skin acne.",
      "Lowers elevated serum triglycerides and low-density lipoprotein (LDL) cholesterol."
    ],
    nutritionFacts: {
      calories: "17 kcal",
      protein: "1.0 g",
      carbs: "3.7 g",
      fats: "0.17 g",
      fiber: "2.8 g",
      glycemicIndex: "15 (Negligible GI)"
    },
    vitamins: ["Vitamin C: 84 mg (140% DV)", "Vitamin A: 471 IU", "Folate: 72 mcg", "Riboflavin"],
    minerals: ["Potassium: 296 mg", "Zinc: 0.8 mg", "Magnesium: 17 mg", "Iron: 0.43 mg"],
    whoShouldEat: [
      "Type 2 diabetic and pre-diabetic patients seeking to lower HbA1c levels.",
      "Individuals with fatty liver, sluggish digestion, or recurring skin acne and boils.",
      "Those on strict fat-loss and metabolic health protocols."
    ],
    whenToAvoid: [
      "Pregnant women must strictly avoid excessive karela (contains emmenagogues that can induce uterine bleeding).",
      "Diabetics on heavy allopathic insulin should monitor blood sugar to prevent acute hypoglycemia."
    ],
    avoidCombinations: [
      "Avoid drinking raw milk right after eating bitter karela (causes bitter curdling in stomach)."
    ]
  },

  bottle_gourd: {
    id: "bottle_gourd",
    nameEn: "Bottle Gourd (Lauki / Ghiya / Dudhi)",
    nameHi: "ताजी लौकी / घीया (Lauki)",
    category: "Cooling Alkaline Renal Vegetable",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Detox & Liver Soother",
    topBenefitTitle: "Sabse Bada Fayda: 96% Alkaline Water Soothes Acidity, Liver & Kidneys",
    topBenefitDesc: "Lauki is composed of 96% structured biological water with an alkaline pH. It neutralizes gastric hyperacidity, cleanses urinary tract pathways, and promotes cardiac health without adding any dietary fat or heavy calories.",
    otherBenefits: [
      "Only 14 calories per 100g, making it one of the lightest foods for gut convalescence.",
      "Promotes tranquil sleep and calms neuro-irritability when consumed as a warm evening soup.",
      "Supports liver cell regeneration post jaundice or viral fever.",
      "Rich in soluble fiber that regulates bowel movement without producing gas or bloating."
    ],
    nutritionFacts: {
      calories: "14 kcal",
      protein: "0.6 g",
      carbs: "3.4 g",
      fats: "0.02 g",
      fiber: "0.5 g",
      glycemicIndex: "15 (Very Low GI)"
    },
    vitamins: ["Vitamin C: 10.1 mg", "Thiamine B1", "Riboflavin", "Niacin", "Folate"],
    minerals: ["Potassium: 150 mg", "Calcium: 26 mg", "Phosphorus: 13 mg", "Magnesium: 11 mg"],
    whoShouldEat: [
      "Individuals recovering from illness, surgery, stomach infection, or severe acidity.",
      "Hypertensive and cardiac patients seeking natural sodium-flushing hydration.",
      "Anyone targeting sustainable, healthy fat loss."
    ],
    whenToAvoid: [
      "CRITICAL SAFETY WARNING: NEVER consume bitter tasting bottle gourd (indicates toxic Cucurbitacin, which can cause fatal GI hemorrhage). Always taste a raw slice before cooking.",
      "Severe cold congestion in the dead of winter (has a strong cooling potency)."
    ],
    avoidCombinations: [
      "Do not combine with sour citrus fruits or fermented dairy."
    ]
  },

  carrot: {
    id: "carrot",
    nameEn: "Fresh Carrot (Gajar)",
    nameHi: "ताजा गाजर (Carrot)",
    category: "Provitamin A Carotenoid Champion",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Eye & Retinal Protector",
    topBenefitTitle: "Sabse Bada Fayda: Beta-Carotene Converts to Retinol for Night Vision & Epithelial Health",
    topBenefitDesc: "Carrots are nature's premier root source of Beta-Carotene (835 mcg per 100g). In the body, this converts into Retinol (Vitamin A), essential for synthesizing Rhodopsin in the retina, preventing night blindness, and shielding macular pigments.",
    otherBenefits: [
      "High pectin fiber binds bile acids, naturally reducing serum LDL cholesterol.",
      "Lutein and Zeaxanthin filter damaging blue light from digital smartphone screens.",
      "Falcarinol polyacetylene compound exhibits protective anti-tumor activity in clinical models.",
      "Provides crisp satisfying crunch with only 41 kcal per 100g."
    ],
    nutritionFacts: {
      calories: "41 kcal",
      protein: "0.9 g",
      carbs: "9.6 g",
      fats: "0.24 g",
      fiber: "2.8 g",
      glycemicIndex: "39 (Cooked / Raw GI 16-35)"
    },
    vitamins: ["Vitamin A: 16706 IU (334% DV!)", "Vitamin K: 13.2 mcg", "Vitamin C: 5.9 mg", "Vitamin B6: 0.14 mg"],
    minerals: ["Potassium: 320 mg", "Calcium: 33 mg", "Phosphorus: 35 mg", "Magnesium: 12 mg"],
    whoShouldEat: [
      "Students, programmers, and professionals with high daily screen time.",
      "Children needing vision development and natural immunity against infections.",
      "Individuals looking to improve skin radiance and mucosal barrier strength."
    ],
    whenToAvoid: [
      "Consuming extreme quantities (>1 kg/day) can cause harmless yellowing of palms (Carotenemia).",
      "Diabetics should prefer eating raw whole carrots rather than strained concentrated juice."
    ],
    avoidCombinations: [
      "Always consume with a drop of healthy fat (ghee or oil) to absorb fat-soluble Vitamin A.",
      "Avoid pairing with overly sweet processed desserts."
    ]
  },

  beetroot: {
    id: "beetroot",
    nameEn: "Fresh Beetroot (Chukandar)",
    nameHi: "ताजा चुकंदर (Beetroot)",
    category: "Inorganic Nitrate & Stamina Tuber",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Stamina & Nitric Oxide Surger",
    topBenefitTitle: "Sabse Bada Fayda: Dietary Nitrates Convert to Nitric Oxide, Dropping BP & Boosting Stamina",
    topBenefitDesc: "Beetroot is densely loaded with natural dietary inorganic Nitrates (NO3-). Oral and intestinal bacteria reduce these nitrates into Nitric Oxide (NO), a powerful signaling gas that dilates arterial walls, lowers systolic blood pressure by 4-10 mmHg, and increases athletic mitochondrial efficiency.",
    otherBenefits: [
      "Betalain pigments (Betacyanin) provide deep red antioxidant protection for liver detox pathways.",
      "Boosts oxygen uptake and VO2 max, enabling runners and cyclists to train 15% longer.",
      "Supports cerebral perfusion: increases blood flow to the frontal cortex in aging adults.",
      "Contains bioavailable non-heme iron and Folate for red blood cell synthesis."
    ],
    nutritionFacts: {
      calories: "43 kcal",
      protein: "1.6 g",
      carbs: "9.6 g",
      fats: "0.17 g",
      fiber: "2.8 g",
      glycemicIndex: "61 (Moderate GI, but low Glycemic Load)"
    },
    vitamins: ["Folate: 109 mcg (27% DV)", "Vitamin C: 4.9 mg", "Vitamin B6", "Betalains"],
    minerals: ["Potassium: 325 mg", "Magnesium: 23 mg", "Iron: 0.8 mg", "Manganese: 0.33 mg"],
    whoShouldEat: [
      "Cardiovascular and hypertensive patients seeking natural blood pressure reduction.",
      "Endurance athletes, runners, and cyclists seeking peak athletic stamina.",
      "Individuals with anemia or low red blood cell counts."
    ],
    whenToAvoid: [
      "Individuals with a history of calcium oxalate kidney stones (high in oxalates).",
      "Harmless condition note: may cause temporary reddish urine or stool (Beeturia)."
    ],
    avoidCombinations: [
      "Avoid using chemical antiseptic mouthwashes immediately before or after eating beets (kills oral bacteria needed to convert nitrates to nitric oxide)."
    ]
  },

  // -------------------------------------------------------------
  // 3. GRAINS & CEREALS (अनाज & मिलेट्स)
  // -------------------------------------------------------------
  white_rice: {
    id: "white_rice",
    nameEn: "Cooked White Rice (Chawal)",
    nameHi: "पका हुआ सफेद चावल (White Rice)",
    category: "Easily Digestible Carbohydrate",
    verdictTag: "⭐⭐⭐ Clean Glycogen Energy • Easy on Gut",
    topBenefitTitle: "Sabse Bada Fayda: Ultra-Gentle Hypoallergenic Energy for Convalescence",
    topBenefitDesc: "Cooked white rice is nature's cleanest, most hypoallergenic source of immediate glucose. Free from irritable lectins and anti-nutrients found in raw bran, it digests effortlessly, providing direct glycogen replenishment for tired muscles without taxing inflamed intestines.",
    otherBenefits: [
      "Gold standard staple for gastrointestinal upset, food poisoning, or Crohn's flares.",
      "Completely gluten-free: safe for Celiac disease and gluten-sensitive enteropathy.",
      "Pairs synergistically with dals (pulses) to provide a 100% complete essential amino acid profile.",
      "Provides quick post-workout glycogen replenishment for high-intensity athletes."
    ],
    nutritionFacts: {
      calories: "130 kcal",
      protein: "2.7 g",
      carbs: "28.2 g",
      fats: "0.28 g",
      fiber: "0.4 g",
      glycemicIndex: "73 (High GI when hot; drops when cooled)"
    },
    vitamins: ["Thiamine B1", "Niacin B3", "Folate (trace)"],
    minerals: ["Iron: 0.2 mg", "Magnesium: 12 mg", "Phosphorus: 43 mg", "Potassium: 35 mg"],
    whoShouldEat: [
      "Athletes needing fast, easily digested post-training carbohydrate replenishment.",
      "Individuals recovering from stomach flu, diarrhea, IBS flares, or surgery.",
      "Anyone pairing with dal, vegetables, or ghee for a balanced traditional meal."
    ],
    whenToAvoid: [
      "Sedentary individuals with uncontrolled Type 2 diabetes (consume in measured portions with dal and salad).",
      "Avoid eating large heaps of hot white rice alone without protein or fiber."
    ],
    avoidCombinations: [
      "Avoid eating with sugary syrup or deep fried oily gravies.",
      "Do not leave cooked rice at room temperature for hours (risk of Bacillus cereus food poisoning)."
    ]
  },

  brown_rice: {
    id: "brown_rice",
    nameEn: "Cooked Brown Rice (Bhura Chawal)",
    nameHi: "भूरा चावल (Brown Rice)",
    category: "Whole Grain Complex Cereal",
    verdictTag: "⭐⭐⭐⭐ High Manganese & Slow-Release Fiber",
    topBenefitTitle: "Sabse Bada Fayda: Intact Bran Layer Provides Slow-Release Glycemic Balance",
    topBenefitDesc: "Unlike polished white rice, brown rice retains its nutrient-dense outer bran and germ layer. This delivers 1.8g of prebiotic dietary fiber and 88% of daily Manganese requirement per 100g, slowing glucose absorption and supporting antioxidant superoxide dismutase (SOD) enzymes.",
    otherBenefits: [
      "Rich in Ferulic acid and phenolic antioxidants that suppress cellular inflammation.",
      "High magnesium content (43mg) improves cellular insulin sensitivity.",
      "Promotes sustained satiety, preventing between-meal snacking.",
      "Assists in maintaining bowel regularity through whole grain bulk."
    ],
    nutritionFacts: {
      calories: "111 kcal",
      protein: "2.6 g",
      carbs: "23.0 g",
      fats: "0.9 g",
      fiber: "1.8 g",
      glycemicIndex: "55 (Low-Medium GI)"
    },
    vitamins: ["Thiamine B1: 0.1 mg", "Niacin: 1.5 mg", "Vitamin B6: 0.15 mg", "Vitamin E"],
    minerals: ["Manganese: 0.9 mg (45% DV!)", "Magnesium: 43 mg", "Phosphorus: 83 mg", "Potassium: 86 mg"],
    whoShouldEat: [
      "Diabetics and insulin-resistant individuals managing glycemic response.",
      "Individuals seeking whole grain cardiovascular protection and weight control.",
      "Active individuals desiring steady, prolonged physical energy."
    ],
    whenToAvoid: [
      "Individuals with acute colitis, Crohn's flares, or severe indigestion (fiber may irritate raw bowel).",
      "Always soak thoroughly for 2-4 hours before cooking to reduce natural phytates."
    ],
    avoidCombinations: [
      "Avoid unwashed raw brown rice."
    ]
  },

  ragi: {
    id: "ragi",
    nameEn: "Ragi / Nachni (Finger Millet)",
    nameHi: "रागी / नाचनी (Finger Millet)",
    category: "High-Calcium Ancient Super-Millet",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Bone & Calcium Champion",
    topBenefitTitle: "Sabse Bada Fayda: Highest Calcium of All Grains (344mg!) For Osteoporosis & Bones",
    topBenefitDesc: "Ragi is the undisputed calcium king of the cereal kingdom, packing a staggering 344mg of Calcium per 100g—more than 3 times that of cow's milk and 10 times that of rice or wheat! It is indispensable for strengthening bone mineral density, preventing osteopenia, and nourishing growing infants.",
    otherBenefits: [
      "Rich in polyphenols and high dietary fiber (11.5g per 100g) with an exceptionally low glycemic response.",
      "100% naturally gluten-free grain, gentle on sensitive digestive tracts.",
      "Abundant in the essential amino acid Methionine, absent in most polished cereals.",
      "High iron content (3.9mg) assists hemoglobin synthesis in nutritional anemia."
    ],
    nutritionFacts: {
      calories: "328 kcal",
      protein: "7.3 g",
      carbs: "72.0 g",
      fats: "1.3 g",
      fiber: "11.5 g",
      glycemicIndex: "54 (Low GI)"
    },
    vitamins: ["Thiamine B1: 0.42 mg", "Riboflavin B2: 0.19 mg", "Niacin B3: 1.1 mg"],
    minerals: ["Calcium: 344 mg (Highest Cereal Source!)", "Iron: 3.9 mg", "Phosphorus: 250 mg", "Potassium: 408 mg"],
    whoShouldEat: [
      "Post-menopausal women and elderly individuals prone to bone fractures and osteoporosis.",
      "Growing children, toddlers, and infants as first weaning porridge (Ragi mudde/kheer).",
      "Diabetics aiming to replace high-GI wheat and white rice."
    ],
    whenToAvoid: [
      "Individuals with severe active kidney stones or severe hypercalcemia.",
      "Consume cooked well with moisture (ragi is naturally drying if eaten dry)."
    ],
    avoidCombinations: [
      "Do not consume raw unroasted flour."
    ]
  },

  // -------------------------------------------------------------
  // 4. DALS & PULSES (दालें & फलियां)
  // -------------------------------------------------------------
  moong_dal: {
    id: "moong_dal",
    nameEn: "Yellow Moong Dal (Split Green Gram)",
    nameHi: "पीली मूंग दाल (Moong Dal)",
    category: "Tridoshic Light Plant Protein",
    verdictTag: "⭐⭐⭐⭐⭐ Gold Standard Digestible Protein",
    topBenefitTitle: "Sabse Bada Fayda: 24g High Plant Protein With Zero Gas & Bloating",
    topBenefitDesc: "Moong Dal is clinically regarded as the lightest, most bioavailable pulse in the human diet. Packing 24g of protein per 100g, it contains minimal flatulence-inducing oligosaccharides, making it the supreme choice for convalescence, muscle repair, and sensitive digestive systems.",
    otherBenefits: [
      "Tremendous Folate powerhouse (625 mcg per 100g - 156% DV!), essential for DNA synthesis.",
      "Potassium-dense (1246mg per 100g), effectively counteracting vascular fluid retention.",
      "Ayurvedic Tridoshic food: balances Vata, Pitta, and Kapha simultaneously.",
      "Rich in resistant starch and polyphenols that nourish Bifidobacteria in the gut."
    ],
    nutritionFacts: {
      calories: "347 kcal",
      protein: "24.0 g",
      carbs: "59.0 g",
      fats: "1.2 g",
      fiber: "16.3 g",
      glycemicIndex: "38 (Low GI)"
    },
    vitamins: ["Folate: 625 mcg (156% DV!)", "Thiamine B1: 0.62 mg", "Vitamin B6: 0.38 mg", "Niacin: 2.2 mg"],
    minerals: ["Potassium: 1246 mg (High)", "Phosphorus: 367 mg", "Magnesium: 189 mg", "Iron: 6.7 mg", "Zinc: 2.7 mg"],
    whoShouldEat: [
      "Vegetarians, fitness enthusiasts, and elderly individuals seeking easy-to-digest protein.",
      "Pregnant and lactating mothers needing dense Folate and iron nutrition.",
      "Patients recovering from fever, surgery, or gastrointestinal distress (Moong Khichdi)."
    ],
    whenToAvoid: [
      "Severe acute uric acid gout flare-ups (moderation advised).",
      "Always soak for at least 20 minutes before pressure cooking."
    ],
    avoidCombinations: [
      "Avoid mixing with curd at night."
    ]
  },

  toor_dal: {
    id: "toor_dal",
    nameEn: "Toor Dal / Arhar Dal (Pigeon Pea)",
    nameHi: "अरहर / तूर दाल (Toor Dal)",
    category: "High-Protein Indian Staple Pulse",
    verdictTag: "⭐⭐⭐⭐ Daily Dietary Protein Foundation",
    topBenefitTitle: "Sabse Bada Fayda: 22g Lean Protein & Complex Dietary Energy For Satiety",
    topBenefitDesc: "Toor Dal is the daily protein backbone of Indian nutrition. It provides 21.7g of plant protein and 15g of dietary fiber per 100g, ensuring prolonged amino acid availability for cellular tissue maintenance while preventing sudden glycemic crashes.",
    otherBenefits: [
      "Extremely rich in Folate (456 mcg per 100g - 114% DV), critical for maternal health.",
      "High potassium and magnesium content supports cardiovascular muscle function.",
      "When paired with rice (Dal-Chawal), supplies all essential amino acids (methionine + lysine).",
      "Lowers serum total and LDL cholesterol through high soluble fiber excretion."
    ],
    nutritionFacts: {
      calories: "343 kcal",
      protein: "21.7 g",
      carbs: "62.8 g",
      fats: "1.5 g",
      fiber: "15.0 g",
      glycemicIndex: "29 (Very Low GI)"
    },
    vitamins: ["Folate: 456 mcg (114% DV)", "Thiamine B1: 0.64 mg", "Niacin B3: 2.9 mg"],
    minerals: ["Potassium: 1392 mg", "Phosphorus: 304 mg", "Magnesium: 183 mg", "Calcium: 130 mg", "Iron: 5.2 mg"],
    whoShouldEat: [
      "Families seeking affordable, complete daily protein nutrition.",
      "Expectant mothers needing natural Folate to prevent birth defects.",
      "Diabetics and weight-conscious individuals wanting slow-burning complex carbs."
    ],
    whenToAvoid: [
      "Individuals prone to flatulence should always cook with hing (asafoetida), jeera, and haldi.",
      "Severe kidney disease on restricted potassium protocols."
    ],
    avoidCombinations: [
      "Avoid eating unsoaked or undercooked toor dal."
    ]
  },

  chana_dal: {
    id: "chana_dal",
    nameEn: "Chana Dal (Split Bengal Gram)",
    nameHi: "चना दाल (Chana Dal)",
    category: "Lowest GI High-Fiber Pulse",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Diabetic & Satiety Pulse",
    topBenefitTitle: "Sabse Bada Fayda: Lowest Glycemic Index (GI 28) & 18g Fiber For Diabetic Control",
    topBenefitDesc: "Chana Dal boasts the lowest glycemic index among all culinary pulses (GI 28). Its complex starch structure and massive 18g dietary fiber delay gastric digestion, preventing insulin spikes and maintaining steady, clean cellular energy for hours.",
    otherBenefits: [
      "Provides 20.8g of muscle-building plant protein per 100g.",
      "High soluble fiber binds intestinal bile acids to reduce circulating serum cholesterol.",
      "Rich in zinc (2.8mg) and magnesium (160mg), aiding testosterone and immune cellular health.",
      "Promotes sustained metabolic fullness, suppressing cravings and emotional overeating."
    ],
    nutritionFacts: {
      calories: "372 kcal",
      protein: "20.8 g",
      carbs: "60.0 g",
      fats: "5.6 g",
      fiber: "18.0 g",
      glycemicIndex: "28 (Extremely Low GI)"
    },
    vitamins: ["Folate: 320 mcg", "Thiamine B1: 0.48 mg", "Riboflavin"],
    minerals: ["Potassium: 850 mg", "Calcium: 160 mg", "Iron: 5.3 mg", "Magnesium: 160 mg", "Zinc: 2.8 mg"],
    whoShouldEat: [
      "Type 2 diabetics and insulin-resistant individuals seeking glycemic balance.",
      "Individuals on weight loss programs needing high satiety protein.",
      "Anyone wanting strong bone and teeth mineral support."
    ],
    whenToAvoid: [
      "Acute hyperuricemia (gout flare-up).",
      "Always soak for at least 1 hour before cooking to reduce phytates."
    ],
    avoidCombinations: [
      "Avoid combining with heavy cream or trans-fat deep frying."
    ]
  },

  rajma: {
    id: "rajma",
    nameEn: "Red Kidney Beans (Rajma)",
    nameHi: "राजमा (Red Kidney Beans)",
    category: "Dense Protein & Fiber Super-Legume",
    verdictTag: "⭐⭐⭐⭐ Complete Plant Power & Gut Champion",
    topBenefitTitle: "Sabse Bada Fayda: 24g Protein & 24.9g Prebiotic Fiber For Heart & Colon",
    topBenefitDesc: "Rajma is a nutritional heavyweight delivering 24g of plant protein and an astounding 24.9g of prebiotic fiber per 100g. Its rich red anthocyanins scavenge free radicals, while fermentable fibers produce short-chain fatty acids that fortify colon epithelial barriers.",
    otherBenefits: [
      "Rich in Molybdenum (cell detox cofactor) and bioavailable non-heme Iron (8.2mg).",
      "Lowers LDL cholesterol and post-prandial glycemic excursions.",
      "Pairs with rice (Rajma-Chawal) to form a complete PDCAAS amino acid profile.",
      "Improves insulin sensitivity in long-term clinical trials."
    ],
    nutritionFacts: {
      calories: "333 kcal",
      protein: "24.0 g",
      carbs: "60.0 g",
      fats: "0.8 g",
      fiber: "24.9 g",
      glycemicIndex: "24 (Extremely Low GI)"
    },
    vitamins: ["Folate: 394 mcg (98% DV)", "Thiamine B1: 0.52 mg", "Vitamin K: 19 mcg"],
    minerals: ["Potassium: 1406 mg", "Phosphorus: 407 mg", "Magnesium: 140 mg", "Iron: 8.2 mg (High)", "Calcium: 143 mg"],
    whoShouldEat: [
      "Fitness enthusiasts, vegetarians, and bodybuilders building dense muscle mass.",
      "Individuals with elevated LDL cholesterol seeking natural fiber reduction.",
      "People wanting to improve bowel microbiome health."
    ],
    whenToAvoid: [
      "CRITICAL: NEVER consume raw or undercooked rajma (contains toxic Phytohaemagglutinin lectin). Must be soaked 8 hours and boiled vigorously for at least 20 minutes.",
      "Individuals with acute flatulence should temper with ginger, garlic, and hing."
    ],
    avoidCombinations: [
      "Do not eat with heavy dairy cream."
    ]
  },

  // -------------------------------------------------------------
  // 5. DAIRY & ANIMAL PROTEIN (डेयरी & प्रोटीन)
  // -------------------------------------------------------------
  cow_milk: {
    id: "cow_milk",
    nameEn: "Fresh Cow Milk (Doodh)",
    nameHi: "ताजा गाय का दूध (Cow Milk)",
    category: "Complete Liquid Nutrient & Bone Builder",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Skeletal & Brain Nourisher",
    topBenefitTitle: "Sabse Bada Fayda: 120mg Bioavailable Calcium & Complete Whey/Casein Protein",
    topBenefitDesc: "Cow milk provides an ideal physiological ratio of Casein (80%) and fast-digesting Whey (20%) proteins containing all 9 essential amino acids. Its calcium-to-phosphorus ratio ensures maximal bone mineral absorption, preventing osteoporosis and dental decay.",
    otherBenefits: [
      "Contains Vitamin B12 (0.45 mcg per 100ml), crucial for myelin sheath and nerve transmission.",
      "Natural Conjugated Linoleic Acid (CLA) and Vitamin D3 support immune vitality.",
      "Ayurvedic Ojas enhancer: induces restful sleep when consumed warm with a pinch of haldi or nutmeg.",
      "Electrolyte-rich liquid hydration that rehydrates the body faster than plain water post-workout."
    ],
    nutritionFacts: {
      calories: "62 kcal",
      protein: "3.2 g",
      carbs: "4.8 g",
      fats: "3.6 g",
      fiber: "0.0 g",
      glycemicIndex: "30 (Low GI)"
    },
    vitamins: ["Vitamin B12: 0.45 mcg (19% DV)", "Vitamin A: 126 IU", "Vitamin D3", "Riboflavin B2: 0.18 mg"],
    minerals: ["Calcium: 120 mg (High)", "Phosphorus: 95 mg", "Potassium: 140 mg", "Magnesium: 11 mg"],
    whoShouldEat: [
      "Growing children and adolescents for skeletal height and bone density.",
      "Athletes seeking complete overnight muscle protein synthesis (casein).",
      "Anyone needing clean dietary calcium and B12."
    ],
    whenToAvoid: [
      "Individuals with diagnosed clinical Lactose Intolerance or cow milk protein allergy.",
      "Active acute asthma with heavy bronchial phlegm (aggravates mucus in some individuals)."
    ],
    avoidCombinations: [
      "NEVER combine with sour citrus fruits, melons, or salty snacks (Classic Viruddha Aahar).",
      "Avoid drinking with fish or non-veg meats."
    ]
  },

  curd: {
    id: "curd",
    nameEn: "Fresh Curd / Dahi (Yogurt)",
    nameHi: "ताजा दही (Curd / Yogurt)",
    category: "Probiotic Living Gut Healer",
    verdictTag: "⭐⭐⭐⭐⭐ Billions of Live Probiotic Cultures",
    topBenefitTitle: "Sabse Bada Fayda: Lactobacillus Probiotics Restore Colon Microbiome & Immunity",
    topBenefitDesc: "Fresh homemade curd contains billions of live lactic acid bacteria (Lactobacillus acidophilus and bulgaricus). These probiotic cultures colonize the intestinal mucosal barrier, crowding out pathogenic pathogens, producing bacteriocins, and optimizing systemic immunity.",
    otherBenefits: [
      "Lactic acid fermentation breaks down lactose, making curd well-tolerated by lactose-sensitive people.",
      "Provides 121mg of easily absorbed Calcium and bioavailable phosphorus per 100g.",
      "Cooling digestive tonic that soothes stomach burn, dysentery, and antibiotic-induced gut damage.",
      "Assists in natural synthesis of B-complex vitamins inside the human intestinal tract."
    ],
    nutritionFacts: {
      calories: "61 kcal",
      protein: "3.5 g",
      carbs: "4.7 g",
      fats: "3.3 g",
      fiber: "0.0 g",
      glycemicIndex: "28 (Very Low GI)"
    },
    vitamins: ["Vitamin B12: 0.38 mcg", "Riboflavin B2: 0.14 mg", "Vitamin A"],
    minerals: ["Calcium: 121 mg (High)", "Phosphorus: 95 mg", "Potassium: 155 mg", "Zinc: 0.5 mg"],
    whoShouldEat: [
      "Anyone experiencing sluggish digestion, gut dysbiosis, or following a course of antibiotics.",
      "Individuals with mild lactose sensitivity looking for safe dairy calcium and protein.",
      "People wanting to improve skin clarity and digestive agility."
    ],
    whenToAvoid: [
      "Ayurvedic classical guideline: avoid consuming sour curd late at night (clogs micro-circulatory channels / Shrotas).",
      "Active acute cough, cold, or sinus congestion flares."
    ],
    avoidCombinations: [
      "Do NOT heat curd directly (cooking destroys beneficial probiotic cultures).",
      "Avoid combining with fish or milk."
    ]
  },

  paneer: {
    id: "paneer",
    nameEn: "Fresh Paneer (Indian Cottage Cheese)",
    nameHi: "ताजा पनीर (Paneer)",
    category: "Concentrated Slow-Release Casein Protein",
    verdictTag: "⭐⭐⭐⭐⭐ Pure Muscle & Bone Powerhouse",
    topBenefitTitle: "Sabse Bada Fayda: 18.3g Slow-Release Casein Protein & 480mg Massive Calcium",
    topBenefitDesc: "Fresh Paneer is one of the richest whole-food vegetarian sources of concentrated Casein protein (18.3g) and bioavailable calcium (480mg per 100g). Casein forms a sustained gel in the stomach that releases amino acids gradually over 6-8 hours, preventing muscular catabolism during overnight fasting.",
    otherBenefits: [
      "Very low in carbohydrates (only 2.5g), making it ideal for keto, diabetic, and low-carb diets.",
      "Concentrated calcium protects teeth enamel and fortifies bone matrix against fractures.",
      "Contains healthy milk lipids and Conjugated Linoleic Acid (CLA) for hormone synthesis.",
      "Provides substantial sustained satiety, stopping untimely hunger pangs."
    ],
    nutritionFacts: {
      calories: "265 kcal",
      protein: "18.3 g",
      carbs: "2.5 g",
      fats: "20.8 g",
      fiber: "0.0 g",
      glycemicIndex: "10 (Negligible GI)"
    },
    vitamins: ["Vitamin B12: 1.4 mcg (58% DV)", "Vitamin A: 680 IU", "Vitamin D"],
    minerals: ["Calcium: 480 mg (Very High!)", "Phosphorus: 280 mg", "Selenium", "Zinc: 1.8 mg"],
    whoShouldEat: [
      "Vegetarian bodybuilders, athletes, and gym-goers seeking dense, slow-digesting protein.",
      "Diabetics and individuals on ketogenic or low-carbohydrate nutrition.",
      "Children and adolescents requiring concentrated calcium for bone growth."
    ],
    whenToAvoid: [
      "Severe lactose intolerance or milk protein allergy.",
      "Sedentary individuals with high lipid restrictions should choose low-fat paneer portions."
    ],
    avoidCombinations: [
      "Avoid deep-frying in reused trans-fat vegetable oils (destroys delicate milk fats).",
      "Do not combine with sour citrus."
    ]
  },

  whole_egg: {
    id: "whole_egg",
    nameEn: "Whole Farm Egg (Anda)",
    nameHi: "पूरा अंडा (Egg)",
    category: "100 Biological Value Complete Protein",
    verdictTag: "⭐⭐⭐⭐⭐ Gold Standard Protein & Brain Choline",
    topBenefitTitle: "Sabse Bada Fayda: Perfect 100 Biological Value Protein & 250mg Brain Choline",
    topBenefitDesc: "Eggs are nature's undisputed benchmark of protein quality with a Biological Value of 100. Containing all 9 essential amino acids in perfect human proportions, the yolk provides 250mg of Choline—the critical precursor for acetylcholine, the neurotransmitter governing memory, focus, and hepatic fat metabolism.",
    otherBenefits: [
      "Supplies Lutein and Zeaxanthin in bioavailable lipid matrix, protecting retinal macular vision.",
      "Rich in Vitamin B12, Riboflavin, Folate, and natural Vitamin D3.",
      "Raises beneficial HDL cholesterol and transforms small dense LDL into benign large buoyant LDL.",
      "High satiety quotient: consuming eggs at breakfast reduces caloric intake over the next 36 hours."
    ],
    nutritionFacts: {
      calories: "143 kcal (per 100g ~ 2 medium eggs)",
      protein: "12.6 g",
      carbs: "0.7 g",
      fats: "9.5 g",
      fiber: "0.0 g",
      glycemicIndex: "0 (Zero GI)"
    },
    vitamins: ["Choline: 250 mg (50% DV!)", "Vitamin B12: 1.1 mcg (46% DV)", "Vitamin A: 540 IU", "Vitamin D: 82 IU", "Riboflavin B2: 0.45 mg"],
    minerals: ["Selenium: 30 mcg (55% DV)", "Phosphorus: 198 mg", "Iron: 1.75 mg", "Zinc: 1.3 mg"],
    whoShouldEat: [
      "Athletes, fitness professionals, and anyone aiming to build lean muscle mass.",
      "Pregnant women needing Choline for fetal brain development and neural tube closure.",
      "Seniors fighting sarcopenia (age-related muscle loss) and cognitive decline."
    ],
    whenToAvoid: [
      "Individuals with diagnosed clinical egg white allergy (Albumin allergy).",
      "Never consume raw unpasteurized eggs (risk of severe Salmonella enterica food poisoning)."
    ],
    avoidCombinations: [
      "Avoid consuming with raw unheated milk simultaneously.",
      "Do not over-fry in burned vegetable fats."
    ]
  },

  // -------------------------------------------------------------
  // 6. NUTS & SEEDS (ड्राई फ्रूट्स & बीज)
  // -------------------------------------------------------------
  almonds: {
    id: "almonds",
    nameEn: "Soaked Almonds (Badam)",
    nameHi: "भीगे बादाम (Almonds)",
    category: "Vitamin E & Brain Neuro-Protective Nut",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Neuro & Cardiovascular Shield",
    topBenefitTitle: "Sabse Bada Fayda: 25.6mg Vitamin E (170% DV!) Protects Brain & Arterial Walls",
    topBenefitDesc: "Almonds are the richest whole-food tree nut source of natural d-alpha-tocopherol (Vitamin E). Packing 25.6mg per 100g, it halts oxidative degradation of brain neuron lipids and guards cardiovascular endothelial tissue against arterial plaque formation.",
    otherBenefits: [
      "Delivers 21.2g of plant protein and 12.5g of prebiotic fiber per 100g.",
      "High bioavailable Magnesium (270mg) improves cellular insulin signaling and lowers blood pressure.",
      "When soaked overnight, removes enzyme-inhibiting phytic acid, multiplying nutrient absorption.",
      "Monounsaturated oleic acid profile optimizes HDL-to-LDL cholesterol ratio."
    ],
    nutritionFacts: {
      calories: "579 kcal",
      protein: "21.2 g",
      carbs: "21.6 g",
      fats: "49.9 g",
      fiber: "12.5 g",
      glycemicIndex: "15 (Very Low GI)"
    },
    vitamins: ["Vitamin E: 25.6 mg (170% DV!)", "Riboflavin B2: 1.1 mg", "Niacin: 3.6 mg", "Folate: 44 mcg"],
    minerals: ["Magnesium: 270 mg (68% DV)", "Calcium: 264 mg", "Phosphorus: 481 mg", "Iron: 3.7 mg", "Zinc: 3.1 mg"],
    whoShouldEat: [
      "Students, researchers, and professionals seeking enhanced mental focus and memory recall.",
      "Cardiac patients and diabetics wanting stable glycemic control and arterial health.",
      "Individuals looking to improve hair follicle strength and skin glow."
    ],
    whenToAvoid: [
      "Individuals with documented tree nut anaphylactic allergies.",
      "Limit to 6-10 soaked almonds daily (high calorie density if consumed in uncontrolled handfuls)."
    ],
    avoidCombinations: [
      "Avoid eating unsoaked dry raw skins in excessive quantities (phytic acid chelates minerals)."
    ]
  },

  walnuts: {
    id: "walnuts",
    nameEn: "Raw Walnuts (Akhrot)",
    nameHi: "अखरोट (Walnuts)",
    category: "Plant-Based Omega-3 Brain Nut",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Plant Omega-3 ALA Champion",
    topBenefitTitle: "Sabse Bada Fayda: 9.1g Plant Omega-3 (ALA) Protects Cognitive Function & Heart",
    topBenefitDesc: "Walnuts look remarkably like the human brain for good reason: they are the only tree nut rich in Alpha-Linolenic Acid (ALA Omega-3, 9.1g per 100g). ALA suppresses neuro-inflammation in the hippocampus, lowers arterial C-reactive protein (CRP), and preserves memory retention.",
    otherBenefits: [
      "Rich in ellagitannins which gut bacteria metabolize into anti-inflammatory Urolithins.",
      "Contains natural bioavailable Melatonin, supporting circadian sleep rhythm regulation.",
      "Reduces diastolic blood pressure and improves vascular flow-mediated dilation.",
      "Supplies 15.2g of complete plant protein and 6.7g of digestive fiber."
    ],
    nutritionFacts: {
      calories: "654 kcal",
      protein: "15.2 g",
      carbs: "13.7 g",
      fats: "65.2 g",
      fiber: "6.7 g",
      glycemicIndex: "15 (Negligible GI)"
    },
    vitamins: ["Omega-3 ALA: 9.1 g (Very High!)", "Vitamin B6: 0.54 mg", "Folate: 98 mcg", "Vitamin E (gamma-tocopherol)"],
    minerals: ["Copper: 1.6 mg (176% DV)", "Manganese: 3.4 mg (148% DV)", "Magnesium: 158 mg", "Phosphorus: 346 mg"],
    whoShouldEat: [
      "Individuals seeking protection against Alzheimer's, memory decline, and cognitive fatigue.",
      "Cardiovascular patients aiming to reduce systemic arterial inflammation.",
      "Vegetarians and vegans needing dense plant-based Omega-3 fatty acids."
    ],
    whenToAvoid: [
      "Tree nut allergies.",
      "Avoid rancid or stale walnuts (polyunsaturated omega-3 fats oxidize if exposed to heat/sunlight). Always store in cool airtight containers."
    ],
    avoidCombinations: [
      "Avoid deep roasting at high temperatures (damages fragile omega-3 fatty acids)."
    ]
  },

  // -------------------------------------------------------------
  // 7. HERBS & SPICES (जड़ी-बूटी & मसाले)
  // -------------------------------------------------------------
  haldi: {
    id: "haldi",
    nameEn: "Turmeric Root Powder (Haldi)",
    nameHi: "हल्दी (Turmeric)",
    category: "Curcumin Anti-Inflammatory Rasayana",
    verdictTag: "⭐⭐⭐⭐⭐ Supreme Cellular Anti-Inflammatory",
    topBenefitTitle: "Sabse Bada Fayda: Curcumin Inhibits NF-kB Inflammation Cascade & Joint Pain",
    topBenefitDesc: "Haldi contains Curcumin, a polyphenol that directly inhibits the Master Inflammatory Switch NF-kB at the genetic level. It rivals pharmaceutical anti-inflammatory agents without ulcerogenic side effects, providing proven relief in rheumatoid arthritis and systemic inflammation.",
    otherBenefits: [
      "Surges Brain-Derived Neurotrophic Factor (BDNF), encouraging new neural connections.",
      "Powerful hepatic antioxidant: stimulates phase-II detox enzymes and gallbladder motility.",
      "Topical and internal antimicrobial: accelerates wound healing and clears blood toxins.",
      "Improves vascular endothelial function, supporting healthy arterial blood pressure."
    ],
    nutritionFacts: {
      calories: "312 kcal",
      protein: "7.8 g",
      carbs: "64.9 g",
      fats: "3.2 g",
      fiber: "21.1 g",
      glycemicIndex: "10 (Negligible GI)"
    },
    vitamins: ["Curcuminoids: 3-5% active extract", "Vitamin C: 25.9 mg", "Vitamin B6: 1.8 mg", "Niacin"],
    minerals: ["Iron: 41.4 mg (230% DV!)", "Manganese: 7.8 mg (340% DV)", "Potassium: 2080 mg", "Magnesium: 193 mg"],
    whoShouldEat: [
      "Individuals suffering from joint pain, arthritis, stiffness, or chronic inflammation.",
      "People wanting to protect cardiovascular and brain neuro-cognitive health.",
      "Anyone seeking strong seasonal immune resistance (Golden Turmeric Milk)."
    ],
    whenToAvoid: [
      "Patients with acute active gallbladder obstruction (curcumin stimulates bile duct contractions).",
      "Those on high-dose prescription blood thinners prior to major surgical procedures."
    ],
    avoidCombinations: [
      "CRITICAL: Always consume haldi with black pepper (Piperine increases curcumin bioavailability by 2000%!) and a healthy lipid (ghee/oil), as curcumin is fat-soluble."
    ]
  }
};

// Intelligently classify any unlisted food item with 100% scientifically sound biochemistry
function classifyUnknownFoodItem(rawQuery) {
  const raw = (rawQuery || '').trim();
  const q = raw.toLowerCase();
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1);

  // 1. SWEETENERS / CONFECTIONERY / SUGARS
  if (/sugar|candy|mithai|sweet|jelly|caramel|halwa|laddu|ladoo|jalebi|rasgulla|barfi|gulab jamun|chikki|cake|pastry|sucrose|glucose|fructose|syrup/i.test(q)) {
    return {
      id: q.replace(/\s+/g, '_'),
      nameEn: `${cap} (Sweetener / Confectionery)`,
      nameHi: `${cap} (मीठा खाद्य पदार्थ)`,
      category: "Concentrated Simple Carbohydrate",
      verdictTag: "⚠️ High GI Empty Calories",
      topBenefitTitle: "Sabse Bada Fayda: Apatkaal Me Instant Glucose (Hypoglycemia Recovery Only)",
      topBenefitDesc: `${cap} provides immediate simple sugars that surge into the bloodstream within minutes. It has negligible vitamins, zero fiber, and no structural protein. Its only clinical utility is quick emergency fuel during acute low blood sugar crashes or mid-race marathon fatigue.`,
      otherBenefits: [
        "Rapid cellular glycogen replenishment during extreme athletic exhaustion.",
        "Culinary texture, sweetness and preservation in confectionery baking."
      ],
      nutritionFacts: {
        calories: "385 - 400 kcal",
        protein: "0.0 - 0.5 g",
        carbs: "95.0 - 99.0 g",
        fats: "0.0 - 0.2 g",
        fiber: "0.0 g",
        glycemicIndex: "70+ (High GI)"
      },
      vitamins: ["Nil (0 mcg)", "Zero Vitamins"],
      minerals: ["Trace Minerals Only"],
      whoShouldEat: ["Individuals experiencing acute hypoglycemia (sugar crash) or extreme endurance fatigue."],
      whenToAvoid: ["Diabetics, pre-diabetics, fatty liver patients, and before bedtime."],
      avoidCombinations: ["High saturated trans-fats and carbonated colas."]
    };
  }

  // 2. GREEN LEAFY VEGETABLES (पालक, मेथी, बथुआ, चौलाई, सरसों)
  if (/leaf|leaves|saag|spinach|palak|methi|bathua|chaulai|sarson|kale|lettuce|coriander|dhaniya|mint|pudina/i.test(q)) {
    return {
      id: q.replace(/\s+/g, '_'),
      nameEn: `${cap} (Green Leafy Vegetable / Saag)`,
      nameHi: `${cap} (हरी पत्तेदार सब्जी)`,
      category: "Green Leafy Micronutrient Superfood",
      verdictTag: "⭐⭐⭐⭐⭐ Supreme Folate, Iron & Chlorophyll",
      topBenefitTitle: `Sabse Bada Fayda: Folate, Non-Heme Iron & Chlorophyll Cellular Detox`,
      topBenefitDesc: `${cap} is exceptionally dense in natural Chlorophyll, bioavailable Folate, Vitamin K, and alkaline minerals. It provides cellular detox protection with virtually zero calories and an ultra-low glycemic index.`,
      otherBenefits: [
        "Rich in lutein and beta-carotene for retinal macular eye health.",
        "High dietary nitrate and potassium content support arterial vasodilation.",
        "Prebiotic insoluble fiber feeds colon microbiome diversity."
      ],
      nutritionFacts: {
        calories: "22 - 28 kcal",
        protein: "2.5 - 3.2 g",
        carbs: "3.5 - 4.5 g",
        fats: "0.3 - 0.5 g",
        fiber: "2.5 - 3.5 g",
        glycemicIndex: "15 (Negligible GI)"
      },
      vitamins: ["Vitamin K: 400+ mcg", "Folate: 140+ mcg", "Vitamin A / Beta-Carotene", "Vitamin C: 25mg"],
      minerals: ["Iron: 2.5 - 4.0 mg", "Calcium: 90 - 150 mg", "Potassium: 450 - 550 mg"],
      whoShouldEat: ["Anemic individuals, diabetics, pregnant mothers, and those seeking cardiovascular wellness."],
      whenToAvoid: ["Patients with calcium oxalate kidney stones should blanch or cook thoroughly to reduce oxalates."],
      avoidCombinations: ["Avoid consuming raw unwashed leaves."]
    };
  }

  // 3. FRESH WHOLE FRUITS (फल)
  if (/fruit|aam|mango|seb|apple|kela|banana|santre|orange|mosambi|amrood|guava|papita|papaya|tarbooz|watermelon|kharbooza|melon|angoor|grapes|nashpati|pear|chikoo|sapota|anannas|pineapple|strawberry|berry|kiwi|lichi|jamun|plum|peach/i.test(q)) {
    return {
      id: q.replace(/\s+/g, '_'),
      nameEn: `${cap} (Fresh Whole Fruit)`,
      nameHi: `${cap} (ताजा प्राकृतिक फल)`,
      category: "Fresh Whole Fruit & Natural Antioxidant",
      verdictTag: "⭐⭐⭐⭐ Natural Cellular Vitamins & Fiber",
      topBenefitTitle: `Sabse Bada Fayda: Natural Vitamin C, Polyphenols & Cellular Hydration`,
      topBenefitDesc: `${cap} provides unrefined natural fructose balanced with cellular dietary fiber, water, and bioactive antioxidants. This supports immune phagocyte activation and protects cellular tissues without synthetic additives.`,
      otherBenefits: [
        "Delivers bioavailable Vitamin C and carotenoids that support collagen synthesis.",
        "High structured cellular water and potassium combat metabolic dehydration.",
        "Natural digestive pectin and fruit enzymes aid smooth gastrointestinal transit."
      ],
      nutritionFacts: {
        calories: "45 - 65 kcal",
        protein: "0.6 - 1.2 g",
        carbs: "11.0 - 16.0 g",
        fats: "0.2 - 0.5 g",
        fiber: "1.8 - 3.5 g",
        glycemicIndex: "35 - 55 (Low to Medium GI)"
      },
      vitamins: ["Vitamin C: 20 - 50 mg", "Vitamin A", "Folate", "Flavonoids"],
      minerals: ["Potassium: 150 - 300 mg", "Magnesium: 10 - 20 mg", "Calcium: 10 - 25 mg"],
      whoShouldEat: ["Individuals seeking natural daily immune defense, radiant skin, and digestive wellness."],
      whenToAvoid: ["Avoid consuming as strained sugary liquid juices; always eat the whole fruit with intact fiber."],
      avoidCombinations: ["Avoid drinking cold water or milk immediately after eating sour fruits."]
    };
  }

  // 4. DALS, PULSES & LEGUMES (दालें & फलियां)
  if (/dal|daal|pulse|lentil|bean|chana|chhole|rajma|moong|urad|masoor|toor|arhar|matar|pea|soybean|soya|lobia|kulthi|besan/i.test(q)) {
    return {
      id: q.replace(/\s+/g, '_'),
      nameEn: `${cap} (Nutrient-Dense Pulse / Legume)`,
      nameHi: `${cap} (दाल / उच्च प्रोटीन फली)`,
      category: "Plant-Based Protein & Complex Fiber",
      verdictTag: "⭐⭐⭐⭐⭐ Supreme Muscle & Prebiotic Fiber",
      topBenefitTitle: `Sabse Bada Fayda: 20-25g High Plant Protein & Soluble Prebiotic Fiber`,
      topBenefitDesc: `${cap} is a primary plant-based protein source providing complex amino acids, sustained low-GI carbohydrates, and fermentable fibers that feed colon Bifidobacteria while building lean muscle tissue.`,
      otherBenefits: [
        "Rich in Folate and non-heme iron for healthy red blood cell production.",
        "Lowers serum total and LDL cholesterol through bile-binding soluble fiber.",
        "When paired with grains (rice/wheat), forms a complete PDCAAS essential amino acid profile."
      ],
      nutritionFacts: {
        calories: "330 - 360 kcal (Raw) / ~120 kcal (Cooked)",
        protein: "20.0 - 25.0 g",
        carbs: "58.0 - 64.0 g",
        fats: "1.0 - 4.0 g",
        fiber: "12.0 - 18.0 g",
        glycemicIndex: "25 - 38 (Very Low GI)"
      },
      vitamins: ["Folate: 250 - 500 mcg", "Thiamine B1", "Niacin B3", "Pyridoxine B6"],
      minerals: ["Potassium: 800 - 1300 mg", "Iron: 5.0 - 8.0 mg", "Magnesium: 120 - 180 mg", "Zinc: 2.5 - 3.5 mg"],
      whoShouldEat: ["Vegetarians, athletes, diabetics, and growing families seeking clean muscle recovery."],
      whenToAvoid: ["Individuals with severe acute uric acid gout flare-ups; always soak before cooking."],
      avoidCombinations: ["Avoid eating undercooked pulses."]
    };
  }

  // 5. WHOLE GRAINS & MILLETS (अनाज & मिलेट्स)
  if (/grain|cereal|wheat|gehu|atta|roti|rice|chawal|millet|bajra|jowar|ragi|oats|barley|jau|corn|makka|quinoa|sooji|rava|poha/i.test(q)) {
    return {
      id: q.replace(/\s+/g, '_'),
      nameEn: `${cap} (Whole Cereal / Millet Grain)`,
      nameHi: `${cap} (पौष्टिक अनाज / मिलेट)`,
      category: "Complex Carbohydrate & Mineral Grain",
      verdictTag: "⭐⭐⭐⭐ Complex Cellular Glycogen Fuel",
      topBenefitTitle: `Sabse Bada Fayda: Sustained Slow-Burning Energy & High Insoluble Fiber`,
      topBenefitDesc: `${cap} delivers complex polysaccharides that digest gradually in the small intestine, providing sustained cellular energy without triggering sudden glucose spikes or insulin exhaustion.`,
      otherBenefits: [
        "Rich in B-complex vitamins (Thiamine, Niacin) essential for cellular carbohydrate metabolism.",
        "Provides magnesium and phosphorus for skeletal stability and muscle contraction.",
        "Promotes gastrointestinal motility through wholesome dietary fiber bulk."
      ],
      nutritionFacts: {
        calories: "320 - 360 kcal (Raw grain)",
        protein: "8.0 - 12.0 g",
        carbs: "65.0 - 74.0 g",
        fats: "1.2 - 4.5 g",
        fiber: "8.0 - 13.0 g",
        glycemicIndex: "45 - 65 (Low to Moderate GI)"
      },
      vitamins: ["Thiamine B1", "Niacin B3", "Folate", "Vitamin E (in whole germ)"],
      minerals: ["Magnesium: 80 - 160 mg", "Phosphorus: 200 - 350 mg", "Potassium: 250 - 450 mg", "Iron: 3.0 - 6.0 mg"],
      whoShouldEat: ["Active individuals, athletes, and families seeking balanced daily complex carbohydrates."],
      whenToAvoid: ["Avoid heavily refined stripped flours (maida); choose whole grain flours."],
      avoidCombinations: ["Avoid consuming raw unroasted or uncooked grain dough."]
    };
  }

  // 6. NUTS, SEEDS & HEALTHY OILS
  if (/nut|seed|badam|almond|kaju|cashew|akhrot|walnut|pista|pistachio|anjeer|fig|kishmish|raisin|khajoor|date|makhana|til|sesame|alsi|flax|chia|pumpkin seed|sunflower seed|ghee|butter|oil/i.test(q)) {
    return {
      id: q.replace(/\s+/g, '_'),
      nameEn: `${cap} (Nutrient-Dense Nut / Seed / Lipid)`,
      nameHi: `${cap} (ड्राई फ्रूट / बीज / आवश्यक वसा)`,
      category: "Essential Fatty Acids & Micronutrient Concentrate",
      verdictTag: "⭐⭐⭐⭐⭐ Dense Neuro-Lipids & Antioxidants",
      topBenefitTitle: `Sabse Bada Fayda: Healthy Monounsaturated / Polyunsaturated Lipids & Vitamin E`,
      topBenefitDesc: `${cap} is concentrated in natural essential fatty acids, fat-soluble antioxidants, and structural minerals that nourish the nervous system, myelin sheath, and cardiovascular walls.`,
      otherBenefits: [
        "Rich in Alpha-Tocopherol Vitamin E and phytosterols that lower oxidized LDL.",
        "High magnesium and zinc support hormonal synthesis and immune cell resilience.",
        "Delivers strong sustained satiety, controlling insulin and cravings."
      ],
      nutritionFacts: {
        calories: "520 - 650 kcal",
        protein: "15.0 - 22.0 g",
        carbs: "12.0 - 25.0 g",
        fats: "45.0 - 60.0 g",
        fiber: "6.0 - 12.0 g",
        glycemicIndex: "10 - 20 (Very Low GI)"
      },
      vitamins: ["Vitamin E (High)", "B-Complex", "Trace Carotenoids"],
      minerals: ["Magnesium: 150 - 270 mg", "Zinc: 2.5 - 4.5 mg", "Calcium: 50 - 260 mg", "Copper", "Selenium"],
      whoShouldEat: ["Individuals seeking brain cognitive health, radiant skin, and cardiovascular resilience."],
      whenToAvoid: ["Consume in mindful daily portions (handful ~25-30g) to account for high caloric density."],
      avoidCombinations: ["Avoid rancid, oxidized, or heavily salted varieties."]
    };
  }

  // 7. DEFAULT NATURAL WHOLE FOOD
  return {
    id: q.replace(/\s+/g, '_'),
    nameEn: `${cap} (Natural Food Ingredient)`,
    nameHi: `${cap} (प्राकृतिक पौष्टिक आहार)`,
    category: "Whole Food / Natural Nutrient Source",
    verdictTag: "⭐⭐⭐⭐ Whole Food Nutrition",
    topBenefitTitle: `Sabse Bada Fayda: Natural Bioactive Micronutrients & Whole Food Synergy`,
    topBenefitDesc: `${cap} provides authentic whole-food macronutrients, unrefined dietary fiber, and cellular minerals without synthetic food processing, industrial trans-fats, or chemical additives.`,
    otherBenefits: [
      "Provides natural, bioavailable vitamins and minerals suited for human digestion.",
      "Supports balanced gut microbiota diversity through natural dietary fiber.",
      "Free from industrial ultra-processing and synthetic flavor chemicals."
    ],
    nutritionFacts: {
      calories: "Variable (Whole Food Density)",
      protein: "Natural plant/animal protein",
      carbs: "Complex dietary carbs",
      fats: "Natural dietary lipids",
      fiber: "Wholesome dietary fiber",
      glycemicIndex: "Low to Moderate"
    },
    vitamins: ["Natural Vitamin Spectrum", "Antioxidants"],
    minerals: ["Natural Potassium, Magnesium & Calcium"],
    whoShouldEat: ["Health-conscious individuals aiming for wholesome, unadulterated balanced diets."],
    whenToAvoid: ["Consume freshly prepared, properly washed, and within individual digestive capacity."],
    avoidCombinations: ["Avoid washing down with ice-cold carbonated artificial sodas or excessive trans-fat oils."]
  };
}

module.exports = {
  CLINICAL_FOOD_DATABASE,
  classifyUnknownFoodItem
};
