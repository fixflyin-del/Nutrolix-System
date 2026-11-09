package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.FoodAiDetail
import com.example.data.FoodAiKnowledgeBase
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiFoodScreen(
  onBack: () -> Unit,
  modifier: Modifier = Modifier
) {
  BackHandler { onBack() }
  val coroutineScope = rememberCoroutineScope()

  var searchQuery by remember { mutableStateOf("") }
  var isSearching by remember { mutableStateOf(false) }
  var selectedFood by remember { mutableStateOf<FoodAiDetail?>(null) }
  var searchErrorMessage by remember { mutableStateOf("") }

  // Default: Load Wheat or Cow Ghee on start so the user immediately sees a rich colorful card
  LaunchedEffect(Unit) {
    if (selectedFood == null) {
      selectedFood = FoodAiKnowledgeBase.searchLocal("cow ghee") ?: FoodAiKnowledgeBase.BUILTIN_FOODS.firstOrNull()
    }
  }

  // Typewriter placeholder animation words requested by user
  val typewriterWords = remember {
    listOf(
      "Cow Ghee",
      "Soyabeans",
      "Dhaniya",
      "Palak",
      "Wheat (Gehu)",
      "Bajra",
      "Anjeer",
      "Makhana",
      "Ashwagandha",
      "Potato (Aloo)",
      "Oats",
      "Moong Dal",
      "Chia Seeds",
      "Curd (Dahi)"
    )
  }

  var typewriterText by remember { mutableStateOf("") }
  LaunchedEffect(Unit) {
    var wordIndex = 0
    while (true) {
      val word = typewriterWords[wordIndex % typewriterWords.size]
      // Type forward
      for (i in 1..word.length) {
        typewriterText = word.substring(0, i)
        delay(120)
      }
      delay(1500) // Pause at full word
      // Delete backward
      for (i in word.length downTo 0) {
        typewriterText = word.substring(0, i)
        delay(60)
      }
      delay(400)
      wordIndex++
    }
  }

  // Pre-searchable pills requested by user
  val preSearchPills = remember {
    listOf(
      "Analyse Wheat",
      "Benefits of Anjeer",
      "Analyse Potato",
      "Cow Ghee",
      "Soyabeans",
      "Palak Benefits",
      "Bajra Millet",
      "Ashwagandha",
      "Makhana",
      "Dhaniya Detox",
      "Pizza Impact",
      "Potato Chips"
    )
  }

  fun executeSearch(query: String) {
    if (query.trim().isBlank()) return
    searchErrorMessage = ""
    isSearching = true
    coroutineScope.launch {
      delay(300) // smooth transition
      val result = FoodAiKnowledgeBase.resolveFoodIntelligence(query.trim())
      isSearching = false
      result.onSuccess { food ->
        selectedFood = food
      }.onFailure { err ->
        searchErrorMessage = "Could not find information. Please check your query."
      }
    }
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(NutrolixBackground)
  ) {
    // Slim, sleek Dark Green Header Banner (User requested: patla karo aur upar khali space kam karo)
    Surface(
      color = NutrolixDarkGreen,
      modifier = Modifier.fillMaxWidth(),
      shadowElevation = 2.dp
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f)
        ) {
          IconButton(
            onClick = onBack,
            modifier = Modifier.size(32.dp)
          ) {
            Icon(
              imageVector = Icons.AutoMirrored.Filled.ArrowBack,
              contentDescription = "Back",
              tint = Color.White,
              modifier = Modifier.size(18.dp)
            )
          }
          Spacer(modifier = Modifier.width(6.dp))
          Column {
            Text(
              text = "Nutrolix AI Food Intelligence",
              fontWeight = FontWeight.Black,
              fontSize = 14.sp,
              color = Color.White
            )
            Text(
              text = "100% Scientific & Clinical Nutrition Encyclopedia",
              fontSize = 9.sp,
              color = Color.White.copy(alpha = 0.8f)
            )
          }
        }
        Surface(
          color = AmberWarm,
          shape = RoundedCornerShape(4.dp)
        ) {
          Text(
            text = "100% ACCURATE",
            fontSize = 8.sp,
            fontWeight = FontWeight.Black,
            color = Color.Black,
            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
          )
        }
      }
    }

    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .background(NutrolixBackground),
      contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 6.dp, bottom = 14.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {

      // -------------------------------------------------------------
      // TOP SEARCH BAR WITH TYPEWRITER ANIMATION (USER REQUIREMENT)
      // -------------------------------------------------------------
      item {
        Card(
          shape = RoundedCornerShape(22.dp),
          colors = CardDefaults.cardColors(containerColor = Color.White),
          elevation = CardDefaults.cardElevation(3.dp),
          border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFE2E8F0)),
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(modifier = Modifier.padding(14.dp)) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                Icons.Default.Search,
                contentDescription = "Search",
                tint = NutrolixPrimaryGreen,
                modifier = Modifier.size(24.dp)
              )
              Spacer(modifier = Modifier.width(10.dp))
              Box(modifier = Modifier.weight(1f)) {
                if (searchQuery.isEmpty()) {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                      text = "Search ",
                      fontSize = 14.sp,
                      color = NutrolixTextSecondary
                    )
                    Text(
                      text = "\"$typewriterText\"",
                      fontSize = 14.sp,
                      fontWeight = FontWeight.Bold,
                      color = NutrolixDarkGreen
                    )
                    Text(
                      text = "|",
                      fontSize = 14.sp,
                      fontWeight = FontWeight.Bold,
                      color = NutrolixPrimaryGreen
                    )
                  }
                }
                TextField(
                  value = searchQuery,
                  onValueChange = { searchQuery = it },
                  colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                  ),
                  singleLine = true,
                  modifier = Modifier
                    .fillMaxWidth()
                    .testTag("ai_food_search_input")
                )
              }

              if (searchQuery.isNotEmpty()) {
                IconButton(onClick = { searchQuery = "" }) {
                  Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color.Gray, modifier = Modifier.size(18.dp))
                }
              }

              Button(
                onClick = { executeSearch(searchQuery) },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                modifier = Modifier.testTag("ai_food_search_button")
              ) {
                Text("Search", fontSize = 12.sp, fontWeight = FontWeight.Bold)
              }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // -------------------------------------------------------------
            // PRE-SEARCHABLE PILLS / CHIPS (USER REQUIREMENT)
            // -------------------------------------------------------------
            Text(
              text = "Popular Foods to Explore:",
              fontSize = 11.sp,
              fontWeight = FontWeight.Bold,
              color = NutrolixTextSecondary,
              modifier = Modifier.padding(bottom = 6.dp)
            )

            Row(
              modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
              horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              preSearchPills.forEach { pill ->
                Surface(
                  shape = RoundedCornerShape(20.dp),
                  color = if (searchQuery.equals(pill, ignoreCase = true)) NutrolixPrimaryGreen else Color(0xFFF1F5F9),
                  border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (searchQuery.equals(pill, ignoreCase = true)) NutrolixPrimaryGreen else Color(0xFFE2E8F0)
                  ),
                  modifier = Modifier.clickable {
                    searchQuery = pill
                    executeSearch(pill)
                  }
                ) {
                  Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Icon(
                      Icons.Default.Bolt,
                      contentDescription = null,
                      tint = if (searchQuery.equals(pill, ignoreCase = true)) Color.White else AmberWarm,
                      modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                      text = pill,
                      fontSize = 11.sp,
                      fontWeight = FontWeight.Bold,
                      color = if (searchQuery.equals(pill, ignoreCase = true)) Color.White else NutrolixTextPrimary
                    )
                  }
                }
              }
            }
          }
        }
      }

      // Loading state
      if (isSearching) {
        item {
          Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF3B82F6)),
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier.padding(18.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color(0xFF2563EB), strokeWidth = 2.5.dp)
              Spacer(modifier = Modifier.width(14.dp))
              Column {
                Text(
                  text = "Analyzing Food Intelligence...",
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Bold,
                  color = Color(0xFF1E40AF)
                )
                Text(
                  text = "Extracting verified clinical macros, vitamins, Ayurvedic properties & contraindications.",
                  fontSize = 11.sp,
                  color = Color(0xFF3B82F6)
                )
              }
            }
          }
        }
      }

      if (searchErrorMessage.isNotEmpty()) {
        item {
          Text(searchErrorMessage, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        }
      }

      // -------------------------------------------------------------
      // DISPLAY SELECTED FOOD INTELLIGENCE (ALL 6 USER SECTIONS)
      // -------------------------------------------------------------
      selectedFood?.let { food ->

        // 1. HEADER & VERDICT CARD
        item {
          Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp)) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
              ) {
                Column(modifier = Modifier.weight(1f)) {
                  Text(
                    text = food.nameEn,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    color = NutrolixDarkGreen
                  )
                  Text(
                    text = food.nameHi,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixTextSecondary
                  )
                }
                Surface(
                  shape = RoundedCornerShape(8.dp),
                  color = if (food.verdictTag.contains("Superfood") || food.verdictTag.contains("Elixir")) Color(0xFFD1FAE5) else Color(0xFFFEF3C7)
                ) {
                  Text(
                    text = food.verdictTag,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = if (food.verdictTag.contains("Superfood") || food.verdictTag.contains("Elixir")) Color(0xFF065F46) else Color(0xFF92400E),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                  )
                }
              }

              Spacer(modifier = Modifier.height(6.dp))
              Text(
                text = "Category: ${food.category}",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = NutrolixPrimaryGreen
              )
            }
          }
        }

        // 2. SABSE BADA FAYDA (TOP HIGHLIGHTED BENEFIT - USER REQUIREMENT)
        item {
          Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F3E2E)),
            elevation = CardDefaults.cardElevation(4.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp)) {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                  modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFF59E0B)),
                  contentAlignment = Alignment.Center
                ) {
                  Icon(Icons.Default.Star, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                  text = "⭐ SABSE BADA FAYDA",
                  fontSize = 12.sp,
                  fontWeight = FontWeight.Black,
                  color = Color(0xFFFCD34D),
                  letterSpacing = 1.sp
                )
              }
              Spacer(modifier = Modifier.height(10.dp))
              Text(
                text = food.topBenefitTitle,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White
              )
              Spacer(modifier = Modifier.height(6.dp))
              Text(
                text = food.topBenefitDesc,
                fontSize = 12.sp,
                lineHeight = 18.sp,
                color = Color(0xFFE2E8F0)
              )
            }
          }
        }

        // 3. OTHER KEY BENEFITS (ANYA MAHATVAPURNA LABH - USER REQUIREMENT)
        item {
          Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = NutrolixPrimaryGreen, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                  text = "Other Major Health Benefits (अन्य लाभ)",
                  fontSize = 14.sp,
                  fontWeight = FontWeight.Black,
                  color = NutrolixTextPrimary
                )
              }

              food.otherBenefits.forEach { benefit ->
                Row(verticalAlignment = Alignment.Top) {
                  Text(text = "•", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = NutrolixPrimaryGreen)
                  Spacer(modifier = Modifier.width(8.dp))
                  Text(
                    text = benefit,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = Color(0xFF334155)
                  )
                }
              }
            }
          }
        }

        // 4. COMPLETE NUTRITION FACTS, VITAMINS & MINERALS (USER REQUIREMENT)
        item {
          Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp)) {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Analytics, contentDescription = null, tint = Color(0xFF2563EB), modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                  Text(
                    text = "Nutrition Facts, Vitamins & Minerals",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = NutrolixTextPrimary
                  )
                  Text("Nutrient profile per 100g edible portion", fontSize = 10.sp, color = NutrolixTextSecondary)
                }
              }

              Spacer(modifier = Modifier.height(14.dp))

              // 4 Core Macro Cards
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MacroStatCard(label = "Calories", value = "${food.nutrients.calories.toInt()} kcal", color = Color(0xFFEA580C), modifier = Modifier.weight(1f))
                MacroStatCard(label = "Protein", value = "${food.nutrients.protein}g", color = Color(0xFF16A34A), modifier = Modifier.weight(1f))
                MacroStatCard(label = "Carbs", value = "${food.nutrients.carbs}g", color = Color(0xFF2563EB), modifier = Modifier.weight(1f))
                MacroStatCard(label = "Fats", value = "${food.nutrients.fats}g", color = Color(0xFFD97706), modifier = Modifier.weight(1f))
              }

              Spacer(modifier = Modifier.height(8.dp))

              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MacroStatCard(label = "Fiber", value = "${food.nutrients.fiber}g", color = Color(0xFF0D9488), modifier = Modifier.weight(1f))
                MacroStatCard(label = "Sugar", value = "${food.nutrients.sugar}g", color = Color(0xFF9333EA), modifier = Modifier.weight(1f))
              }

              Spacer(modifier = Modifier.height(14.dp))
              HorizontalDivider(color = Color(0xFFF1F5F9))
              Spacer(modifier = Modifier.height(12.dp))

              // Minerals & Vitamins Breakdown
              Text("Key Vitamins & Minerals:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
              Spacer(modifier = Modifier.height(8.dp))

              Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                MicroRow("Calcium", "${food.nutrients.calciumMg} mg", "Iron", "${food.nutrients.ironMg} mg")
                MicroRow("Magnesium", "${food.nutrients.magnesiumMg} mg", "Potassium", "${food.nutrients.potassiumMg} mg")
                MicroRow("Zinc", "${food.nutrients.zincMg} mg", "Vitamin C", food.nutrients.vitaminC.ifBlank { "0 mg" })
                MicroRow("Vitamin A", food.nutrients.vitaminA.ifBlank { "Trace" }, "B-Complex", food.nutrients.vitaminBComplex.ifBlank { "Trace" })
              }
            }
          }
        }

        // 5. KISE JYADA KHANA CHAHIYE (WHO SHOULD EAT MORE - USER REQUIREMENT)
        item {
          Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF86EFAC)),
            elevation = CardDefaults.cardElevation(1.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Recommend, contentDescription = null, tint = Color(0xFF15803D), modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                  text = "Kise Jyada Khana Chahiye (किसे ज्यादा खाना चाहिए)",
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Black,
                  color = Color(0xFF166534)
                )
              }
              food.whoShouldEat.forEach { group ->
                Row(verticalAlignment = Alignment.Top) {
                  Text("✓", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF16A34A))
                  Spacer(modifier = Modifier.width(8.dp))
                  Text(group, fontSize = 12.sp, lineHeight = 17.sp, color = Color(0xFF14532D))
                }
              }
            }
          }
        }

        // 6. KAB NAHI KHANA CHAHIYE / PARHEZ (WHEN TO AVOID - USER REQUIREMENT)
        item {
          Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB)),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCD34D)),
            elevation = CardDefaults.cardElevation(1.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.WarningAmber, contentDescription = null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                  text = "Kab Nahi Khana Chahiye (कब नहीं खाना चाहिए / परहेज)",
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Black,
                  color = Color(0xFF92400E)
                )
              }
              food.whenToAvoid.forEach { warning ->
                Row(verticalAlignment = Alignment.Top) {
                  Text("⚠️", fontSize = 12.sp)
                  Spacer(modifier = Modifier.width(8.dp))
                  Text(warning, fontSize = 12.sp, lineHeight = 17.sp, color = Color(0xFF78350F))
                }
              }
            }
          }
        }

        // 7. KIS CHIJ KE SAATH AVOID KARNA CHAHIYE (VIRUDDHA AAHAR - USER REQUIREMENT)
        item {
          Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCA5A5)),
            elevation = CardDefaults.cardElevation(1.dp),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.DoNotDisturbOn, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                  text = "Kis Chij Ke Saath Avoid Karna Chahiye (गलत कॉम्बिनेशन)",
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Black,
                  color = Color(0xFF991B1B)
                )
              }
              food.avoidWith.forEach { combo ->
                Row(verticalAlignment = Alignment.Top) {
                  Text("🚫", fontSize = 12.sp)
                  Spacer(modifier = Modifier.width(8.dp))
                  Text(combo, fontSize = 12.sp, lineHeight = 17.sp, color = Color(0xFF7F1D1D))
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun MacroStatCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
  Card(
    shape = RoundedCornerShape(12.dp),
    colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.08f)),
    border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.2f)),
    modifier = modifier
  ) {
    Column(
      modifier = Modifier.padding(8.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
      Spacer(modifier = Modifier.height(2.dp))
      Text(value, fontSize = 12.sp, fontWeight = FontWeight.Black, color = NutrolixDarkGreen)
    }
  }
}

@Composable
fun MicroRow(label1: String, val1: String, label2: String, val2: String) {
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
    Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
      Text("$label1: ", fontSize = 11.sp, color = NutrolixTextSecondary)
      Text(val1, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
    }
    Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
      Text("$label2: ", fontSize = 11.sp, color = NutrolixTextSecondary)
      Text(val2, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
    }
  }
}
