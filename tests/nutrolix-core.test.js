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
