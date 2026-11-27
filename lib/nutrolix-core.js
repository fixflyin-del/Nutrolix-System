const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FIREBASE_PROJECT_ID = String(process.env.FIREBASE_PROJECT_ID || 'com-aistudio-nutrolix-fo-56ac8').trim();
const DEFAULT_DB_ID = '(default)';
const NAMED_DB_ID = String(process.env.FIREBASE_DATABASE_ID || 'ai-studio-android-nutrolix-53a14619-b244-4a3d-9101-a841b657720b').trim();
const BOTH_DB_IDS = DEFAULT_DB_ID === NAMED_DB_ID ? [DEFAULT_DB_ID] : [DEFAULT_DB_ID, NAMED_DB_ID];

let cachedAccessToken = null;
let cachedTokenExpiresAtMs = 0;
let ephemeralRuntimeHmacSecret = null;

// Smart runtime DB health cache: avoids repeated 404 round-trips for non-existent DBs & tracks 429 quota errors
const missingDbUntilMs = new Map();
const MISSING_DB_TTL_MS = 5 * 60 * 1000;
const dbQuotaExceededUntilMs = new Map();
const QUOTA_BACKOFF_MS = 30 * 1000;
let lastFirestoreQuotaError = null;
let lastFirestoreSuccessAtMs = 0;

function isDbTemporarilySkipped(databaseId) {
  const until = missingDbUntilMs.get(databaseId) || 0;
  return until > Date.now();
}

function recordFirestoreHttpOutcome(databaseId, statusCode, data) {
  const now = Date.now();
  if (statusCode >= 200 && statusCode < 300) {
    missingDbUntilMs.delete(databaseId);
    dbQuotaExceededUntilMs.delete(databaseId);
    lastFirestoreSuccessAtMs = now;
    if (lastFirestoreQuotaError && lastFirestoreQuotaError.databaseId === databaseId) {
      lastFirestoreQuotaError = null;
    }
    return;
  }
  const msg = String((data && data.error && data.error.message) || '');
  if (statusCode === 404 && /database\s+.*does not exist/i.test(msg)) {
    missingDbUntilMs.set(databaseId, now + MISSING_DB_TTL_MS);
    return;
  }
  if (statusCode === 429 || /quota\s+(limit\s+)?exceeded|RESOURCE_EXHAUSTED/i.test(msg)) {
    dbQuotaExceededUntilMs.set(databaseId, now + QUOTA_BACKOFF_MS);
    lastFirestoreQuotaError = {
      databaseId,
      statusCode: Number(statusCode || 429),
      message: msg.slice(0, 320),
      atMs: now,
      atIso: new Date(now).toISOString()
    };
  }
}

function isFirestoreQuotaExhausted() {
  if (!lastFirestoreQuotaError) return false;
  return (Date.now() - lastFirestoreQuotaError.atMs) < (5 * 60 * 1000) && lastFirestoreSuccessAtMs < lastFirestoreQuotaError.atMs;
}

function getFirestoreHealthStatus() {
  return {
    projectId: FIREBASE_PROJECT_ID,
    configuredDatabases: BOTH_DB_IDS,
    skippedMissingDatabases: Array.from(missingDbUntilMs.entries())
      .filter(([, until]) => until > Date.now())
      .map(([dbId]) => dbId),
    quotaExceeded: isFirestoreQuotaExhausted(),
    lastQuotaError: lastFirestoreQuotaError,
    lastSuccessAtIso: lastFirestoreSuccessAtMs ? new Date(lastFirestoreSuccessAtMs).toISOString() : null
  };
}

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '').slice(-10);
}

function isValidIndianMobile(p) {
  const digits = normalizePhone(p);
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
}

function canonicalCustomerUid(p) {
  const digits = normalizePhone(p);
  if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) return '';
  return `phone_${digits}`;
}

function phoneVariants(p) {
  const digits = normalizePhone(p);
  if (digits.length !== 10) return [];
  return [digits, `+91${digits}`, `91${digits}`];
}

function normalizeEmail(e) {
  if (!e) return '';
  return String(e).toLowerCase().trim();
}

function formatE164IndianPhone(p) {
  const digits = normalizePhone(p);
  return digits.length === 10 ? `+91${digits}` : '';
}

const PLACEHOLDER_NAMES = new Set([
  '',
  'nutrolix customer',
  'nutrolix member',
  'valued customer',
  'customer',
  'guest customer',
  'guest',
  'user',
  'unknown'
]);

function isMeaningfulCustomerName(name) {
  const clean = String(name || '').trim();
  return clean.length >= 2 && /[A-Za-z]/.test(clean) && !PLACEHOLDER_NAMES.has(clean.toLowerCase());
}

function pickBestCustomerName(...candidates) {
  for (const c of candidates) {
    if (isMeaningfulCustomerName(c)) {
      return String(c).trim();
    }
  }
  for (const c of candidates) {
    const clean = String(c || '').trim();
    if (clean.length > 0 && !PLACEHOLDER_NAMES.has(clean.toLowerCase())) {
      return clean;
    }
  }
  return 'Nutrolix Customer';
}

function normalizeOrderStatus(rawStatus) {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (!s) return { key: 'placed', label: 'Order Placed' };
  if (s.includes('cancel') || s.includes('reject')) {
    return { key: 'cancelled', label: 'Cancelled' };
  }
  if (
    s.includes('out for delivery') ||
    s.includes('out_for_delivery') ||
    s.includes('dispatch') ||
    s.includes('ship') ||
    s.includes('transit')
  ) {
    return { key: 'out_for_delivery', label: 'Out for Delivery' };
  }
  if (s.includes('deliver') || s.includes('complet')) {
    return { key: 'delivered', label: 'Delivered' };
  }
  if (s.includes('pack') || s.includes('ready')) {
    return { key: 'packed', label: 'Packed' };
  }
  if (s.includes('process') || s.includes('prepar') || s.includes('cook')) {
    return { key: 'processing', label: 'Processing' };
  }
  if (s.includes('confirm') || s.includes('accept')) {
    return { key: 'confirmed', label: 'Order Confirmed' };
  }
  if (s.includes('place') || s.includes('pending')) {
    return { key: 'placed', label: 'Order Placed' };
  }
  return { key: s.replace(/[^a-z0-9]+/g, '_'), label: String(rawStatus).trim() };
}

function buildOrderStatusNotificationCopy(orderId, rawStatus, courier = '', trackingNumber = '') {
  const norm = normalizeOrderStatus(rawStatus);
  const trackingSuffix = trackingNumber
    ? ` (${courier ? courier + ' • ' : ''}AWB: ${trackingNumber})`
    : (courier ? ` via ${courier}` : '');

  switch (norm.key) {
    case 'confirmed':
      return {
        statusKey: 'confirmed',
        statusLabel: 'Order Confirmed',
        title: 'Nutrolix – Order Confirmed!',
        message: `Your Nutrolix Order #${orderId} has been Confirmed and queued for preparation.`,
        dedupKey: `notif_${orderId}_confirmed`
      };
    case 'processing':
      return {
        statusKey: 'processing',
        statusLabel: 'Processing',
        title: 'Nutrolix – Order Processing!',
        message: `Your Nutrolix Order #${orderId} is now being processed & freshly prepared.`,
        dedupKey: `notif_${orderId}_processing`
      };
    case 'packed':
      return {
        statusKey: 'packed',
        statusLabel: 'Packed',
        title: 'Nutrolix – Order Packed & Ready!',
        message: `Your Nutrolix Order #${orderId} is hygienically packed and ready for dispatch.`,
        dedupKey: `notif_${orderId}_packed`
      };
    case 'out_for_delivery':
      return {
        statusKey: 'out_for_delivery',
        statusLabel: 'Out for Delivery',
        title: 'Nutrolix – Out for Delivery!',
        message: `Your Nutrolix Order #${orderId} is Shipped / Out for Delivery${trackingSuffix}.`,
        dedupKey: `notif_${orderId}_out_for_delivery`
      };
    case 'delivered':
      return {
        statusKey: 'delivered',
        statusLabel: 'Delivered',
        title: 'Nutrolix – Order Delivered!',
        message: `Your Nutrolix Order #${orderId} has been Delivered! Enjoy your clean nutrition.`,
        dedupKey: `notif_${orderId}_delivered`
      };
    case 'cancelled':
      return {
        statusKey: 'cancelled',
        statusLabel: 'Cancelled',
        title: 'Nutrolix – Order Cancelled',
        message: `Your Nutrolix Order #${orderId} was cancelled. Any eligible refund will be processed shortly.`,
        dedupKey: `notif_${orderId}_cancelled`
      };
    case 'placed':
    default:
      return {
        statusKey: norm.key,
        statusLabel: norm.label,
        title: 'Nutrolix – Order Placed Successfully!',
        message: `Your order #${orderId} has been placed successfully.`,
        dedupKey: `notif_${orderId}_${norm.key}`
      };
  }
}

const STORE_CATEGORIES = [
  'Protein Atta',
  'Protein Snacks',
  'Nutrition Meal',
  'Nutrition Drink',
  'Healthy Flakes',
  'Body Building & Strength'
];

function normalizeStoreCategory(category, title = '') {
  const rawCat = String(category || '').trim();
  const catLower = rawCat.toLowerCase();
  for (const canonical of STORE_CATEGORIES) {
    if (canonical.toLowerCase() === catLower) return canonical;
  }

  const titleLower = String(title || '').toLowerCase();
  const combined = `${catLower} ${titleLower}`;

  if (catLower.includes('flour') || catLower.includes('atta') || combined.includes('atta') || combined.includes('flour') || combined.includes('wheat')) {
    return 'Protein Atta';
  }
  if (catLower.includes('snack') || combined.includes('snack') || combined.includes('chia') || combined.includes('flax') || combined.includes('omega') || combined.includes('seed')) {
    return 'Protein Snacks';
  }
  if (catLower.includes('drink') || catLower.includes('cold-pressed') || catLower.includes('oil') || combined.includes('drink') || combined.includes('black seed') || combined.includes('kalonji') || combined.includes('elixir') || combined.includes('shake') || combined.includes('liquid')) {
    return 'Nutrition Drink';
  }
  if (catLower.includes('flake') || catLower.includes('millet') || combined.includes('flake') || combined.includes('cereal') || combined.includes('crisp')) {
    return 'Healthy Flakes';
  }
  if (catLower.includes('plant protein') || catLower.includes('strength') || catLower.includes('body building') || combined.includes('strength') || combined.includes('body building') || combined.includes('shilajit') || combined.includes('protein powder') || combined.includes('sprouted moong') || combined.includes('muscle')) {
    return 'Body Building & Strength';
  }
  if (catLower.includes('meal') || catLower.includes('breakfast') || catLower.includes('prophetic') || catLower.includes('superfood') || combined.includes('meal') || combined.includes('talbeenah') || combined.includes('porridge') || combined.includes('superfood')) {
    return 'Nutrition Meal';
  }
  return 'Protein Atta';
}

const LEGACY_UNCONFIGURED_VARIANT_IDS = new Set([
  'prod_high_protein_atta',
  'prod_complete_nutri_meal',
  'prod_premium_talbeenah',
  'prod_multi_millet_flakes',
  'prod_sprouted_moong_protein',
  'prod_cold_pressed_black_seed_oil',
  'prod_raw_forest_honey_shilajit',
  'prod_chia_flax_omega_blend'
]);

function normalizeProductVariants(rawVariants, productMeta = {}) {
  const id = String((productMeta && productMeta.id) || '').trim();
  const explicitlyConfigured = Boolean(productMeta && productMeta.variantsConfigured === true);
  if (id && LEGACY_UNCONFIGURED_VARIANT_IDS.has(id) && !explicitlyConfigured) {
    return [];
  }
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const v of rawVariants) {
    if (!v || typeof v !== 'object') continue;
    const size = String(v.size || v.label || v.weight || v.name || '').trim();
    const price = Number(v.price);
    if (!size || !Number.isFinite(price) || price <= 0) continue;
    const key = size.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rawMrp = Number(v.mrp);
    const mrp = (Number.isFinite(rawMrp) && rawMrp >= price) ? rawMrp : price;
    out.push({
      size,
      label: size,
      price,
      mrp
    });
  }
  return out;
}

function normalizeFoodAddons(rawAddons) {
  if (!Array.isArray(rawAddons) || rawAddons.length === 0) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const a of rawAddons) {
    if (!a || typeof a !== 'object') continue;
    const name = String(a.name || a.title || a.label || '').trim();
    const price = Number(a.price);
    if (!name || !Number.isFinite(price) || price < 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const id = String(a.id || ('addon_' + key.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))).trim();
    out.push({
      id: id || ('addon_' + out.length),
      name,
      price,
      isVeg: a.isVeg !== false
    });
  }
  return out;
}

const SEED_PRODUCT_REVIEWS = {
  prod_high_protein_atta: [
    { id: 'seed_atta_1', name: 'Vikram S.', customerName: 'Vikram S.', rating: 5, date: 'Oct 28, 2026', text: 'The texture and taste are unbelievable. Making phulkas with this high-protein atta is simple and the rotis stay soft for hours.', comment: 'The texture and taste are unbelievable. Making phulkas with this high-protein atta is simple and the rotis stay soft for hours.', verified: true },
    { id: 'seed_atta_2', name: 'Ananya Mehta', customerName: 'Ananya Mehta', rating: 5, date: 'Oct 20, 2026', text: 'Verified quality. Checked the lab report QR code on the pack. Genuine 46g protein and zero bloating whatsoever.', comment: 'Verified quality. Checked the lab report QR code on the pack. Genuine 46g protein and zero bloating whatsoever.', verified: true },
    { id: 'seed_atta_3', name: 'Karan Verma', customerName: 'Karan Verma', rating: 4, date: 'Oct 14, 2026', text: 'Knead slightly with warm water and let it rest 10 minutes — soft rotis with awesome daily protein intake.', comment: 'Knead slightly with warm water and let it rest 10 minutes — soft rotis with awesome daily protein intake.', verified: true },
    { id: 'seed_atta_4', name: 'Dr. Ritu Sharma', customerName: 'Dr. Ritu Sharma', rating: 5, date: 'Oct 08, 2026', text: 'Recommended to my diabetic and fitness clients. Post-meal sugar levels stayed remarkably steady.', comment: 'Recommended to my diabetic and fitness clients. Post-meal sugar levels stayed remarkably steady.', verified: true },
    { id: 'seed_atta_5', name: 'Siddharth Rao', customerName: 'Siddharth Rao', rating: 5, date: 'Oct 02, 2026', text: 'Whole family switched to Nutrolix High Protein Atta. Zero maida feel and rich natural aroma.', comment: 'Whole family switched to Nutrolix High Protein Atta. Zero maida feel and rich natural aroma.', verified: true }
  ],
  prod_complete_nutri_meal: [
    { id: 'seed_meal_1', name: 'Sneha Kulkarni', customerName: 'Sneha Kulkarni', rating: 5, date: 'Oct 25, 2026', text: 'My daily morning breakfast shake now. Clean taste, mixes smoothly in seconds, and keeps me full until lunch.', comment: 'My daily morning breakfast shake now. Clean taste, mixes smoothly in seconds, and keeps me full until lunch.', verified: true },
    { id: 'seed_meal_2', name: 'Arjun Nair', customerName: 'Arjun Nair', rating: 5, date: 'Oct 18, 2026', text: 'No artificial sweetener aftertaste and gentle on digestion thanks to the enzyme blend.', comment: 'No artificial sweetener aftertaste and gentle on digestion thanks to the enzyme blend.', verified: true },
    { id: 'seed_meal_3', name: 'Pooja Deshmukh', customerName: 'Pooja Deshmukh', rating: 4, date: 'Oct 11, 2026', text: '26g plant protein with moringa and ashwagandha in one scoop makes busy mornings effortless.', comment: '26g plant protein with moringa and ashwagandha in one scoop makes busy mornings effortless.', verified: true }
  ],
  prod_premium_talbeenah: [
    { id: 'seed_talb_1', name: 'Farhan Siddiqui', customerName: 'Farhan Siddiqui', rating: 5, date: 'Oct 26, 2026', text: 'Authentic slow-roasted barley, dates and almond taste. Very soothing for acidity and morning energy.', comment: 'Authentic slow-roasted barley, dates and almond taste. Very soothing for acidity and morning energy.', verified: true },
    { id: 'seed_talb_2', name: 'Zoya Khan', customerName: 'Zoya Khan', rating: 5, date: 'Oct 19, 2026', text: 'Ready in 5 minutes with warm milk. Mildly sweet from Arabian dates with zero refined sugar.', comment: 'Ready in 5 minutes with warm milk. Mildly sweet from Arabian dates with zero refined sugar.', verified: true },
    { id: 'seed_talb_3', name: 'Imran Qureshi', customerName: 'Imran Qureshi', rating: 5, date: 'Oct 09, 2026', text: 'Parents love it every morning. Great aroma of cardamom and pure roasted barley.', comment: 'Parents love it every morning. Great aroma of cardamom and pure roasted barley.', verified: true }
  ],
  prod_multi_millet_flakes: [
    { id: 'seed_millet_1', name: 'Neha Bansal', customerName: 'Neha Bansal', rating: 5, date: 'Oct 22, 2026', text: 'Stays crunchy in cold milk and tastes so much cleaner than sugary cornflakes. Kids finish the whole bowl.', comment: 'Stays crunchy in cold milk and tastes so much cleaner than sugary cornflakes. Kids finish the whole bowl.', verified: true },
    { id: 'seed_millet_2', name: 'Rohan Malhotra', customerName: 'Rohan Malhotra', rating: 4, date: 'Oct 12, 2026', text: 'Ragi, jowar, bajra and quinoa flakes without palm oil. Light and filling breakfast.', comment: 'Ragi, jowar, bajra and quinoa flakes without palm oil. Light and filling breakfast.', verified: true }
  ],
  prod_sprouted_moong_protein: [
    { id: 'seed_moong_1', name: 'Meera Iyer', customerName: 'Meera Iyer', rating: 5, date: 'Oct 24, 2026', text: 'Sprouted moong and chana feels super light on the stomach unlike whey. Great in buttermilk with lemon.', comment: 'Sprouted moong and chana feels super light on the stomach unlike whey. Great in buttermilk with lemon.', verified: true },
    { id: 'seed_moong_2', name: 'Kabir Joshi', customerName: 'Kabir Joshi', rating: 5, date: 'Oct 16, 2026', text: '32g clean plant protein with zero bloating. Also mix a spoon into paratha dough for extra protein.', comment: '32g clean plant protein with zero bloating. Also mix a spoon into paratha dough for extra protein.', verified: true },
    { id: 'seed_moong_3', name: 'Tanvi Kapoor', customerName: 'Tanvi Kapoor', rating: 4, date: 'Oct 07, 2026', text: 'Roasted jeera and rock salt flavour makes a refreshing post-workout chaas.', comment: 'Roasted jeera and rock salt flavour makes a refreshing post-workout chaas.', verified: true }
  ],
  prod_cold_pressed_black_seed_oil: [
    { id: 'seed_kalonji_1', name: 'Dr. Arvind Rao', customerName: 'Dr. Arvind Rao', rating: 5, date: 'Oct 27, 2026', text: 'Dark amber glass bottle and genuine peppery aroma of high Thymoquinone virgin cold-pressed kalonji oil.', comment: 'Dark amber glass bottle and genuine peppery aroma of high Thymoquinone virgin cold-pressed kalonji oil.', verified: true },
    { id: 'seed_kalonji_2', name: 'Salma Begum', customerName: 'Salma Begum', rating: 5, date: 'Oct 21, 2026', text: '1 teaspoon every morning with warm water helped noticeably with joint stiffness and seasonal immunity.', comment: '1 teaspoon every morning with warm water helped noticeably with joint stiffness and seasonal immunity.', verified: true },
    { id: 'seed_kalonji_3', name: 'Harish Patel', customerName: 'Harish Patel', rating: 5, date: 'Oct 15, 2026', text: '100% pure first cold-press with zero dilution. Dropper bottle makes daily dosing clean and easy.', comment: '100% pure first cold-press with zero dilution. Dropper bottle makes daily dosing clean and easy.', verified: true },
    { id: 'seed_kalonji_4', name: 'Nandini Menon', customerName: 'Nandini Menon', rating: 5, date: 'Oct 09, 2026', text: 'Used both internally and in hair oil blend — very potent and fresh harvest quality.', comment: 'Used both internally and in hair oil blend — very potent and fresh harvest quality.', verified: true },
    { id: 'seed_kalonji_5', name: 'Tariq Ahmed', customerName: 'Tariq Ahmed', rating: 4, date: 'Oct 03, 2026', text: 'Strong authentic Nigella Sativa potency. Sealed leak-proof packaging.', comment: 'Strong authentic Nigella Sativa potency. Sealed leak-proof packaging.', verified: true }
  ],
  prod_raw_forest_honey_shilajit: [
    { id: 'seed_honey_1', name: 'Prashant Hegde', customerName: 'Prashant Hegde', rating: 5, date: 'Oct 23, 2026', text: 'Thick raw wild honey with real Himalayan Shilajit and Ashwagandha. Noticeable stamina and recovery boost.', comment: 'Thick raw wild honey with real Himalayan Shilajit and Ashwagandha. Noticeable stamina and recovery boost.', verified: true },
    { id: 'seed_honey_2', name: 'Devika Singh', customerName: 'Devika Singh', rating: 5, date: 'Oct 17, 2026', text: 'Earthy, pure, and non-sugary. Feels completely different from supermarket commercial honey.', comment: 'Earthy, pure, and non-sugary. Feels completely different from supermarket commercial honey.', verified: true },
    { id: 'seed_honey_3', name: 'Manoj Tiwari', customerName: 'Manoj Tiwari', rating: 5, date: 'Oct 05, 2026', text: 'Great morning tonic with lukewarm water before gym sessions.', comment: 'Great morning tonic with lukewarm water before gym sessions.', verified: true }
  ],
  prod_chia_flax_omega_blend: [
    { id: 'seed_chia_1', name: 'Ritu Chatterjee', customerName: 'Ritu Chatterjee', rating: 5, date: 'Oct 20, 2026', text: 'Cold-milled flax mixed evenly with whole chia seeds. Easy to sprinkle over oats and curd daily.', comment: 'Cold-milled flax mixed evenly with whole chia seeds. Easy to sprinkle over oats and curd daily.', verified: true },
    { id: 'seed_chia_2', name: 'Gaurav Saxena', customerName: 'Gaurav Saxena', rating: 4, date: 'Oct 10, 2026', text: 'Fresh nutty taste with zero rancid smell. Helps digestion right from the first week.', comment: 'Fresh nutty taste with zero rancid smell. Helps digestion right from the first week.', verified: true }
  ]
};

function getSeedReviewsForProduct(productOrId) {
  const id = typeof productOrId === 'string'
    ? productOrId.trim()
    : String((productOrId && productOrId.id) || '').trim();
  const explicit = (productOrId && typeof productOrId === 'object' && Array.isArray(productOrId.reviews))
    ? productOrId.reviews
    : null;
  if (explicit && explicit.length > 0 && productOrId.reviewsConfigured === true) {
    return explicit.map((r, idx) => ({
      id: r.id || `prod_rev_${id}_${idx}`,
      name: String(r.customerName || r.name || 'Verified Buyer').trim(),
      customerName: String(r.customerName || r.name || 'Verified Buyer').trim(),
      rating: Math.min(5, Math.max(1, Number(r.rating || 5) || 5)),
      date: r.date || 'Verified Purchase',
      text: String(r.comment || r.text || '').trim(),
      comment: String(r.comment || r.text || '').trim(),
      verified: r.verified !== false
    })).filter(r => r.text);
  }
  if (id && Array.isArray(SEED_PRODUCT_REVIEWS[id])) {
    return SEED_PRODUCT_REVIEWS[id].map(r => ({ ...r }));
  }
  if (explicit && explicit.length > 0) {
    return explicit.map((r, idx) => ({
      id: r.id || `prod_rev_${id}_${idx}`,
      name: String(r.customerName || r.name || 'Verified Buyer').trim(),
      customerName: String(r.customerName || r.name || 'Verified Buyer').trim(),
      rating: Math.min(5, Math.max(1, Number(r.rating || 5) || 5)),
      date: r.date || 'Verified Purchase',
      text: String(r.comment || r.text || '').trim(),
      comment: String(r.comment || r.text || '').trim(),
      verified: r.verified !== false
    })).filter(r => r.text);
  }
  return [];
}

function computeProductReviewSummary(product, liveReviews = []) {
  const pid = String((product && product.id) || '').trim().toLowerCase();
  const pname = String((product && (product.name || product.title)) || '').trim().toLowerCase();
  const baseReviews = getSeedReviewsForProduct(product);

  const matchingLive = (Array.isArray(liveReviews) ? liveReviews : []).filter(r => {
    if (!r || typeof r !== 'object' || r.approved === false) return false;
    const rIds = [r.productId, ...(Array.isArray(r.productIds) ? r.productIds : [])].filter(Boolean).map(x => String(x).trim().toLowerCase());
    const rNames = [r.productName, ...(Array.isArray(r.productNames) ? r.productNames : [])].filter(Boolean).map(x => String(x).trim().toLowerCase());
    if (pid && rIds.some(x => x === pid || x.includes(pid) || pid.includes(x))) return true;
    if (pname && rNames.some(x => x === pname || x.includes(pname) || pname.includes(x))) return true;
    return false;
  });

  const seen = new Set();
  const combined = [];
  const pushRev = (r) => {
    if (!r || typeof r !== 'object' || r.approved === false) return;
    const text = String(r.comment || r.text || '').trim();
    const name = String(r.customerName || r.name || 'Verified Customer').trim();
    if (!text) return;
    const key = r.orderId
      ? ('order_' + String(r.orderId).trim())
      : String(r.id || `${name.toLowerCase()}::${text.toLowerCase().slice(0, 60)}`);
    if (seen.has(key)) return;
    seen.add(key);
    combined.push({
      id: r.id,
      name,
      customerName: name,
      rating: Math.min(5, Math.max(1, Number(r.rating || 5) || 5)),
      date: r.date || 'Verified Purchase',
      text,
      comment: text,
      verified: r.verified !== false
    });
  };

  matchingLive.forEach(pushRev);
  baseReviews.forEach(pushRev);

  const reviewCount = combined.length;
  const rating = reviewCount > 0
    ? Number((combined.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(1))
    : Number((product && product.rating) || 4.9);

  return {
    reviews: baseReviews,
    combinedReviews: combined,
    reviewCount,
    rating
  };
}

function normalizeGeoToken(val) {
  return String(val || '')
    .toLowerCase()
    .replace(/\(mh\)|\(gj\)|\(ka\)|\(up\)|\(dl\)/g, '')
    .replace(/\braigad\b/g, 'raigarh')
    .replace(/\bahmadabad\b/g, 'ahmedabad')
    .replace(/\bbengaluru(\s+(urban|rural))?\b/g, 'bangalore')
    .replace(/\bgurugram\b/g, 'gurgaon')
    .replace(/\bprayagraj\b/g, 'allahabad')
    .replace(/\bchhatrapati sambhajinagar\b/g, 'aurangabad')
    .replace(/\bbaroda\b/g, 'vadodara')
    .replace(/\bbelagavi\b/g, 'belgaum')
    .replace(/\bmysuru\b/g, 'mysore')
    .replace(/\bmangaluru\b/g, 'mangalore')
    .replace(/\bkalaburagi\b/g, 'gulbarga')
    .replace(/\bshivamogga\b/g, 'shimoga')
    .replace(/\btumakuru\b/g, 'tumkur')
    .replace(/\bhubballi\b/g, 'hubli')
    .replace(/\btrivandrum\b/g, 'thiruvananthapuram')
    .replace(/\bcalicut\b/g, 'kozhikode')
    .replace(/\bcochin\b/g, 'kochi')
    .replace(/\bpondicherry\b/g, 'puducherry')
    .replace(/\bcalcutta\b/g, 'kolkata')
    .replace(/\bbombay\b/g, 'mumbai')
    .replace(/\bmadras\b/g, 'chennai')
    .replace(/\bnasik\b/g, 'nashik')
    .replace(/\bsholapur\b/g, 'solapur')
    .replace(/\bmahesana\b/g, 'mehsana')
    .replace(/\bdohad\b/g, 'dahod')
    .replace(/\bkachchh\b/g, 'kutch')
    .replace(/\bbanas\s+kantha\b/g, 'banaskantha')
    .replace(/\bsabar\s+kantha\b/g, 'sabarkantha')
    .replace(/\bpanch\s+mahals?\b/g, 'panchmahal')
    .replace(/\bmumbai suburban\b/g, 'mumbai')
    .replace(/\bnavi mumbai\b/g, 'mumbai')
    .replace(/\b(district|taluka|tehsil|subdistrict|municipal corporation)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_INDIA_POST_PIN_MAP = {
  '410208': { pincode: '410208', city: 'Taloja, Panvel', state: 'Maharashtra', district: 'Raigad', area: 'Taloja / MIDC Taloja' },
  '410210': { pincode: '410210', city: 'Kharghar, Navi Mumbai', state: 'Maharashtra', district: 'Raigad', area: 'Kharghar' },
  '410218': { pincode: '410218', city: 'Kalamboli, Navi Mumbai', state: 'Maharashtra', district: 'Raigad', area: 'Kalamboli Node' },
  '410209': { pincode: '410209', city: 'Kamothe, Navi Mumbai', state: 'Maharashtra', district: 'Raigad', area: 'Kamothe' },
  '410206': { pincode: '410206', city: 'Panvel, Navi Mumbai', state: 'Maharashtra', district: 'Raigad', area: 'Panvel / Ulwe / New Panvel' },
  '410221': { pincode: '410221', city: 'Palaspe, Panvel', state: 'Maharashtra', district: 'Raigad', area: 'Palaspe / ONGC Panvel' },
  '400614': { pincode: '400614', city: 'CBD Belapur, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'CBD Belapur' },
  '400703': { pincode: '400703', city: 'Vashi, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'Vashi' },
  '400705': { pincode: '400705', city: 'Sanpada, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'Sanpada' },
  '400706': { pincode: '400706', city: 'Nerul, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'Nerul / Seawoods' },
  '400708': { pincode: '400708', city: 'Airoli, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'Airoli' },
  '400701': { pincode: '400701', city: 'Ghansoli, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'Ghansoli' },
  '400709': { pincode: '400709', city: 'Kopar Khairane, Navi Mumbai', state: 'Maharashtra', district: 'Thane', area: 'Kopar Khairane' }
};

// Official India Post 2-digit PIN prefix table by State / UT
// Prevents impossible cross-state bogus PINs (e.g., 497586 for Maharashtra, where valid PINs are 40-44).
const INDIA_STATE_PIN_PREFIXES = {
  'delhi': ['11'],
  'haryana': ['12', '13'],
  'punjab': ['14', '15', '16'],
  'chandigarh': ['16'],
  'himachal pradesh': ['17'],
  'jammu and kashmir': ['18', '19'],
  'jammu & kashmir': ['18', '19'],
  'ladakh': ['19'],
  'uttar pradesh': ['20', '21', '22', '23', '24', '25', '26', '27', '28'],
  'uttarakhand': ['24', '26'],
  'rajasthan': ['30', '31', '32', '33', '34'],
  'gujarat': ['36', '37', '38', '39'],
  'dadra and nagar haveli': ['39'],
  'daman and diu': ['39', '36'],
  'maharashtra': ['40', '41', '42', '43', '44'],
  'goa': ['40'],
  'madhya pradesh': ['45', '46', '47', '48'],
  'chhattisgarh': ['49'],
  'telangana': ['50'],
  'andhra pradesh': ['51', '52', '53'],
  'karnataka': ['56', '57', '58', '59'],
  'tamil nadu': ['60', '61', '62', '63', '64'],
  'puducherry': ['60', '53', '67'],
  'kerala': ['67', '68', '69'],
  'lakshadweep': ['68'],
  'west bengal': ['70', '71', '72', '73', '74'],
  'sikkim': ['73'],
  'andaman and nicobar': ['74'],
  'odisha': ['75', '76', '77'],
  'orissa': ['75', '76', '77'],
  'assam': ['78'],
  'arunachal pradesh': ['79'],
  'manipur': ['79'],
  'meghalaya': ['79'],
  'mizoram': ['79'],
  'nagaland': ['79'],
  'tripura': ['79'],
  'bihar': ['80', '81', '82', '83', '84', '85'],
  'jharkhand': ['81', '82', '83']
};

function isValidIndianPincodeForState(pin, state) {
  const cleanPin = String(pin || '').replace(/\D/g, '');
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) return false;
  const normState = normalizeGeoToken(state);
  if (!normState) return true;
  const prefix2 = cleanPin.slice(0, 2);
  for (const [stateKey, prefixes] of Object.entries(INDIA_STATE_PIN_PREFIXES)) {
    if (normState === stateKey || normState.includes(stateKey) || stateKey.includes(normState)) {
      return prefixes.includes(prefix2);
    }
  }
  return true;
}

function resolveKnownIndianPostalOverride(geo) {
  if (!geo || typeof geo !== 'object') return null;

  // 1. High-precision GPS coordinate bounding boxes for Navi Mumbai / Panvel nodes
  //    where OSM/BigDataCloud often omit the sub-locality name or return neighbouring PINs.
  const lat = Number(geo.lat ?? geo.latitude);
  const lon = Number(geo.lon ?? geo.lng ?? geo.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    // Taloja Phase 1, Phase 2, Taloja MIDC, Taloja Panchanand, Navde, Pendhar (PIN 410208)
    if (lat >= 19.050 && lat <= 19.118 && lon >= 73.078 && lon <= 73.138) {
      return { pincode: '410208', city: 'Taloja, Panvel', state: 'Maharashtra', district: 'Raigad' };
    }
    // Kharghar (PIN 410210)
    if (lat >= 19.028 && lat <= 19.076 && lon >= 73.048 && lon < 73.078) {
      return { pincode: '410210', city: 'Kharghar, Navi Mumbai', state: 'Maharashtra', district: 'Raigad' };
    }
    // Kalamboli / Roadpali (PIN 410218)
    if (lat >= 19.024 && lat < 19.050 && lon >= 73.084 && lon <= 73.112) {
      return { pincode: '410218', city: 'Kalamboli, Navi Mumbai', state: 'Maharashtra', district: 'Raigad' };
    }
    // Kamothe (PIN 410209)
    if (lat >= 19.010 && lat < 19.028 && lon >= 73.078 && lon <= 73.104) {
      return { pincode: '410209', city: 'Kamothe, Navi Mumbai', state: 'Maharashtra', district: 'Raigad' };
    }
  }

  const localityText = [
    geo.neighborhood,
    geo.city,
    geo.locality,
    geo.taluka,
    geo.district,
    geo.formattedAddress
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\btaloja\b|\btaloje\b|\bnavde\b|\bpendhar\b|\bpanchanand\b/.test(localityText)) {
    return { pincode: '410208', city: 'Taloja, Panvel', state: 'Maharashtra', district: 'Raigad' };
  }
  if (/\bkharghar\b/.test(localityText)) {
    return { pincode: '410210', city: 'Kharghar, Navi Mumbai', state: 'Maharashtra', district: 'Raigad' };
  }
  if (/\bkalamboli\b|\broadpali\b/.test(localityText)) {
    return { pincode: '410218', city: 'Kalamboli, Navi Mumbai', state: 'Maharashtra', district: 'Raigad' };
  }
  if (/\bkamothe\b/.test(localityText)) {
    return { pincode: '410209', city: 'Kamothe, Navi Mumbai', state: 'Maharashtra', district: 'Raigad' };
  }
  if (/\bulwe\b|\bulwa\b/.test(localityText)) {
    return { pincode: '410206', city: 'Ulwe, Panvel', state: 'Maharashtra', district: 'Raigad' };
  }
  if (/\bcbd belapur\b|\bbelapur\b/.test(localityText)) {
    return { pincode: '400614', city: 'CBD Belapur, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  if (/\bvashi\b/.test(localityText)) {
    return { pincode: '400703', city: 'Vashi, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  if (/\bsanpada\b/.test(localityText)) {
    return { pincode: '400705', city: 'Sanpada, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  if (/\bnerul\b|\bseawoods\b/.test(localityText)) {
    return { pincode: '400706', city: 'Nerul, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  if (/\bairoli\b/.test(localityText)) {
    return { pincode: '400708', city: 'Airoli, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  if (/\bghansoli\b/.test(localityText)) {
    return { pincode: '400701', city: 'Ghansoli, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  if (/\bkopar ?khairane\b|\bkoparkhairane\b/.test(localityText)) {
    return { pincode: '400709', city: 'Kopar Khairane, Navi Mumbai', state: 'Maharashtra', district: 'Thane' };
  }
  return null;
}

function postOfficeMatchesGeo(po, geo) {
  if (!po || !geo) return false;
  const poState = normalizeGeoToken(po.State);
  const geoState = normalizeGeoToken(geo.state);
  if (geoState && poState && !poState.includes(geoState) && !geoState.includes(poState)) {
    return false;
  }

  const localityBlob = normalizeGeoToken([
    geo.neighborhood,
    geo.locality,
    geo.city,
    geo.taluka,
    geo.district,
    geo.formattedAddress
  ].filter(Boolean).join(' '));

  const poName = normalizeGeoToken(po.Name);
  const poBlock = normalizeGeoToken(po.Block);
  const poDistrict = normalizeGeoToken(po.District);
  const poDivision = normalizeGeoToken(po.Division);
  const geoDistrict = normalizeGeoToken(geo.district || geo.taluka || '');

  // If the geocoder gave a specific district (e.g., Raigad), reject post offices
  // from a completely different district (e.g., Mumbai 400010 for Taloja/Panvel).
  if (geoDistrict && poDistrict) {
    const districtMatch =
      poDistrict.includes(geoDistrict) ||
      geoDistrict.includes(poDistrict) ||
      (poBlock && poBlock !== 'na' && (poBlock.includes(geoDistrict) || geoDistrict.includes(poBlock))) ||
      (poDivision && geoDistrict.split(' ').some((w) => w.length >= 4 && poDivision.includes(w)));
    if (!districtMatch) {
      // Allow only if the post office Name or Block itself explicitly appears in the detected locality
      const blockMatches = poBlock && poBlock !== 'na' && poBlock.length >= 4 && localityBlob.includes(poBlock);
      const nameMatches = poName && poName.length >= 4 && localityBlob.includes(poName);
      if (!nameMatches && !blockMatches) {
        return false;
      }
    }
  }

  const tokensToCheck = [poName, poBlock, poDistrict].filter((t) => t && t.length >= 3);
  return tokensToCheck.some((tok) => {
    if (localityBlob.includes(tok)) return true;
    return tok.split(' ').some((word) => word.length >= 4 && localityBlob.includes(word));
  });
}

function replaceIncorrectPincodeInAddress(formattedAddress, badPin, verifiedPin) {
  let out = String(formattedAddress || '').trim();
  if (!out || !verifiedPin) return out;
  if (badPin && badPin !== verifiedPin) {
    const pinRegex = new RegExp(`\\b${badPin}\\b`, 'g');
    if (pinRegex.test(out)) {
      out = out.replace(pinRegex, verifiedPin);
    }
  }
  return out;
}

function parseNominatimGeocodeResponse(lat, lon, data) {
  if (!data || data.error || !data.address || typeof data.address !== 'object') {
    return {
      success: false,
      fallbackRequired: true,
      code: 'NOMINATIM_EMPTY',
      error: (data && data.error) || 'Unable to resolve address from OpenStreetMap Nominatim.'
    };
  }

  const addr = data.address;
  const pincode = String(addr.postcode || '').replace(/\D/g, '').slice(0, 6);
  const neighborhood =
    addr.suburb ||
    addr.neighbourhood ||
    addr.residential ||
    addr.quarter ||
    addr.hamlet ||
    '';
  const locality =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.city_district ||
    addr.state_district ||
    addr.county ||
    '';
  const district = addr.state_district || addr.county || addr.city_district || '';
  const taluka = addr.county || addr.municipality || '';
  const state = addr.state || '';

  const resolvedCity = [neighborhood, locality]
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(', ');

  const streetParts = [
    addr.house_number,
    addr.road || addr.pedestrian || addr.footway,
    neighborhood,
    locality,
    state,
    pincode
  ].filter(Boolean);
  const formattedAddress = data.display_name || streetParts.join(', ');

  return {
    success: Boolean(formattedAddress || resolvedCity || pincode),
    provider: 'nominatim',
    lat: Number(lat),
    lon: Number(lon),
    pincode: pincode || '',
    city: resolvedCity || locality || neighborhood || '',
    locality: locality || '',
    district: district || '',
    taluka: taluka || '',
    state: state || '',
    neighborhood: neighborhood || '',
    formattedAddress: formattedAddress || ''
  };
}

function parseBigDataCloudGeocodeResponse(lat, lon, data) {
  if (!data || (!data.locality && !data.city && !data.postcode && !data.principalSubdivision)) {
    return {
      success: false,
      fallbackRequired: true,
      code: 'BIGDATACLOUD_EMPTY',
      error: 'Unable to resolve address from reverse geocoder.'
    };
  }

  const pincode = String(data.postcode || '').replace(/\D/g, '').slice(0, 6);
  const neighborhood = data.locality && data.locality !== data.city ? data.locality : '';
  const locality = data.city || data.locality || '';
  const state = data.principalSubdivision || '';
  const resolvedCity = [neighborhood, locality]
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(', ');
  const formattedAddress = [neighborhood, locality, state, pincode, data.countryName]
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(', ');

  return {
    success: Boolean(formattedAddress || resolvedCity || pincode),
    provider: 'bigdatacloud',
    lat: Number(lat),
    lon: Number(lon),
    pincode: pincode || '',
    city: resolvedCity || locality || '',
    locality: locality || '',
    district: '',
    taluka: '',
    state: state || '',
    neighborhood: neighborhood || '',
    formattedAddress: formattedAddress || ''
  };
}

function httpsJsonRequest(options, bodyPayload = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (settled) return;
        settled = true;
        clearTimeout(overallTimer);
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (_) {
          parsed = { raw: data };
        }
        resolve({ statusCode: res.statusCode || 500, data: parsed, raw: data });
      });
    });
    const overallTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      req.destroy(new Error('HTTPS request timed out'));
      reject(new Error('HTTPS request timed out'));
    }, timeoutMs);
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      reject(err);
    });
    req.setTimeout(timeoutMs, () => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      req.destroy(new Error('HTTPS request timed out'));
      reject(new Error('HTTPS request timed out'));
    });
    if (bodyPayload) {
      req.write(typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload));
    }
    req.end();
  });
}

async function lookupIndiaPostByPincode(pin) {
  const cleanPin = String(pin || '').replace(/\D/g, '').slice(0, 6);
  if (cleanPin.length !== 6) return [];
  try {
    const resp = await httpsJsonRequest(
      {
        hostname: 'api.postalpincode.in',
        port: 443,
        path: `/pincode/${encodeURIComponent(cleanPin)}`,
        method: 'GET',
        headers: { 'User-Agent': 'NutrolixWellnessApp/2.0', Accept: 'application/json' }
      },
      null,
      3500
    );
    if (resp.statusCode === 200 && Array.isArray(resp.data) && resp.data[0] && resp.data[0].Status === 'Success') {
      return Array.isArray(resp.data[0].PostOffice) ? resp.data[0].PostOffice : [];
    }
  } catch (_) {}
  return [];
}

async function lookupIndiaPostByPostOffice(placeName) {
  const cleanName = String(placeName || '').replace(/[^a-zA-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanName.length < 3) return [];
  try {
    const resp = await httpsJsonRequest(
      {
        hostname: 'api.postalpincode.in',
        port: 443,
        path: `/postoffice/${encodeURIComponent(cleanName)}`,
        method: 'GET',
        headers: { 'User-Agent': 'NutrolixWellnessApp/2.0', Accept: 'application/json' }
      },
      null,
      3500
    );
    if (resp.statusCode === 200 && Array.isArray(resp.data) && resp.data[0] && resp.data[0].Status === 'Success') {
      return Array.isArray(resp.data[0].PostOffice) ? resp.data[0].PostOffice : [];
    }
  } catch (_) {}
  return [];
}

async function verifyAndResolveIndianPincode(geo, options = {}) {
  if (!geo || !geo.success) return geo;
  const nativeGeo = options.nativeGeocoder || null;
  const lookupPincodeFn = typeof options.lookupPincodeFn === 'function' ? options.lookupPincodeFn : lookupIndiaPostByPincode;
  const lookupPostOfficeFn = typeof options.lookupPostOfficeFn === 'function' ? options.lookupPostOfficeFn : lookupIndiaPostByPostOffice;

  const originalPin = String(geo.pincode || '').replace(/\D/g, '').slice(0, 6);
  const nativePin = String((nativeGeo && nativeGeo.pincode) || '').replace(/\D/g, '').slice(0, 6);

  // 1. Check authoritative locality-to-PIN overrides when reverse geocoders
  //    systematically return an adjacent/wrong ward PIN (e.g. 400010 for Taloja).
  const knownOverride = resolveKnownIndianPostalOverride(geo);
  if (knownOverride && knownOverride.pincode) {
    return {
      ...geo,
      pincode: knownOverride.pincode,
      city: knownOverride.city || geo.city,
      state: knownOverride.state || geo.state,
      pincodeVerifiedBy: 'india_post_locality_override',
      formattedAddress: replaceIncorrectPincodeInAddress(geo.formattedAddress, originalPin, knownOverride.pincode)
    };
  }

  // 2. Verify candidate PIN codes against India Post.
  //    PRIORITIZE Android's native Google Geocoder PIN first (Google Maps Indian PIN polygons are far more accurate
  //    than crowd-sourced OpenStreetMap Nominatim), then Nominatim/BigDataCloud PIN.
  //    Strictly reject any candidate PIN whose 2-digit prefix is impossible for geo.state.
  const pinCandidates = [nativePin, originalPin].filter(
    (p, i, arr) => p.length === 6 && arr.indexOf(p) === i && isValidIndianPincodeForState(p, geo.state)
  );
  let verifiedPin = '';
  let indiaPostReachable = false;

  for (const candidate of pinCandidates) {
    const offices = await lookupPincodeFn(candidate);
    if (!Array.isArray(offices) || offices.length === 0) {
      continue;
    }
    indiaPostReachable = true;
    if (offices.some((po) => postOfficeMatchesGeo(po, geo))) {
      verifiedPin = candidate;
      break;
    }
  }

  // 3. If candidate PIN failed verification against district/locality (e.g. wrong ward PIN),
  //    query India Post ONLY by narrow neighborhood/sub-locality name (NEVER by whole metro city/district name,
  //    which would return a random GPO PIN like 380001 for all of Ahmedabad or 400001 for all of Mumbai!).
  if (!verifiedPin) {
    const placeQueries = [];
    const metroBroadSet = new Set([
      'mumbai', 'navi mumbai', 'thane', 'pune', 'ahmedabad', 'surat', 'vadodara', 'rajkot',
      'delhi', 'new delhi', 'noida', 'gurugram', 'gurgaon', 'faridabad', 'ghaziabad',
      'bengaluru', 'bangalore', 'hyderabad', 'secunderabad', 'chennai', 'kolkata',
      'jaipur', 'lucknow', 'kanpur', 'indore', 'bhopal', 'nagpur', 'patna', 'chandigarh',
      'kochi', 'coimbatore', 'visakhapatnam', 'guwahati', 'bhubaneswar', 'dehradun'
    ]);
    const addNarrowPlace = (raw) => {
      const cleaned = String(raw || '')
        .replace(/\b(Phase|Sector|Taluka|District|Subdistrict|Ward|Municipal Corporation|Division)\b.*$/i, '')
        .replace(/[-,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const normCleaned = normalizeGeoToken(cleaned);
      if (cleaned.length >= 3 && !metroBroadSet.has(normCleaned) && !placeQueries.includes(cleaned)) {
        placeQueries.push(cleaned);
      }
    };

    addNarrowPlace(geo.neighborhood);
    if (nativeGeo && nativeGeo.neighborhood) {
      addNarrowPlace(nativeGeo.neighborhood);
    }

    for (const qName of placeQueries) {
      const poMatches = await lookupPostOfficeFn(qName);
      if (!Array.isArray(poMatches) || poMatches.length === 0) continue;

      const geoState = normalizeGeoToken(geo.state);
      const geoDistrict = normalizeGeoToken(geo.district || geo.taluka || '');
      const stateFiltered = poMatches.filter((po) => {
        if (!po || !po.Pincode) return false;
        const ps = normalizeGeoToken(po.State);
        if (geoState && ps && !ps.includes(geoState) && !geoState.includes(ps)) return false;
        if (geoDistrict) {
          const pd = normalizeGeoToken(po.District);
          const pdiv = normalizeGeoToken(po.Division);
          if (pd && !pd.includes(geoDistrict) && !geoDistrict.includes(pd) && !(pdiv && geoDistrict.split(' ').some((w) => w.length >= 4 && pdiv.includes(w)))) {
            return false;
          }
        }
        return true;
      });

      const ranked = stateFiltered.sort((a, b) => {
        const aExact = normalizeGeoToken(a.Name) === normalizeGeoToken(qName) ? 2 : 0;
        const bExact = normalizeGeoToken(b.Name) === normalizeGeoToken(qName) ? 2 : 0;
        const aDeliv = String(a.DeliveryStatus || '').toLowerCase() === 'delivery' ? 1 : 0;
        const bDeliv = String(b.DeliveryStatus || '').toLowerCase() === 'delivery' ? 1 : 0;
        return (bExact + bDeliv) - (aExact + aDeliv);
      });

      if (ranked[0] && String(ranked[0].Pincode || '').replace(/\D/g, '').length === 6) {
        verifiedPin = String(ranked[0].Pincode).replace(/\D/g, '').slice(0, 6);
        break;
      }
    }
  }

  // 4. Final fallback: if India Post API timed out / was unreachable, trust state-validated nativePin first, then originalPin.
  if (!verifiedPin && !indiaPostReachable) {
    if (nativePin && isValidIndianPincodeForState(nativePin, geo.state)) {
      verifiedPin = nativePin;
    } else if (originalPin && isValidIndianPincodeForState(originalPin, geo.state)) {
      verifiedPin = originalPin;
    }
  }

  return {
    ...geo,
    pincode: verifiedPin || '',
    pincodeVerifiedBy: verifiedPin
      ? (verifiedPin === nativePin ? 'android_geocoder_india_post_verified' : (verifiedPin === originalPin ? 'india_post_confirmed' : 'india_post_corrected'))
      : 'unverified_stripped',
    formattedAddress: replaceIncorrectPincodeInAddress(geo.formattedAddress, originalPin, verifiedPin)
  };
}

async function reverseGeocodeFree(lat, lon, options = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon) || Math.abs(numLat) > 90 || Math.abs(numLon) > 180) {
    return { success: false, fallbackRequired: true, code: 'INVALID_COORDS', error: 'Invalid latitude or longitude.' };
  }

  let parsed = null;
  try {
    const nominatimPath = `/reverse?format=jsonv2&lat=${encodeURIComponent(numLat)}&lon=${encodeURIComponent(numLon)}&addressdetails=1&zoom=18&accept-language=en`;
    const nomResp = await httpsJsonRequest({
      hostname: 'nominatim.openstreetmap.org',
      port: 443,
      path: nominatimPath,
      method: 'GET',
      headers: {
        'User-Agent': 'NutrolixWellnessApp/2.0 (https://nutrolix.in; support@nutrolix.in)',
        Accept: 'application/json'
      }
    });
    if (nomResp.statusCode >= 200 && nomResp.statusCode < 300) {
      const parsedNom = parseNominatimGeocodeResponse(numLat, numLon, nomResp.data);
      if (parsedNom.success) parsed = parsedNom;
    }
  } catch (_) {}

  if (!parsed) {
    try {
      const bdcPath = `/data/reverse-geocode-client?latitude=${encodeURIComponent(numLat)}&longitude=${encodeURIComponent(numLon)}&localityLanguage=en`;
      const bdcResp = await httpsJsonRequest({
        hostname: 'api.bigdatacloud.net',
        port: 443,
        path: bdcPath,
        method: 'GET',
        headers: {
          'User-Agent': 'NutrolixWellnessApp/2.0',
          Accept: 'application/json'
        }
      });
      if (bdcResp.statusCode >= 200 && bdcResp.statusCode < 300) {
        const parsedBdc = parseBigDataCloudGeocodeResponse(numLat, numLon, bdcResp.data);
        if (parsedBdc.success) parsed = parsedBdc;
      }
    } catch (err) {
      if (options.nativeGeocoder && (options.nativeGeocoder.formattedAddress || options.nativeGeocoder.city || options.nativeGeocoder.pincode)) {
        return verifyAndResolveIndianPincode({ success: true, provider: 'native', lat: numLat, lon: numLon, ...options.nativeGeocoder }, options);
      }
      return {
        success: false,
        fallbackRequired: true,
        code: 'GEOCODE_ERROR',
        error: err.message || 'Free reverse geocoding request failed.'
      };
    }
  }

  if (parsed) {
    // Enrich Nominatim/BigDataCloud output with accurate Android nativeGeocoder locality/PIN when missing
    if (options.nativeGeocoder && typeof options.nativeGeocoder === 'object') {
      const ng = options.nativeGeocoder;
      if (!parsed.pincode && ng.pincode) parsed.pincode = String(ng.pincode).replace(/\D/g, '').slice(0, 6);
      if (!parsed.city && ng.city) parsed.city = String(ng.city).trim();
      if (!parsed.state && ng.state) parsed.state = String(ng.state).trim();
      if (!parsed.neighborhood && ng.neighborhood) parsed.neighborhood = String(ng.neighborhood).trim();
      if (!parsed.locality && ng.locality) parsed.locality = String(ng.locality).trim();
      if (!parsed.district && ng.district) parsed.district = String(ng.district).trim();
    }
    const verified = await verifyAndResolveIndianPincode(parsed, options);
    // If India Post could not confirm Nominatim's PIN, fall back to Android nativeGeocoder's valid state-matched PIN
    if (!verified.pincode && options.nativeGeocoder && options.nativeGeocoder.pincode) {
      const ngPin = String(options.nativeGeocoder.pincode).replace(/\D/g, '').slice(0, 6);
      if (ngPin.length === 6 && isValidIndianPincodeForState(ngPin, verified.state || options.nativeGeocoder.state)) {
        verified.pincode = ngPin;
        verified.pincodeVerifiedBy = 'android_native_geocoder';
      }
    }
    return verified;
  }

  if (options.nativeGeocoder && (options.nativeGeocoder.formattedAddress || options.nativeGeocoder.city || options.nativeGeocoder.pincode)) {
    return verifyAndResolveIndianPincode({ success: true, provider: 'native', lat: numLat, lon: numLon, ...options.nativeGeocoder }, options);
  }

  return {
    success: false,
    fallbackRequired: true,
    code: 'GEOCODE_EMPTY',
    error: 'Unable to resolve address automatically. Please enter PIN code & city manually.'
  };
}

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !String(raw).trim()) return null;
  let text = String(raw).trim();
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8').trim();
    } catch (_) {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.client_email && parsed.private_key) {
      return parsed;
    }
  } catch (_) {}
  return null;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && Date.now() < cachedTokenExpiresAtMs - 60000) {
    return cachedAccessToken;
  }

  const sa = parseServiceAccountFromEnv();
  if (!sa) return null;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSec + 3600,
    iat: nowSec
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  const signature = signer.sign(sa.private_key.replace(/\\n/g, '\n'));
  const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

  const formBody = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`;
  const res = await httpsJsonRequest(
    {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody)
      }
    },
    formBody
  );

  if (res.statusCode === 200 && res.data && res.data.access_token) {
    cachedAccessToken = res.data.access_token;
    const ttlMs = (Number(res.data.expires_in) || 3500) * 1000;
    cachedTokenExpiresAtMs = Date.now() + ttlMs;
    return cachedAccessToken;
  }
  return null;
}

function isPermanentFcmTokenError(statusCode, responseData) {
  if (statusCode === 404 || statusCode === 410) return true;
  const errObj = responseData && responseData.error;
  if (!errObj) return false;
  const msg = JSON.stringify(errObj).toUpperCase();
  return (
    msg.includes('UNREGISTERED') ||
    msg.includes('SENDER_ID_MISMATCH') ||
    msg.includes('REGISTRATION_TOKEN_NOT_REGISTERED') ||
    (statusCode === 400 && msg.includes('INVALID_ARGUMENT') && msg.includes('TOKEN'))
  );
}

async function sendFcmV1Message(fcmToken, payload) {
  if (!fcmToken || String(fcmToken).trim().length < 16) {
    return { sent: false, permanentFailure: false, status: 'SKIPPED_INVALID_TOKEN' };
  }
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return { sent: false, permanentFailure: false, status: 'FCM_SERVICE_ACCOUNT_UNCONFIGURED' };
  }

  const stringData = {};
  if (payload.data && typeof payload.data === 'object') {
    for (const [k, v] of Object.entries(payload.data)) {
      if (v !== undefined && v !== null) {
        stringData[k] = String(v);
      }
    }
  }
  if (payload.orderId) stringData.orderId = String(payload.orderId);
  if (payload.url) stringData.url = String(payload.url);
  if (payload.title) stringData.title = String(payload.title);
  if (payload.body) stringData.message = String(payload.body);

  const isDataOnlyAndroid = Boolean(payload.dataOnlyAndroid);
  const resolvedTitle = String(payload.title || 'Nutrolix Order Update');
  const resolvedBody = String(payload.body || '');
  const resolvedChannel = payload.channelId || 'nutrolix_orders_channel_v3';

  if (payload.title && !stringData.title) stringData.title = resolvedTitle;
  if (payload.body && !stringData.body) stringData.body = resolvedBody;

  const messagePayload = {
    token: String(fcmToken).trim(),
    data: stringData,
    android: {
      priority: 'HIGH',
      ttl: '86400s'
    },
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '86400'
      },
      notification: {
        title: resolvedTitle,
        body: resolvedBody,
        icon: '/assets/nutrolix-logo.png',
        badge: '/assets/nutrolix-logo.png',
        vibrate: [250, 100, 250, 100, 250],
        silent: false,
        renotify: true,
        requireInteraction: true,
        ...(stringData.dedupKey ? { tag: stringData.dedupKey } : {})
      },
      fcm_options: {
        link: payload.url || '/orders.html'
      }
    }
  };

  if (!isDataOnlyAndroid) {
    messagePayload.notification = {
      title: resolvedTitle,
      body: resolvedBody
    };
    messagePayload.android.notification = {
      channel_id: resolvedChannel,
      sound: 'default',
      default_sound: true,
      default_vibrate_timings: true,
      default_light_settings: true,
      notification_priority: 'PRIORITY_MAX',
      visibility: 'PUBLIC',
      ...(stringData.dedupKey ? { tag: stringData.dedupKey } : {})
    };
  }

  const fcmBody = {
    message: messagePayload
  };

  const bodyStr = JSON.stringify(fcmBody);
  const res = await httpsJsonRequest(
    {
      hostname: 'fcm.googleapis.com',
      port: 443,
      path: `/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    },
    bodyStr
  );

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { sent: true, permanentFailure: false, statusCode: res.statusCode, status: 'FCM_DELIVERED', messageName: res.data.name || '' };
  }

  const permanent = isPermanentFcmTokenError(res.statusCode, res.data);
  return {
    sent: false,
    permanentFailure: permanent,
    statusCode: res.statusCode,
    status: permanent ? 'FCM_TOKEN_UNREGISTERED_REMOVED' : `FCM_HTTP_${res.statusCode}`,
    error: res.data && res.data.error ? res.data.error.message : 'FCM send error'
  };
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val) {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const out = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function encodeFirestorePath(docPath) {
  return String(docPath || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

async function firestorePatchDocument(docPath, dataObj, databaseId = DEFAULT_DB_ID) {
  try {
    if (isDbTemporarilySkipped(databaseId)) return false;
    const accessToken = await getGoogleAccessToken();
    if (!accessToken || !docPath || !dataObj || typeof dataObj !== 'object') return false;

    const cleanPath = encodeFirestorePath(docPath);
    if (!cleanPath) return false;
    const fields = {};
    const updateMaskParams = [];
    for (const [k, v] of Object.entries(dataObj)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
        updateMaskParams.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
      }
    }
    if (updateMaskParams.length === 0) return false;

    const bodyStr = JSON.stringify({ fields });
    const reqPath = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(databaseId)}/documents/${cleanPath}?${updateMaskParams.join('&')}`;
    const res = await httpsJsonRequest(
      {
        hostname: 'firestore.googleapis.com',
        port: 443,
        path: reqPath,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      },
      bodyStr
    );
    recordFirestoreHttpOutcome(databaseId, res.statusCode, res.data);
    return res.statusCode >= 200 && res.statusCode < 300;
  } catch (_) {
    return false;
  }
}

function decodeFirestoreDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFirestoreValue(v);
  }
  obj._docId = doc.name ? doc.name.split('/').pop() : undefined;
  obj._docName = doc.name || undefined;
  return obj;
}

async function firestoreGetDocument(docPath, databaseId = DEFAULT_DB_ID) {
  try {
    if (isDbTemporarilySkipped(databaseId)) return null;
    const accessToken = await getGoogleAccessToken();
    if (!accessToken || !docPath) return null;
    const cleanPath = encodeFirestorePath(docPath);
    if (!cleanPath) return null;
    const reqPath = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(databaseId)}/documents/${cleanPath}`;
    const res = await httpsJsonRequest({
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: reqPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    recordFirestoreHttpOutcome(databaseId, res.statusCode, res.data);
    if (res.statusCode !== 200 || !res.data || !res.data.name) return null;
    return decodeFirestoreDoc(res.data);
  } catch (_) {
    return null;
  }
}

async function firestoreGetFirstAvailable(docPath) {
  const results = await Promise.all(
    BOTH_DB_IDS.map((dbId) => firestoreGetDocument(docPath, dbId).catch(() => null))
  );
  return results.find(Boolean) || null;
}

async function firestorePatchBothDbs(docPath, dataObj) {
  const results = await Promise.all(
    BOTH_DB_IDS.map((dbId) => firestorePatchDocument(docPath, dataObj, dbId))
  );
  return {
    anySuccess: results.some(Boolean),
    defaultDb: Boolean(results[0]),
    namedDb: Boolean(results[1])
  };
}

async function firestoreDeleteBothDbs(docPath) {
  const results = await Promise.all(
    BOTH_DB_IDS.map((dbId) => firestoreDeleteDocument(docPath, dbId))
  );
  return {
    anySuccess: results.some(Boolean),
    defaultDb: Boolean(results[0]),
    namedDb: Boolean(results[1])
  };
}

async function firestoreListCollectionPaginated(collectionPath, databaseId = DEFAULT_DB_ID, pageSize = 100, pageToken = '') {
  try {
    if (isDbTemporarilySkipped(databaseId)) return { docs: [], nextPageToken: '' };
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) return { docs: [], nextPageToken: '' };
    const cleanPath = encodeFirestorePath(collectionPath);
    if (!cleanPath) return { docs: [], nextPageToken: '' };
    const safePageSize = Math.max(1, Math.min(Number(pageSize) || 100, 300));
    let reqPath = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(databaseId)}/documents/${cleanPath}?pageSize=${safePageSize}`;
    if (pageToken) {
      reqPath += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    const res = await httpsJsonRequest({
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: reqPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    recordFirestoreHttpOutcome(databaseId, res.statusCode, res.data);
    if (res.statusCode !== 200 || !res.data) return { docs: [], nextPageToken: '' };
    const docs = Array.isArray(res.data.documents)
      ? res.data.documents.map(decodeFirestoreDoc).filter(Boolean)
      : [];
    return {
      docs,
      nextPageToken: res.data.nextPageToken || ''
    };
  } catch (_) {
    return { docs: [], nextPageToken: '' };
  }
}

async function firestoreListDocuments(collectionPath, databaseId = DEFAULT_DB_ID) {
  const page = await firestoreListCollectionPaginated(collectionPath, databaseId, 100, '');
  return page.docs;
}

async function firestoreListAllDocuments(collectionPath, databaseId = DEFAULT_DB_ID, maxDocs = 2000) {
  const all = [];
  let pageToken = '';
  let truncated = false;
  do {
    const page = await firestoreListCollectionPaginated(collectionPath, databaseId, 200, pageToken);
    all.push(...page.docs);
    pageToken = page.nextPageToken;
    if (all.length >= maxDocs && pageToken) {
      truncated = true;
      break;
    }
  } while (pageToken);
  return { docs: all.slice(0, maxDocs), truncated };
}

async function firestoreRunQuery(structuredQuery, parentPath = '', databaseId = DEFAULT_DB_ID) {
  try {
    if (isDbTemporarilySkipped(databaseId)) return [];
    const accessToken = await getGoogleAccessToken();
    if (!accessToken || !structuredQuery) return [];
    const cleanParent = encodeFirestorePath(parentPath);
    const suffix = cleanParent ? `/${cleanParent}` : '';
    const reqPath = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(databaseId)}/documents${suffix}:runQuery`;
    const bodyStr = JSON.stringify({ structuredQuery });
    const res = await httpsJsonRequest(
      {
        hostname: 'firestore.googleapis.com',
        port: 443,
        path: reqPath,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      },
      bodyStr
    );
    recordFirestoreHttpOutcome(databaseId, res.statusCode, res.data);
    if (res.statusCode !== 200 || !Array.isArray(res.data)) return [];
    const results = [];
    for (const row of res.data) {
      if (row && row.document) {
        const decoded = decodeFirestoreDoc(row.document);
        if (decoded) results.push(decoded);
      }
    }
    return results;
  } catch (_) {
    return [];
  }
}

async function firestoreListCollectionIds(docPath, databaseId = DEFAULT_DB_ID) {
  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken || !docPath) return [];
    const cleanPath = encodeFirestorePath(docPath);
    if (!cleanPath) return [];
    const reqPath = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(databaseId)}/documents/${cleanPath}:listCollectionIds`;
    const bodyStr = JSON.stringify({ pageSize: 50 });
    const res = await httpsJsonRequest(
      {
        hostname: 'firestore.googleapis.com',
        port: 443,
        path: reqPath,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      },
      bodyStr
    );
    if (res.statusCode === 200 && res.data && Array.isArray(res.data.collectionIds)) {
      return res.data.collectionIds.filter(Boolean);
    }
    return [];
  } catch (_) {
    return [];
  }
}

async function firestoreDeleteDocument(docPath, databaseId = DEFAULT_DB_ID) {
  try {
    if (isDbTemporarilySkipped(databaseId)) return false;
    const accessToken = await getGoogleAccessToken();
    if (!accessToken || !docPath) return false;
    const cleanPath = encodeFirestorePath(docPath);
    if (!cleanPath) return false;
    const reqPath = `/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(databaseId)}/documents/${cleanPath}`;
    const res = await httpsJsonRequest({
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: reqPath,
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    recordFirestoreHttpOutcome(databaseId, res.statusCode, res.data);
    return res.statusCode >= 200 && res.statusCode < 300;
  } catch (_) {
    return false;
  }
}

function getFirebaseWebApiKey(rootDir = path.join(__dirname, '..')) {
  let firebaseApiKey = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
  if (firebaseApiKey) return firebaseApiKey;

  const googleServicesPath = path.join(rootDir, 'app', 'google-services.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
    firebaseApiKey = cfg.client?.[0]?.api_key?.[0]?.current_key || '';
    if (firebaseApiKey) return firebaseApiKey;
  } catch (_) {}

  for (const relPath of [
    path.join('public', 'assets', 'nutrolix-auth.js'),
    path.join('public', 'assets', 'nutrolix-firebase.js'),
    path.join('app', 'src', 'main', 'assets', 'web', 'assets', 'nutrolix-auth.js')
  ]) {
    try {
      const clientSource = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
      const match = clientSource.match(/apiKey\s*:\s*["'](AIza[0-9A-Za-z_-]+)["']/);
      if (match) return match[1];
    } catch (_) {}
  }
  return '';
}

async function verifyFirebaseIdToken(idToken, rootDir = path.join(__dirname, '..')) {
  const token = String(idToken || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.split('.').length !== 3) return null;
  const apiKey = getFirebaseWebApiKey(rootDir);
  if (!apiKey) return null;

  try {
    const payload = JSON.stringify({ idToken: token });
    const res = await httpsJsonRequest(
      {
        hostname: 'identitytoolkit.googleapis.com',
        port: 443,
        path: `/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      payload
    );
    if (res.statusCode === 200 && res.data && Array.isArray(res.data.users) && res.data.users[0]) {
      const u = res.data.users[0];
      return {
        uid: u.localId || '',
        email: normalizeEmail(u.email || ''),
        phoneNumber: u.phoneNumber || '',
        displayName: u.displayName || ''
      };
    }
  } catch (_) {}
  return null;
}

function getAdminHmacSecret() {
  const envSecret = String(process.env.ADMIN_SESSION_SECRET || '').trim();
  if (envSecret.length >= 16) return envSecret;

  const sa = parseServiceAccountFromEnv();
  if (sa && sa.private_key) {
    return crypto
      .createHash('sha256')
      .update('nutrolix-admin-session:' + sa.private_key)
      .digest('hex');
  }

  if (!ephemeralRuntimeHmacSecret) {
    ephemeralRuntimeHmacSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralRuntimeHmacSecret;
}

function signAdminSessionToken(emailOrPayload = 'nutrolix.in@gmail.com', ttlSeconds = 12 * 3600) {
  const nowSec = Math.floor(Date.now() / 1000);
  const rawEmail =
    emailOrPayload && typeof emailOrPayload === 'object'
      ? emailOrPayload.email
      : emailOrPayload;
  const rawRole =
    emailOrPayload && typeof emailOrPayload === 'object' && emailOrPayload.role
      ? String(emailOrPayload.role)
      : 'ADMIN';
  const payload = {
    email: normalizeEmail(rawEmail) || 'nutrolix.in@gmail.com',
    role: rawRole,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
    jti: crypto.randomBytes(8).toString('hex')
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getAdminHmacSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAdminSessionToken(rawToken) {
  try {
    const token = String(rawToken || '').replace(/^Bearer\s+/i, '').trim();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    if (!encoded || !sig) return null;

    const expectedSig = crypto
      .createHmac('sha256', getAdminHmacSecret())
      .update(encoded)
      .digest('base64url');

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'ADMIN') return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || Number(payload.exp) < nowSec) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function matchCustomerTokens(tokens, { uid = '', phone = '', email = '' }) {
  const cleanUid = String(uid || '').trim();
  const derivedPhone = cleanUid.startsWith('phone_') ? normalizePhone(cleanUid.slice(6)) : '';
  const cleanPhone = normalizePhone(phone) || derivedPhone;
  const cleanEmail = normalizeEmail(email);

  const seenKeys = new Set();
  const matched = [];
  for (const t of Array.isArray(tokens) ? tokens : []) {
    const tUid = String(t.uid || '').trim();
    const tDerivedPhone = tUid.startsWith('phone_') ? normalizePhone(tUid.slice(6)) : '';
    const tPhone = normalizePhone(t.customerPhone || t.phone) || tDerivedPhone;
    const tEmail = normalizeEmail(t.customerEmail || t.email);

    const isMatch =
      (cleanUid && tUid && tUid === cleanUid) ||
      (cleanPhone && tPhone && tPhone === cleanPhone) ||
      (cleanEmail && tEmail && tEmail === cleanEmail);
    if (!isMatch) continue;

    const dedupTokenId = t.fcmToken || t.token || (t.subscription && t.subscription.endpoint) || t.endpoint;
    if (!dedupTokenId || seenKeys.has(dedupTokenId)) continue;
    seenKeys.add(dedupTokenId);
    matched.push(t);
  }
  return matched;
}

function deduplicatePushTargets(tokens) {
  const list = Array.isArray(tokens) ? tokens : [];
  const byDevice = new Map();
  const passthrough = [];

  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const devId = String(t.deviceId || '').trim();
    const hasWebSub = Boolean((t.subscription && t.subscription.endpoint) || (t.endpoint && t.keys));
    if (!devId) {
      passthrough.push(t);
      continue;
    }
    const existing = byDevice.get(devId);
    if (!existing) {
      byDevice.set(devId, t);
    } else {
      const existingHasWebSub = Boolean((existing.subscription && existing.subscription.endpoint) || (existing.endpoint && existing.keys));
      const existingIsApk = String(existing.platform || '').includes('android');
      const curIsApk = String(t.platform || '').includes('android');
      if (curIsApk && !existingIsApk) {
        byDevice.set(devId, t);
      } else if (hasWebSub && !existingHasWebSub) {
        byDevice.set(devId, t);
      } else if (hasWebSub === existingHasWebSub) {
        const curTs = Number(t.updatedAtMillis || Date.parse(t.updatedAt || t.registeredAt || 0) || 0);
        const exTs = Number(existing.updatedAtMillis || Date.parse(existing.updatedAt || existing.registeredAt || 0) || 0);
        if (curTs >= exTs) byDevice.set(devId, t);
      }
    }
  }
  return [...byDevice.values(), ...passthrough];
}

module.exports = {
  FIREBASE_PROJECT_ID,
  DEFAULT_DB_ID,
  NAMED_DB_ID,
  BOTH_DB_IDS,
  normalizePhone,
  isValidIndianMobile,
  canonicalCustomerUid,
  phoneVariants,
  normalizeEmail,
  formatE164IndianPhone,
  isMeaningfulCustomerName,
  pickBestCustomerName,
  normalizeOrderStatus,
  buildOrderStatusNotificationCopy,
  parseNominatimGeocodeResponse,
  parseBigDataCloudGeocodeResponse,
  reverseGeocodeFree,
  STORE_CATEGORIES,
  normalizeStoreCategory,
  LEGACY_UNCONFIGURED_VARIANT_IDS,
  normalizeProductVariants,
  normalizeFoodAddons,
  SEED_PRODUCT_REVIEWS,
  getSeedReviewsForProduct,
  computeProductReviewSummary,
  KNOWN_INDIA_POST_PIN_MAP,
  isValidIndianPincodeForState,
  resolveKnownIndianPostalOverride,
  lookupIndiaPostByPincode,
  lookupIndiaPostByPostOffice,
  verifyAndResolveIndianPincode,
  parseServiceAccountFromEnv,
  getGoogleAccessToken,
  isPermanentFcmTokenError,
  sendFcmV1Message,
  toFirestoreValue,
  fromFirestoreValue,
  firestorePatchDocument,
  firestorePatchBothDbs,
  firestoreDeleteBothDbs,
  firestoreGetDocument,
  firestoreGetFirstAvailable,
  firestoreListDocuments,
  firestoreListCollectionPaginated,
  firestoreListAllDocuments,
  firestoreListCollectionIds,
  firestoreRunQuery,
  firestoreDeleteDocument,
  encodeFirestorePath,
  getFirebaseWebApiKey,
  verifyFirebaseIdToken,
  signAdminSessionToken,
  verifyAdminSessionToken,
  matchCustomerTokens,
  deduplicatePushTargets,
  isFirestoreQuotaExhausted,
  getFirestoreHealthStatus,
  clearMissingDbCache: () => missingDbUntilMs.clear()
};
