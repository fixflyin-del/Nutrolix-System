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


