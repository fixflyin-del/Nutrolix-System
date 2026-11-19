const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../lib/nutrolix-core');

test('Phone normalization & E.164 formatting for +91', () => {
  assert.equal(core.normalizePhone('+91 98765-43210'), '9876543210');
  assert.equal(core.normalizePhone('09876543210'), '9876543210');
  assert.equal(core.formatE164IndianPhone('9876543210'), '+919876543210');
  assert.equal(core.formatE164IndianPhone('+91 98765 43210'), '+919876543210');
  assert.equal(core.formatE164IndianPhone('12345'), '');
});

test('Order status notification copy covers all 6 canonical statuses and dedup keys', () => {
  const cases = [
    ['Order Confirmed', 'confirmed', 'Order Confirmed'],
    ['Processing', 'processing', 'Processing'],
    ['Preparing', 'processing', 'Processing'],
    ['Packed', 'packed', 'Packed'],
    ['Ready to Pickup', 'packed', 'Packed'],
    ['Out for Delivery', 'out_for_delivery', 'Out for Delivery'],
    ['Shipped / Out for Delivery', 'out_for_delivery', 'Out for Delivery'],
    ['Delivered', 'delivered', 'Delivered'],
    ['Cancelled', 'cancelled', 'Cancelled']
  ];

  for (const [input, expectedKey, expectedLabel] of cases) {
    const copy = core.buildOrderStatusNotificationCopy('ORD-778899', input, 'Delhivery', 'AWB9988');
    assert.equal(copy.statusKey, expectedKey, `Expected ${expectedKey} for ${input}`);
    assert.equal(copy.statusLabel, expectedLabel, `Expected ${expectedLabel} for ${input}`);
    assert.equal(copy.dedupKey, `notif_ORD-778899_${expectedKey}`);
    assert.ok(copy.title.includes('Nutrolix'));
    assert.ok(copy.message.includes('ORD-778899'));
  }

  const transit = core.buildOrderStatusNotificationCopy('ORD-1122', 'Out for Delivery', 'BlueDart', 'BD123');
  assert.ok(transit.message.includes('BlueDart'));
  assert.ok(transit.message.includes('BD123'));
});

test('Nominatim free geocode parser extracts PIN code, city, state, and formattedAddress', () => {
  const sampleNominatimResponse = {
    display_name: 'Sector 17, Vashi, Navi Mumbai, Thane, Maharashtra, 400703, India',
    address: {
      road: 'Palm Beach Marg',
      suburb: 'Sector 17',
      city: 'Navi Mumbai',
      state_district: 'Thane',
      state: 'Maharashtra',
      postcode: '400703',
      country: 'India'
    }
  };

  const parsed = core.parseNominatimGeocodeResponse(19.076, 72.998, sampleNominatimResponse);
  assert.equal(parsed.success, true);
  assert.equal(parsed.provider, 'nominatim');
  assert.equal(parsed.pincode, '400703');
  assert.equal(parsed.city, 'Sector 17, Navi Mumbai');
  assert.equal(parsed.state, 'Maharashtra');
  assert.ok(parsed.formattedAddress.includes('400703'));

  const errorParsed = core.parseNominatimGeocodeResponse(19.07, 72.99, { error: 'Unable to geocode' });
  assert.equal(errorParsed.success, false);
  assert.equal(errorParsed.fallbackRequired, true);
});

test('BigDataCloud free fallback parser extracts city, state, and postal code cleanly', () => {
  const sampleBdcResponse = {
    locality: 'Vashi',
    city: 'Navi Mumbai',
    principalSubdivision: 'Maharashtra',
    postcode: '400703',
    countryName: 'India'
  };

  const parsed = core.parseBigDataCloudGeocodeResponse(19.076, 72.998, sampleBdcResponse);
  assert.equal(parsed.success, true);
  assert.equal(parsed.provider, 'bigdatacloud');
  assert.equal(parsed.pincode, '400703');
  assert.equal(parsed.city, 'Vashi, Navi Mumbai');
  assert.equal(parsed.state, 'Maharashtra');
});

test('reverseGeocodeFree handles invalid coords gracefully without requiring any paid API key', async () => {
  const invalid = await core.reverseGeocodeFree(999, 72);
  assert.equal(invalid.success, false);
  assert.equal(invalid.fallbackRequired, true);
  assert.equal(invalid.code, 'INVALID_COORDS');
});

test('FCM permanent unregistered token error detection & recipient matching', () => {
  assert.equal(core.isPermanentFcmTokenError(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), true);
  assert.equal(core.isPermanentFcmTokenError(410, {}), true);
  assert.equal(core.isPermanentFcmTokenError(403, { error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }), true);
  assert.equal(core.isPermanentFcmTokenError(500, { error: { status: 'INTERNAL' } }), false);

  const tokens = [
    { uid: 'uid_alice', fcmToken: 'fcm_tok_1', customerPhone: '+91 9876543210' },
    { uid: 'uid_alice', fcmToken: 'fcm_tok_1', customerPhone: '9876543210' }, // duplicate
    { uid: 'uid_bob', fcmToken: 'fcm_tok_bob', customerEmail: 'bob@example.com' },
    { uid: '', fcmToken: 'fcm_tok_phone_only', customerPhone: '9876543210' }
  ];

  const matched = core.matchCustomerTokens(tokens, { uid: 'uid_alice', phone: '9876543210' });
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map(t => t.fcmToken), ['fcm_tok_1', 'fcm_tok_phone_only']);
});

const customerSync = require('../lib/nutrolix-customer-sync');
const purgeLib = require('../lib/nutrolix-purge');

test('Canonical customer UID, valid Indian mobile check, and non-clobbering name resolution', () => {
  assert.equal(core.isValidIndianMobile('9876543210'), true);
  assert.equal(core.isValidIndianMobile('+91 9876543210'), true);
  assert.equal(core.isValidIndianMobile('1234567890'), false);
  assert.equal(core.canonicalCustomerUid('+91 98765-43210'), 'phone_9876543210');
  assert.equal(core.canonicalCustomerUid('invalid'), '');

  assert.equal(core.isMeaningfulCustomerName('Nutrolix Customer'), false);
  assert.equal(core.isMeaningfulCustomerName('Guest'), false);
  assert.equal(core.isMeaningfulCustomerName('Aarav Mehta'), true);
  assert.equal(core.pickBestCustomerName('Nutrolix Customer', 'Aarav Mehta', 'Customer'), 'Aarav Mehta');
  assert.equal(core.pickBestCustomerName('', 'Nutrolix Customer'), 'Nutrolix Customer');

  const variants = core.phoneVariants('9876543210');
  assert.ok(variants.includes('9876543210'));
  assert.ok(variants.includes('+919876543210'));
  assert.ok(variants.includes('919876543210'));
});

test('matchCustomerTokens derives phone from canonical phone_<digits> UID even when customerPhone omitted', () => {
  const tokens = [
    { uid: 'phone_9876543210', fcmToken: 'tok_from_canonical_uid' },
    { uid: 'old_uid_1', fcmToken: 'tok_from_phone_field', customerPhone: '+91 9876543210' },
    { uid: 'phone_9111122222', fcmToken: 'tok_other_user', customerPhone: '9111122222' }
  ];
  const matched = core.matchCustomerTokens(tokens, { uid: 'phone_9876543210', phone: '' });
  assert.deepEqual(matched.map(t => t.fcmToken), ['tok_from_canonical_uid', 'tok_from_phone_field']);
});

test('HMAC admin session token signing & verification rejects tampering and expiry', () => {
  const token = core.signAdminSessionToken('nutrolix.in@gmail.com', 60);
  assert.ok(token && token.includes('.'));
  const verified = core.verifyAdminSessionToken(token);
  assert.ok(verified);
  assert.equal(verified.email, 'nutrolix.in@gmail.com');
  assert.equal(verified.role, 'ADMIN');

  // Supports Bearer prefix cleanly
  const bearerVerified = core.verifyAdminSessionToken('Bearer ' + token);
  assert.ok(bearerVerified);

  // Tampered signature must fail
  const parts = token.split('.');
  const tampered = parts[0] + '.invalidsig' + parts[1].slice(10);
  assert.equal(core.verifyAdminSessionToken(tampered), null);

  // Expired token must fail
  const expiredToken = core.signAdminSessionToken('nutrolix.in@gmail.com', -10);
  assert.equal(core.verifyAdminSessionToken(expiredToken), null);
});

test('Authoritative order validation enforces items, Indian mobile, PIN code & address and normalizes canonical UID', () => {
  const validRes = customerSync.validateOrderPayload({
    uid: 'legacy_firebase_uid_xyz',
    customerPhone: '+91 98765 43210',
    customerName: 'Priya Singh',
    deliveryAddress: {
      address1: 'B-402 Green Valley, Kharghar',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '410210'
    },
    items: [{ id: 'p1', title: 'High Protein Atta', quantity: 2, price: 399 }],
    grandTotal: 798
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.normalizedOrder.uid, 'phone_9876543210');
  assert.equal(validRes.normalizedOrder.verifiedPhone, '9876543210');
  assert.equal(validRes.normalizedOrder.customerName, 'Priya Singh');
  assert.equal(validRes.normalizedOrder.status, 'Order Placed');

  const emptyItems = customerSync.validateOrderPayload({
    customerPhone: '9876543210',
    deliveryAddress: { address1: 'Flat 10', pincode: '410210' },
    items: [],
    grandTotal: 100
  });
  assert.equal(emptyItems.valid, false);
  assert.ok(emptyItems.errors.some(e => e.includes('item')));

  const badPhone = customerSync.validateOrderPayload({
    customerPhone: '12345',
    deliveryAddress: { address1: 'Flat 10', pincode: '410210' },
    items: [{ title: 'Meal', quantity: 1, price: 200 }],
    grandTotal: 200
  });
  assert.equal(badPhone.valid, false);
  assert.ok(badPhone.errors.some(e => e.includes('WhatsApp/mobile')));

  const badPin = customerSync.validateOrderPayload({
    customerPhone: '9876543210',
    deliveryAddress: { address1: 'Flat 10', pincode: '410' },
    items: [{ title: 'Meal', quantity: 1, price: 200 }],
    grandTotal: 200
  });
  assert.equal(badPin.valid, false);
  assert.ok(badPin.errors.some(e => e.includes('PIN')));
});

test('Push delivery attempt classifier produces accurate honest states', () => {
  assert.equal(customerSync.classifyDeliveryAttempt({ channel: 'fcm', sent: true, statusCode: 200 }).state, 'delivered');
  assert.equal(customerSync.classifyDeliveryAttempt({ channel: 'webpush', sent: false, accepted: true, statusCode: 201 }).state, 'accepted');
  assert.equal(customerSync.classifyDeliveryAttempt({ channel: 'fcm', sent: false, detail: 'NO_TOKENS_MATCHED' }).state, 'unavailable');
  assert.equal(customerSync.classifyDeliveryAttempt({ channel: 'fcm', sent: false, statusCode: 404, permanentFailure: true, detail: 'UNREGISTERED' }).state, 'failed');
});

test('Purge guardrails isolate customer collections from preserved catalog/admin collections and enforce exact confirmation phrase', async () => {
  for (const preserved of ['admins', 'adminTokens', 'products', 'meals', 'categories', 'banners', 'coupons', 'settings', 'blogs', 'reviews', 'hero_products', 'catalogStore']) {
    assert.equal(purgeLib.isPreservedCollection(preserved), true);
    assert.equal(purgeLib.isTargetCustomerCollection(preserved), false);
  }
  for (const target of ['users', 'orders', 'notificationTokens', 'fcmTokens', 'notificationDedups', 'notificationDeliveries', 'customerDiscounts']) {
    assert.equal(purgeLib.isTargetCustomerCollection(target), true);
    assert.equal(purgeLib.isPreservedCollection(target), false);
  }

  await assert.rejects(
    () => purgeLib.purgeCustomerData({ dryRun: false, confirmPhrase: 'wrong phrase' }),
    (err) => err && err.code === 'CONFIRM_PHRASE_REQUIRED' && err.statusCode === 400
  );
});

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const server = require('../server');

test('deduplicatePushTargets prevents double browser pushes per deviceId while keeping distinct devices', () => {
  const targets = [
    { deviceId: 'web_chrome_desktop', platform: 'web-fcm', fcmToken: 'fcm_desktop_1234567890', updatedAtMillis: 1000 },
    { deviceId: 'web_chrome_desktop', platform: 'web', subscription: { endpoint: 'https://fcm.googleapis.com/wp/1', keys: { p256dh: 'a', auth: 'b' } }, updatedAtMillis: 900 },
    { deviceId: 'web_chrome_mobile', platform: 'web', subscription: { endpoint: 'https://fcm.googleapis.com/wp/2', keys: { p256dh: 'c', auth: 'd' } }, updatedAtMillis: 1100 },
    { deviceId: 'apk_device_1', platform: 'android-apk', fcmToken: 'fcm_android_1234567890', updatedAtMillis: 1200 },
    { platform: 'android-apk', fcmToken: 'fcm_legacy_no_device_id' }
  ];

  const deduped = core.deduplicatePushTargets(targets);
  assert.equal(deduped.length, 4);
  const desktop = deduped.find(d => d.deviceId === 'web_chrome_desktop');
  assert.equal(desktop.platform, 'web');
  assert.ok(desktop.subscription && desktop.subscription.endpoint);
});

test('buildMergedCustomerProfile never lets stale localStorage extraProfile overwrite Firestore data unless explicit override', () => {
  const remoteDoc = {
    uid: 'phone_9876543210',
    name: 'Ananya Verma',
    email: 'ananya@example.com',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400703',
    defaultAddress: 'Flat 901, Palm Greens'
  };
  const staleLocalProfile = {
    name: 'Nutrolix Customer',
    email: 'old_wrong@example.com',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    defaultAddress: 'Old Stale Street'
  };

  const mergedHydrate = customerSync.buildMergedCustomerProfile({
    matchedUserDocs: [remoteDoc],
    extraProfile: staleLocalProfile,
    cleanPhone: '9876543210',
    resolvedUid: 'phone_9876543210',
    allowProfileOverride: false
  });
  assert.equal(mergedHydrate.name, 'Ananya Verma');
  assert.equal(mergedHydrate.city, 'Mumbai');
  assert.equal(mergedHydrate.pincode, '400703');
  assert.equal(mergedHydrate.defaultAddress, 'Flat 901, Palm Greens');
  assert.equal(mergedHydrate.email, 'ananya@example.com');

  const mergedExplicitEdit = customerSync.buildMergedCustomerProfile({
    matchedUserDocs: [remoteDoc],
    extraProfile: { city: 'Thane', pincode: '400601' },
    cleanPhone: '9876543210',
    resolvedUid: 'phone_9876543210',
    allowProfileOverride: true
  });
  assert.equal(mergedExplicitEdit.city, 'Thane');
  assert.equal(mergedExplicitEdit.pincode, '400601');
  assert.equal(mergedExplicitEdit.name, 'Ananya Verma');
});

test('Manual push ON/OFF toggles are removed across web and Android assets, and COD order save normalizes NutrolixFirebase return value', () => {
  const root = path.resolve(__dirname, '..');
  const forbiddenPatterns = [
    'btnAccountPushToggle',
    'btnOrdersPushToggle',
    'handleAccountPushToggle',
    'handleOrdersPushToggle',
    'setNotificationsEnabled',
    'Enable Order Push Alerts',
    'Enable Push Order Alert'
  ];

  const filesToCheck = [
    'public/account.html',
    'public/orders.html',
    'public/assets/nutrolix-notifications.js',
    'app/src/main/assets/web/account.html',
    'app/src/main/assets/web/orders.html',
    'app/src/main/assets/web/assets/nutrolix-notifications.js'
  ];

  for (const rel of filesToCheck) {
    const content = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const pat of forbiddenPatterns) {
      assert.equal(content.includes(pat), false, `Forbidden toggle pattern "${pat}" found in ${rel}`);
    }
  }

  for (const relCart of ['public/cart.html', 'app/src/main/assets/web/cart.html']) {
    const cartHtml = fs.readFileSync(path.join(root, relCart), 'utf8');
    assert.equal(cartHtml.includes("profile.whatsapp || '9076254354'"), false, `Hardcoded customer fallback phone found in ${relCart}`);
    assert.ok(cartHtml.includes('const resolvedOrder = (data && data.order) ? data.order : data;'), `Missing COD saveOrder normalization in ${relCart}`);
  }
});

test('End-to-end HTTP server verification: config-status, token guardrails, order idempotency & status push dedup', async () => {
  const root = path.resolve(__dirname, '..');
  const dataDir = path.join(root, 'public', 'data');
  const trackedFiles = ['notification_tokens.json', 'notifications_log.json', 'nutrition_orders.json'];
  const originals = {};
  for (const f of trackedFiles) {
    const p = path.join(dataDir, f);
    originals[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  assert.ok(port > 0, 'Ephemeral HTTP test port should be bound');

  const httpReq = (method, reqPath, bodyObj = null, headers = {}) => new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: {
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });

  try {
    const cfg = await httpReq('GET', '/api/notifications/config-status');
    assert.equal(cfg.status, 200);
    assert.equal(typeof cfg.json.hasFirebaseServiceAccount, 'boolean');
    assert.equal(typeof cfg.json.hasVapidPublicKey, 'boolean');
    assert.equal(typeof cfg.json.hasVapidPrivateKey, 'boolean');
    assert.equal(typeof cfg.json.hasFast2Sms, 'boolean');

    // 1. Canonical sync requires verified Firebase token
    const unauthSync = await httpReq('POST', '/api/auth/sync-canonical', { phone: '9876543210' });
    assert.equal(unauthSync.status, 401);

    // 2. Register token rejects dummy tokens & invalid short tokens
    const dummyRes = await httpReq('POST', '/api/notifications/register-token', {
      uid: 'verify_uid_001',
      fcmToken: 'verify_dummy_fcm_token_1234567890'
    });
    assert.equal(dummyRes.status, 400);

    // 3. Register valid APK token + valid Web Push subscription on separate devices
    const apkReg = await httpReq('POST', '/api/notifications/register-token', {
      uid: 'phone_9898989898',
      deviceId: 'apk_dev_test_1',
      customerPhone: '9898989898',
      fcmToken: 'fcm_real_like_token_abcdefghijklmnopqrstuvwxyz_001',
      platform: 'android-apk'
    });
    assert.equal(apkReg.status, 200);
    assert.equal(apkReg.json.success, true);

    const webReg = await httpReq('POST', '/api/notifications/register-token', {
      uid: 'phone_9898989898',
      deviceId: 'web_dev_test_1',
      customerPhone: '9898989898',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-unique-123456789',
        keys: { p256dh: 'BNtestkey1234', auth: 'testauth1234' }
      },
      platform: 'web'
    });
    assert.equal(webReg.status, 200);
    assert.equal(webReg.json.success, true);

    // 4. Order creation + Idempotency dedup
    const idempKey = 'idem_test_' + Date.now();
    const ordPayload = {
      orderId: 'NTX-TEST-' + Date.now().toString().slice(-6),
      idempotencyKey: idempKey,
      customerPhone: '9898989898',
      customerName: 'Rohan Kulkarni',
      deliveryAddress: { address1: 'Plot 12, Nerul', city: 'Navi Mumbai', state: 'Maharashtra', pincode: '400706' },
      items: [{ id: 'p1', title: 'High Protein Atta', quantity: 1, price: 399 }],
      grandTotal: 399
    };

    const create1 = await httpReq('POST', '/api/nutrition-orders', ordPayload);
    assert.equal(create1.status, 200);
    assert.equal(create1.json.success, true);
    assert.equal(create1.json.order.uid, 'phone_9898989898');

    const placedPush = await httpReq('POST', '/api/notifications/order-placed', { orderId: ordPayload.orderId });
    assert.equal(placedPush.status, 200);
    assert.equal(placedPush.json.success, true);

    const createDup = await httpReq('POST', '/api/nutrition-orders', { ...ordPayload, orderId: 'NTX-TEST-DIFFERENT-ID' });
    assert.equal(createDup.status, 200);
    assert.equal(createDup.json.deduplicated, true);
    assert.equal(createDup.json.order.orderId, ordPayload.orderId);

    // 5. Order status progression + dedup
    for (const st of ['Order Confirmed', 'Processing', 'Packed', 'Out for Delivery', 'Delivered']) {
      const sRes = await httpReq('POST', '/api/nutrition-orders/status', { orderId: ordPayload.orderId, status: st });
      assert.equal(sRes.status, 200);
      assert.equal(sRes.json.success, true);
      assert.equal(sRes.json.notificationSent, true);
    }

    const repeatDelivered = await httpReq('POST', '/api/nutrition-orders/status', { orderId: ordPayload.orderId, status: 'Delivered' });
    assert.equal(repeatDelivered.status, 200);
    assert.equal(repeatDelivered.json.deduplicated, true);

    // 6. Scoped order & notification history retrieval for phone_9898989898
    const ordersRes = await httpReq('GET', '/api/nutrition-orders?uid=phone_9898989898&phone=9898989898');
    assert.equal(ordersRes.status, 200);
    assert.ok(Array.isArray(ordersRes.json) && ordersRes.json.some(o => o.orderId === ordPayload.orderId));

    const histRes = await httpReq('GET', '/api/notifications/user-history?uid=phone_9898989898&phone=9898989898');
    assert.equal(histRes.status, 200);
    assert.ok(Array.isArray(histRes.json.notifications) && histRes.json.notifications.length >= 6);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const f of trackedFiles) {
      const p = path.join(dataDir, f);
      if (originals[f] !== null) fs.writeFileSync(p, originals[f], 'utf8');
    }
  }
});

test('My Orders UI removes Order Status Notifications box & Order Alerts badge while keeping internal push & PTR', () => {
  const root = path.resolve(__dirname, '..');
  const forbiddenOrdersPatterns = [
    'ordersPushStatusBadge',
    'liveNotificationsCard',
    'Order Status Notifications',
    'Order Alerts: Active',
    'Order Alerts:'
  ];
  for (const rel of ['public/orders.html', 'app/src/main/assets/web/orders.html']) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const pat of forbiddenOrdersPatterns) {
      assert.equal(html.includes(pat), false, `Removed UI element "${pat}" still present in ${rel}`);
    }
    assert.ok(html.includes('nutrolix-notifications.js'), `Missing internal notifications script in ${rel}`);
    assert.ok(html.includes('assets/pull-to-refresh.js'), `Missing pull-to-refresh.js in ${rel}`);
  }
});

test('All customer & admin web pages include pull-to-refresh.js and APKs load live Vercel URLs with native PullToRefresh wrapper', () => {
  const root = path.resolve(__dirname, '..');
  const ptrPages = [
    'public/index.html',
    'public/food.html',
    'public/shop.html',
    'public/product.html',
    'public/cart.html',
    'public/orders.html',
    'public/account.html',
    'public/admin.html',
    'public/blogs.html',
    'public/article.html',
    'public/about.html',
    'public/contact.html',
    'public/faqs.html',
    'public/shipping.html',
    'public/refund.html',
    'public/cancellation.html',
    'public/terms.html',
    'public/privacy.html',
    'public/download.html'
  ];
  for (const rel of ptrPages) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(html.includes('assets/pull-to-refresh.js'), `Missing assets/pull-to-refresh.js in ${rel}`);
  }

  const mainKt = fs.readFileSync(path.join(root, 'app/src/main/java/com/example/MainActivity.kt'), 'utf8');
  const adminKt = fs.readFileSync(path.join(root, 'app/src/main/java/com/example/AdminActivity.kt'), 'utf8');
  const ptrKt = fs.readFileSync(path.join(root, 'app/src/main/java/com/example/util/PullToRefreshWebViewWrapper.kt'), 'utf8');

  assert.ok(mainKt.includes('loadUrl(deepLinkUrl ?: MainActivity.LIVE_SERVER_URL)'), 'Customer APK must boot from LIVE_SERVER_URL');
  assert.ok(mainKt.includes('PullToRefreshWebViewWrapper'), 'Customer APK must use PullToRefreshWebViewWrapper');
  assert.ok(mainKt.includes('window.__nutrolixNativePtr = true;'), 'Customer APK must notify web PTR script');

  assert.ok(adminKt.includes('loadUrl(AdminActivity.LIVE_SERVER_ADMIN_URL)'), 'Admin APK must boot from LIVE_SERVER_ADMIN_URL');
  assert.ok(adminKt.includes('PullToRefreshWebViewWrapper'), 'Admin APK must use PullToRefreshWebViewWrapper');
  assert.ok(adminKt.includes('window.__nutrolixNativePtr = true;'), 'Admin APK must notify web PTR script');
  assert.ok(ptrKt.includes('NutrolixPtrBridge'), 'PullToRefreshWebViewWrapper must expose NutrolixPtrBridge');
});

test('Cart checkout skips OTP for authenticated users and persists first-order address on client & server', () => {
  const root = path.resolve(__dirname, '..');
  const cartHtml = fs.readFileSync(path.join(root, 'public/cart.html'), 'utf8');
  const authJs = fs.readFileSync(path.join(root, 'public/assets/nutrolix-auth.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

  assert.ok(cartHtml.includes('addr_primary'), 'cart.html should persist primary first-order address');
  assert.ok(cartHtml.includes('nutrolix:addresses-updated'), 'cart.html should notify profile/address listeners on order save');
  assert.ok(cartHtml.includes('nutrolix_saved_addresses'), 'cart.html should sync saved addresses');
  assert.equal(authJs.includes('setTimeout(() => {\n        try {\n          const nativeRaw = window.AndroidNative.getAuthUserJson'), false, 'nutrolix-auth.js should seed native auth synchronously before DOMContentLoaded');
  assert.ok(serverJs.includes("isFirstAddr ? 'addr_primary'"), 'server.js POST /api/nutrition-orders should auto-create primary profile address');
});

test('Admin Portal requires 4-digit PIN 9090 on entry and removes inner PIN/confirmation forms from Customer Data Audit UI', async () => {
  const root = path.resolve(__dirname, '..');
  for (const rel of ['public/admin.html', 'app/src/main/assets/web/admin.html']) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(html.includes('id="adminPortalLockOverlay"'), `Missing 4-digit portal lock overlay in ${rel}`);
    assert.ok(html.includes('id="adminPortalPinInput"'), `Missing 4-digit PIN input in ${rel}`);
    assert.equal(html.includes('purgeAdminPinInput'), false, `Inner purgeAdminPinInput still present in ${rel}`);
    assert.equal(html.includes('btnUnlockAdminPurge'), false, `Inner btnUnlockAdminPurge still present in ${rel}`);
    assert.equal(html.includes('purgeConfirmPhraseInput'), false, `Inner purgeConfirmPhraseInput still present in ${rel}`);
    assert.equal(html.includes('Admin PIN Required'), false, `Inner Admin PIN Required badge still present in ${rel}`);
    assert.ok(html.includes('id="btnRunCustomerDryRun"'), `Direct Dry-Run Preview button missing in ${rel}`);
    assert.ok(html.includes('id="btnExecuteLivePurge"'), `Direct Delete Customer Data button missing in ${rel}`);
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const postLogin = (payload) => new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });

  try {
    const badRes = await postLogin({ pin: '1234' });
    assert.equal(badRes.status, 401);

    const okRes = await postLogin({ pin: '9090' });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.json.success, true);
    assert.ok(core.verifyAdminSessionToken(okRes.json.token));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Fresh Admin Panel guarantees empty local stores, live reset-state endpoint, and never resurrects deleted localStorage orders', async () => {
  const root = path.resolve(__dirname, '..');
  for (const rel of [
    'public/data/nutrition_orders.json',
    'public/data/notification_tokens.json',
    'public/data/notifications_log.json',
    'app/src/main/assets/web/data/nutrition_orders.json',
    'app/src/main/assets/web/data/notification_tokens.json',
    'app/src/main/assets/web/data/notifications_log.json'
  ]) {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.deepEqual(parsed, [], `${rel} must be empty array [] for fresh admin start`);
  }

  const adminHtml = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
  assert.ok(adminHtml.includes('window.wipeAdminLocalOrderAndUserCaches'), 'admin.html must expose wipeAdminLocalOrderAndUserCaches');
  assert.equal(adminHtml.includes('...localCached,'), false, 'admin.html must never resurrect stale localStorage orders into live merge');

  const authJs = fs.readFileSync(path.join(root, 'public/assets/nutrolix-auth.js'), 'utf8');
  assert.ok(authJs.includes('/api/system/reset-state'), 'nutrolix-auth.js must sync system resetEpoch');

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    const res = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/api/system/reset-state' }, (r) => {
        let raw = '';
        r.on('data', c => raw += c);
        r.on('end', () => resolve({ status: r.statusCode, json: JSON.parse(raw) }));
      }).on('error', reject);
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(Number(res.json.resetEpoch) > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('encodeFirestorePath percent-encodes legacy user document IDs containing spaces and + signs', () => {
  assert.equal(core.encodeFirestorePath('users/+91 9877666512'), 'users/%2B91%209877666512');
  assert.equal(core.encodeFirestorePath('/users/+91 98765 43210/fcmTokens/tok_1'), 'users/%2B91%2098765%2043210/fcmTokens/tok_1');
  assert.equal(core.encodeFirestorePath('users/phone_9931354354'), 'users/phone_9931354354');
});

test('Checkout horizontal Payment & Promo UI and Healthy Food Nutrition Facts heading match requirements', () => {
  const root = path.resolve(__dirname, '..');
  for (const rel of ['public/cart.html', 'app/src/main/assets/web/cart.html']) {
    const cartHtml = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(cartHtml.includes('grid-cols-2 gap-2'), `${rel} must use compact 2-column horizontal payment selector`);
    assert.ok(cartHtml.includes('overflow-x-auto') && cartHtml.includes('whitespace-nowrap'), `${rel} must lay out promo chips in compact horizontal row`);
  }
  for (const rel of ['public/food.html', 'app/src/main/assets/web/food.html']) {
    const foodHtml = fs.readFileSync(path.join(root, rel), 'utf8');
    const nutritionIdx = foodHtml.indexOf('Nutrition Facts (Per Serving)');
    assert.ok(nutritionIdx > 0, `${rel} should keep Nutrition Facts (Per Serving) heading`);
    const headingSlice = foodHtml.slice(nutritionIdx, nutritionIdx + 220);
    assert.equal(headingSlice.includes('100% Lab Verified'), false, `${rel} must not contain 100% Lab Verified inside Nutrition Facts heading`);
  }
});

test('Customer notification v3 sound channel, Admin APK data-only alarm routing, and Mobile Admin audio unlocker are wired', () => {
  const root = path.resolve(__dirname, '..');
  const helperKt = fs.readFileSync(path.join(root, 'app/src/main/java/com/example/util/NotificationAndSoundHelper.kt'), 'utf8');
  const fcmKt = fs.readFileSync(path.join(root, 'app/src/main/java/com/example/service/NutrolixFirebaseMessagingService.kt'), 'utf8');
  const adminSvcKt = fs.readFileSync(path.join(root, 'app/src/main/java/com/example/service/AdminOrderBackgroundService.kt'), 'utf8');
  const notifJs = fs.readFileSync(path.join(root, 'public/assets/nutrolix-notifications.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
  const swJs = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

  assert.ok(helperKt.includes('CHANNEL_ID = "nutrolix_orders_channel_v3"'), 'Customer Android channel must bump to v3 with sound');
  assert.ok(helperKt.includes('RingtoneManager.TYPE_NOTIFICATION'), 'Customer notification must use default notification tone');
  assert.ok(fcmKt.includes('OrderAlarmPlayer.playOrderAlarm(applicationContext)'), 'FCM service must ring OrderAlarmPlayer on ADMIN_NEW_ORDER');
  assert.ok(fcmKt.includes('OrderNotificationHelper.sendAdminNewOrderNotification'), 'FCM service must post Admin lockscreen notification');
  assert.ok(adminSvcKt.includes('OrderStatus.PLACED || order.status == OrderStatus.CONFIRMED'), 'Admin background service must ring on CONFIRMED and PLACED orders');
  assert.ok(notifJs.includes('playCustomerNotificationTone'), 'Browser notifications must play Web Audio chime');
  assert.ok(swJs.includes('silent: false'), 'Service Worker Web Push notifications must set silent: false');
  assert.ok(adminHtml.includes('unlockAdminAudio') && adminHtml.includes('buildAdminSirenWavDataUri'), 'Mobile Admin web must unlock Web Audio + WAV fallback');
  assert.ok(adminHtml.includes('registerAdminBrowserPush'), 'Admin web portal must register admin Web Push subscription');
});

test('Product reviews and single-time delivered popup state persist across HTTP API and sync to product/food pages', async () => {
  const root = path.resolve(__dirname, '..');
  const dataDir = path.join(root, 'public', 'data');
  const tracked = ['product_reviews.json', 'review_state.json'];
  const backups = {};
  for (const f of tracked) {
    const p = path.join(dataDir, f);
    backups[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }

  const prodHtml = fs.readFileSync(path.join(root, 'public/product.html'), 'utf8');
  const foodHtml = fs.readFileSync(path.join(root, 'public/food.html'), 'utf8');
  const ordersHtml = fs.readFileSync(path.join(root, 'public/orders.html'), 'utf8');
  const reviewsJs = fs.readFileSync(path.join(root, 'public/assets/nutrolix-reviews.js'), 'utf8');

  assert.ok(prodHtml.includes('/api/product-reviews?'), 'product.html must load permanent server reviews');
  assert.ok(foodHtml.includes('/api/product-reviews'), 'food.html modal must load permanent server reviews');
  assert.ok(ordersHtml.includes('nutrolix:orders-loaded'), 'orders.html must notify NutrolixReviews when live orders load');
  assert.ok(ordersHtml.includes('window.NutrolixReviews.openReviewModalForOrder'), 'orders.html must use NutrolixReviews modal');
  assert.ok(reviewsJs.includes('nutrolix_review_shown_'), 'nutrolix-reviews.js must mark popup shown for single-time behavior');
  assert.ok(reviewsJs.includes('/api/nutrition-orders?'), 'nutrolix-reviews.js must fetch live orders to detect Delivered status');

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  const httpReq = (method, reqPath, bodyObj = null) => new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });

  try {
    const testOrderId = 'NTX-REV-TEST-' + Date.now();
    const postRev = await httpReq('POST', '/api/product-reviews', {
      orderId: testOrderId,
      productId: 'high-protein-atta',
      productIds: ['high-protein-atta', 'paneer-tikka-bowl'],
      productName: 'High Protein Atta',
      productNames: ['High Protein Atta', 'Paneer Tikka Bowl'],
      rating: 5,
      comment: 'Amazing protein quality and fresh packaging!',
      customerName: 'Aarav Sharma',
      verified: true
    });
    assert.equal(postRev.status, 200);
    assert.equal(postRev.json.success, true);
    assert.equal(postRev.json.review.orderId, testOrderId);

    const getProdRev = await httpReq('GET', '/api/product-reviews?productId=paneer-tikka-bowl');
    assert.equal(getProdRev.status, 200);
    assert.ok(Array.isArray(getProdRev.json) && getProdRev.json.some(r => r.orderId === testOrderId));

    const dismissRes = await httpReq('POST', '/api/reviews/dismiss', { orderId: 'NTX-DISMISS-1' });
    assert.equal(dismissRes.status, 200);
    assert.ok(dismissRes.json.dismissed.includes('NTX-DISMISS-1'));

    const stateRes = await httpReq('GET', '/api/reviews/state');
    assert.equal(stateRes.status, 200);
    assert.ok(stateRes.json.dismissed.includes('NTX-DISMISS-1'));
    assert.ok(stateRes.json.reviewed.includes(testOrderId));

    // Re-submitting / editing the same delivered order MUST update in-place, never create a duplicate
    const editRev = await httpReq('POST', '/api/product-reviews', {
      orderId: testOrderId,
      productId: 'high-protein-atta',
      rating: 4,
      comment: 'Edited: Great packaging and taste after trying for a week!',
      customerName: 'Aarav Sharma',
      isEdit: true
    });
    assert.equal(editRev.status, 200);
    assert.equal(editRev.json.success, true);
    assert.equal(editRev.json.updated, true);
    assert.equal(editRev.json.review.id, postRev.json.review.id);
    assert.equal(editRev.json.review.rating, 4);
    assert.equal(editRev.json.review.edited, true);

    const byOrderRes = await httpReq('GET', `/api/product-reviews?orderId=${encodeURIComponent(testOrderId)}`);
    assert.equal(byOrderRes.status, 200);
    assert.equal(byOrderRes.json.length, 1, 'Same delivered order must strictly have at most 1 review');
    assert.equal(byOrderRes.json[0].comment, 'Edited: Great packaging and taste after trying for a week!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const f of tracked) {
      const p = path.join(dataDir, f);
      if (backups[f] !== null) fs.writeFileSync(p, backups[f], 'utf8');
      else if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
});

test('Single-review Edit UI & Chrome lockscreen/background Web Push guarantees are wired', async () => {
  const http = require('http');
  const rootDir = path.join(__dirname, '..');
  const ordersHtml = fs.readFileSync(path.join(rootDir, 'public', 'orders.html'), 'utf8');
  const reviewsJs = fs.readFileSync(path.join(rootDir, 'public', 'assets', 'nutrolix-reviews.js'), 'utf8');
  const prodHtml = fs.readFileSync(path.join(rootDir, 'public', 'product.html'), 'utf8');
  const notifJs = fs.readFileSync(path.join(rootDir, 'public', 'assets', 'nutrolix-notifications.js'), 'utf8');
  const cartHtml = fs.readFileSync(path.join(rootDir, 'public', 'cart.html'), 'utf8');
  const swJs = fs.readFileSync(path.join(rootDir, 'public', 'sw.js'), 'utf8');
  const vercelJson = fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8');

  // Issue 1 UI & client deduplication checks
  assert.ok(ordersHtml.includes('Edit Review'), 'orders.html must render Edit Review when order already reviewed');
  assert.ok(ordersHtml.includes('hasReviewForOrder'), 'orders.html must check hasReviewForOrder');
  assert.ok(reviewsJs.includes('Edit Your Review'), 'nutrolix-reviews.js must switch modal to Edit Your Review mode');
  assert.ok(reviewsJs.includes('rev_ord_'), 'nutrolix-reviews.js must use deterministic per-order ID');
  assert.ok(prodHtml.includes("'order_' + String(raw.orderId)"), 'product.html must deduplicate merged reviews by orderId');

  // Issue 2 Chrome Web Push & lockscreen checks
  assert.ok(notifJs.includes('ensureWebPushSynced'), 'nutrolix-notifications.js must expose ensureWebPushSynced');
  assert.ok(notifJs.includes('keysMatch'), 'nutrolix-notifications.js must detect and replace mismatched VAPID subscriptions');
  assert.ok(notifJs.includes('attachLoggedInGestureAutoPrompt'), 'nutrolix-notifications.js must prompt logged-in Chrome users on first gesture');
  assert.ok(cartHtml.includes('await window.NutrolixNotifications?.ensureWebPushSynced'), 'cart.html must await Web Push sync before order-placed/PayU');
  assert.ok(swJs.includes('silent: false') && swJs.includes('requireInteraction: true') && swJs.includes('pushsubscriptionchange'), 'sw.js must emit audible lockscreen notifications and handle pushsubscriptionchange');
  assert.ok(vercelJson.includes('firebase-messaging-sw.js') && vercelJson.includes('Service-Worker-Allowed'), 'vercel.json must serve sw.js & firebase-messaging-sw.js uncached');

  const server = require(path.join(rootDir, 'server.js'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    const swRes = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/firebase-messaging-sw.js' }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: raw }));
      }).on('error', reject);
    });
    assert.equal(swRes.status, 200);
    assert.equal(swRes.headers['service-worker-allowed'], '/');
    assert.ok(swRes.body.includes('pushsubscriptionchange'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Admin Storefront category dropdown matches User Webapp Store categories identically', () => {
  const rootDir = path.join(__dirname, '..');
  const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
  const shopHtml = fs.readFileSync(path.join(rootDir, 'public', 'shop.html'), 'utf8');

  const pkgMatch = adminHtml.match(/<select id="pkgCategory"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(pkgMatch, 'admin.html must contain #pkgCategory select');
  const adminCategories = Array.from(pkgMatch[1].matchAll(/<option value="([^"]+)"/g)).map(m => m[1]);

  const shopCatMatch = shopHtml.match(/id="packagedCategoryTabs"[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(shopCatMatch, 'shop.html must contain #packagedCategoryTabs');
  const shopCategories = Array.from(shopCatMatch[0].matchAll(/window\.selectCategory\('([^']+)'/g))
    .map(m => m[1])
    .filter(c => c !== 'All');

  assert.deepEqual(adminCategories, core.STORE_CATEGORIES);
  assert.deepEqual(shopCategories, core.STORE_CATEGORIES);

  // Explicit canonical categories must NEVER be overwritten by product title keywords
  assert.equal(core.normalizeStoreCategory('Nutrition Meal', 'High Protein Atta Meal'), 'Nutrition Meal');
  assert.equal(core.normalizeStoreCategory('Protein Snacks', 'Healthy Oat Milk Drink'), 'Protein Snacks');
  assert.equal(core.normalizeStoreCategory('Body Building & Strength', 'Atta Muscle Blend'), 'Body Building & Strength');
  assert.equal(core.normalizeStoreCategory('High-Protein Flours', 'Nutrolix Flour'), 'Protein Atta');
  assert.equal(core.normalizeStoreCategory('Cold-Pressed Oils', 'Kalonji Oil'), 'Nutrition Drink');
});

test('verifyAndResolveIndianPincode rejects bogus OSM postcodes (400010 for Taloja, Panvel) and resolves accurate India Post PINs', async () => {
  // 1. Exact Taloja screenshot scenario: OSM returns 400010 for Taloja Phase-II, Panvel, Raigad
  const osmTaloja = core.parseNominatimGeocodeResponse(19.075, 73.112, {
    display_name: 'Chatrapati Shivaji Maharaj Road, Taloja Phase-II, Taloja, Panvel, Panvel Taluka, Raigad, Maharashtra, 400010, India',
    address: {
      road: 'Chatrapati Shivaji Maharaj Road',
      suburb: 'Taloja',
      town: 'Panvel',
      county: 'Panvel Taluka',
      state_district: 'Raigad',
      state: 'Maharashtra',
      postcode: '400010',
      country: 'India'
    }
  });
  assert.equal(osmTaloja.pincode, '400010');

  const resolvedTaloja = await core.verifyAndResolveIndianPincode(osmTaloja);
  assert.equal(resolvedTaloja.pincode, '410208');
  assert.ok(!resolvedTaloja.formattedAddress.includes('400010'), 'Incorrect 400010 should be replaced in formattedAddress');
  assert.ok(resolvedTaloja.formattedAddress.includes('410208'), 'Correct 410208 should appear in formattedAddress');

  // 2. General India district-mismatch recovery outside Navi Mumbai override map (via mocked India Post lookup)
  const osmPuneMisattributed = core.parseNominatimGeocodeResponse(18.56, 73.80, {
    display_name: 'Aundh, Pune, Maharashtra, 400001, India',
    address: {
      suburb: 'Aundh',
      city: 'Pune',
      state_district: 'Pune',
      state: 'Maharashtra',
      postcode: '400001',
      country: 'India'
    }
  });

  const resolvedPune = await core.verifyAndResolveIndianPincode(osmPuneMisattributed, {
    lookupPincodeFn: async (pin) => {
      if (pin === '400001') {
        return [{ Name: 'Fort', District: 'Mumbai', State: 'Maharashtra', Block: 'Mumbai', DeliveryStatus: 'Delivery', Pincode: '400001' }];
      }
      return [];
    },
    lookupPostOfficeFn: async (place) => {
      if (place.toLowerCase() === 'aundh') {
        return [
          { Name: 'Aundh', District: 'Satara', State: 'Maharashtra', DeliveryStatus: 'Delivery', Pincode: '415510' },
          { Name: 'Aundh', District: 'Pune', State: 'Maharashtra', DeliveryStatus: 'Delivery', Pincode: '411007' }
        ];
      }
      return [];
    }
  });
  assert.equal(resolvedPune.pincode, '411007', 'Must pick Pune District Aundh PIN 411007 over Mumbai 400001 and Satara Aundh 415510');
});

test('Saved address permanent deletion UI, dual-DB sync clearance, and /api/users/addresses/delete validation', async () => {
  const http = require('http');
  const rootDir = path.join(__dirname, '..');
  const accountHtml = fs.readFileSync(path.join(rootDir, 'public', 'account.html'), 'utf8');
  const cartHtml = fs.readFileSync(path.join(rootDir, 'public', 'cart.html'), 'utf8');
  const firebaseJs = fs.readFileSync(path.join(rootDir, 'public', 'assets', 'nutrolix-firebase.js'), 'utf8');

  // UI & confirmation popup + Add New Address empty-state prompt checks
  assert.ok(accountHtml.includes('id="deleteAddressConfirmModal"'), 'account.html must include confirmation popup modal');
  assert.ok(accountHtml.includes('Are you sure you want to delete this address?'), 'confirmation popup must ask confirmation text');
  assert.ok(accountHtml.includes('id="confirmDeleteAddressBtn"'), 'confirmation popup must have OK confirm button');
  assert.ok(accountHtml.includes('window.openAddressModal()') && accountHtml.includes('Add New Address'), 'empty/single-deleted state must show Add New Address action');
  assert.ok(accountHtml.includes('addressesCleared: true'), 'confirmDeleteAddress must mark addressesCleared when last address deleted');
  assert.ok(!accountHtml.includes("id: 'addr_primary'"), 'account.html must not auto-resurrect deleted defaultAddress into addr_primary');
  assert.ok(cartHtml.includes('if (profile.addressesCleared) return []'), 'cart.html must respect addressesCleared and never resurrect deleted addresses');
  assert.ok(firebaseJs.includes('/api/users/addresses/delete') && firebaseJs.includes('/api/users/addresses/save'), 'nutrolix-firebase.js must sync save/delete via dual-DB server API');

  // buildMergedCustomerProfile respects addressesCleared: true
  const clearedProfile = customerSync.buildMergedCustomerProfile({
    matchedUserDocs: [{ uid: 'phone_9876543210', name: 'Test User', defaultAddress: '', pincode: '', addressesCleared: true }],
    extraProfile: { defaultAddress: 'Old Stale Line', pincode: '410208' },
    cleanPhone: '9876543210',
    resolvedUid: 'phone_9876543210',
    allowProfileOverride: false
  });
  assert.equal(clearedProfile.addressesCleared, true);
  assert.equal(clearedProfile.defaultAddress, '');
  assert.equal(clearedProfile.pincode, '');

  // HTTP server endpoint guard & pincode endpoint verification
  const server = require(path.join(rootDir, 'server.js'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    const unauthDel = await new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify({ addressId: 'addr_1' });
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/users/addresses/delete',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
      });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
    assert.equal(unauthDel.status, 401);

    const pinRes = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/api/location/pincode?pin=410208' }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
      }).on('error', reject);
    });
    assert.equal(pinRes.status, 200);
    assert.equal(pinRes.json.success, true);
    assert.equal(pinRes.json.pincode, '410208');
    assert.ok(String(pinRes.json.city).toLowerCase().includes('taloja'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Checkout address tick switch, default address selection, recipient phone isolation, bounded delete timeouts, and single icons', () => {
  const rootDir = path.join(__dirname, '..');
  const cartHtml = fs.readFileSync(path.join(rootDir, 'public', 'cart.html'), 'utf8');
  const accountHtml = fs.readFileSync(path.join(rootDir, 'public', 'account.html'), 'utf8');
  const ordersHtml = fs.readFileSync(path.join(rootDir, 'public', 'orders.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(rootDir, 'public', 'admin.html'), 'utf8');
  const firebaseJs = fs.readFileSync(path.join(rootDir, 'public', 'assets', 'nutrolix-firebase.js'), 'utf8');

  // 1. Checkout address switch & default selection
  assert.ok(cartHtml.includes('window.isAddingNewAddress = true'), 'toggleAddNewAddressForm must activate new address mode');
  assert.ok(cartHtml.includes('window.selectedAddressIndex = -1'), 'toggleAddNewAddressForm must deselect saved address cards');
  assert.ok(cartHtml.includes('id="newAddressSelectedBar"'), 'cart.html must show active selection bar when New Address is selected');
  assert.ok(cartHtml.includes('window.NutrolixFirebase.setDefaultUserAddress(user.uid, chosen.id)'), 'selectDeliveryAddress must sync default selection');

  // 2. Recipient phone on deliveryAddress without clobbering logged-in verified/whatsapp number
  assert.ok(cartHtml.includes('deliveryPhone: recipientPhone'), 'cart.html order payload must send deliveryPhone separately');
  assert.ok(cartHtml.includes('Ordering for someone else?'), 'cart.html must clarify recipient vs login notification number');
  assert.ok(cartHtml.includes('window.cartPhoneUserEdited = true'), 'cart.html must track user phone editing so clearing field does not snap back to registered phone');
  assert.equal(cartHtml.includes('if (isAuthed && phoneEl && !phoneEl.value.trim()) {\n        phoneEl.value = verifiedDigits;'), false, 'updateCartPhoneOkButtonState must never refill registered phone while user edits');

  const valRes = customerSync.validateOrderPayload({
    orderId: 'ORD-RECIP-1',
    uid: 'phone_9931354354',
    customerPhone: '9931354354',
    whatsappNumber: '9931354354',
    customerName: 'Sk Arman',
    deliveryPhone: '9820012345',
    deliveryAddress: {
      name: 'Rahul Friend',
      phone: '9820012345',
      address1: 'Sector 2, Taloja',
      city: 'Taloja, Panvel',
      state: 'Maharashtra',
      pincode: '410208'
    },
    items: [{ id: 'p1', title: 'High Protein Atta', quantity: 1, price: 399 }],
    grandTotal: 399
  });
  assert.equal(valRes.valid, true);
  assert.equal(valRes.normalizedOrder.customerPhone, '9931354354');
  assert.equal(valRes.normalizedOrder.whatsappNumber, '9931354354');
  assert.equal(valRes.normalizedOrder.deliveryPhone, '9820012345');
  assert.equal(valRes.normalizedOrder.deliveryAddress.phone, '9820012345');
  assert.equal(valRes.normalizedOrder.deliveryAddress.name, 'Rahul Friend');

  // 3. Delete modal bounded timeout (never stuck on Deleting...)
  assert.ok(firebaseJs.includes('_withTimeout') && firebaseJs.includes('_fetchWithTimeout'), 'nutrolix-firebase.js must bound token/SDK/fetch operations');
  assert.ok(accountHtml.includes('Promise.race([') && accountHtml.includes('timedOut: true'), 'confirmDeleteAddress must bound remote delete wait');

  // 4. Zero duplicate icons on add/back buttons
  assert.equal(cartHtml.includes('+ Add Different Address'), false, 'cart.html must not have double + icon');
  assert.equal(ordersHtml.includes('← Back to Order History'), false, 'orders.html must not have double back arrow');
  assert.equal(adminHtml.includes('+ Add Google Review'), false, 'admin.html must not have double + icon on Google Review button');
  assert.equal(adminHtml.includes('+ Add New Category'), false, 'admin.html must not have double + icon on Add Category button');
});

test('Live cross-device media upload (/api/upload-image -> /api/media/:id) & no-store catalog CRUD roundtrips', async () => {
  const rootDir = path.join(__dirname, '..');
  const dataDir = path.join(rootDir, 'public', 'data');
  const trackedCatalogFiles = [
    'banners.json',
    'hero_products.json',
    'google_reviews.json',
    'video_reviews.json',
    'store_settings.json'
  ];
  const backups = {};
  for (const f of trackedCatalogFiles) {
    const p = path.join(dataDir, f);
    backups[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  let createdUploadPath = null;

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  const httpReq = (method, reqPath, bodyObj = null) => new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const raw = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, json, raw, buf });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });

  try {
    // 1. Upload 1x1 PNG via /api/upload-image and retrieve binary via /api/media/:id
    const png1x1Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const upRes = await httpReq('POST', '/api/upload-image', {
      imageData: `data:image/png;base64,${png1x1Base64}`,
      filename: 'test_sync_png'
    });
    assert.equal(upRes.status, 200);
    assert.equal(upRes.json.success, true);
    assert.ok(upRes.json.url.startsWith('/api/media/'), 'Upload URL must be /api/media/:id');
    assert.ok(String(upRes.headers['cache-control'] || '').includes('no-store'));

    if (upRes.json.filename) {
      const candidate = path.join(rootDir, 'public', 'uploads', upRes.json.filename);
      if (fs.existsSync(candidate)) createdUploadPath = candidate;
    }

    const mediaGet = await httpReq('GET', upRes.json.url);
    assert.equal(mediaGet.status, 200);
    assert.equal(mediaGet.headers['content-type'], 'image/png');
    assert.ok(mediaGet.buf.equals(Buffer.from(png1x1Base64, 'base64')), 'Served binary image must match uploaded PNG bytes');

    // 2. Banners CRUD + no-store header
    const bPost = await httpReq('POST', '/api/banners', {
      id: 'banner_test_sync',
      title: 'Diwali Fitness Sale',
      subtitle: 'Extra 15% Off',
      code: 'NUTRO15',
      imageUrl: upRes.json.url,
      active: true
    });
    assert.equal(bPost.status, 200);
    assert.equal(bPost.json.success, true);

    const bGet = await httpReq('GET', '/api/banners');
    assert.equal(bGet.status, 200);
    assert.ok(String(bGet.headers['cache-control'] || '').includes('no-store'));
    assert.ok(bGet.json.some(b => b.id === 'banner_test_sync' && b.imageUrl === upRes.json.url));

    const bDel = await httpReq('POST', '/api/banners/delete', { id: 'banner_test_sync' });
    assert.equal(bDel.status, 200);
    assert.equal(bDel.json.banners.some(b => b.id === 'banner_test_sync'), false);

    // 3. Hero products roundtrip
    const heroPost = await httpReq('POST', '/api/hero-products', {
      card1: { title: 'Test Atta', subtitle: '46g Protein', rating: '5.0', price: 399, image: upRes.json.url },
      card2: { title: 'Test Meal', subtitle: 'Clean Fuel', rating: '4.9', price: 299, image: upRes.json.url },
      showcase: { title: 'Test Showcase', tag: 'Lab Verified', price: 399, image: upRes.json.url }
    });
    assert.equal(heroPost.status, 200);
    const heroGet = await httpReq('GET', '/api/hero-products');
    assert.equal(heroGet.status, 200);
    assert.ok(String(heroGet.headers['cache-control'] || '').includes('no-store'));
    assert.equal(heroGet.json.heroProducts.card1.image, upRes.json.url);

    // 4. Google Reviews dual-field normalization (author/authorName, text/reviewText)
    const gPost = await httpReq('POST', '/api/google-reviews', {
      author: 'Kabir Mehta',
      text: 'Fresh atta and fast delivery!',
      rating: 5
    });
    assert.equal(gPost.status, 200);
    const gGet = await httpReq('GET', '/api/google-reviews');
    assert.equal(gGet.status, 200);
    assert.ok(String(gGet.headers['cache-control'] || '').includes('no-store'));
    const kabir = gGet.json.reviews.find(r => r.authorName === 'Kabir Mehta');
    assert.ok(kabir && kabir.author === 'Kabir Mehta' && kabir.reviewText === 'Fresh atta and fast delivery!');

    // 5. Video Reviews YouTube ID extraction across shorts/, youtu.be/, watch?v=
    for (const [vidId, url] of [
      ['vid_test_short', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'],
      ['vid_test_be', 'https://youtu.be/M7lc1UVf-VE?si=xyz'],
      ['vid_test_watch', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ']
    ]) {
      const vPost = await httpReq('POST', '/api/video-reviews', { id: vidId, youtubeUrl: url, title: 'Review' });
      assert.equal(vPost.status, 200);
      assert.ok(vPost.json.item.youtubeId, `Should extract YouTube ID from ${url}`);
    }
    const vGet = await httpReq('GET', '/api/video-reviews');
    assert.equal(vGet.status, 200);
    assert.equal(vGet.json.find(v => v.id === 'vid_test_short').youtubeId, 'dQw4w9WgXcQ');
    assert.equal(vGet.json.find(v => v.id === 'vid_test_be').youtubeId, 'M7lc1UVf-VE');
    assert.equal(vGet.json.find(v => v.id === 'vid_test_watch').youtubeId, 'aqz-KE-bpKQ');

    // 6. Store settings unified alias (/api/settings & /api/store-settings)
    const sPost = await httpReq('POST', '/api/store-settings', {
      announcementText: 'Live Test Banner!',
      deliveryFee: 39,
      freeDeliveryMin: 599
    });
    assert.equal(sPost.status, 200);
    const sGet = await httpReq('GET', '/api/settings');
    assert.equal(sGet.status, 200);
    assert.ok(String(sGet.headers['cache-control'] || '').includes('no-store'));
    assert.equal(sGet.json.announcementText, 'Live Test Banner!');
    assert.equal(sGet.json.deliveryFee, 39);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const f of trackedCatalogFiles) {
      const p = path.join(dataDir, f);
      if (backups[f] !== null) fs.writeFileSync(p, backups[f], 'utf8');
      else if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (createdUploadPath && fs.existsSync(createdUploadPath)) {
      try { fs.unlinkSync(createdUploadPath); } catch (_) {}
    }
  }
});

test('Audible lockscreen Android channel alignment, Doze WakeLock, Web Push SW broadcast & client live-sync guards', () => {
  const rootDir = path.join(__dirname, '..');
  const manifestXml = fs.readFileSync(path.join(rootDir, 'app/src/main/AndroidManifest.xml'), 'utf8');
  const helperKt = fs.readFileSync(path.join(rootDir, 'app/src/main/java/com/example/util/NotificationAndSoundHelper.kt'), 'utf8');
  const fcmKt = fs.readFileSync(path.join(rootDir, 'app/src/main/java/com/example/service/NutrolixFirebaseMessagingService.kt'), 'utf8');
  const rules = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
  const swJs = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
  const uploaderJs = fs.readFileSync(path.join(rootDir, 'public/assets/cloudinary-uploader.js'), 'utf8');
  const notifJs = fs.readFileSync(path.join(rootDir, 'public/assets/nutrolix-notifications.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(rootDir, 'public/admin.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'public/index.html'), 'utf8');
  const coreJs = fs.readFileSync(path.join(rootDir, 'lib/nutrolix-core.js'), 'utf8');

  // Android manifest & service lockscreen/Doze + sound integrity
  assert.ok(manifestXml.includes('android:value="nutrolix_orders_channel_v3"'), 'AndroidManifest default FCM channel must be nutrolix_orders_channel_v3');
  assert.ok(helperKt.includes('"nutrolix_orders_channel"'), 'NotificationAndSoundHelper must also register legacy nutrolix_orders_channel');
  assert.ok(helperKt.includes('NotificationCompat.DEFAULT_LIGHTS or NotificationCompat.DEFAULT_VIBRATE'), 'sendFcmOrderNotification must not let DEFAULT_ALL override custom sound');
  assert.ok(fcmKt.includes('PowerManager.PARTIAL_WAKE_LOCK') && fcmKt.includes('wakeLock?.isHeld == true'), 'NutrolixFirebaseMessagingService must hold & release PARTIAL_WAKE_LOCK');

  // FCM v1 server payload & Firestore rules
  assert.ok(coreJs.includes("visibility: 'PUBLIC'") && coreJs.includes("notification_priority: 'PRIORITY_MAX'") && coreJs.includes("ttl: '86400s'"));
  assert.ok(rules.includes("'role'") && rules.includes("'endpoint'") && rules.includes("'subscriptionJson'"), 'firestore.rules fcmTokens schema must allow role, endpoint & subscriptionJson');

  // Web Push SW broadcast & permission recovery
  assert.ok(swJs.includes('NUTROLIX_PUSH_RECEIVED'), 'sw.js must broadcast push events to open window clients');
  assert.ok(notifJs.includes('lastWebAutoPromptAt') && notifJs.includes('NUTROLIX_PUSH_RECEIVED'), 'nutrolix-notifications.js must retry permission prompt cleanly and handle SW broadcast');

  // Cross-device image compression + persistent upload + no-store storefront/admin sync
  assert.ok(uploaderJs.includes('/api/upload-image') && uploaderJs.includes('compressImageFile'), 'cloudinary-uploader.js must compress and persist via /api/upload-image');
  assert.ok(adminHtml.includes('uploadHeroCardImage') && adminHtml.includes('loadBannersAdmin') && adminHtml.includes('loadHeroProductsAdmin'));
  assert.ok(indexHtml.includes('syncLiveHomepageData') && indexHtml.includes("cache: 'no-store'"));
});

test('Sample artwork default across catalog/blogs and 1s first-open vs reload-skip progressive reveal', async () => {
  const vm = require('node:vm');
  const rootDir = path.join(__dirname, '..');

  // 1. Sample image exists in public & Android assets mirror
  assert.ok(fs.existsSync(path.join(rootDir, 'public/assets/aistudio/image_6061bdc8.png')), 'Sample artwork must exist in public/assets/aistudio/');
  assert.ok(fs.existsSync(path.join(rootDir, 'app/src/main/assets/web/assets/aistudio/image_6061bdc8.png')), 'Sample artwork must be mirrored to Android assets');

  // 2. Zero Unsplash catalog URLs remain in JSON seeds, nutrolix-data.js, or store/food/blog/admin HTML
  for (const rel of [
    'public/data/nutrition_products.json',
    'public/data/healthy_food_menu.json',
    'public/data/blogs.json',
    'public/assets/nutrolix-data.js',
    'public/shop.html',
    'public/product.html',
    'public/food.html',
    'public/blogs.html',
    'public/article.html',
    'public/admin.html'
  ]) {
    const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.equal(content.includes('images.unsplash.com/'), false, `Legacy Unsplash URL still present in ${rel}`);
  }

  // 3. All target web pages wire nutrolix-image-loader.js and match Android assets mirror
  for (const page of ['index.html', 'shop.html', 'product.html', 'food.html', 'blogs.html', 'article.html', 'cart.html', 'orders.html', 'admin.html']) {
    const pubHtml = fs.readFileSync(path.join(rootDir, 'public', page), 'utf8');
    const apkHtml = fs.readFileSync(path.join(rootDir, 'app/src/main/assets/web', page), 'utf8');
    assert.ok(pubHtml.includes('assets/nutrolix-image-loader.js'), `Missing nutrolix-image-loader.js in public/${page}`);
    assert.equal(pubHtml, apkHtml, `Android asset mirror mismatch on ${page}`);
  }

  // 4. Direct synchronous resolution test (no MutationObserver, no 1000ms hold, no Image preloader)
  const loaderSrc = fs.readFileSync(path.join(rootDir, 'public/assets/nutrolix-image-loader.js'), 'utf8');
  assert.equal(loaderSrc.includes('MutationObserver'), false, 'nutrolix-image-loader.js must NOT use MutationObserver');
  assert.equal(loaderSrc.includes('setTimeout'), false, 'nutrolix-image-loader.js must NOT run blocking/delay timers');
  assert.equal(loaderSrc.includes('new Image'), false, 'nutrolix-image-loader.js must NOT spawn Image preloader probes');

  const ctx = {
    location: { protocol: 'https:', pathname: '/index.html' }
  };
  ctx.window = ctx;
  vm.runInNewContext(loaderSrc, ctx);

  assert.equal(ctx.nutrolixResolveCatalogImage(''), '/assets/aistudio/image_6061bdc8.png');
  assert.equal(ctx.nutrolixResolveCatalogImage('https://images.unsplash.com/photo-123'), '/assets/aistudio/image_6061bdc8.png');
  assert.equal(ctx.nutrolixResolveCatalogImage('https://res.cloudinary.com/demo/image/upload/p.png'), 'https://res.cloudinary.com/demo/image/upload/p.png');
  assert.equal(ctx.nutrolixResolveCatalogImage('/api/media/item1.webp'), '/api/media/item1.webp');

  const realUrl = 'https://res.cloudinary.com/demo/image/upload/v1/atta.webp';
  assert.equal(ctx.nutrolixImmediateSrc(realUrl), realUrl, 'Uploaded images must resolve and render immediately without 1s hold');

  const attrs = new Map();
  const fakeImgEl = {
    src: '',
    onerror: null,
    getAttribute: (k) => attrs.get(k) || '',
    removeAttribute: (k) => attrs.delete(k)
  };
  ctx.nutrolixBindImage(fakeImgEl, realUrl);
  assert.equal(fakeImgEl.src, realUrl, 'nutrolixBindImage must assign real uploaded URL directly');
  assert.equal(typeof fakeImgEl.onerror, 'function', 'nutrolixBindImage must attach safe sample fallback on error');
  fakeImgEl.onerror();
  assert.equal(fakeImgEl.src, '/assets/aistudio/image_6061bdc8.png', 'Broken real image must fall back cleanly to sample artwork');

  // 5. HTTP Server GET endpoints normalize default/Unsplash items and preserve uploaded /api/media images
  const dataDir = path.join(rootDir, 'public', 'data');
  const prodFile = path.join(dataDir, 'nutrition_products.json');
  const origProds = fs.readFileSync(prodFile, 'utf8');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    const prodList = JSON.parse(origProds);
    const customTestProd = {
      ...prodList[0],
      id: 'test-img-precedence',
      images: ['/assets/aistudio/image_6061bdc8.png', '/api/media/uploaded_real.png']
    };
    fs.writeFileSync(prodFile, JSON.stringify([customTestProd, ...prodList], null, 2), 'utf8');

    const getJson = (reqPath) => new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: reqPath }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
      }).on('error', reject);
    });

    const pRes = await getJson('/api/nutrition-products');
    assert.equal(pRes.status, 200);
    const customOut = pRes.json.find(x => x.id === 'test-img-precedence');
    assert.equal(customOut.images[0], '/api/media/uploaded_real.png', 'Uploaded image must take precedence over sample fallback');
    assert.equal(pRes.json.find(x => x.id !== 'test-img-precedence').images[0], '/assets/aistudio/image_6061bdc8.png');

    for (const ep of ['/api/food-menu', '/api/blogs']) {
      const r = await getJson(ep);
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json) && r.json.length > 0);
      assert.equal(r.json[0].image, '/assets/aistudio/image_6061bdc8.png', `${ep} must default to sample image`);
    }
  } finally {
    fs.writeFileSync(prodFile, origProds, 'utf8');
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Unique Cloudinary filenames (no blob.webp overwrite), progress bars, and single deduplicated admin notification', () => {
  const vm = require('node:vm');
  const rootDir = path.join(__dirname, '..');
  const uploaderSrc = fs.readFileSync(path.join(rootDir, 'public/assets/cloudinary-uploader.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(rootDir, 'public/admin.html'), 'utf8');
  const serverJs = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');

  // 1. Evaluate CloudinaryService in VM sandbox
  const ctx = {
    location: { protocol: 'https:' },
    localStorage: { getItem: () => null, setItem: () => {} },
    crypto: require('node:crypto').webcrypto
  };
  ctx.window = ctx;
  vm.runInNewContext(uploaderSrc, ctx);

  const svc = ctx.CloudinaryService;
  const f1 = svc.buildUniqueFilename({ name: 'blob', type: 'image/webp' }, 'image/webp');
  const f2 = svc.buildUniqueFilename({ name: 'image.png', type: 'image/png' }, 'image/png');
  const f3 = svc.buildUniqueFilename({ name: 'image.png', type: 'image/png' }, 'image/png');
  assert.notEqual(f1, f2);
  assert.notEqual(f2, f3);
  assert.equal(/blob\.webp$/i.test(f1), false, 'Generated filename must never be blob.webp');
  assert.ok(f1.startsWith('nutrolix_') && f1.endsWith('.webp'));
  assert.ok(f2.startsWith('nutrolix_') && f2.endsWith('.png'));

  // 2. Collision guard catches /blob.webp and duplicate URL across different file bytes
  const sigA = svc.computeFileSignature({ size: 1200 }, 'data:image/webp;base64,AAA111');
  const sigB = svc.computeFileSignature({ size: 2400 }, 'data:image/webp;base64,BBB222');
  assert.equal(svc.isCollisionUrl('https://res.cloudinary.com/muy6zdcd/image/upload/v1795019222/nutrolix_catalog/blob.webp', sigA), true);
  const uniqueUrlA = 'https://res.cloudinary.com/muy6zdcd/image/upload/v1795019999/nutrolix_catalog/nutrolix_atta_1.webp';
  assert.equal(svc.isCollisionUrl(uniqueUrlA, sigA), false);
  svc.recordUploadedUrl(uniqueUrlA, sigA);
  assert.equal(svc.isCollisionUrl(uniqueUrlA, sigA), false, 'Same file signature may match its own URL');
  assert.equal(svc.isCollisionUrl(uniqueUrlA, sigB), true, 'Different file bytes must reject colliding CDN URL');

  // 3. Server /api/cloudinary-upload enforces unique public_id / multipart filename & rejects /blob.*
  assert.ok(serverJs.includes('public_id: uniquePublicId') && serverJs.includes('multipart/form-data; boundary='));
  assert.ok(serverJs.includes('!/\\/blob(\\.[a-z0-9]+)?$/i.test(cleanPath)'));

  // 4. Admin progress bars & single deduplicated toast notification (zero alert() spam on image/product upload)
  for (const id of [
    'pkgMultiUploadProgressWrap',
    'pkgSaveProgressWrap', 'singleMealProgressWrap', 'mealSaveProgressWrap',
    'adminHeroProgressWrap1', 'adminHeroProgressWrap2', 'adminHeroProgressWrap3', 'heroSaveProgressWrap',
    'blogImageProgressWrap', 'blogSaveProgressWrap', 'bannerImageProgressWrap', 'bannerSaveProgressWrap',
    'cloudinaryTestProgressWrap'
  ]) {
    assert.ok(adminHtml.includes(`id="${id}"`), `Missing admin progress indicator: ${id}`);
  }
  assert.ok(adminHtml.includes('window.showAdminNotification') && adminHtml.includes('id="nutrolixAdminToast"') || adminHtml.includes("container.id = 'nutrolixAdminToast'"));
  assert.equal(adminHtml.includes('uploaded and synced live!'), false, 'Per-image upload must not spam alert popups');
  assert.equal(adminHtml.includes('Packaged product saved & published live across Web'), false, 'Packaged product save must use single toast notification instead of alert');
  assert.equal(adminHtml.includes('Healthy food meal saved & synced live across Web'), false, 'Healthy meal save must use single toast notification instead of alert');
});

test('Packaged product variants & Healthy Food Zomato-style add-ons work end-to-end and stay hidden when unconfigured', async () => {
  const vm = require('node:vm');
  const rootDir = path.join(__dirname, '..');

  // 1. Core normalization: legacy unconfigured seed variants must be suppressed; explicit Admin config preserved
  assert.deepEqual(
    core.normalizeProductVariants([{ size: '1 Kg', price: 349, mrp: 449 }], { id: 'prod_high_protein_atta' }),
    [],
    'Unconfigured legacy seed variants must be hidden'
  );
  assert.deepEqual(
    core.normalizeProductVariants(
      [{ size: '1 Kg', price: 349, mrp: 449 }, { size: '5 Kg', price: 1649, mrp: 2199 }, { size: '1 kg', price: 999 }],
      { id: 'prod_high_protein_atta', variantsConfigured: true }
    ),
    [
      { size: '1 Kg', label: '1 Kg', price: 349, mrp: 449 },
      { size: '5 Kg', label: '5 Kg', price: 1649, mrp: 2199 }
    ]
  );
  assert.deepEqual(
    core.normalizeProductVariants([], { id: 'prod_high_protein_atta', variantsConfigured: true }),
    []
  );

  // Food Zomato add-ons sanitizer
  assert.deepEqual(
    core.normalizeFoodAddons([
      { name: 'Extra A2 Ghee', price: 30, isVeg: true },
      { name: 'extra a2 ghee', price: 99, isVeg: true },
      { name: 'Extra Boiled Egg', price: 35, isVeg: false },
      { name: '', price: 20 }
    ]),
    [
      { id: 'addon_extra_a2_ghee', name: 'Extra A2 Ghee', price: 30, isVeg: true },
      { id: 'addon_extra_boiled_egg', name: 'Extra Boiled Egg', price: 35, isVeg: false }
    ]
  );

  // 2. Order validation preserves variant & Zomato add-ons and omits blank variant
  const orderWithCustom = customerSync.validateOrderPayload({
    customerPhone: '9876543210',
    customerName: 'Aarav Sharma',
    deliveryAddress: { address1: 'Sector 17, Vashi', city: 'Navi Mumbai', state: 'Maharashtra', pincode: '400703' },
    items: [
      {
        id: 'meal_bowl_1',
        title: 'Grilled Paneer Quinoa Bowl',
        variant: 'Jumbo 500g',
        addons: [{ name: 'Extra A2 Ghee', price: 30, isVeg: true }, { name: 'Extra Dry Fruits', price: 45, isVeg: true }],
        quantity: 2,
        price: 374
      },
      {
        id: 'prod_high_protein_atta',
        title: 'Nutrolix High Protein Atta',
        quantity: 1,
        price: 349
      }
    ],
    grandTotal: 1097
  });
  assert.equal(orderWithCustom.valid, true);
  assert.equal(orderWithCustom.normalizedOrder.items[0].variant, 'Jumbo 500g');
  assert.equal(orderWithCustom.normalizedOrder.items[0].addons.length, 2);
  assert.equal(orderWithCustom.normalizedOrder.items[0].addonsTotal, 75);
  assert.equal(orderWithCustom.normalizedOrder.items[1].variant, undefined, 'Items without variants must not inject fake Standard Pack');

  // 3. Seed files must NOT contain hardcoded unconfigured variants, and Android assets mirror matches
  const seedJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/nutrition_products.json'), 'utf8'));
  for (const prod of seedJson) {
    assert.deepEqual(prod.variants || [], [], `Seed product ${prod.id} must have empty variants by default`);
  }

  const dataJsCtx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(rootDir, 'public/assets/nutrolix-data.js'), 'utf8'), dataJsCtx);
  for (const prod of dataJsCtx.window.nutroProducts) {
    assert.deepEqual(JSON.parse(JSON.stringify(prod.variants || [])), [], `Fallback nutroProducts ${prod.id} must have empty variants`);
  }

  for (const file of ['admin.html', 'product.html', 'shop.html', 'index.html', 'food.html', 'cart.html', 'orders.html', 'delete-account.html']) {
    const pubContent = fs.readFileSync(path.join(rootDir, 'public', file), 'utf8');
    const apkContent = fs.readFileSync(path.join(rootDir, 'app/src/main/assets/web', file), 'utf8');
    assert.equal(pubContent, apkContent, `APK web mirror out of sync for ${file}`);
  }

  // 4. Static UI contracts on Admin, Product, Food, Cart & Orders pages
  const adminHtml = fs.readFileSync(path.join(rootDir, 'public/admin.html'), 'utf8');
  for (const marker of ['pkgVariantsEditorList', 'btnAddPkgVariantRow', 'mealVariantsEditorList', 'btnAddMealVariantRow', 'mealAddonsEditorList', 'btnAddMealAddonRow', 'Extra A2 Ghee', 'Extra Dry Fruits', 'Extra Ragi Roti']) {
    assert.ok(adminHtml.includes(marker), `Admin panel missing ${marker}`);
  }

  const productHtml = fs.readFileSync(path.join(rootDir, 'public/product.html'), 'utf8');
  assert.ok(productHtml.includes('id="productVariantsSection" class="pt-1 hidden"'), 'product.html must hide variant section by default');
  assert.equal(productHtml.includes('>Standard Pack<'), false, 'product.html must not render hardcoded Standard Pack fallback');

  const foodHtml = fs.readFileSync(path.join(rootDir, 'public/food.html'), 'utf8');
  for (const marker of ['id="modalDishVariantsSection"', 'id="modalDishAddonsSection"', 'Extra Add-ons (Zomato Style)', 'window.toggleModalMealAddon', 'window.selectModalMealVariant']) {
    assert.ok(foodHtml.includes(marker), `food.html missing ${marker}`);
  }

  // 5. Server HTTP roundtrip tests for Packaged Variants & Food Zomato Add-ons (restoring disk JSONs in finally)
  const dataDir = path.join(rootDir, 'public/data');
  const prodFile = path.join(dataDir, 'nutrition_products.json');
  const foodFile = path.join(dataDir, 'food_menu.json');
  const origProds = fs.readFileSync(prodFile, 'utf8');
  const origFood = fs.existsSync(foodFile) ? fs.readFileSync(foodFile, 'utf8') : null;

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  const requestJson = (method, reqPath, bodyObj = null) => new Promise((resolve, reject) => {
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

  try {
    // 5a. Legacy Atta has [] variants before Admin edits
    const initialList = await requestJson('GET', '/api/nutrition-products');
    assert.equal(initialList.status, 200);
    const attaBefore = initialList.json.find(p => p.id === 'prod_high_protein_atta');
    assert.deepEqual(attaBefore.variants, []);

    // 5b. Admin adds custom variants to Atta -> saved & returned live
    const postProd = await requestJson('POST', '/api/nutrition-products', {
      id: 'prod_high_protein_atta',
      name: 'Nutrolix High Protein Atta',
      price: 349,
      mrp: 449,
      variants: [{ size: '2 Kg', price: 669, mrp: 849 }],
      variantsConfigured: true
    });
    assert.equal(postProd.status, 200);
    assert.equal(postProd.json.success, true);

    const afterAddList = await requestJson('GET', '/api/nutrition-products');
    const attaAfterAdd = afterAddList.json.find(p => p.id === 'prod_high_protein_atta');
    assert.deepEqual(attaAfterAdd.variants, [{ size: '2 Kg', label: '2 Kg', price: 669, mrp: 849 }]);

    // 5c. Admin clears variants -> empty [] persists cleanly
    await requestJson('POST', '/api/nutrition-products', {
      id: 'prod_high_protein_atta',
      name: 'Nutrolix High Protein Atta',
      price: 349,
      mrp: 449,
      variants: [],
      variantsConfigured: true
    });
    const afterClearList = await requestJson('GET', '/api/nutrition-products');
    const attaAfterClear = afterClearList.json.find(p => p.id === 'prod_high_protein_atta');
    assert.deepEqual(attaAfterClear.variants, []);

    // 5d. Admin saves Healthy Meal with Portion Variants + Zomato Add-ons
    const postMeal = await requestJson('POST', '/api/food-menu', {
      id: 'meal_test_zomato_bowl',
      name: 'Clinical Millet Power Bowl',
      category: 'High Protein Meals',
      price: 249,
      variants: [{ size: 'Regular (300g)', price: 249 }, { size: 'Jumbo (500g)', price: 369 }],
      addons: [
        { name: 'Extra A2 Ghee', price: 30, isVeg: true },
        { name: 'Extra Dry Fruits', price: 45, isVeg: true },
        { name: 'Extra Ragi Roti', price: 25, isVeg: true }
      ]
    });
    assert.equal(postMeal.status, 200);
    assert.equal(postMeal.json.success, true);

    const foodList = await requestJson('GET', '/api/food-menu');
    assert.equal(foodList.status, 200);
    const savedMeal = foodList.json.find(m => m.id === 'meal_test_zomato_bowl');
    assert.ok(savedMeal, 'Saved healthy meal must exist');
    assert.equal(savedMeal.variants.length, 2);
    assert.equal(savedMeal.addons.length, 3);
    assert.equal(savedMeal.addons[0].name, 'Extra A2 Ghee');
    assert.equal(savedMeal.addons[0].price, 30);
  } finally {
    fs.writeFileSync(prodFile, origProds, 'utf8');
    if (origFood !== null) fs.writeFileSync(foodFile, origFood, 'utf8');
    else if (fs.existsSync(foodFile)) fs.unlinkSync(foodFile);
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Product detail removes thumbnail hint, enforces 2-3-5 reviews + Admin review creation, and renders 2-column recommended products', async () => {
  const vm = require('node:vm');
  const rootDir = path.join(__dirname, '..');

  // 1. Thumbnail swipe caption must be removed from product.html and APK mirror; recommended grid must be 2-column horizontal
  for (const rel of ['public/product.html', 'app/src/main/assets/web/product.html']) {
    const html = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.equal(
      html.includes('Tap thumbnails or swipe left/right to view packaging, nutrition tables & benefits'),
      false,
      `${rel} must not contain removed thumbnail swipe caption`
    );
    assert.equal(
      html.includes('Tap thumbnails or swipe left/right'),
      false,
      `${rel} must not contain partial thumbnail swipe caption`
    );
    assert.ok(
      html.includes('id="relatedProductsGrid" class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'),
      `${rel} must render recommended products in a 2-column horizontal grid`
    );
  }

  // 2. Every seed packaged product & healthy food dish must have 2, 3, or 5 reviews (no legacy 184/148/142 inflated counts)
  const allowedCounts = new Set([2, 3, 5]);
  const seedProducts = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/nutrition_products.json'), 'utf8'))
    .filter(p => p && p.name && Array.isArray(p.images));
  assert.equal(seedProducts.length, 8, 'Expected all 8 core packaged products');
  for (const p of seedProducts) {
    assert.ok(Array.isArray(p.reviews) && allowedCounts.has(p.reviews.length), `nutrition_products.json ${p.id} reviews length ${p.reviews?.length} must be in {2,3,5}`);
    assert.equal(p.reviewCount, p.reviews.length, `nutrition_products.json ${p.id} reviewCount must match reviews.length`);
    const coreSeed = core.getSeedReviewsForProduct(p.id);
    assert.ok(allowedCounts.has(coreSeed.length), `nutrolix-core seed for ${p.id} must be in {2,3,5}`);
  }

  const dataJsCtx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(rootDir, 'public/assets/nutrolix-data.js'), 'utf8'), dataJsCtx);
  for (const p of dataJsCtx.window.nutroProducts) {
    assert.ok(allowedCounts.has(Number(p.reviewCount)), `nutrolix-data.js ${p.id} reviewCount ${p.reviewCount} must be in {2,3,5}`);
    assert.ok(Array.isArray(p.reviews) && p.reviews.length === p.reviewCount, `nutrolix-data.js ${p.id} reviews must match reviewCount`);
  }

  const healthyMenu = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/healthy_food_menu.json'), 'utf8'))
    .filter(d => d && d.id && d.id.startsWith('food_') && d.name);
  assert.equal(healthyMenu.length, 8, 'Expected all 8 core healthy food dishes');
  for (const dish of healthyMenu) {
    assert.ok(Array.isArray(dish.reviews) && allowedCounts.has(dish.reviews.length), `healthy_food_menu.json ${dish.id} reviews length ${dish.reviews?.length} must be in {2,3,5}`);
    assert.equal(dish.reviewCount, dish.reviews.length, `healthy_food_menu.json ${dish.id} reviewCount must match reviews.length`);
  }

  // 3. Admin Panel exposes Product Reviews tab, Add Product Review modal & handlers, and removes hardcoded reviewCount: 148
  for (const rel of ['public/admin.html', 'app/src/main/assets/web/admin.html']) {
    const adminHtml = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    for (const marker of [
      'id="tabBtn-reviews"',
      'id="addProductReviewModal"',
      'id="adminRevProductSelect"',
      'openAddProductReviewModal',
      'submitAdminProductReview',
      'loadProductReviewsAdmin',
      'moderateProductReviewAdmin'
    ]) {
      assert.ok(adminHtml.includes(marker), `${rel} missing ${marker}`);
    }
    assert.equal(adminHtml.includes('reviewCount: 148'), false, `${rel} must not hardcode reviewCount: 148`);
  }

  // 4. Live HTTP roundtrip: GET /api/nutrition-products returns 2/3/5 counts; Admin POST /api/product-reviews increments count & cleans up via moderate delete
  const reviewsFile = path.join(rootDir, 'public/data/product_reviews.json');
  const origReviews = fs.existsSync(reviewsFile) ? fs.readFileSync(reviewsFile, 'utf8') : null;

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  const requestJson = (method, reqPath, bodyObj = null) => new Promise((resolve, reject) => {
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw) }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

  try {
    const beforeProds = await requestJson('GET', '/api/nutrition-products');
    assert.equal(beforeProds.status, 200);
    const attaBefore = beforeProds.json.find(p => p.id === 'prod_high_protein_atta');
    assert.ok(attaBefore, 'prod_high_protein_atta must exist');
    const baseCount = attaBefore.reviewCount;
    assert.ok(baseCount >= 2 && baseCount < 50, `Expected realistic seed reviewCount, got ${baseCount}`);

    const addRes = await requestJson('POST', '/api/product-reviews', {
      productId: 'prod_high_protein_atta',
      productName: attaBefore.name,
      customerName: 'Admin Verified Tester',
      rating: 5,
      date: '18 Nov 2026',
      comment: 'Soft rotis and crisp macro profile added via Admin Panel.',
      verified: true,
      source: 'admin'
    });
    assert.equal(addRes.status, 200);
    assert.equal(addRes.json.success, true);
    assert.equal(addRes.json.review.source, 'admin');
    const createdId = addRes.json.review.id;

    const afterProds = await requestJson('GET', '/api/nutrition-products');
    const attaAfter = afterProds.json.find(p => p.id === 'prod_high_protein_atta');
    assert.equal(attaAfter.reviewCount, baseCount + 1, 'Adding an admin review must increment product reviewCount by 1');

    const prodRevs = await requestJson('GET', '/api/product-reviews?productId=prod_high_protein_atta');
    assert.equal(prodRevs.status, 200);
    assert.ok(prodRevs.json.some(r => r.id === createdId && r.customerName === 'Admin Verified Tester'));

    const delRes = await requestJson('POST', '/api/product-reviews/moderate', { id: createdId, action: 'delete' });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.json.success, true);
  } finally {
    if (origReviews !== null) fs.writeFileSync(reviewsFile, origReviews, 'utf8');
    else if (fs.existsSync(reviewsFile)) fs.unlinkSync(reviewsFile);
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Slim shop banner, removed factory dispatch bar, unified 5-image multi-upload with reorder & auto-save, and square user product images', () => {
  const rootDir = path.join(__dirname, '..');

  // 1. Shop page removes status bar & slims down dark green Nutrition Store Catalog banner
  for (const rel of ['public/shop.html', 'app/src/main/assets/web/shop.html']) {
    const shopHtml = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.equal(shopHtml.includes('100% Direct Factory Dispatch'), false, `${rel} must not contain removed Direct Factory Dispatch bar`);
    assert.equal(shopHtml.includes('Lab-Tested Nutrition Products'), false, `${rel} must not contain removed Showing X Lab-Tested Nutrition Products bar`);
    assert.ok(shopHtml.includes('py-3.5 sm:py-4 px-4'), `${rel} must use slim Nutrition Store Catalog banner padding`);
    assert.ok(shopHtml.includes('relative aspect-square overflow-hidden bg-slate-100'), `${rel} product cards must use 1:1 square images`);
  }

  // 2. User product detail & homepage hero showcase use 1:1 square product images (not rectangular)
  for (const rel of ['public/product.html', 'app/src/main/assets/web/product.html']) {
    const prodHtml = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.ok(prodHtml.includes('id="mainImageContainer"') && prodHtml.includes('aspect-square'), `${rel} main product image container must be 1:1 square`);
    assert.equal(prodHtml.includes('min-h-[280px] max-h-[380px]'), false, `${rel} must not use rectangular main image height`);
  }
  for (const rel of ['public/index.html', 'app/src/main/assets/web/index.html']) {
    const idxHtml = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.ok(idxHtml.includes('id="heroShowcaseLinkImg" class="block aspect-square'), `${rel} hero showcase must use 1:1 square image`);
    assert.equal(idxHtml.includes('h-64 sm:h-72 object-cover rounded-2xl'), false, `${rel} must not use rectangular hero showcase image`);
  }

  // 3. Admin Panel unified 5-image multi-upload, up/down & drag reorder, scrollable list, and auto-save
  for (const rel of ['public/admin.html', 'app/src/main/assets/web/admin.html']) {
    const adminHtml = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    for (const marker of [
      'id="pkgMultiImageInput" accept="image/*" multiple',
      'id="pkgMultiUploadProgressWrap"',
      'id="pkgImagesSortableList"',
      'id="pkgImgAutoSaveBadge"',
      'handlePkgMultiImageUpload',
      'movePkgImage',
      'reorderPkgImage',
      'scheduleAutoSavePkgImages',
      'autoSavePkgProductImages'
    ]) {
      assert.ok(adminHtml.includes(marker), `${rel} missing ${marker}`);
    }
    assert.equal(adminHtml.includes('id="pkgImg1"'), false, `${rel} must replace separate 5 slots with unified multi-upload`);
  }

  // 4. Android Admin APK WebView file chooser supports multi-image selection (EXTRA_ALLOW_MULTIPLE + clipData)
  const adminKt = fs.readFileSync(path.join(rootDir, 'app/src/main/java/com/example/AdminActivity.kt'), 'utf8');
  assert.ok(adminKt.includes('Intent.EXTRA_ALLOW_MULTIPLE') && adminKt.includes('data?.clipData'), 'AdminActivity.kt must support multi-file selection in WebView');
});

test('Sticky header overflow-x clip fix, compact slow auto-scroll reviews, and compact colorful app download section', () => {
  const rootDir = path.join(__dirname, '..');
  const mainPages = [
    'index.html',
    'shop.html',
    'product.html',
    'food.html',
    'cart.html',
    'orders.html',
    'account.html',
    'admin.html'
  ];

  // 1. Sticky header must not be broken by overflow-x: hidden / overflow-x-hidden on html/body across Web & APK assets
  for (const base of ['public', 'app/src/main/assets/web']) {
    for (const page of mainPages) {
      const html = fs.readFileSync(path.join(rootDir, base, page), 'utf8');
      assert.equal(/overflow-x:\s*hidden/i.test(html), false, `${base}/${page} must not use overflow-x: hidden (breaks position: sticky header)`);
      assert.equal(/<body[^>]*overflow-x-hidden/i.test(html), false, `${base}/${page} <body> must not use overflow-x-hidden (breaks position: sticky header)`);
      assert.ok(html.includes('overflow-x: clip') || html.includes('overflow-x-clip'), `${base}/${page} should use overflow-x: clip / overflow-x-clip`);
      assert.ok(html.includes('sticky top-0'), `${base}/${page} must preserve sticky top-0 header`);
    }

    // 2. Home page real customer reviews: compact, attractive, no 4.9/5.0 148+ or Read All Google Reviews block, slow auto-scroll
    const idxHtml = fs.readFileSync(path.join(rootDir, base, 'index.html'), 'utf8');
    assert.ok(idxHtml.includes('id="realCustomerReviewsSection"'), `${base}/index.html must contain realCustomerReviewsSection`);
    assert.equal(idxHtml.includes('4.9 / 5.0 Rating'), false, `${base}/index.html must remove 4.9 / 5.0 Rating summary block`);
    assert.equal(idxHtml.includes('Read All Google Reviews'), false, `${base}/index.html must remove Read All Google Reviews CTA`);
    assert.ok(idxHtml.includes('function startGoogleReviewsAutoScroll()'), `${base}/index.html must define startGoogleReviewsAutoScroll()`);
    assert.ok(idxHtml.includes('container.innerHTML = singleTrack + singleTrack;'), `${base}/index.html must duplicate review cards for seamless slow auto-scroll`);

    // 3. Home page mobile app download section: compact, reduced text, colorful gradient, preserves real APK download link
    const appSectionStart = idxHtml.indexOf('id="downloadAppSection"');
    assert.ok(appSectionStart > -1, `${base}/index.html must contain downloadAppSection`);
    const appSectionEnd = idxHtml.indexOf('</section>', appSectionStart);
    const appSectionHtml = idxHtml.slice(appSectionStart, appSectionEnd);
    assert.ok(appSectionHtml.includes('from-emerald-600 via-teal-600 to-amber-500'), `${base}/index.html downloadAppSection must use vibrant colorful gradient`);
    assert.ok(appSectionHtml.includes('/api/download/customer-apk'), `${base}/index.html downloadAppSection must preserve real APK download link`);
    assert.ok(appSectionHtml.includes('APP10'), `${base}/index.html downloadAppSection must preserve APP10 coupon highlight`);
    assert.equal(appSectionHtml.includes('Experience ultra-fast reordering, live GPS dispatch tracking'), false, `${base}/index.html downloadAppSection must remove verbose paragraph text`);
  }
});

test('Healthy Food Nutrition Highlights (no Clinical word) & Nutrition Facts Admin-to-User live sync across Healthy Food and Packaged catalogs', async () => {
  const rootDir = path.join(__dirname, '..');

  // 1. UI checks across both public/ and Android WebView assets
  for (const base of ['public', 'app/src/main/assets/web']) {
    const foodHtml = fs.readFileSync(path.join(rootDir, base, 'food.html'), 'utf8');
    assert.equal(foodHtml.includes('Clinical Nutrition Highlights'), false, `${base}/food.html must remove the word "Clinical" from Nutrition Highlights`);
    assert.ok(foodHtml.includes('<span>Nutrition Highlights:</span>'), `${base}/food.html must render "Nutrition Highlights:" heading`);
    assert.ok(foodHtml.includes('id="modalDishHighlightsSection"'), `${base}/food.html must have toggleable highlights container`);
    assert.ok(foodHtml.includes('id="modalDishNutritionSection"'), `${base}/food.html must have nutrition facts container`);
    assert.ok(foodHtml.includes('function sanitizeMealHighlights('), `${base}/food.html must sanitize meal highlights`);
    assert.ok(foodHtml.includes('function sanitizeMealNutritionFacts('), `${base}/food.html must sanitize meal nutritionFacts`);

    const adminHtml = fs.readFileSync(path.join(rootDir, base, 'admin.html'), 'utf8');
    for (const marker of [
      'id="mealHighlightsEditorList"',
      'id="btnAddMealHighlightRow"',
      'window.renderMealHighlightsEditor',
      'window.addMealHighlightRow',
      'window.readMealHighlightsFromForm',
      'id="singleMealFiber"',
      'id="singleMealCarbs"',
      'id="singleMealFats"',
      'id="singleMealSodium"',
      'id="mealCustomNutritionEditorList"',
      'window.readMealNutritionFactsFromForm',
      'Nutrition Highlights (Bullet Points)'
    ]) {
      assert.ok(adminHtml.includes(marker), `${base}/admin.html missing ${marker}`);
    }
    assert.equal(adminHtml.includes('Clinical Nutrition Highlights'), false, `${base}/admin.html must not use "Clinical Nutrition Highlights"`);

    const productHtml = fs.readFileSync(path.join(rootDir, base, 'product.html'), 'utf8');
    assert.ok(productHtml.includes('facts.per100g') && productHtml.includes('formatFact('), `${base}/product.html must read both flat and per100g nutritionFacts`);
  }

  // 2. End-to-end HTTP server roundtrip verification (Healthy Food & Packaged Products)
  const foodFile = path.join(rootDir, 'public/data/healthy_food_menu.json');
  const prodFile = path.join(rootDir, 'public/data/nutrition_products.json');
  const origFood = fs.existsSync(foodFile) ? fs.readFileSync(foodFile, 'utf8') : null;
  const origProd = fs.existsSync(prodFile) ? fs.readFileSync(prodFile, 'utf8') : null;

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Healthy Food Meal with custom Nutrition Highlights & Nutrition Facts
    const testMealId = 'meal_test_nutr_sync_' + Date.now();
    const postMealRes = await fetch(`${baseUrl}/api/food-menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testMealId,
        name: 'Paneer Quinoa Power Bowl',
        category: 'High Protein Meals',
        price: 269,
        calories: 445,
        protein: 38,
        fiber: 12,
        carbs: 36,
        fats: 11,
        sodium: 165,
        highlights: [
          '38g Complete Plant & Paneer Protein',
          'Zero Palm Oil, Zero Refined Sugar'
        ],
        nutritionFacts: [
          { name: 'Calories', value: '445 kcal' },
          { name: 'Protein', value: '38 g' },
          { name: 'Dietary Fiber', value: '12 g' },
          { name: 'Total Carbs', value: '36 g' },
          { name: 'Healthy Fats', value: '11 g' },
          { name: 'Sodium', value: '165 mg' },
          { name: 'Iron', value: '4.5 mg' }
        ]
      })
    });
    assert.equal(postMealRes.status, 200);

    const getMealsRes = await fetch(`${baseUrl}/api/food-menu`);
    assert.equal(getMealsRes.status, 200);
    const meals = await getMealsRes.json();
    const savedMeal = meals.find(m => m.id === testMealId);
    assert.ok(savedMeal, 'Saved healthy meal must be returned by GET /api/food-menu');
    assert.deepEqual(savedMeal.highlights, [
      '38g Complete Plant & Paneer Protein',
      'Zero Palm Oil, Zero Refined Sugar'
    ]);
    assert.equal(savedMeal.nutritionFacts.length, 7);
    assert.deepEqual(savedMeal.nutritionFacts[0], { name: 'Calories', value: '445 kcal' });
    assert.deepEqual(savedMeal.nutritionFacts[6], { name: 'Iron', value: '4.5 mg' });

    // Packaged Product saved with nested per100g must expose flat numeric fields too
    const testProdId = 'prod_test_nutr_sync_' + Date.now();
    const postProdRes = await fetch(`${baseUrl}/api/nutrition-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testProdId,
        name: 'Nutrolix Test Protein Mix',
        category: 'Nutrition Meal',
        price: 599,
        mrp: 799,
        nutritionFacts: {
          servingSize: '100g',
          per100g: {
            calories: '415 kcal',
            protein: '48g',
            carbs: '29g',
            fat: '6.2g',
            dietaryFiber: '14g',
            addedSugar: '0g'
          }
        }
      })
    });
    assert.equal(postProdRes.status, 200);

    const getProdsRes = await fetch(`${baseUrl}/api/nutrition-products`);
    assert.equal(getProdsRes.status, 200);
    const prods = await getProdsRes.json();
    const savedProd = prods.find(p => p.id === testProdId);
    assert.ok(savedProd, 'Saved packaged product must be returned by GET /api/nutrition-products');
    assert.equal(savedProd.nutritionFacts.calories, 415);
    assert.equal(savedProd.nutritionFacts.protein, 48);
    assert.equal(savedProd.nutritionFacts.carbs, 29);
    assert.equal(savedProd.nutritionFacts.fats, 6.2);
    assert.equal(savedProd.nutritionFacts.dietaryFiber, 14);
    assert.equal(savedProd.nutritionFacts.addedSugar, 0);
    assert.equal(savedProd.nutritionFacts.per100g.protein, '48g');
  } finally {
    if (origFood !== null) fs.writeFileSync(foodFile, origFood, 'utf8');
    if (origProd !== null) fs.writeFileSync(prodFile, origProd, 'utf8');
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Healthy Food bulk-paste 5 Nutrition Highlights and strictly optional Calories, Protein & Nutrition Facts', async () => {
  const rootDir = path.join(__dirname, '..');

  // 1. Admin & User UI checks across Web and Android assets
  for (const base of ['public', 'app/src/main/assets/web']) {
    const adminHtml = fs.readFileSync(path.join(rootDir, base, 'admin.html'), 'utf8');
    assert.ok(adminHtml.includes('id="singleMealHighlightsBulk"'), `${base}/admin.html must include bulk-paste highlights textarea`);
    assert.ok(adminHtml.includes('window.parseBulkMealHighlights'), `${base}/admin.html must define parseBulkMealHighlights`);
    assert.ok(adminHtml.includes('id="mealHighlightsCountBadge"'), `${base}/admin.html must show live highlight point count badge`);
    assert.equal(/id="singleMealCalories"[^>]*\brequired\b/.test(adminHtml), false, `${base}/admin.html singleMealCalories must be optional (no required attribute)`);
    assert.equal(/id="singleMealProtein"[^>]*\brequired\b/.test(adminHtml), false, `${base}/admin.html singleMealProtein must be optional (no required attribute)`);
    assert.ok(adminHtml.includes('Nutrition Facts (Per Serving — Optional)'), `${base}/admin.html must mark Nutrition Facts as optional`);

    const foodHtml = fs.readFileSync(path.join(rootDir, base, 'food.html'), 'utf8');
    assert.equal(foodHtml.includes(": '25g Protein'"), false, `${base}/food.html must not fabricate default '25g Protein' when blank`);
    assert.equal(foodHtml.includes(": '350 kcal'"), false, `${base}/food.html must not fabricate default '350 kcal' when blank`);
    assert.ok(foodHtml.includes("macroPillEl.classList.add('hidden')"), `${base}/food.html must hide modal macro pill when calories & protein are blank`);
    assert.ok(foodHtml.includes("nutritionSection.classList.add('hidden')"), `${base}/food.html must hide Nutrition Facts section when empty`);
  }

  // 2. Live HTTP roundtrip: 5 bulk-pasted highlights (with bullet/number prefixes) + completely empty nutrition/calories/protein
  const foodFile = path.join(rootDir, 'public/data/healthy_food_menu.json');
  const origFood = fs.existsSync(foodFile) ? fs.readFileSync(foodFile, 'utf8') : null;

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const optionalMealId = 'meal_optional_nutr_' + Date.now();
    const postRes = await fetch(`${baseUrl}/api/food-menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: optionalMealId,
        name: 'Pure Fruit Bowl',
        category: 'Fresh Salads',
        price: 149,
        calories: '',
        protein: '',
        fiber: '',
        carbs: '',
        fats: '',
        sodium: '',
        nutritionFacts: [],
        nutritionConfigured: true,
        highlights: [
          '1. 100% Seasonal Farm-Fresh Cut Fruits',
          '• Zero Added Sugar or Syrups',
          '✓ Rich in Natural Antioxidants & Vitamin C',
          '- Freshly Cut Just Before Dispatch',
          '5) Naturally Hydrating & Light on Digestion'
        ]
      })
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/food-menu`);
    assert.equal(getRes.status, 200);
    const meals = await getRes.json();
    const saved = meals.find(m => m.id === optionalMealId);
    assert.ok(saved, 'Saved optional-nutrition meal must exist');
    assert.deepEqual(saved.highlights, [
      '100% Seasonal Farm-Fresh Cut Fruits',
      'Zero Added Sugar or Syrups',
      'Rich in Natural Antioxidants & Vitamin C',
      'Freshly Cut Just Before Dispatch',
      'Naturally Hydrating & Light on Digestion'
    ]);
    assert.equal(saved.calories, '');
    assert.equal(saved.protein, '');
    assert.deepEqual(saved.nutritionFacts, []);
  } finally {
    if (origFood !== null) fs.writeFileSync(foodFile, origFood, 'utf8');
    await new Promise((resolve) => server.close(resolve));
  }
});








