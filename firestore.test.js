const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";
const ADMIN_UID = "admin_nutrolix_01";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated caller cannot read users or orders", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).get());
  await assertFails(unauthDb.collection("orders").where("uid", "==", ALICE_UID).get());
  await assertFails(unauthDb.collection("orders").get());
});

test("Public storefront catalog allows read but denies non-admin writes", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();

  await assertSucceeds(unauthDb.collection("products").get());
  await assertFails(
    aliceDb.collection("products").doc("prod_1").set({ id: "prod_1", title: "Hack", price: 1 })
  );
  await assertFails(
    aliceDb.collection("settings").doc("store").set({ isOpen: false })
  );
});

test("Authenticated user can manage own profile, addresses, and FCM tokens cleanly", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      uid: ALICE_UID,
      name: "Alice Sharma",
      email: "alice@example.com",
      verifiedPhone: "+919876543210",
      whatsappNumber: "+919876543210",
      authProviders: ["phone", "google.com"],
      phoneVerified: true,
      googleLinked: true,
      updatedAtMillis: Date.now(),
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("addresses").doc("addr_1").set({
      id: "addr_1",
      uid: ALICE_UID,
      address1: "Sector 17 Vashi",
      city: "Navi Mumbai",
      pincode: "400703",
      lat: 19.076,
      lon: 72.998,
      locationSource: "gps_google_maps",
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("fcmTokens").doc("tok_abc123").set({
      uid: ALICE_UID,
      token: "fcm_valid_token_string_1234567890",
      platform: "android-apk",
      customerPhone: "9876543210",
    })
  );
});

test("Cross-user isolation & PII protection on users, addresses, tokens, and notifications", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("users").doc(BOB_UID).set({
      uid: BOB_UID,
      name: "Bob Verma",
      phone: "+919999988888",
    });
    await db.collection("users").doc(BOB_UID).collection("addresses").doc("addr_bob").set({
      id: "addr_bob",
      uid: BOB_UID,
      address1: "Secret Lane",
      city: "Mumbai",
      pincode: "400001",
    });
    await db.collection("users").doc(BOB_UID).collection("notifications").doc("notif_bob").set({
      id: "notif_bob",
      uid: BOB_UID,
      orderId: "ORD-900",
      status: "Order Confirmed",
      title: "Confirmed",
      message: "Your order is confirmed",
      read: false,
    });
  });

  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertFails(aliceDb.collection("users").doc(BOB_UID).get());
  await assertFails(aliceDb.collection("users").get());
  await assertFails(aliceDb.collection("users").doc(BOB_UID).collection("addresses").get());
  await assertFails(aliceDb.collection("users").doc(BOB_UID).collection("notifications").get());
});

test("Shadow Update & RBAC privilege escalation are rejected", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();

  // Ghost field isAdmin / role rejected on user profile
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).set({
      uid: ALICE_UID,
      name: "Alice",
      isAdmin: true,
      role: "ADMIN",
    })
  );

  // Regular user cannot create their own admin doc
  await assertFails(
    aliceDb.collection("admins").doc(ALICE_UID).set({ uid: ALICE_UID, role: "ADMIN" })
  );
});

test("Email spoofing with email_verified=false is rejected for admin operations", async () => {
  const spoofedAdminDb = testEnv.authenticatedContext("spoof_uid", {
    email: "nutrolix.in@gmail.com",
    email_verified: false,
  }).firestore();

  await assertFails(
    spoofedAdminDb.collection("products").doc("prod_hack").set({
      id: "prod_hack",
      title: "Fake Product",
      price: 10,
    })
  );
  await assertFails(spoofedAdminDb.collection("orders").get());
});

test("Orders isolation: owner can create & query own orders, cannot hijack or bypass status", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();

  // Owner cannot create order pre-marked as Delivered
  await assertFails(
    aliceDb.collection("orders").doc("ORD-ILLEGAL").set({
      id: "ORD-ILLEGAL",
      uid: ALICE_UID,
      status: "Delivered",
      items: [{ title: "Protein Atta", qty: 1 }],
      total: 499,
    })
  );

  // Valid owner order creation
  await assertSucceeds(
    aliceDb.collection("orders").doc("ORD-1001").set({
      id: "ORD-1001",
      orderId: "ORD-1001",
      uid: ALICE_UID,
      status: "Order Placed",
      items: [{ title: "High Protein Atta", qty: 1, price: 349 }],
      total: 349,
      grandTotal: 349,
    })
  );

  // Owner query matching uid == ALICE_UID succeeds
  await assertSucceeds(aliceDb.collection("orders").where("uid", "==", ALICE_UID).get());
  // Unfiltered query without uid fails
  await assertFails(aliceDb.collection("orders").get());
  // Cross-user read fails
  await assertFails(bobDb.collection("orders").doc("ORD-1001").get());
  // Customer cannot self-promote status to Out for Delivery
  await assertFails(
    aliceDb.collection("orders").doc("ORD-1001").update({ status: "Out for Delivery" })
  );
});

test("Verified Admin can manage catalog, list orders, update status, and send notifications", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("admins").doc(ADMIN_UID).set({ uid: ADMIN_UID, role: "ADMIN" });
    await db.collection("orders").doc("ORD-2002").set({
      id: "ORD-2002",
      uid: ALICE_UID,
      status: "Order Placed",
      items: [{ title: "Nutri Meal", qty: 1 }],
      total: 299,
    });
  });

  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

  await assertSucceeds(
    adminDb.collection("products").doc("prod_atta").set({
      id: "prod_atta",
      title: "Nutrolix High Protein Atta",
      price: 399,
    })
  );
  await assertSucceeds(adminDb.collection("orders").get());
  await assertSucceeds(
    adminDb.collection("orders").doc("ORD-2002").update({
      status: "Out for Delivery",
      courier: "Delhivery",
      trackingNumber: "DLV123456",
    })
  );
  await assertSucceeds(
    adminDb.collection("users").doc(ALICE_UID).collection("notifications").doc("notif_1").set({
      id: "notif_1",
      uid: ALICE_UID,
      orderId: "ORD-2002",
      status: "Out for Delivery",
      title: "Nutrolix – Out for Delivery!",
      message: "Your order is out for delivery.",
      read: false,
    })
  );
});
