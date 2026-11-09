package com.example

import com.example.data.NutrolixRepository
import com.example.model.Coupon
import com.example.model.OrderStatus
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class NutrolixUnitTest {

  private lateinit var repository: NutrolixRepository

  @Before
  fun setUp() {
    repository = NutrolixRepository()
  }

  @Test
  fun testInitialCatalogNotEmpty() {
    val meals = repository.meals.value
    assertTrue("Meals catalog should have items", meals.isNotEmpty())
    assertTrue("At least one bestseller item should exist", meals.any { it.isBestseller })
  }

  @Test
  fun testAddToCartAndMacroCalculations() {
    val meal = repository.meals.value.first()
    val portion = meal.portionSizes.first()

    repository.addToCart(meal, portion, emptyList(), quantity = 2)

    val cart = repository.cartItems.value
    assertEquals(1, cart.size)
    assertEquals(2, cart.first().quantity)
    assertEquals(meal.proteinGrams * 2, cart.first().totalProtein)
    assertEquals(meal.calories * 2, cart.first().totalCalories)
  }

  @Test
  fun testCouponApplication() {
    val meal = repository.meals.value.first()
    repository.addToCart(meal, meal.portionSizes.first(), emptyList(), quantity = 2)

    val coupon = Coupon("NUTROLIX100", "Flat 100 off", 100.0, 399.0, "Test coupon")
    repository.applyCoupon(coupon)

    assertEquals("NUTROLIX100", repository.appliedCoupon.value?.code)
  }

  @Test
  fun testPlaceOrderWorkflow() {
    val meal = repository.meals.value.first()
    repository.addToCart(meal, meal.portionSizes.first(), emptyList(), quantity = 1)

    val initialCount = repository.orders.value.size
    val order = repository.placeOrder("UPI (Google Pay)")

    assertNotNull(order.id)
    assertEquals("PAID_VERIFIED", order.paymentStatus)
    assertEquals(initialCount + 1, repository.orders.value.size)
    assertTrue("Cart should be cleared after order", repository.cartItems.value.isEmpty())
  }

  @Test
  fun testDeliveryOtpVerification() {
    val meal = repository.meals.value.first()
    repository.addToCart(meal, meal.portionSizes.first(), emptyList(), quantity = 1)
    val order = repository.placeOrder("UPI")

    val wrongOtp = "0000"
    val isWrongOtpAccepted = repository.verifyDeliveryOtp(order.id, wrongOtp)
    assertFalse(isWrongOtpAccepted)

    val correctOtp = order.deliveryOtp
    val isCorrectOtpAccepted = repository.verifyDeliveryOtp(order.id, correctOtp)
    assertTrue(isCorrectOtpAccepted)

    val updatedOrder = repository.orders.value.find { it.id == order.id }
    assertEquals(OrderStatus.DELIVERED, updatedOrder?.status)
  }
}
