package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.FoodCategory
import com.example.model.MealItem
import com.example.model.PromoBanner
import com.example.model.StoreSettings
import com.example.ui.components.FoodItemCard
import com.example.ui.theme.*
import com.example.viewmodel.DietaryFilter
import com.example.viewmodel.SortOption

import androidx.compose.material3.pulltorefresh.PullToRefreshBox

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerHomeScreen(
  meals: List<MealItem>,
  categories: List<FoodCategory>,
  banners: List<PromoBanner>,
  storeSettings: StoreSettings,
  selectedCategoryId: String,
  dietaryFilter: DietaryFilter,
  sortOption: SortOption,
  searchQuery: String,
  cartItemCount: Int,
  cartTotal: Double,
  isRefreshing: Boolean = false,
  onRefresh: () -> Unit = {},
  onSearchChange: (String) -> Unit,
  onCategorySelect: (String) -> Unit,
  onDietaryFilterSelect: (DietaryFilter) -> Unit,
  onSortSelect: (SortOption) -> Unit,
  onMealClick: (MealItem) -> Unit,
  onQuickAdd: (MealItem) -> Unit,
  onViewCart: () -> Unit,
  onOpenScanner: () -> Unit = {},
  onOpenAiFood: () -> Unit = onOpenScanner,
  modifier: Modifier = Modifier
) {
  var showSortMenu by remember { mutableStateOf(false) }

  PullToRefreshBox(
    isRefreshing = isRefreshing,
    onRefresh = onRefresh,
    modifier = modifier.fillMaxSize()
  ) {
    Box(modifier = Modifier.fillMaxSize()) {
      LazyColumn(
        modifier = Modifier
          .fillMaxSize()
          .background(NutrolixBackground)
          .testTag("customer_home_list"),
        contentPadding = PaddingValues(bottom = if (cartItemCount > 0) 90.dp else 24.dp)
      ) {
      // 1. Store Announcement Strip (Configured by Admin)
      if (storeSettings.announcement.isNotBlank()) {
        item {
          Surface(
            color = NutrolixDarkGreen,
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.Center
            ) {
              Text(
                text = storeSettings.announcement,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = NutrolixLightGreen
              )
            }
          }
        }
      }

      // Store Closed Notice
      if (!storeSettings.isOpen) {
        item {
          Surface(
            color = StatusDanger,
            modifier = Modifier.fillMaxWidth()
          ) {
            Text(
              text = "⚠️ Kitchen is currently offline. You can still browse menu and pre-order.",
              fontSize = 11.sp,
              fontWeight = FontWeight.Bold,
              color = Color.White,
              modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
          }
        }
      }

      // 2. Single-Line Search Bar (Neatly aligned, compact, non-wrapping)
      item {
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
          OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = {
              Text(
                text = "Search healthy meals, salads, protein bowls...",
                fontSize = 13.sp,
                maxLines = 1,
                softWrap = false,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
              )
            },
            leadingIcon = {
              Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search",
                tint = NutrolixPrimaryGreen,
                modifier = Modifier.size(20.dp)
              )
            },
            trailingIcon = {
              if (searchQuery.isNotEmpty()) {
                IconButton(
                  onClick = { onSearchChange("") },
                  modifier = Modifier.size(32.dp)
                ) {
                  Icon(Icons.Default.Clear, contentDescription = "Clear", tint = NutrolixTextSecondary, modifier = Modifier.size(16.dp))
                }
              }
            },
            singleLine = true,
            maxLines = 1,
            shape = RoundedCornerShape(12.dp),
            colors = nutrolixTextFieldColors(),
            modifier = Modifier
              .fillMaxWidth()
              .heightIn(min = 48.dp, max = 50.dp)
              .testTag("search_food_input")
          )
        }
      }

      // 3. Dynamic Promotional Hero Banners Carousel (Managed by Admin)
      val activeBanners = banners.filter { it.isActive }
      if (activeBanners.isNotEmpty()) {
        item {
          LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
          ) {
            items(activeBanners, key = { it.id }) { banner ->
              DynamicPromoHeroBanner(banner = banner)
            }
          }
          Spacer(modifier = Modifier.height(10.dp))
        }
      }



      // 4. Food Categories (Curated Healthy Categories)
      item {
        Column(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
          Text(
            text = "Explore Healthy Menu",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = NutrolixTextPrimary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
          )

          LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            items(categories, key = { it.id }) { category ->
              val isSelected = category.id == selectedCategoryId
              Surface(
                onClick = { onCategorySelect(category.id) },
                shape = RoundedCornerShape(12.dp),
                color = if (isSelected) NutrolixDarkGreen else NutrolixSurface,
                border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
                shadowElevation = if (isSelected) 3.dp else 0.dp,
                modifier = Modifier.testTag("category_chip_${category.id}")
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                  Text(text = category.iconEmoji, fontSize = 16.sp)
                  Text(
                    text = category.title,
                    fontSize = 12.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    color = if (isSelected) Color.White else NutrolixTextPrimary
                  )
                }
              }
            }
          }
        }
      }

      // 5. Dietary Filter Chips & Sort
      item {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .horizontalScroll(rememberScrollState()),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          // Sort Dropdown Trigger
          Box {
            FilterChip(
              selected = sortOption != SortOption.POPULAR,
              onClick = { showSortMenu = true },
              label = { Text("Sort: ${sortOption.label}", fontSize = 11.sp) },
              leadingIcon = {
                Icon(Icons.Default.FilterList, contentDescription = null, modifier = Modifier.size(14.dp))
              },
              shape = RoundedCornerShape(20.dp)
            )

            DropdownMenu(
              expanded = showSortMenu,
              onDismissRequest = { showSortMenu = false }
            ) {
              SortOption.values().forEach { option ->
                DropdownMenuItem(
                  text = { Text(option.label) },
                  onClick = {
                    onSortSelect(option)
                    showSortMenu = false
                  }
                )
              }
            }
          }

          // Dietary Filter Chips
          DietaryFilter.values().forEach { filter ->
            FilterChip(
              selected = dietaryFilter == filter,
              onClick = { onDietaryFilterSelect(filter) },
              label = { Text(filter.label, fontSize = 11.sp) },
              shape = RoundedCornerShape(20.dp)
            )
          }
        }
      }

      // 6. Section Header
      item {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = if (selectedCategoryId == "cat_all") "Curated Healthy Meals" else categories.find { it.id == selectedCategoryId }?.title ?: "Menu",
              fontSize = 17.sp,
              fontWeight = FontWeight.ExtraBold,
              color = NutrolixTextPrimary
            )
            Text(
              text = "${meals.size} clean food options available",
              fontSize = 11.sp,
              color = NutrolixTextSecondary
            )
          }
        }
      }

      // 7. Meals List
      if (meals.isEmpty()) {
        item {
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .padding(40.dp),
            contentAlignment = Alignment.Center
          ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
              Text(text = "🥗", fontSize = 42.sp)
              Spacer(modifier = Modifier.height(10.dp))
              Text(
                text = "No healthy meals match your filter",
                fontWeight = FontWeight.Bold,
                color = NutrolixTextPrimary
              )
              Text(
                text = "Try clearing filters or search query",
                fontSize = 12.sp,
                color = NutrolixTextSecondary
              )
            }
          }
        }
      } else {
        items(meals, key = { it.id }) { meal ->
          FoodItemCard(
            meal = meal,
            quantityInCart = 0,
            onCardClick = { onMealClick(meal) },
            onAddClick = { onMealClick(meal) },
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
          )
        }
      }
    }

    // 8. Sticky Bottom Cart Bar
    AnimatedVisibility(
      visible = cartItemCount > 0,
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .padding(16.dp)
    ) {
      Surface(
        onClick = onViewCart,
        shape = RoundedCornerShape(16.dp),
        color = NutrolixDarkGreen,
        shadowElevation = 8.dp,
        modifier = Modifier
          .fillMaxWidth()
          .height(56.dp)
          .testTag("floating_view_cart_bar")
      ) {
        Row(
          modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 18.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            Box(
              modifier = Modifier
                .size(32.dp)
                .background(NutrolixPrimaryGreen, CircleShape),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = Icons.Default.ShoppingCart,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(18.dp)
              )
            }

            Column {
              Text(
                text = "$cartItemCount ${if (cartItemCount == 1) "Item" else "Items"} Added",
                fontSize = 12.sp,
                color = NutrolixLightGreen,
                fontWeight = FontWeight.Medium
              )
              Text(
                text = "₹${cartTotal.toInt()}",
                fontSize = 16.sp,
                color = Color.White,
                fontWeight = FontWeight.Bold
              )
            }
          }

          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
          ) {
            Text(
              text = "View Cart",
              fontSize = 14.sp,
              fontWeight = FontWeight.Bold,
              color = Color.White
            )
            Icon(
              imageVector = Icons.AutoMirrored.Filled.ArrowForward,
              contentDescription = null,
              tint = Color.White,
              modifier = Modifier.size(16.dp)
            )
          }
        }
      }
    }
  }
}
}

@Composable
fun DynamicPromoHeroBanner(banner: PromoBanner) {
  Card(
    shape = RoundedCornerShape(18.dp),
    modifier = Modifier
      .width(310.dp)
      .height(140.dp)
  ) {
    Box(modifier = Modifier.fillMaxSize()) {
      AsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
          .data(banner.imageUrl)
          .crossfade(true)
          .build(),
        contentDescription = banner.title,
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize()
      )

      // Gradient Overlay
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(
            Brush.horizontalGradient(
              colors = listOf(
                Color.Black.copy(alpha = 0.85f),
                Color.Black.copy(alpha = 0.40f),
                Color.Transparent
              )
            )
          )
      )

      Column(
        modifier = Modifier
          .fillMaxSize()
          .padding(14.dp),
        verticalArrangement = Arrangement.SpaceBetween
      ) {
        Surface(
          shape = RoundedCornerShape(6.dp),
          color = NutrolixOrange
        ) {
          Text(
            text = banner.badge,
            fontSize = 9.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color.White,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
          )
        }

        Column {
          Text(
            text = banner.title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            maxLines = 1
          )
          Text(
            text = banner.subtitle,
            fontSize = 11.sp,
            color = Color.White.copy(alpha = 0.85f),
            maxLines = 2
          )
          if (banner.discountCode.isNotBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Surface(
              shape = RoundedCornerShape(4.dp),
              color = Color.White.copy(alpha = 0.2f)
            ) {
              Text(
                text = "Use Code: ${banner.discountCode}",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixLightGreen,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
              )
            }
          }
        }
      }
    }
  }
}
