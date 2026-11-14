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
