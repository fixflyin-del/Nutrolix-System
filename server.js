const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const nutrolixCore = require('./lib/nutrolix-core');
const customerSync = require('./lib/nutrolix-customer-sync');
const nutrolixPurge = require('./lib/nutrolix-purge');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Gemini Model Configuration per gemini-api skill (MANDATORY: gemini-3.5-flash or gemini-3.1-pro-preview)
const GEMINI_MODEL = 'gemini-3.5-flash';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.apk': 'application/vnd.android.package-archive',
  '.aab': 'application/octet-stream',
  '.zip': 'application/zip',
};

// Web Push Configuration (RFC 8291 / RFC 8030 with VAPID Authentication)
let webpush = null;
try {
  webpush = require('web-push');
} catch (e) {
  console.warn('Notice: web-push initialization error:', e.message);
}

const VAPID_PUBLIC_KEY = String(
  process.env.VAPID_PUBLIC_KEY || 'BNKixC3ZCYx27sN2fDJcsDhc1NVZEBQJ_-NkX9Xa1CuHB0xz9tyvCk582_j0bPaCBzn8LUeswFAZigMzzlSj5gY'
).trim();
const VAPID_PRIVATE_KEY = String(
  process.env.VAPID_PRIVATE_KEY || 'zFrl89pn0HV8jrf5JyPvY4y28s4l6iyHk2vt67bdHG4'
).trim();

if (webpush) {
  try {
    webpush.setVapidDetails(
      'mailto:support@nutrolix.in',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.warn('VAPID setup warning:', err.message);
  }
}

// Global in-memory cache and safe JSON helpers for serverless / read-only filesystem environments (e.g. Vercel)
const inMemoryCache = {};
const mediaMemoryCache = new Map();

const NO_STORE_JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

function normalizeStoreSettingsPayload(raw, prev = {}) {
  const baseDefaults = {
    storeName: 'Nutrolix',
    tagline: 'Nutrition That Works',
    isOpen: true,
    storeOpen: true,
    deliveryFee: 49,
    freeDeliveryAbove: 499,
    freeDeliveryThreshold: 499,
    announcement: '⚡ SPECIAL OFFER: Get 15% OFF on your first nutrition order with code NUTRO15! Free Delivery on orders above ₹499',
    announcementActive: true,
    taxPercent: 5.0,
    payuEnabled: true,
    payuIsLive: true,
    cloudinaryCloudName: 'muy6zdcd',
    cloudinaryPreset: 'ml_default',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: ''
  };
  const merged = { ...baseDefaults, ...(prev || {}), ...(raw || {}) };
  const resolvedOpen = raw && raw.isOpen !== undefined
    ? Boolean(raw.isOpen)
    : (raw && raw.storeOpen !== undefined ? Boolean(raw.storeOpen) : Boolean(merged.isOpen !== false && merged.storeOpen !== false));
  const resolvedFree = Number(
    (raw && raw.freeDeliveryAbove !== undefined ? raw.freeDeliveryAbove
      : (raw && raw.freeDeliveryThreshold !== undefined ? raw.freeDeliveryThreshold
        : (merged.freeDeliveryAbove !== undefined ? merged.freeDeliveryAbove : merged.freeDeliveryThreshold))) || 499
  );
  merged.isOpen = resolvedOpen;
  merged.storeOpen = resolvedOpen;
  merged.freeDeliveryAbove = resolvedFree;
  merged.freeDeliveryThreshold = resolvedFree;
  merged.deliveryFee = Number(merged.deliveryFee !== undefined ? merged.deliveryFee : 49);
  merged.taxPercent = Number(merged.taxPercent !== undefined ? merged.taxPercent : 5.0);
  merged.announcementActive = merged.announcementActive !== false;
  merged.updatedAt = new Date().toISOString();
  return merged;
}

function safeWriteJson(filePath, data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  inMemoryCache[filePath] = content;
  try {
    fs.writeFileSync(filePath, content);
    return true;
  } catch (err) {
    try {
      const tmpPath = path.join('/tmp', path.basename(filePath));
      fs.writeFileSync(tmpPath, content);
    } catch (_) {}
    return true;
  }
}

function safeReadJson(filePath, defaultValue = []) {
  if (inMemoryCache[filePath]) {
    try { return JSON.parse(inMemoryCache[filePath]); } catch (_) {}
  }
  try {
    const tmpPath = path.join('/tmp', path.basename(filePath));
    if (fs.existsSync(tmpPath)) {
      return JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    }
  } catch (_) {}
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_) {}
  return defaultValue;
}

// Firestore-backed catalog & settings persistence helper (read-through & write-through across both DBs)
async function readCatalogDocOrFallback(docKey, localFile, fallbackValue) {
  try {
    const fsDoc = await nutrolixCore.firestoreGetFirstAvailable(`catalogStore/${docKey}`);
    if (fsDoc && fsDoc.dataJson) {
      const parsed = JSON.parse(fsDoc.dataJson);
      safeWriteJson(localFile, parsed);
      return parsed;
    }
    if (fsDoc && fsDoc.items !== undefined) {
      safeWriteJson(localFile, fsDoc.items);
      return fsDoc.items;
    }
  } catch (_) {}
  return safeReadJson(localFile, fallbackValue);
}

async function writeCatalogDocAndLocal(docKey, localFile, value) {
  safeWriteJson(localFile, value);
  try {
    await nutrolixCore.firestorePatchBothDbs(`catalogStore/${docKey}`, {
      key: docKey,
      dataJson: JSON.stringify(value),
      updatedAt: new Date().toISOString(),
      updatedAtMillis: Date.now()
    });
  } catch (_) {}
}

// Customer Discount Engine Helpers (Strictly for Healthy Food / Cloud Kitchen orders)
function normalizePhone(p) {
  return nutrolixCore.normalizePhone(p);
}

function normalizeEmail(e) {
  return nutrolixCore.normalizeEmail(e);
}

function getCustomerDiscountsStore() {
  const file = path.join(PUBLIC_DIR, 'data', 'customer_discounts.json');
  return safeReadJson(file, {});
}

function saveCustomerDiscountsStore(store) {
  const file = path.join(PUBLIC_DIR, 'data', 'customer_discounts.json');
  safeWriteJson(file, store);
}

function buildEligibilityResponse(is100Redeemed) {
  if (!is100Redeemed) {
    return {
      eligible: true,
      offerType: 'FIRST100',
      discount: 100,
      minOrder: 349,
      title: '₹100 OFF on First Healthy Meal',
      description: 'Get ₹100 OFF on your first Healthy Food order (Min. order ₹349)',
      bannerText: 'Order Ready Healthy Meals Now & Get ₹100 OFF on Your First Order! (Min. Order ₹349)'
    };
  }
  return {
    eligible: true,
    offerType: 'SUBSEQUENT50',
    discount: 50,
    minOrder: 249,
    title: '₹50 OFF on Healthy Food',
    description: 'Get ₹50 OFF on your next Healthy Food order (Min. order ₹249)',
    bannerText: 'Keep Your Health Streak Going: Get ₹50 OFF on Your Next Meal! (Min. Order ₹249)'
  };
}

function getCustomerHealthyFoodEligibility(phoneRaw, emailRaw) {
  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  const store = getCustomerDiscountsStore();

  let customerRecord = null;
  if (phone && store[phone]) customerRecord = store[phone];
  else if (email && store[email]) customerRecord = store[email];

  if (!customerRecord) {
    const ordersFile = path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json');
    try {
      const orders = safeReadJson(ordersFile, []);
      const hasPast100Order = orders.some(o => {
        const ordPhone = customerSync.extractOrderPhone(o);
        const ordEmail = customerSync.extractOrderEmail(o);
        const matches = (phone && ordPhone === phone) || (email && ordEmail === email);
        const hasFoodDiscount = (o.foodDiscount && o.foodDiscount >= 50) || (o.couponCode === 'FIRST100');
        return matches && hasFoodDiscount;
      });
      if (hasPast100Order) {
        customerRecord = { first100Redeemed: true };
        if (phone) store[phone] = customerRecord;
        if (email) store[email] = customerRecord;
        saveCustomerDiscountsStore(store);
      }
    } catch (_) {}
  }

  return buildEligibilityResponse(Boolean(customerRecord && customerRecord.first100Redeemed));
}

async function getCustomerHealthyFoodEligibilityDurable(phoneRaw, emailRaw) {
  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  const local = getCustomerHealthyFoodEligibility(phoneRaw, emailRaw);
  if (local.offerType === 'SUBSEQUENT50') return local;

  try {
    const discountKey = phone || (email ? 'email_' + crypto.createHash('sha1').update(email).digest('hex').slice(0, 12) : '');
    if (discountKey) {
      const fsDisc = await nutrolixCore.firestoreGetFirstAvailable(`customerDiscounts/${discountKey}`);
      if (fsDisc && fsDisc.first100Redeemed) {
        const store = getCustomerDiscountsStore();
        store[discountKey] = fsDisc;
        saveCustomerDiscountsStore(store);
        return buildEligibilityResponse(true);
      }
    }
  } catch (_) {}
  return local;
}

async function recordHealthyFoodRedemption(order) {
  if (!order || !order.foodDiscount || Number(order.foodDiscount) <= 0) return;
  const phone = customerSync.extractOrderPhone(order);
  const email = customerSync.extractOrderEmail(order);
  const store = getCustomerDiscountsStore();
  const key = phone || email;
  if (!key) return;

  const existing = (phone && store[phone]) || (email && store[email]) || {};
  const rec = { ...existing };
  if (order.couponCode === 'FIRST100' || Number(order.foodDiscount) >= 100 || !rec.first100Redeemed) {
    rec.first100Redeemed = true;
    rec.first100RedeemedAt = new Date().toISOString();
    rec.first100OrderId = order.orderId || order.id;
  } else {
    if (!Array.isArray(rec.subsequentRedemptions)) rec.subsequentRedemptions = [];
    rec.subsequentRedemptions.push({
      orderId: order.orderId || order.id,
      amount: Number(order.foodDiscount),
      date: new Date().toISOString()
    });
  }

  if (phone) store[phone] = rec;
  if (email) store[email] = rec;
  saveCustomerDiscountsStore(store);

  const fsKey = phone || ('email_' + crypto.createHash('sha1').update(email).digest('hex').slice(0, 12));
  try {
    await nutrolixCore.firestorePatchBothDbs(`customerDiscounts/${fsKey}`, {
      ...rec,
      phone,
      email,
      updatedAt: new Date().toISOString()
    });
  } catch (_) {}
}

function makeTokenDocId(rawVal) {
  return crypto.createHash('sha1').update(String(rawVal || '')).digest('hex').slice(0, 24);
}

async function gatherCustomerTokens({ uid = '', customerPhone = '', customerEmail = '' }) {
  const tokensFile = path.join(PUBLIC_DIR, 'data', 'notification_tokens.json');
  let localTokens = safeReadJson(tokensFile, []);
  if (!Array.isArray(localTokens)) localTokens = [];

  const firestoreTokens = [];
  const cleanPhone = normalizePhone(customerPhone);
  const canonicalUid = nutrolixCore.canonicalCustomerUid(cleanPhone) || '';
  const candidateUids = Array.from(new Set([String(uid || '').trim(), canonicalUid].filter(Boolean)));

  // Read the customer's own token subcollection first. This is the durable
  // registration path for both FCM and Web Push; avoid scanning every user's
  // global token collections on each checkout.
  const scopedReads = [];
  for (const u of candidateUids) {
    for (const dbId of nutrolixCore.BOTH_DB_IDS) {
      scopedReads.push(
        nutrolixCore.firestoreListDocuments(`users/${u}/fcmTokens`, dbId)
          .then((docs) => docs.map((d) => {
            let subscription = d.subscription || null;
            if (!subscription && d.subscriptionJson) {
              try { subscription = JSON.parse(d.subscriptionJson); } catch (_) {}
            }
            return { ...d, subscription, uid: d.uid || u, _firestorePath: `users/${u}/fcmTokens/${d._docId}`, _dbId: dbId };
          }))
          .catch(() => [])
      );
    }
  }
  const scopedLists = await Promise.all(scopedReads);
  for (const list of scopedLists) firestoreTokens.push(...list);

  // Compatibility fallback for older Web Push registrations that predate
  // the user-scoped token subcollection. Use indexed equality queries rather
  // than downloading up to 800 documents from each global collection.
  if (firestoreTokens.length === 0) {
    const filters = [];
    if (canonicalUid) filters.push({ field: 'uid', value: canonicalUid });
    if (cleanPhone) filters.push({ field: 'customerPhone', value: cleanPhone });
    if (cleanPhone) filters.push({ field: 'phone', value: cleanPhone });
    const legacyReads = [];
    for (const col of ['notificationTokens', 'fcmTokens']) {
      for (const dbId of nutrolixCore.BOTH_DB_IDS) {
        for (const filter of filters) {
          const structuredQuery = {
            from: [{ collectionId: col }],
            where: {
              fieldFilter: {
                field: { fieldPath: filter.field },
                op: 'EQUAL',
                value: { stringValue: filter.value }
              }
            },
            limit: 100
          };
          legacyReads.push(
            nutrolixCore.firestoreRunQuery(structuredQuery, '', dbId)
              .then((docs) => docs.map((d) => {
                let subscription = d.subscription || null;
                if (!subscription && d.subscriptionJson) {
                  try { subscription = JSON.parse(d.subscriptionJson); } catch (_) {}
                }
                return { ...d, subscription, _firestorePath: `${col}/${d._docId}`, _dbId: dbId };
              }))
              .catch(() => [])
          );
        }
      }
    }
    const legacyLists = await Promise.all(legacyReads);
    for (const list of legacyLists) firestoreTokens.push(...list);
  } else if (canonicalUid || uid || cleanPhone) {
    // Also check top-level notificationTokens by canonical UID & customerPhone so Chrome Web Push
    // registrations are never masked when an Android APK token already exists.
    const uidTarget = canonicalUid || String(uid || '').trim();
    const tokenFilters = [];
    if (uidTarget) tokenFilters.push({ field: 'uid', value: uidTarget });
    if (cleanPhone) tokenFilters.push({ field: 'customerPhone', value: cleanPhone });
    const webTokenQueries = [];
    for (const filter of tokenFilters) {
      const q = {
        from: [{ collectionId: 'notificationTokens' }],
        where: {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'EQUAL',
            value: { stringValue: filter.value }
          }
        },
        limit: 50
      };
      for (const dbId of nutrolixCore.BOTH_DB_IDS) {
        webTokenQueries.push(
          nutrolixCore.firestoreRunQuery(q, '', dbId)
            .then((docs) => docs.map((d) => {
              let subscription = d.subscription || null;
              if (!subscription && d.subscriptionJson) {
                try { subscription = JSON.parse(d.subscriptionJson); } catch (_) {}
              }
              return { ...d, subscription, _firestorePath: `notificationTokens/${d._docId}`, _dbId: dbId };
            }))
            .catch(() => [])
        );
      }
    }
    const webTokenLists = await Promise.all(webTokenQueries);
    for (const list of webTokenLists) firestoreTokens.push(...list);
  }

  const allTokens = [...localTokens, ...firestoreTokens];
  const matched = nutrolixCore.matchCustomerTokens(allTokens, {
    uid: canonicalUid || uid,
    phone: cleanPhone,
    email: customerEmail
  });

  return { localTokens, firestoreTokens, matched, candidateUids, canonicalUid, tokensFile };
}
async function pruneDeadNotificationTargets(deadEndpoints, deadFcmTokens, deadDocPaths = []) {
  const tokensFile = path.join(PUBLIC_DIR, 'data', 'notification_tokens.json');
  let localTokens = safeReadJson(tokensFile, []);
  if (!Array.isArray(localTokens)) localTokens = [];

  if (deadEndpoints.length > 0 || deadFcmTokens.length > 0) {
    localTokens = localTokens.filter((t) => {
      const ep = (t.subscription && t.subscription.endpoint) || t.endpoint;
      const ft = t.fcmToken || t.token;
      if (ep && deadEndpoints.includes(ep)) return false;
      if (ft && deadFcmTokens.includes(ft)) return false;
      return true;
    });
    safeWriteJson(tokensFile, localTokens);

    for (const rawDead of [...deadEndpoints, ...deadFcmTokens]) {
      const docId = makeTokenDocId(rawDead);
      try {
        await Promise.all([
          nutrolixCore.firestoreDeleteBothDbs(`notificationTokens/${docId}`),
          nutrolixCore.firestoreDeleteBothDbs(`fcmTokens/${docId}`),
          nutrolixCore.firestoreDeleteBothDbs(`adminTokens/${docId}`)
        ]);
      } catch (_) {}
    }
  }

  for (const deadDoc of deadDocPaths) {
    if (deadDoc && deadDoc.path) {
      try {
        await nutrolixCore.firestoreDeleteDocument(deadDoc.path, deadDoc.dbId || nutrolixCore.DEFAULT_DB_ID);
      } catch (_) {}
    }
  }
}

async function dispatchPushToCustomer(arg1, customerEmailArg, orderIdArg, titleArg, messageArg) {
  const opts = (arg1 && typeof arg1 === 'object')
    ? arg1
    : {
        uid: '',
        customerPhone: arg1,
        customerEmail: customerEmailArg,
        orderId: orderIdArg,
        status: '',
        title: titleArg,
        message: messageArg,
        dedupKey: '',
        force: false
      };

  const cleanPhone = normalizePhone(opts.customerPhone || '');
  const resolvedUid = nutrolixCore.canonicalCustomerUid(cleanPhone) || String(opts.uid || '').trim();
  const customerEmail = normalizeEmail(opts.customerEmail || '');
  const orderId = String(opts.orderId || '').trim();
  const status = String(opts.status || '').trim();
  const title = opts.title || 'Nutrolix Order Update';
  const message = opts.message || '';
  const dedupKey = opts.dedupKey ? String(opts.dedupKey).trim() : '';
  const force = Boolean(opts.force);

  const logFile = path.join(PUBLIC_DIR, 'data', 'notifications_log.json');
  let logs = safeReadJson(logFile, []);
  if (!Array.isArray(logs)) logs = [];

  if (dedupKey && !force) {
    const alreadyLogged = logs.find(l => l.dedupKey === dedupKey || l.id === dedupKey);
    if (alreadyLogged) {
      return { ...alreadyLogged, deduplicated: true };
    }
    const existingDedup = await nutrolixCore.firestoreGetFirstAvailable(`notificationDedups/${dedupKey}`);
    if (existingDedup) {
      return {
        id: dedupKey,
        dedupKey,
        orderId: orderId || null,
        status,
        title,
        message,
        deduplicated: true,
        timestamp: existingDedup.timestamp || new Date().toISOString()
      };
    }
  }

  const { matched: rawMatchingTokens, firestoreTokens } = await gatherCustomerTokens({
    uid: resolvedUid,
    customerPhone: cleanPhone,
    customerEmail
  });
  const matchingTokens = nutrolixCore.deduplicatePushTargets(rawMatchingTokens);

  const targetUrl = orderId ? `/orders.html?orderId=${encodeURIComponent(orderId)}` : '/orders.html';
  const payloadStr = JSON.stringify({
    title,
    body: message,
    orderId,
    status,
    url: targetUrl,
    dedupKey
  });

  const deliveryAttempts = [];
  const deadEndpoints = [];
  const deadFcmTokens = [];
  const deadFirestoreDocs = [];

  await Promise.all(matchingTokens.map(async (tokenRec) => {
    const fcmTok = tokenRec.fcmToken || ((!tokenRec.subscription || !tokenRec.subscription.endpoint) && tokenRec.token && !String(tokenRec.token).startsWith('http') ? tokenRec.token : '');
    const tasks = [];
    if (fcmTok) {
      tasks.push((async () => {
        try {
          const fcmRes = await nutrolixCore.sendFcmV1Message(fcmTok, {
            title,
            body: message,
            orderId,
            url: targetUrl,
            channelId: 'nutrolix_orders_channel_v3',
            data: {
              type: 'ORDER_UPDATE',
              status: status || '',
              dedupKey: dedupKey || ''
            }
          });
          deliveryAttempts.push(customerSync.classifyDeliveryAttempt({
            channel: 'fcm_v1',
            targetId: fcmTok,
            sent: Boolean(fcmRes.sent),
            permanentFailure: Boolean(fcmRes.permanentFailure),
            statusCode: Number(fcmRes.statusCode || (fcmRes.sent ? 200 : 0)),
            detail: fcmRes.status || fcmRes.error || ''
          }));
          if (fcmRes.permanentFailure) {
            deadFcmTokens.push(fcmTok);
            firestoreTokens
              .filter((ft) => (ft.fcmToken || ft.token) === fcmTok && ft._firestorePath)
              .forEach((ft) => deadFirestoreDocs.push({ path: ft._firestorePath, dbId: ft._dbId }));
          }
        } catch (err) {
          deliveryAttempts.push(customerSync.classifyDeliveryAttempt({
            channel: 'fcm_v1',
            targetId: fcmTok,
            sent: false,
            detail: 'FAILED: ' + err.message
          }));
        }
      })());
    }

    const sub = tokenRec.subscription && tokenRec.subscription.endpoint
      ? tokenRec.subscription
      : (tokenRec.endpoint && tokenRec.keys ? { endpoint: tokenRec.endpoint, keys: tokenRec.keys } : null);

    if (sub && sub.endpoint) {
      tasks.push((async () => {
        if (!webpush) {
          deliveryAttempts.push(customerSync.classifyDeliveryAttempt({
            channel: 'web_push',
            targetId: sub.endpoint,
            sent: false,
            detail: 'WEBPUSH_UNAVAILABLE'
          }));
          return;
        }
        try {
          const wpRes = await webpush.sendNotification(sub, payloadStr, { TTL: 86400, urgency: 'high' });
          const statusCode = (wpRes && wpRes.statusCode) || 201;
          deliveryAttempts.push(customerSync.classifyDeliveryAttempt({
            channel: 'web_push',
            targetId: sub.endpoint,
            accepted: true,
            statusCode,
            detail: `PUSH_SERVICE_ACCEPTED_${statusCode}`
          }));
        } catch (err) {
          const code = Number(err.statusCode || 0);
          const isGone = code === 410 || code === 404 || code === 401 || code === 403;
          if (isGone) {
            deadEndpoints.push(sub.endpoint);
            firestoreTokens
              .filter((ft) => (ft.endpoint || (ft.subscription && ft.subscription.endpoint)) === sub.endpoint && ft._firestorePath)
              .forEach((ft) => deadFirestoreDocs.push({ path: ft._firestorePath, dbId: ft._dbId }));
          }
          deliveryAttempts.push(customerSync.classifyDeliveryAttempt({
            channel: 'web_push',
            targetId: sub.endpoint,
            sent: false,
            permanentFailure: isGone,
            statusCode: code,
            detail: isGone ? 'EXPIRED_SUBSCRIPTION_REMOVED' : ('FAILED: ' + err.message)
          }));
        }
      })());
    }
    await Promise.all(tasks);
  }));
  if (deliveryAttempts.length === 0) {
    deliveryAttempts.push(customerSync.classifyDeliveryAttempt({
      channel: 'in_app_inbox',
      targetId: resolvedUid || cleanPhone,
      accepted: Boolean(resolvedUid || cleanPhone),
      detail: 'NO_TOKENS_REGISTERED_INBOX_ONLY'
    }));
  }

  await pruneDeadNotificationTargets(deadEndpoints, deadFcmTokens, deadFirestoreDocs);

  const notifId = dedupKey || ('notif_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'));
  const nowIso = new Date().toISOString();
  const logEntry = {
    id: notifId,
    dedupKey: dedupKey || notifId,
    uid: resolvedUid || '',
    orderId: orderId || null,
    status: status || '',
    type: 'ORDER_UPDATE',
    title,
    message,
    customerPhone: cleanPhone,
    customerEmail,
    url: targetUrl,
    read: false,
    timestamp: nowIso,
    targetedDevices: matchingTokens.length,
    deliveryStatus: deliveryAttempts
  };

  logs.unshift(logEntry);
  safeWriteJson(logFile, logs.slice(0, 250));

  try {
    const persistenceTasks = [];
    if (dedupKey) {
      persistenceTasks.push(
        nutrolixCore.firestorePatchBothDbs(`notificationDedups/${dedupKey}`, {
          dedupKey,
          orderId,
          status,
          uid: resolvedUid,
          timestamp: nowIso
        })
      );
    }
    persistenceTasks.push(
      nutrolixCore.firestorePatchBothDbs(`notificationDeliveries/${notifId}`, {
        id: notifId,
        orderId,
        status,
        uid: resolvedUid,
        targetedDevices: matchingTokens.length,
        attemptsJson: JSON.stringify(deliveryAttempts),
        timestamp: nowIso
      })
    );
    if (resolvedUid) {
      persistenceTasks.push(
        nutrolixCore.firestorePatchBothDbs(`users/${resolvedUid}/notifications/${notifId}`, {
          id: notifId,
          dedupKey: dedupKey || notifId,
          uid: resolvedUid,
          orderId: String(orderId || ''),
          status: String(status || ''),
          type: 'ORDER_UPDATE',
          title,
          message,
          url: targetUrl,
          read: false,
          timestamp: nowIso
        })
      );
    }
    await Promise.all(persistenceTasks);
  } catch (_) {}

  return logEntry;
}

async function dispatchPushToAdmins({ orderId = '', title = '', message = '', total = 0, customerName = '', customerPhone = '', paymentMethod = '' } = {}) {
  const tokensFile = path.join(PUBLIC_DIR, 'data', 'notification_tokens.json');
  const localTokens = safeReadJson(tokensFile, []);
  const candidates = [];
  if (Array.isArray(localTokens)) {
    localTokens
      .filter((t) => t && (t.role === 'admin' || String(t.platform || '').includes('admin')))
      .forEach((t) => candidates.push(t));
  }
  try {
    const [defDocs, namedDocs] = await Promise.all([
      nutrolixCore.firestoreListAllDocuments('adminTokens', nutrolixCore.DEFAULT_DB_ID, 200),
      nutrolixCore.firestoreListAllDocuments('adminTokens', nutrolixCore.NAMED_DB_ID, 200)
    ]);
    for (const d of [...defDocs.docs, ...namedDocs.docs]) {
      if (!d) continue;
      let parsedSub = d.subscription || null;
      if (!parsedSub && d.subscriptionJson) {
        try { parsedSub = JSON.parse(d.subscriptionJson); } catch (_) {}
      }
      if (d.fcmToken || d.token || (parsedSub && parsedSub.endpoint)) {
        candidates.push({
          ...d,
          subscription: parsedSub,
          _firestorePath: `adminTokens/${d._docId}`
        });
      }
    }
  } catch (_) {}

  const seenFcm = new Set();
  const seenEndpoints = new Set();
  const attempts = [];
  const deadFcm = [];
  const deadEndpoints = [];
  const finalTitle = title || `New Order #${orderId}!`;
  const finalBody = message || `${customerName || 'Customer'} placed an order of ₹${Number(total || 0).toFixed(0)}.`;
  const webPushPayloadStr = JSON.stringify({
    title: finalTitle,
    body: finalBody,
    orderId: String(orderId || ''),
    type: 'ADMIN_NEW_ORDER',
    role: 'admin',
    url: '/admin.html'
  });

  await Promise.all(candidates.map(async (rec) => {
    const sub = (rec.subscription && rec.subscription.endpoint)
      ? rec.subscription
      : (rec.endpoint && rec.keys ? { endpoint: rec.endpoint, keys: rec.keys } : null);
    const fcmTok = rec.fcmToken || ((!sub || !sub.endpoint) && rec.token && !String(rec.token).startsWith('http') ? rec.token : '');
    const isWebTarget = String(rec.platform || '').toLowerCase().includes('web');

    if (fcmTok && !seenFcm.has(fcmTok)) {
      seenFcm.add(fcmTok);
      try {
        const fcmRes = await nutrolixCore.sendFcmV1Message(fcmTok, {
          title: finalTitle,
          body: finalBody,
          orderId,
          url: '/admin.html',
          channelId: 'nutrolix_admin_orders_channel_v3',
          dataOnlyAndroid: !isWebTarget,
          data: {
            type: 'ADMIN_NEW_ORDER',
            role: 'admin',
            orderId: String(orderId || ''),
            orderNumber: String(orderId || ''),
            customerName: String(customerName || 'Customer'),
            customerPhone: String(customerPhone || ''),
            paymentMethod: String(paymentMethod || 'Online'),
            total: String(Number(total || 0)),
            title: finalTitle,
            body: finalBody
          }
        });
        attempts.push(customerSync.classifyDeliveryAttempt({
          channel: 'admin_fcm_v1',
          targetId: fcmTok,
          sent: Boolean(fcmRes.sent),
          permanentFailure: Boolean(fcmRes.permanentFailure),
          statusCode: Number(fcmRes.statusCode || (fcmRes.sent ? 200 : 0)),
          detail: fcmRes.status || ''
        }));
        if (fcmRes.permanentFailure) deadFcm.push(fcmTok);
      } catch (err) {
        attempts.push(customerSync.classifyDeliveryAttempt({
          channel: 'admin_fcm_v1',
          targetId: fcmTok,
          sent: false,
          detail: 'FAILED: ' + err.message
        }));
      }
    }

    if (webpush && sub && sub.endpoint && !seenEndpoints.has(sub.endpoint)) {
      seenEndpoints.add(sub.endpoint);
      try {
        const wpRes = await webpush.sendNotification(sub, webPushPayloadStr, { TTL: 86400, urgency: 'high' });
        const statusCode = (wpRes && wpRes.statusCode) || 201;
        attempts.push(customerSync.classifyDeliveryAttempt({
          channel: 'admin_web_push',
          targetId: sub.endpoint,
          accepted: true,
          statusCode,
          detail: `PUSH_SERVICE_ACCEPTED_${statusCode}`
        }));
      } catch (err) {
        const code = Number(err.statusCode || 0);
        const isGone = code === 410 || code === 404;
        if (isGone) deadEndpoints.push(sub.endpoint);
        attempts.push(customerSync.classifyDeliveryAttempt({
          channel: 'admin_web_push',
          targetId: sub.endpoint,
          sent: false,
          permanentFailure: isGone,
          statusCode: code,
          detail: isGone ? 'EXPIRED_SUBSCRIPTION_REMOVED' : ('FAILED: ' + err.message)
        }));
      }
    }
  }));

  if (deadFcm.length > 0 || deadEndpoints.length > 0) {
    await pruneDeadNotificationTargets(deadEndpoints, deadFcm, []);
  }
  return attempts;
}


// Known Additives & Preservatives Knowledge Base (INS/E codes with plain-language functions & safety notes)
const ADDITIVE_KNOWLEDGE_BASE = {
  '211': { name: 'Sodium Benzoate (INS 211)', function: 'Antimicrobial Preservative', safetyNote: 'Inhibits yeast and bacteria growth in acidic foods. In combination with Vitamin C (ascorbic acid), can form trace benzene under heat/light. Safe in standard regulatory limits.', risk: 'Moderate' },
  '202': { name: 'Potassium Sorbate (INS 202)', function: 'Antifungal Preservative', safetyNote: 'Widely used preservative that metabolizes into water and CO2. Generally considered very safe with low allergenicity.', risk: 'Low' },
  '330': { name: 'Citric Acid (INS 330)', function: 'Acidity Regulator & Antioxidant', safetyNote: 'Naturally found in citrus fruits; biologically normal and safe. Used to regulate pH and enhance tart flavor.', risk: 'Very Low' },
  '621': { name: 'Monosodium Glutamate / MSG (INS 621)', function: 'Flavor Enhancer (Umami)', safetyNote: 'Sodium salt of glutamic acid, an amino acid. Recognized as safe by FDA/FSSAI/WHO. Sensitive individuals may report mild temporary headaches if consumed in excessive amounts on an empty stomach.', risk: 'Low-Moderate' },
  '150d': { name: 'Caramel Color IV (INS 150d / Ammonia Sulphite)', function: 'Synthetic Coloring Agent', safetyNote: 'Produced using ammonium and sulphite compounds. Contains 4-MEI byproduct. Excessive daily intake of dark sodas with 150d is discouraged by health authorities.', risk: 'Moderate-High' },
  '282': { name: 'Calcium Propionate (INS 282)', function: 'Mold Inhibitor in Baked Goods', safetyNote: 'Prevents fungal spoilage in packaged bread and baked items. Safe at authorized levels; rare reports of mild headaches in children with sensitive metabolism.', risk: 'Low' },
  '471': { name: 'Mono- and Di-glycerides of Fatty Acids (INS 471)', function: 'Emulsifier & Texture Stabilizer', safetyNote: 'Blends fats and water together. May contain trace trans fats not declared on labels. Common marker of ultra-processed industrial food.', risk: 'Moderate' },
  '551': { name: 'Silicon Dioxide (INS 551)', function: 'Anti-caking Agent', safetyNote: 'Prevents powdered mixes and salts from clumping. Insoluble and passes through the digestive tract largely unabsorbed.', risk: 'Low' },
  '955': { name: 'Sucralose (INS 955)', function: 'High-Intensity Artificial Sweetener', safetyNote: 'Zero-calorie chlorinated sugar derivative ~600x sweeter than sugar. Safe in moderate amounts; emerging research investigates potential gut microbiome alterations with high chronic intake.', risk: 'Moderate' },
  '960': { name: 'Steviol Glycosides (INS 960 / Stevia)', function: 'Natural Plant Sweetener', safetyNote: 'Extracted from Stevia rebaudiana leaves. Zero calories and does not spike blood glucose. Generally considered safe.', risk: 'Low' },
  '322': { name: 'Lecithins (INS 322 / Soy/Sunflower Lecithin)', function: 'Natural Emulsifier', safetyNote: 'Essential phospholipid found in eggs and soybeans. Beneficial for brain and cell membranes. Check source for soy allergies.', risk: 'Very Low' },
  '220': { name: 'Sulphur Dioxide (INS 220)', function: 'Preservative & Bleaching Agent', safetyNote: 'Used in dried fruits and juices. Can trigger severe bronchospasms in individuals with asthma or sulphite allergies.', risk: 'Moderate-High' },
  '250': { name: 'Sodium Nitrite (INS 250)', function: 'Color Fixative & Curing Preservative', safetyNote: 'Inhibits Clostridium botulinum in processed meats. Can react with secondary amines during high-heat frying to form nitrosamines, linked to colorectal health risks.', risk: 'High' },
  '412': { name: 'Guar Gum (INS 412)', function: 'Natural Thickener & Soluble Fiber', safetyNote: 'Derived from guar beans. Safe natural dietary fiber, helps create smooth viscosity without synthetic additives.', risk: 'Very Low' },
  '415': { name: 'Xanthan Gum (INS 415)', function: 'Stabilizer & Thickening Agent', safetyNote: 'Fermented carbohydrate polysaccharide. Non-toxic and safe; large quantities may have a mild laxative effect.', risk: 'Low' }
};

// Evidence-Based Food Quality Scoring Algorithm
function computeNutritionalScore(nutrients, ingredientsText, additivesList, expStatus) {
  let score = 70; // baseline neutral

  // 1. Overall Nutrition (0-100)
  let nutritionScore = 70;
  const cal = nutrients.calories || 0;
  const prot = nutrients.protein || 0;
  const carbs = nutrients.carbs || 0;
  const totSugar = nutrients.totalSugar || 0;
  const addSugar = nutrients.addedSugar || 0;
  const satFat = nutrients.saturatedFat || 0;
  const transFat = nutrients.transFat || 0;
  const sodium = nutrients.sodium || 0;
  const fiber = nutrients.dietaryFiber || 0;

  // Positive nutrient credits
  if (prot >= 15) nutritionScore += 12;
  else if (prot >= 8) nutritionScore += 7;
  else if (prot >= 4) nutritionScore += 3;

  if (fiber >= 6) nutritionScore += 12;
  else if (fiber >= 3) nutritionScore += 6;

  // Negative nutrient penalties
  if (addSugar > 20 || totSugar > 25) nutritionScore -= 20;
  else if (addSugar > 10 || totSugar > 15) nutritionScore -= 12;
  else if (addSugar > 5 || totSugar > 8) nutritionScore -= 5;

  if (satFat > 7) nutritionScore -= 12;
  else if (satFat > 3) nutritionScore -= 6;

  if (transFat > 0.2) nutritionScore -= 18;

  if (sodium > 600) nutritionScore -= 14;
  else if (sodium > 400) nutritionScore -= 8;

  nutritionScore = Math.max(10, Math.min(100, Math.round(nutritionScore)));

  // 2. Ingredient Quality (0-100)
  let ingredientScore = 75;
  const ingLower = (ingredientsText || '').toLowerCase();

  const wholeGood = ['whole wheat', 'rolled oats', 'almonds', 'walnuts', 'chia seeds', 'flaxseed', 'quinoa', 'lentils', 'spinach', 'extra virgin olive oil', 'milk', 'cocoa beans', 'chickpeas', 'millet', 'ragi'];
  const refinedBad = ['palm oil', 'palmolein', 'hydrogenated', 'high fructose corn syrup', 'invert sugar syrup', 'maltodextrin', 'refined wheat flour', 'maida', 'artificial flavor', 'modified starch'];

  let goodCount = 0;
  wholeGood.forEach(item => {
    if (ingLower.includes(item)) goodCount++;
  });
  ingredientScore += Math.min(20, goodCount * 6);

  let badCount = 0;
  refinedBad.forEach(item => {
    if (ingLower.includes(item)) badCount++;
  });
  ingredientScore -= Math.min(40, badCount * 10);

  // Check order of ingredients: if first 2 ingredients are sugar or refined flour/oil
  const tokens = ingLower.split(/[,;\n()]+/).map(s => s.trim()).filter(Boolean);
  if (tokens.length > 0) {
    const firstTwo = tokens.slice(0, 2).join(' ');
    if (firstTwo.includes('sugar') || firstTwo.includes('syrup') || firstTwo.includes('palm') || firstTwo.includes('maida') || firstTwo.includes('refined wheat')) {
      ingredientScore -= 12;
    }
  }

  ingredientScore = Math.max(10, Math.min(100, Math.round(ingredientScore)));

  // 3. Sugar & Fat Profile (0-100)
  let sugarFatScore = 80;
  if (addSugar > 25) sugarFatScore -= 35;
  else if (addSugar > 15) sugarFatScore -= 22;
  else if (addSugar > 5) sugarFatScore -= 10;
  else if (addSugar === 0 && totSugar < 5) sugarFatScore += 10;

  if (satFat > 10) sugarFatScore -= 25;
  else if (satFat > 5) sugarFatScore -= 15;

  if (transFat > 0.1) sugarFatScore -= 20;
  sugarFatScore = Math.max(5, Math.min(100, Math.round(sugarFatScore)));

  // 4. Additives & Preservatives (0-100)
  let additivesScore = 90;
  if (additivesList && additivesList.length > 0) {
    additivesList.forEach(add => {
      if (add.risk === 'High') additivesScore -= 18;
      else if (add.risk === 'Moderate-High') additivesScore -= 12;
      else if (add.risk === 'Moderate') additivesScore -= 7;
      else if (add.risk === 'Low-Moderate') additivesScore -= 4;
      else additivesScore -= 2;
    });
  }
  additivesScore = Math.max(15, Math.min(100, Math.round(additivesScore)));

  // 5. Label Completeness (0-100)
  let completenessScore = 60;
  if (nutrients.calories > 0) completenessScore += 8;
  if (nutrients.protein > 0) completenessScore += 8;
  if (nutrients.carbs > 0) completenessScore += 8;
  if (nutrients.totalSugar >= 0) completenessScore += 8;
  if (nutrients.saturatedFat >= 0) completenessScore += 6;
  if (nutrients.sodium >= 0) completenessScore += 6;
  if (nutrients.dietaryFiber >= 0) completenessScore += 6;
  if (ingredientsText && ingredientsText.length > 20) completenessScore += 10;
  completenessScore = Math.min(100, Math.max(20, Math.round(completenessScore)));

  // Overall Weighted Score
  let overallScore = Math.round(
    (nutritionScore * 0.35) +
    (ingredientScore * 0.25) +
    (sugarFatScore * 0.20) +
    (additivesScore * 0.15) +
    (completenessScore * 0.05)
  );

  // Severe safety penalty if expired
  if (expStatus && expStatus.isExpired) {
    overallScore = Math.min(overallScore, 20);
  }

  // Processing Level Determination
  let processingLevel = "Processed";
  if (badCount >= 2 || (additivesList && additivesList.length >= 3) || ingLower.includes('maltodextrin') || ingLower.includes('high fructose')) {
    processingLevel = "Ultra-Processed (NOVA 4)";
  } else if (badCount === 0 && (!additivesList || additivesList.length <= 1) && goodCount >= 2) {
    processingLevel = "Minimally Processed (NOVA 1-2)";
  }

  // Recommendation Category
  let recommendation = "Okay in Moderation";
  let recommendationRationale = "";

  if (expStatus && expStatus.isExpired) {
    recommendation = "Do Not Consume if Expired or Unsafe";
    recommendationRationale = `The product passed its expiration date (${expStatus.expDate || 'Expired'}). Microbial growth and chemical degradation make it unsafe for consumption.`;
  } else if (overallScore >= 75) {
    recommendation = "Good Choice";
    recommendationRationale = "High nutritional density with favorable macro balance, wholesome primary ingredients, and minimal controversial additives. Suitable for regular healthy dietary plans.";
  } else if (overallScore >= 50) {
    recommendation = "Okay in Moderation";
    recommendationRationale = "Moderate nutritional profile. Enjoy occasionally while keeping serving sizes in check due to modest sugar, sodium, or refined components.";
  } else {
    recommendation = "Choose a Healthier Alternative";
    recommendationRationale = "Contains elevated added sugars, refined fats, sodium, or multiple ultra-processed additives. Consider substituting with whole foods or lower-sodium/low-sugar alternatives.";
  }

  return {
    overallScore,
    scoreBreakdown: {
      nutrition: nutritionScore,
      ingredientQuality: ingredientScore,
      sugarFatProfile: sugarFatScore,
      additives: additivesScore,
      completeness: completenessScore
    },
    processingLevel,
    recommendation,
    recommendationRationale
  };
}

// Helper to parse dates and calculate product age and expiry status
function parseExpiryDates(text) {
  const result = {
    mfgDate: null,
    expDate: null,
    bestBefore: null,
    ageMonths: null,
    isExpired: false,
    isNearExpiry: false,
    statusText: 'Date could not be verified from packaging',
    warning: null
  };

  if (!text) return result;

  const dateRegex = /\b(\d{1,2}[-\/.]\d{1,2}[-\/.](?:20)?\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:20)?\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:20)?\d{2})\b/gi;
  const matches = text.match(dateRegex);

  // Look for contextual keywords
  const mfgMatch = text.match(/(?:mfg|pkd|packed|mfd|manufactured)[\s.:]*([^\n,;]+)/i);
  if (mfgMatch) result.mfgDate = mfgMatch[1].trim().substring(0, 20);

  const expMatch = text.match(/(?:exp|expiry|use\s*by|best\s*before)[\s.:]*([^\n,;]+)/i);
  if (expMatch) result.expDate = expMatch[1].trim().substring(0, 20);

  if (!result.mfgDate && matches && matches[0]) result.mfgDate = matches[0];
  if (!result.expDate && matches && matches[1]) result.expDate = matches[1];

  // Try parsing expDate into Date
  if (result.expDate) {
    try {
      const parsedExp = new Date(Date.parse(result.expDate.replace(/[-.]/g, '/')));
      if (!isNaN(parsedExp.getTime())) {
        const now = new Date();
        const diffMs = parsedExp.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          result.isExpired = true;
          result.statusText = `EXPIRED (${Math.abs(diffDays)} days ago)`;
          result.warning = `⚠️ Critical: This product expired on ${result.expDate}. Consuming expired packaged food may pose microbial or chemical risks.`;
        } else if (diffDays <= 30) {
          result.isNearExpiry = true;
          result.statusText = `Near Expiry (${diffDays} days remaining)`;
          result.warning = `⚠️ Warning: Best before date is approaching (${diffDays} days remaining). Consume promptly.`;
        } else {
          result.statusText = `Fresh & Within Shelf Life (${diffDays} days remaining)`;
        }
      }
    } catch (e) {
      // Date parse fallback
    }
  }

  return result;
}

// Extract Additives from text
function detectAdditivesFromText(ingredientsText) {
  const detected = [];
  if (!ingredientsText) return detected;

  const insRegex = /(?:ins|e)[-\s]*([0-9]{3,4}[a-z]?)/gi;
  let match;
  while ((match = insRegex.exec(ingredientsText)) !== null) {
    const code = match[1].toLowerCase();
    const cleanCode = code.replace(/[^0-9a-z]/g, '');
    const numOnly = cleanCode.replace(/[a-z]/g, '');

    const info = ADDITIVE_KNOWLEDGE_BASE[cleanCode] || ADDITIVE_KNOWLEDGE_BASE[numOnly] || {
      name: `Additive (INS ${match[1].toUpperCase()})`,
      function: 'Food Processing / Stabilizing Additive',
      safetyNote: 'Regulatory approved food additive. Common standard additive in packaged formulations.',
      risk: 'Low-Moderate'
    };

    if (!detected.some(d => d.name === info.name)) {
      detected.push({
        code: match[1].toUpperCase(),
        ...info
      });
    }
  }

  // Also check common named additives
  const commonNames = [
    { key: 'sodium benzoate', code: '211' },
    { key: 'potassium sorbate', code: '202' },
    { key: 'citric acid', code: '330' },
    { key: 'monosodium glutamate', code: '621' },
    { key: 'msg', code: '621' },
    { key: 'caramel color', code: '150d' },
    { key: 'sucralose', code: '955' },
    { key: 'stevia', code: '960' },
    { key: 'lecithin', code: '322' },
    { key: 'guar gum', code: '412' },
    { key: 'xanthan gum', code: '415' }
  ];

  const lower = ingredientsText.toLowerCase();
  commonNames.forEach(item => {
    if (lower.includes(item.key) && !detected.some(d => d.code === item.code)) {
      const info = ADDITIVE_KNOWLEDGE_BASE[item.code];
      if (info && !detected.some(d => d.name === info.name)) {
        detected.push({ code: item.code, ...info });
      }
    }
  });

  return detected;
}

// Generate Audio Scripts in English and Hindi
function generateAudioScripts(analysis) {
  const prodName = analysis.productName || 'this packaged food product';
  const score = analysis.overallScore;
  const rec = analysis.recommendation;
  const expWarn = analysis.dates.warning ? `Attention: ${analysis.dates.warning}. ` : '';

  const audioScriptEn = `Nutrolix Food Quality Report for ${prodName}. The overall Food Quality Score is ${score} out of 100. Recommendation: ${rec}. ${expWarn}Key nutrients per 100 grams: ${analysis.nutritionTable.calories} calories, ${analysis.nutritionTable.protein} grams of protein, and ${analysis.nutritionTable.addedSugar} grams of added sugar. Processing classification is ${analysis.processingLevel}. ${analysis.recommendationRationale}`;

  const audioScriptHi = `न्यूट्रोलिक्स फ़ूड क्वालिटी रिपोर्ट: ${prodName} का कुल क्वालिटी स्कोर 100 में से ${score} है। सुझाव: ${rec}। ${expWarn ? 'सावधानी: ' + analysis.dates.warning + '। ' : ''}प्रति 100 ग्राम इसमें लगभग ${analysis.nutritionTable.calories} कैलोरी, ${analysis.nutritionTable.protein} ग्राम प्रोटीन और ${analysis.nutritionTable.addedSugar} ग्राम एडेड शुगर है। यह उत्पाद ${analysis.processingLevel} श्रेणी में आता है। अपने स्वास्थ्य लक्ष्यों के अनुसार ही इसका सेवन करें।`;

  return { audioScriptEn, audioScriptHi };
}

// Comprehensive Food Science OCR & Analysis Engine
function analyzeFoodData(payload) {
  const {
    productName = '',
    brandName = '',
    rawIngredients = '',
    rawNutrition = '',
    rawDates = '',
    nutrientsInput = {}
  } = payload;

  // 1. Parse dates & shelf life
  const combinedDateText = (rawDates + ' ' + rawIngredients + ' ' + (payload.extractedText || '')).trim();
  const dateAnalysis = parseExpiryDates(combinedDateText);

  // 2. Parse nutrients
  const nutritionTable = {
    servingSize: nutrientsInput.servingSize || '100g / 1 pack',
    calories: Number(nutrientsInput.calories) || extractNumber(rawNutrition, /calories?|energy/i, 250),
    protein: Number(nutrientsInput.protein) || extractNumber(rawNutrition, /protein/i, 4.5),
    carbs: Number(nutrientsInput.carbs) || extractNumber(rawNutrition, /carbohydrate|carbs/i, 40),
    totalSugar: Number(nutrientsInput.totalSugar) || extractNumber(rawNutrition, /total\s*sugars?|sugars?/i, 12),
    addedSugar: Number(nutrientsInput.addedSugar) || extractNumber(rawNutrition, /added\s*sugars?/i, 6),
    saturatedFat: Number(nutrientsInput.saturatedFat) || extractNumber(rawNutrition, /saturated\s*fat/i, 3),
    transFat: Number(nutrientsInput.transFat) || extractNumber(rawNutrition, /trans\s*fat/i, 0),
    sodium: Number(nutrientsInput.sodium) || extractNumber(rawNutrition, /sodium/i, 280),
    dietaryFiber: Number(nutrientsInput.dietaryFiber) || extractNumber(rawNutrition, /dietary\s*fiber|fibre/i, 2.5)
  };

  // 3. Detect Additives & Preservatives
  const combinedIngText = (rawIngredients + ' ' + (payload.extractedText || '')).trim();
  const additives = detectAdditivesFromText(combinedIngText);

  // 4. Good ingredients & Attention ingredients
  const goodIngredients = [];
  const attentionIngredients = [];

  const ingLower = combinedIngText.toLowerCase();

  if (ingLower.includes('oats') || ingLower.includes('quinoa') || ingLower.includes('millet') || ingLower.includes('whole wheat')) {
    goodIngredients.push({ name: 'Whole Grains', benefit: 'Complex carbohydrates with sustained glucose release and high satiety' });
  }
  if (ingLower.includes('almond') || ingLower.includes('peanut') || ingLower.includes('walnut') || ingLower.includes('seed')) {
    goodIngredients.push({ name: 'Nuts & Healthy Seeds', benefit: 'Source of plant-based monounsaturated fats and essential minerals' });
  }
  if (ingLower.includes('milk') || ingLower.includes('whey') || ingLower.includes('paneer') || ingLower.includes('egg') || ingLower.includes('pea protein')) {
    goodIngredients.push({ name: 'High-Biological Value Protein', benefit: 'Complete amino acid profile aiding muscle protein synthesis' });
  }
  if (nutritionTable.dietaryFiber >= 4) {
    goodIngredients.push({ name: 'Beneficial Dietary Fiber', benefit: 'Supports healthy intestinal motility and microbiome diversity' });
  }

  // Attention items
  if (nutritionTable.addedSugar >= 12 || ingLower.includes('added sugar') || ingLower.includes('high fructose')) {
    attentionIngredients.push({ name: 'High Added Sugars', reason: 'Excessive added simple sugars contribute to glycemic spikes and metabolic strain' });
  }
  if (ingLower.includes('palm oil') || ingLower.includes('palmolein')) {
    attentionIngredients.push({ name: 'Palm Oil / Palmolein', reason: 'High in saturated palmitic acid and commonly refined under high industrial heat' });
  }
  if (ingLower.includes('hydrogenated') || nutritionTable.transFat > 0.1) {
    attentionIngredients.push({ name: 'Hydrogenated Fat / Trans Fat', reason: 'Trans fatty acids significantly elevate LDL cholesterol and systemic inflammation' });
  }
  if (nutritionTable.sodium >= 500) {
    attentionIngredients.push({ name: 'Elevated Sodium Content', reason: 'Contains over 500mg sodium per 100g, approaching 25% of the WHO daily maximum' });
  }
  if (ingLower.includes('maltodextrin') || ingLower.includes('invert syrup')) {
    attentionIngredients.push({ name: 'Refined Sugar Derivatives', reason: 'High glycemic index carbohydrates absorbed almost as rapidly as pure dextrose' });
  }

  // 5. Compute Evidence-Based Score
  const scoreResult = computeNutritionalScore(nutritionTable, combinedIngText, additives, dateAnalysis);

  // 6. Identify Missing or Uncertain Information
  const missingOrUncertainInfo = [];
  if (!nutritionTable.addedSugar && nutritionTable.addedSugar !== 0) {
    missingOrUncertainInfo.push('Added sugar breakdown was not specifically segregated from total sugars on the packaging.');
  }
  if (!dateAnalysis.mfgDate && !dateAnalysis.expDate) {
    missingOrUncertainInfo.push('Manufacturing and Expiry dates were not clearly legible in the provided photos.');
  }
  if (!nutritionTable.sodium && nutritionTable.sodium !== 0) {
    missingOrUncertainInfo.push('Sodium content was not stated on the visible nutrition panel.');
  }
  if (!combinedIngText || combinedIngText.length < 15) {
    missingOrUncertainInfo.push('Ingredient list photo was faint or incomplete. Analysis was computed with available label data.');
  }

  // 7. Calculate transparent scoring explanation
  const scoringExplanation = `The Nutrolix Quality Score of ${scoreResult.overallScore}/100 is calculated across 5 objective nutritional standards: Overall Nutrition (35% weight: ${scoreResult.scoreBreakdown.nutrition}/100), Ingredient Quality & Whole Food Ratio (25% weight: ${scoreResult.scoreBreakdown.ingredientQuality}/100), Sugar & Saturated Fat Profile (20% weight: ${scoreResult.scoreBreakdown.sugarFatProfile}/100), Additives & Chemical Preservatives (15% weight: ${scoreResult.scoreBreakdown.additives}/100), and Label Disclosure Completeness (5% weight: ${scoreResult.scoreBreakdown.completeness}/100). Points are deducted for added sugars (>10g/100g), sodium (>400mg), hydrogenated/palm oils, and chemical preservatives.`;

  const finalAnalysis = {
    productName: productName.trim() || 'Scanned Packaged Product',
    brandName: brandName.trim() || 'Packaged Goods',
    overallScore: scoreResult.overallScore,
    scoreBreakdown: scoreResult.overallScore ? scoreResult.scoreBreakdown : {
      nutrition: 70, ingredientQuality: 70, sugarFatProfile: 70, additives: 85, completeness: 80
    },
    processingLevel: scoreResult.processingLevel,
    recommendation: scoreResult.recommendation,
    recommendationRationale: scoreResult.recommendationRationale,
    nutritionTable,
    goodIngredients: goodIngredients.length > 0 ? goodIngredients : [
      { name: 'Recognizable Food Ingredients', benefit: 'Provides baseline caloric sustenance' }
    ],
    attentionIngredients: attentionIngredients.length > 0 ? attentionIngredients : [
      { name: 'Moderate Sodium & Carbohydrate Load', benefit: 'Check serving size if on a strict calorie-deficit diet' }
    ],
    additivesAndPreservatives: additives,
    dates: dateAnalysis,
    missingOrUncertainInfo,
    scoringExplanation,
    confidence: Math.min(96, Math.max(78, 80 + (combinedIngText.length > 30 ? 10 : 0) + (nutritionTable.calories > 0 ? 6 : 0)))
  };

  // Top Key Benefit Highlight (Sabse Bada Fayda)
  let topBenefit = null;
  if (nutritionTable.protein >= 12) {
    topBenefit = {
      title: `Rich Source of Muscle-Building Protein (${nutritionTable.protein}g per 100g)`,
      description: `Contains high biological value amino acids that support muscle synthesis, recovery, and long-lasting fullness without rapid hunger crashes.`
    };
  } else if (nutritionTable.dietaryFiber >= 5) {
    topBenefit = {
      title: `High Prebiotic Dietary Fiber (${nutritionTable.dietaryFiber}g per 100g)`,
      description: `Excellent digestive fiber density that nurtures gut microbiome balance, improves digestive motility, and stabilizes post-meal blood sugar levels.`
    };
  } else if (nutritionTable.addedSugar === 0 && nutritionTable.totalSugar <= 4) {
    topBenefit = {
      title: `100% Zero Added Refined Sugar`,
      description: `Completely free from added sucrose, high-fructose corn syrups, or synthetic sweeteners, promoting optimal metabolic and cardiovascular wellness.`
    };
  } else if (goodIngredients.length > 0 && goodIngredients[0].name !== 'Recognizable Food Ingredients') {
    topBenefit = {
      title: `Wholesome Whole-Food Foundation (${goodIngredients[0].name})`,
      description: `${goodIngredients[0].benefit}. Provides authentic natural nutrients without heavy industrial refining.`
    };
  } else if (scoreResult.overallScore >= 75) {
    topBenefit = {
      title: `Clean Balanced Nutritional Profile`,
      description: `Well-distributed macronutrients with minimal processing and no high-risk chemical preservatives.`
    };
  } else if (nutritionTable.sodium < 140 && nutritionTable.saturatedFat < 2) {
    topBenefit = {
      title: `Heart-Friendly Low Sodium & Saturated Fat`,
      description: `Protects arterial and cardiovascular health through strictly controlled sodium and saturated fat levels.`
    };
  } else {
    topBenefit = {
      title: `Controlled Single-Serve Energy Source`,
      description: `Provides labeled caloric energy for active fuel. Monitor portion sizes in accordance with your daily nutritional goals.`
    };
  }
  finalAnalysis.topBenefit = topBenefit;

  const scripts = generateAudioScripts(finalAnalysis);
  finalAnalysis.audioScriptEn = scripts.audioScriptEn;
  finalAnalysis.audioScriptHi = scripts.audioScriptHi;

  return finalAnalysis;
}

function extractNumber(text, pattern, defaultVal) {
  if (!text) return defaultVal;
  const match = text.match(new RegExp(pattern.source + '[\\s:=-]*([0-9]+(?:\\.[0-9]+)?)', 'i'));
  return match ? parseFloat(match[1]) : defaultVal;
}

// Call Google Gemini API (gemini-3.5-flash) for vision analysis
function callGeminiVision(apiKey, images, textContext) {
  return new Promise((resolve, reject) => {
    const parts = [
      {
        text: `You are an expert food scientist and clinical nutritionist for Nutrolix. Analyze the provided food packaging images (ingredients list, nutrition facts table, mfg/expiry dates, and front branding).
Extract all verifiable information with 100% accuracy without inventing data. If text is illegible, flag it clearly.
Output ONLY a strictly valid JSON object matching this schema:
{
  "productName": "string",
  "brandName": "string",
  "nutritionTable": {
    "servingSize": "string",
    "calories": number,
    "protein": number,
    "carbs": number,
    "totalSugar": number,
    "addedSugar": number,
    "saturatedFat": number,
    "transFat": number,
    "sodium": number,
    "dietaryFiber": number
  },
  "rawIngredients": "string (full ingredients text read from label)",
  "rawDates": "string (mfg date, exp date, best before date read from label)"
}`
      }
    ];

    if (textContext) {
      parts.push({ text: `Additional user provided notes or corrected text: ${textContext}` });
    }

    images.forEach(img => {
      if (img && img.data) {
        let cleanBase64 = img.data;
        if (cleanBase64.includes('base64,')) {
          cleanBase64 = cleanBase64.split('base64,')[1];
        }
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: cleanBase64
          }
        });
      }
    });

    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const postOptions = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 30000
    };

    const req = https.request(postOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`Gemini API error status ${res.statusCode}: ${data}`));
          }
          const parsed = JSON.parse(data);
          const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) return reject(new Error("No text candidate returned from Gemini"));
          const jsonResult = JSON.parse(rawText);
          resolve(jsonResult);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error("Gemini API request timed out"));
    });

    req.write(requestBody);
    req.end();
  });
}

// Ask AI About This Product Endpoint
function callGeminiQnA(apiKey, productContext, question) {
  return new Promise((resolve, reject) => {
    const prompt = `You are Nutrolix Food AI, an expert, objective clinical nutritionist.
You are answering a customer's question about a specific packaged food product they scanned.

PRODUCT CONTEXT:
Product Name: ${productContext.productName || 'Scanned Product'} (${productContext.brandName || ''})
Overall Food Quality Score: ${productContext.overallScore}/100
Processing Level: ${productContext.processingLevel}
Recommendation: ${productContext.recommendation} (${productContext.recommendationRationale})
Nutritional Profile (per 100g): Calories: ${productContext.nutritionTable?.calories}, Protein: ${productContext.nutritionTable?.protein}g, Total Sugar: ${productContext.nutritionTable?.totalSugar}g, Added Sugar: ${productContext.nutritionTable?.addedSugar}g, Sat Fat: ${productContext.nutritionTable?.saturatedFat}g, Sodium: ${productContext.nutritionTable?.sodium}mg, Fiber: ${productContext.nutritionTable?.dietaryFiber}g.
Additives Detected: ${JSON.stringify(productContext.additivesAndPreservatives || [])}
Expiry Status: ${productContext.dates?.statusText || 'Unknown'} (${productContext.dates?.warning || ''})
Missing Information on Label: ${JSON.stringify(productContext.missingOrUncertainInfo || [])}

CUSTOMER'S QUESTION:
"${question}"

GUIDELINES:
1. Answer in 2 to 4 concise, clear, and empathetic paragraphs.
2. Rely strictly on the extracted product information and established nutritional science.
3. If information is not on the packaging label (e.g. vitamins not listed, trace minerals), explicitly disclose that the label does not state this.
4. Do not make unsupported medical or curative claims (do not claim this cures diseases).
5. If the product is expired, firmly warn the user not to consume it.
6. Provide practical serving advice, healthy portioning, or wholesome alternative ideas where relevant.`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3
      }
    });

    const postOptions = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 25000
    };

    const req = https.request(postOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`Gemini QnA error ${res.statusCode}: ${data}`));
          }
          const parsed = JSON.parse(data);
          const answer = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          resolve(answer || "I could not generate an answer at this moment.");
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error("Gemini QnA timed out"));
    });

    req.write(requestBody);
    req.end();
  });
}

// Fallback Rule-based Q&A if API key is not configured
function ruleBasedQnA(context, question) {
  const qLower = (question || '').toLowerCase();
  const prod = context.productName || 'this product';
  const score = context.overallScore || 65;
  const sugar = context.nutritionTable?.addedSugar || context.nutritionTable?.totalSugar || 0;
  const sodium = context.nutritionTable?.sodium || 0;
  const exp = context.dates || {};

  if (exp.isExpired) {
    return `⚠️ Safety Alert: ${prod} has passed its expiry date (${exp.expDate || 'Expired'}). It is not safe to consume regardless of its ingredients, as microbial growth or chemical degradation may have occurred. Please discard it safely.`;
  }

  if (qLower.includes('daily') || qLower.includes('every day') || qLower.includes('regular')) {
    if (score >= 75) {
      return `Yes, based on the scanned nutrition profile (Quality Score: ${score}/100), ${prod} has balanced macros and clean ingredients. It can be integrated into your daily diet, keeping your individual daily caloric and protein targets in mind.`;
    } else if (score >= 50) {
      return `${prod} is best enjoyed occasionally or in moderation (Quality Score: ${score}/100). It contains modest amounts of ${sugar > 10 ? 'sugar' : 'sodium or saturated fat'}, so substituting whole unprocessed meals on most days is recommended.`;
    } else {
      return `Daily consumption is not recommended (Quality Score: ${score}/100). The product is categorized as ${context.processingLevel} with ${sugar > 15 ? 'high sugar (' + sugar + 'g)' : 'elevated additives/sodium'}. Regular daily intake may lead to excessive caloric and sugar load.`;
    }
  }

  if (qLower.includes('sugar') || qLower.includes('sweet') || qLower.includes('diabetes')) {
    return `According to the nutrition panel, ${prod} contains approximately ${context.nutritionTable?.totalSugar || 0}g of total sugars, with ${context.nutritionTable?.addedSugar || 'estimated ' + Math.round((context.nutritionTable?.totalSugar || 0) * 0.7)}g of added sugars per 100g. The WHO recommends keeping added sugars below 25g per day. Those managing blood glucose should account for these simple sugars.`;
  }

  if (qLower.includes('child') || qLower.includes('kid') || qLower.includes('children')) {
    const hasCaffeineOrArtificial = (context.additivesAndPreservatives || []).some(a => a.risk === 'Moderate-High' || a.name.includes('150d') || a.name.includes('Nitrite'));
    if (hasCaffeineOrArtificial || sugar > 15) {
      return `Caution is advised for young children. This product contains ${sugar > 15 ? 'high sugar (' + sugar + 'g/100g)' : ''} ${hasCaffeineOrArtificial ? 'and synthetic additives' : ''}, which can quickly exceed a child's conservative daily nutritional thresholds. Opt for natural whole-food snacks like fresh fruit or nuts instead.`;
    } else {
      return `In appropriate child-sized portions, ${prod} does not present acute red flags based on the label. However, ensure their overall diet emphasizes whole grains, pulses, and fresh fruits and vegetables.`;
    }
  }

  if (qLower.includes('alternative') || qLower.includes('healthier') || qLower.includes('substitute')) {
    return `Healthier alternatives to ${prod} include whole-food preparations: 1) Nutrolix Fresh Prepared Nutrition Bowls (zero preservatives, fresh vegetables, verified macros), 2) Roasted chickpeas or mixed unsalted seeds for crunchy snacking, or 3) Plain Greek yogurt with fresh berries and crushed almonds for sweet cravings without added refined sugar.`;
  }

  if (qLower.includes('preservative') || qLower.includes('additive') || qLower.includes('ins') || qLower.includes('chemical')) {
    const adds = context.additivesAndPreservatives || [];
    if (adds.length === 0) {
      return `No major chemical preservatives or artificial additives (INS codes) were detected in the visible ingredient list. The product appears to rely on natural preservation methods (e.g. moisture control or packaging barrier).`;
    }
    const list = adds.map(a => `• ${a.name}: ${a.function}. Safety note: ${a.safetyNote}`).join('\n');
    return `The label indicates the following additives:\n${list}\n\nNote: Regulated food additives are permitted within statutory quantities, but minimizing chronic consumption of ultra-processed additives is optimal for gut health.`;
  }

  return `Regarding ${prod} (Food Quality Score ${score}/100): It provides ${context.nutritionTable?.calories} kcal, ${context.nutritionTable?.protein}g protein, and ${sugar}g sugar per 100g. Recommendation: ${context.recommendation}. ${context.recommendationRationale} Always verify with a healthcare provider if you have specific clinical dietary requirements.`;
}

// -------------------------------------------------------------
// Universal Food Intelligence Knowledge Base & Gemini Resolver
// -------------------------------------------------------------
const { CLINICAL_FOOD_DATABASE, classifyUnknownFoodItem } = require('./scripts/clinical_food_db');
const BUILTIN_FOOD_ENTRIES = CLINICAL_FOOD_DATABASE;

async function resolveFoodAiData(rawQuery, apiKey) {
  const raw = (rawQuery || '').trim();
  const q = raw.toLowerCase().replace(/analyse|analyze|benefits of|benefit of|nutrition of|details of|about/gi, '').trim();
  if (!q) return BUILTIN_FOOD_ENTRIES.cow_ghee;

  // 1. Explicit Direct Key Check
  if (BUILTIN_FOOD_ENTRIES[q]) return BUILTIN_FOOD_ENTRIES[q];

  // 2. High-Priority Keyword Normalization
  if (/refined sugar|white sugar|sugar|chini|cheeni|sakkar|sugar crystals/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.refined_sugar;
  }
  if (/jaggery|gud|gur|desi jaggery|cane jaggery/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.jaggery;
  }
  if (/honey|shahad|madhu/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.honey;
  }
  if (/maida|refined flour|all purpose flour/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.maida;
  }
  if (/cow ghee|desi ghee|ghee|clarified butter/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.cow_ghee;
  }
  if (/soya|soybean|soyabean|bhatma/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.soyabeans;
  }
  if (/wheat|gehu|atta|whole wheat|roti/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.wheat;
  }
  if (/bajra|pearl millet/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.bajra;
  }
  if (/ragi|nachni|finger millet/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.ragi;
  }
  if (/white rice|rice|chawal|bhat/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.white_rice;
  }
  if (/brown rice|bhura chawal/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.brown_rice;
  }
  if (/mango|aam|alphonso|dasheri|langra/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.mango;
  }
  if (/banana|kela/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.banana;
  }
  if (/apple|seb|saeb/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.apple;
  }
  if (/papaya|papita/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.papaya;
  }
  if (/guava|amrood|amrud/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.guava;
  }
  if (/pomegranate|anar|anaar/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.pomegranate;
  }
  if (/watermelon|tarbooz|tarbuj/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.watermelon;
  }
  if (/potato chips|chips|kurkure|lays|bingo|namkeen/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.potato_chips;
  }
  if (/potato|aloo|alu|batata/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.potato;
  }
  if (/tomato|tamatar/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.tomato;
  }
  if (/onion|pyaz|pyaaz|kanda/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.onion;
  }
  if (/lady finger|bhindi|okra/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.lady_finger;
  }
  if (/bitter gourd|karela/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.bitter_gourd;
  }
  if (/bottle gourd|lauki|ghiya|dudhi/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.bottle_gourd;
  }
  if (/carrot|gajar/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.carrot;
  }
  if (/beetroot|chukandar/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.beetroot;
  }
  if (/palak|spinach|saag/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.palak;
  }
  if (/dhaniya|coriander|cilantro/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.dhaniya;
  }
  if (/haldi|turmeric/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.haldi;
  }
  if (/moong dal|mung dal|moong/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.moong_dal;
  }
  if (/toor dal|arhar dal|toor|arhar/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.toor_dal;
  }
  if (/chana dal|chana/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.chana_dal;
  }
  if (/rajma|kidney bean/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.rajma;
  }
  if (/cow milk|milk|doodh/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.cow_milk;
  }
  if (/curd|dahi|yogurt/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.curd;
  }
  if (/paneer|cottage cheese/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.paneer;
  }
  if (/egg|eggs|anda|ande/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.whole_egg;
  }
  if (/almond|almonds|badam/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.almonds;
  }
  if (/walnut|walnuts|akhrot/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.walnuts;
  }
  if (/anjeer|fig|figs/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.anjeer;
  }
  if (/pizza|burger/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.pizza;
  }
  if (/ashwagandha|asgandh/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.ashwagandha;
  }
  if (/makhana|fox nut|lotus seed/i.test(q)) {
    return BUILTIN_FOOD_ENTRIES.makhana;
  }

  // 3. Substring search in builtin items
  for (const key of Object.keys(BUILTIN_FOOD_ENTRIES)) {
    const item = BUILTIN_FOOD_ENTRIES[key];
    if (item.nameEn.toLowerCase().includes(q) || item.nameHi.toLowerCase().includes(q) || key.includes(q)) {
      return item;
    }
  }

  // 4. Try Gemini 3.5 Flash if valid API key is present
  if (apiKey && apiKey !== 'YOUR_GEMINI_KEY') {
    try {
      const geminiResult = await callGeminiFoodAiLookup(apiKey, raw);
      if (geminiResult && geminiResult.topBenefitTitle) {
        return geminiResult;
      }
    } catch (err) {
      console.warn("Gemini food lookup fallback to clinical classifier:", err.message);
    }
  }

  // 5. Intelligent Biochemical Classifier for Unlisted Foods (100% Honest Science)
  return classifyUnknownFoodItem(raw);
}

function callGeminiFoodAiLookup(apiKey, foodQuery) {
  return new Promise((resolve, reject) => {
    const prompt = `You are Nutrolix Food AI, the world's leading clinical nutritionist and Ayurvedic biochemist.
Provide comprehensive, 100% accurate food intelligence for: "${foodQuery}".
Output ONLY a valid JSON object (no markdown, no backticks) with this schema:
{
  "id": "slug_name",
  "nameEn": "English Name",
  "nameHi": "Hindi Name (e.g. नाम)",
  "category": "e.g. Grain / Legume / Vegetable / Herb / Dairy / Superfood / Snack",
  "verdictTag": "e.g. ⭐⭐⭐⭐⭐ Wholesome Superfood",
  "topBenefitTitle": "Sabse Bada Fayda: Title with active nutrient",
  "topBenefitDesc": "2-3 sentences deep clinical explanation of the top benefit.",
  "otherBenefits": ["Benefit 1 (Heart/BP)", "Benefit 2 (Gut/Digestion)", "Benefit 3 (Muscle/Recovery)", "Benefit 4 (Immunity/Antioxidants)", "Benefit 5 (Brain/Focus)"],
  "nutrients": {
    "calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0, "fiber": 0.0, "sugar": 0.0,
    "calciumMg": 0.0, "ironMg": 0.0, "magnesiumMg": 0.0, "potassiumMg": 0.0, "zincMg": 0.0,
    "vitaminA": "string", "vitaminC": "string", "vitaminD": "string", "vitaminBComplex": "string"
  },
  "whoShouldEat": ["Group 1 with clear rationale", "Group 2 with clear rationale"],
  "whenToAvoid": ["Condition or timing 1", "Condition or timing 2"],
  "avoidWith": ["Incompatible pairing 1 (Viruddha Aahar)", "Incompatible pairing 2"]
}`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const postOptions = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 25000
    };

    const req = https.request(postOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return reject(new Error(`Gemini status ${res.statusCode}: ${data}`));
          const parsed = JSON.parse(data);
          const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) return reject(new Error("No text candidate"));
          const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(requestBody);
    req.end();
  });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Nutrolix-Admin-Token, x-gemini-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const matchedPath = req.headers && (req.headers['x-matched-path'] || req.headers['x-forwarded-uri']);
  let effectiveUrl = req.url || '/';
  if (matchedPath && (effectiveUrl.startsWith('/api/index.js') || effectiveUrl === '/api' || effectiveUrl === '/api/')) {
    effectiveUrl = matchedPath;
  }
  const parsedUrl = url.parse(effectiveUrl, true);
  let reqPath = parsedUrl.pathname;
  if (reqPath === '/api/index.js' || reqPath === '/api' || reqPath === '/api/') {
    const sub = parsedUrl.query.__route || parsedUrl.query.__path || parsedUrl.query['0'];
    if (sub) {
      reqPath = sub.startsWith('/api') ? sub : ('/api/' + String(sub).replace(/^\/+/, ''));
    }
  }

  // -------------------------------------------------------------
  // HERO PRODUCTS & BANNERS API (Homepage Customizer)
  // -------------------------------------------------------------
  if (reqPath === '/api/hero-products') {
    const heroFile = path.join(PUBLIC_DIR, 'data', 'hero_products.json');
    const defaultHero = {
      card1: {
        title: "High Protein Atta",
        subtitle: "46g Bioavailable Plant Protein • Zero Spike Formula",
        rating: "4.9 ★ (1,840+ Sold)",
        price: 349,
        image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700&auto=format&fit=crop&q=80"
      },
      card2: {
        title: "Complete Nutri Meal",
        subtitle: "Zero Added Sugar • Micronutrient Rich Shake",
        rating: "4.9 ★ (820+ Sold)",
        price: 699,
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=700&auto=format&fit=crop&q=80"
      },
      showcase: {
        title: "Nutrolix High Protein Atta",
        tag: "⭐ Bestseller • Clinical Nutrition",
        price: 349,
        image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700&auto=format&fit=crop&q=80"
      }
    };

    if (req.method === 'GET') {
      const data = await readCatalogDocOrFallback('hero_products', heroFile, defaultHero);
      res.writeHead(200, NO_STORE_JSON_HEADERS);
      res.end(JSON.stringify({ success: true, heroProducts: data }));
      return;
    } else if (req.method === 'POST') {
      let bodyData = '';
      req.on('data', chunk => bodyData += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyData || '{}');
          await writeCatalogDocAndLocal('hero_products', heroFile, payload);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, heroProducts: payload }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (reqPath === '/api/banners') {
    const bannersFile = path.join(PUBLIC_DIR, 'data', 'banners.json');
    if (req.method === 'GET') {
      const banners = await readCatalogDocOrFallback('banners', bannersFile, []);
      res.writeHead(200, NO_STORE_JSON_HEADERS);
      res.end(JSON.stringify(Array.isArray(banners) ? banners : []));
      return;
    } else if (req.method === 'POST') {
      let bodyData = '';
      req.on('data', chunk => bodyData += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyData || '{}');
          let banners = await readCatalogDocOrFallback('banners', bannersFile, []);
          if (!Array.isArray(banners)) banners = [];
          if (Array.isArray(payload)) {
            banners = payload;
          } else {
            const b = {
              id: payload.id || ('banner_' + Date.now().toString(36)),
              title: String(payload.title || '').trim(),
              subtitle: String(payload.subtitle || '').trim(),
              badge: String(payload.badge || '').trim(),
              code: String(payload.code || '').trim().toUpperCase(),
              imageUrl: String(payload.imageUrl || '').trim(),
              active: payload.active !== false,
              updatedAt: new Date().toISOString()
            };
            const idx = banners.findIndex(item => item.id === b.id);
            if (idx >= 0) banners[idx] = { ...banners[idx], ...b };
            else banners.unshift(b);
          }
          await writeCatalogDocAndLocal('banners', bannersFile, banners);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, banners }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/banners/delete') {
    let bodyData = '';
    req.on('data', chunk => bodyData += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(bodyData || '{}');
        const bannersFile = path.join(PUBLIC_DIR, 'data', 'banners.json');
        let banners = await readCatalogDocOrFallback('banners', bannersFile, []);
        if (!Array.isArray(banners)) banners = [];
        banners = banners.filter(b => b.id !== id);
        await writeCatalogDocAndLocal('banners', bannersFile, banners);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true, banners }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // API ROUTE 1: POST /api/scan-food
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/scan-food') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      // Guard against payloads larger than 40MB
      if (bodyData.length > 40 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Payload too large. Please upload smaller images." }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData || '{}');
        const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-api-key'] || payload.apiKey || '';

        let extractedFromVision = null;
        if (apiKey && payload.images && payload.images.length > 0) {
          try {
            extractedFromVision = await callGeminiVision(apiKey, payload.images, payload.userNotes || '');
          } catch (apiErr) {
            console.warn("Gemini Vision API fallback to local scientific engine:", apiErr.message);
          }
        }

        // Merge vision findings with client inputs - giving absolute priority to verified Vision OCR
        const mergedNutrients = { ...(payload.nutrients || {}) };
        if (extractedFromVision?.nutritionTable) {
          const vt = extractedFromVision.nutritionTable;
          if (vt.calories) mergedNutrients.calories = vt.calories;
          if (vt.protein !== undefined && vt.protein !== null) mergedNutrients.protein = vt.protein;
          if (vt.carbs !== undefined && vt.carbs !== null) mergedNutrients.carbs = vt.carbs;
          if (vt.totalSugar !== undefined && vt.totalSugar !== null) mergedNutrients.totalSugar = vt.totalSugar;
          if (vt.addedSugar !== undefined && vt.addedSugar !== null) mergedNutrients.addedSugar = vt.addedSugar;
          if (vt.saturatedFat !== undefined && vt.saturatedFat !== null) mergedNutrients.saturatedFat = vt.saturatedFat;
          if (vt.transFat !== undefined && vt.transFat !== null) mergedNutrients.transFat = vt.transFat;
          if (vt.sodium !== undefined && vt.sodium !== null) mergedNutrients.sodium = vt.sodium;
          if (vt.dietaryFiber !== undefined && vt.dietaryFiber !== null) mergedNutrients.dietaryFiber = vt.dietaryFiber;
        }

        const mergedPayload = {
          productName: (extractedFromVision?.productName && extractedFromVision.productName !== 'Scanned Product')
            ? extractedFromVision.productName
            : (payload.productName || 'Scanned Food Product'),
          brandName: extractedFromVision?.brandName || payload.brandName || 'Packaged Goods',
          rawIngredients: extractedFromVision?.rawIngredients || payload.rawIngredients || payload.ingredientsText || '',
          rawNutrition: payload.rawNutrition || '',
          rawDates: extractedFromVision?.rawDates || payload.rawDates || payload.datesText || '',
          nutrientsInput: mergedNutrients,
          extractedText: extractedFromVision?.rawIngredients || payload.extractedText || ''
        };

        const finalReport = analyzeFoodData(mergedPayload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(finalReport));
      } catch (err) {
        console.error("Error analyzing food scan:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Failed to complete food quality analysis: " + err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // API ROUTE 2: POST /api/ask-food-ai
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/ask-food-ai') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > 5 * 1024 * 1024) req.destroy();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData || '{}');
        const { productContext, question } = payload;
        if (!question) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Question is required." }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-api-key'] || payload.apiKey || '';
        let answerText = '';

        if (apiKey && productContext) {
          try {
            answerText = await callGeminiQnA(apiKey, productContext, question);
          } catch (geminiErr) {
            console.warn("Gemini QnA fallback to rule engine:", geminiErr.message);
            answerText = ruleBasedQnA(productContext, question);
          }
        } else {
          answerText = ruleBasedQnA(productContext || {}, question);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ answer: answerText }));
      } catch (err) {
        console.error("Error in ask-food-ai:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Could not answer question: " + err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // API ROUTE 3: POST /api/food-ai-lookup
  // Universal Food & Grain Nutrition Intelligence
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/food-ai-lookup') {
    let bodyData = '';
    req.on('data', chunk => bodyData += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData || '{}');
        const query = (payload.query || payload.foodName || '').trim();
        const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-api-key'] || payload.apiKey || '';

        const foodData = await resolveFoodAiData(query, apiKey);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(foodData));
      } catch (err) {
        console.error("Error in food-ai-lookup:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Failed to resolve food details: " + err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // DEDICATED STREAMING APK & AAB DOWNLOAD ROUTES (WITH RANGE SUPPORT & NO BUFFERING)
  // -------------------------------------------------------------
  function serveApkFile(target, filename, req, res) {
    if (!target || !fs.existsSync(target)) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end('APK file not found on server');
      return;
    }
    const stat = fs.statSync(target);
    const totalSize = stat.size;
    const range = req.headers.range;

    const baseHeaders = {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no' // Instructs Nginx not to buffer large binaries to prevent 500 error
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, { ...baseHeaders, 'Content-Length': totalSize });
      res.end();
      return;
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize || (parts[1] && isNaN(end)) || start > end) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }

      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize
      });

      const stream = fs.createReadStream(target, { start, end });
      stream.on('error', (err) => {
        console.error('APK Range Stream error:', err);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      req.on('close', () => {
        stream.destroy();
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Length': totalSize
      });

      const stream = fs.createReadStream(target);
      stream.on('error', (err) => {
        console.error('APK Stream error:', err);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      req.on('close', () => {
        stream.destroy();
      });
      stream.pipe(res);
    }
  }

  if (['/download-admin-apk', '/nutrolix-admin.apk', '/Nutrolix-Admin.apk', '/admin.apk'].includes(reqPath)) {
    const adminApkProper = path.join(PUBLIC_DIR, 'Nutrolix-Admin.apk');
    const adminApkLower = path.join(PUBLIC_DIR, 'nutrolix-admin.apk');
    const custApk = path.join(PUBLIC_DIR, 'Nutrolix-Customer.apk');
    const fallbackApk = path.join(__dirname, 'Nutrolix-Customer.apk');
    const target = fs.existsSync(adminApkProper)
      ? adminApkProper
      : (fs.existsSync(adminApkLower) ? adminApkLower : (fs.existsSync(custApk) ? custApk : fallbackApk));
    serveApkFile(target, 'Nutrolix-Admin.apk', req, res);
    return;
  }

  if (['/download-customer-apk', '/nutrolix-customer.apk', '/Nutrolix-Customer.apk', '/customer.apk', '/app.apk', '/apk', '/download-apk'].includes(reqPath)) {
    const custApk = path.join(PUBLIC_DIR, 'Nutrolix-Customer.apk');
    const custApkLower = path.join(PUBLIC_DIR, 'nutrolix-customer.apk');
    const fallbackApk = path.join(__dirname, 'Nutrolix-Customer.apk');
    const target = fs.existsSync(custApk) ? custApk : (fs.existsSync(custApkLower) ? custApkLower : fallbackApk);
    serveApkFile(target, 'Nutrolix-Customer.apk', req, res);
    return;
  }

  if (['/nutrolix-live.apk', '/nutrolix.apk', '/app-debug.apk'].includes(reqPath)) {
    const target = path.join(PUBLIC_DIR, 'Nutrolix-Customer.apk');
    serveApkFile(target, 'Nutrolix.apk', req, res);
    return;
  }

  if (['/download-aab', '/nutrolix-release.aab', '/Nutrolix-Customer.aab', '/aab'].includes(reqPath)) {
    const aabProper = path.join(PUBLIC_DIR, 'Nutrolix-Customer.aab');
    const aabFile = fs.existsSync(aabProper) ? aabProper : path.join(PUBLIC_DIR, 'nutrolix-release.aab');
    if (fs.existsSync(aabFile)) {
      serveApkFile(aabFile, 'Nutrolix-Customer.aab', req, res);
      return;
    }
  }

  if (reqPath === '/download' || reqPath === '/download/') {
    reqPath = '/download.html';
  }

  // -------------------------------------------------------------
  // NUTROLIX NUTRITION STORE APIS
  // -------------------------------------------------------------
  if (reqPath === '/api/nutrition-products' || reqPath === '/api/nutrition-products/') {
    const productsFile = path.join(PUBLIC_DIR, 'data', 'nutrition_products.json');
    if (req.method === 'GET') {
      try {
        const products = await readCatalogDocOrFallback('nutrition_products', productsFile, []);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify(products));
      } catch (e) {
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify([]));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const item = JSON.parse(body || '{}');
          if (item.category) {
            item.category = nutrolixCore.normalizeStoreCategory(item.category, item.title || item.name || '');
          }
          let products = await readCatalogDocOrFallback('nutrition_products', productsFile, []);
          const existingIdx = products.findIndex(p => p.id === item.id);
          if (existingIdx >= 0) {
            products[existingIdx] = { ...products[existingIdx], ...item };
          } else {
            if (!item.id) item.id = 'prod_' + Date.now().toString(36);
            products.unshift(item);
          }
          await writeCatalogDocAndLocal('nutrition_products', productsFile, products);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, product: item }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    } else if (req.method === 'DELETE') {
      try {
        const id = parsedUrl.query.id;
        let products = await readCatalogDocOrFallback('nutrition_products', productsFile, []);
        if (id) products = products.filter(p => p.id !== id);
        await writeCatalogDocAndLocal('nutrition_products', productsFile, products);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/nutrition-products/delete') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body || '{}');
        const productsFile = path.join(PUBLIC_DIR, 'data', 'nutrition_products.json');
        let products = await readCatalogDocOrFallback('nutrition_products', productsFile, []);
        products = products.filter(p => p.id !== id);
        await writeCatalogDocAndLocal('nutrition_products', productsFile, products);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Google Reviews API (Firestore-backed across devices)
  if (reqPath === '/api/google-reviews') {
    const reviewsFile = path.join(PUBLIC_DIR, 'data', 'google_reviews.json');
    const defaultGoogleData = {
      profileUrl: "https://share.google/VKolmxSnf5D05l7pu",
      rating: 4.9,
      totalReviews: 148,
      reviews: []
    };
    const normalizeGoogleReviewItem = (r) => {
      if (!r || typeof r !== 'object') return null;
      const authorName = String(r.authorName || r.author || 'Verified Customer').trim();
      const reviewText = String(r.reviewText || r.text || '').trim();
      return {
        ...r,
        author: authorName,
        authorName,
        text: reviewText,
        reviewText,
        rating: Math.min(5, Math.max(1, Number(r.rating || 5) || 5)),
        relativeTime: r.relativeTime || 'Recent'
      };
    };

    if (req.method === 'GET') {
      try {
        const data = await readCatalogDocOrFallback('google_reviews', reviewsFile, defaultGoogleData);
        const list = (Array.isArray(data.reviews) ? data.reviews : (Array.isArray(data.featuredReviews) ? data.featuredReviews : []))
          .map(normalizeGoogleReviewItem)
          .filter(Boolean);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ ...defaultGoogleData, ...data, reviews: list, featuredReviews: list }));
      } catch (e) {
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ ...defaultGoogleData, featuredReviews: [] }));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          let current = await readCatalogDocOrFallback('google_reviews', reviewsFile, defaultGoogleData);
          if (!current || typeof current !== 'object') current = { ...defaultGoogleData };
          if (!Array.isArray(current.reviews)) current.reviews = [];
          if (payload.review) {
            const norm = normalizeGoogleReviewItem(payload.review);
            if (norm) current.reviews.unshift(norm);
            current.totalReviews = (Number(current.totalReviews) || 148) + 1;
          } else if (payload.author || payload.authorName) {
            const norm = normalizeGoogleReviewItem(payload);
            if (norm) current.reviews.unshift(norm);
            current.totalReviews = (Number(current.totalReviews) || 148) + 1;
          } else if (Array.isArray(payload.reviews)) {
            current = { ...current, ...payload, reviews: payload.reviews.map(normalizeGoogleReviewItem).filter(Boolean) };
          }
          current.featuredReviews = current.reviews;
          current.lastSynced = new Date().toISOString();
          await writeCatalogDocAndLocal('google_reviews', reviewsFile, current);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, lastSynced: current.lastSynced, totalReviews: current.totalReviews || 148, reviews: current.reviews, featuredReviews: current.reviews }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // Video Reviews API (YouTube Shorts — Firestore-backed across devices)
  if (reqPath === '/api/video-reviews') {
    const vidsFile = path.join(PUBLIC_DIR, 'data', 'video_reviews.json');
    if (req.method === 'GET') {
      try {
        const vids = await readCatalogDocOrFallback('video_reviews', vidsFile, []);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify(Array.isArray(vids) ? vids : []));
      } catch (e) {
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify([]));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const item = JSON.parse(body || '{}');
          let vids = await readCatalogDocOrFallback('video_reviews', vidsFile, []);
          if (!Array.isArray(vids)) vids = [];
          if (!item.id) item.id = 'vid_' + Date.now().toString(36);

          // Extract clean YouTube video ID across shorts/, watch?v=, youtu.be/, embed/
          const rawUrl = String(item.youtubeUrl || item.youtubeId || '').trim();
          let yId = '';
          const ytMatch = rawUrl.match(/(?:shorts\/|embed\/|youtu\.be\/|[?&]v=)([a-zA-Z0-9_-]{6,})/);
          if (ytMatch && ytMatch[1]) {
            yId = ytMatch[1];
          } else if (/^[a-zA-Z0-9_-]{11}$/.test(rawUrl)) {
            yId = rawUrl;
          }
          if (yId) {
            item.youtubeId = yId;
            item.embedUrl = `https://www.youtube.com/embed/${yId}?autoplay=1&mute=1&loop=1&playlist=${yId}&enablejsapi=1&controls=0&modestbranding=1`;
            if (!item.thumbnail) item.thumbnail = `https://i.ytimg.com/vi/${yId}/hqdefault.jpg`;
          }

          const existingIdx = vids.findIndex(v => v.id === item.id);
          if (existingIdx >= 0) {
            vids[existingIdx] = { ...vids[existingIdx], ...item };
          } else {
            vids.unshift(item);
          }
          await writeCatalogDocAndLocal('video_reviews', vidsFile, vids);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, item }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/video-reviews/delete') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body || '{}');
        const vidsFile = path.join(PUBLIC_DIR, 'data', 'video_reviews.json');
        let vids = await readCatalogDocOrFallback('video_reviews', vidsFile, []);
        if (!Array.isArray(vids)) vids = [];
        vids = vids.filter(v => v.id !== id);
        await writeCatalogDocAndLocal('video_reviews', vidsFile, vids);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Blogs API (Full CRUD)
  if (reqPath === '/api/blogs') {
    const blogsFile = path.join(PUBLIC_DIR, 'data', 'blogs.json');
    if (req.method === 'GET') {
      try {
        const blogs = await readCatalogDocOrFallback('blogs', blogsFile, []);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify(blogs));
      } catch (e) {
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify([]));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const blog = JSON.parse(body || '{}');
          let blogs = await readCatalogDocOrFallback('blogs', blogsFile, []);
          if (!blog.id) blog.id = 'blog_' + Date.now().toString(36);
          if (!blog.date) blog.date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          if (!blog.readTime) blog.readTime = '4 min read';

          const existingIdx = blogs.findIndex(b => b.id === blog.id);
          if (existingIdx >= 0) {
            blogs[existingIdx] = { ...blogs[existingIdx], ...blog };
          } else {
            blogs.unshift(blog);
          }
          await writeCatalogDocAndLocal('blogs', blogsFile, blogs);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, blog }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/blogs/delete') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body || '{}');
        const blogsFile = path.join(PUBLIC_DIR, 'data', 'blogs.json');
        let blogs = await readCatalogDocOrFallback('blogs', blogsFile, []);
        blogs = blogs.filter(b => b.id !== id);
        await writeCatalogDocAndLocal('blogs', blogsFile, blogs);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Free Server-Side Reverse Geocoding (OpenStreetMap Nominatim + BigDataCloud + India Post PIN verification)
  if (req.method === 'POST' && reqPath === '/api/location/reverse-geocode') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const lat = payload.lat ?? payload.latitude;
        const lon = payload.lon ?? payload.lng ?? payload.longitude;
        const result = await nutrolixCore.reverseGeocodeFree(lat, lon, {
          nativeGeocoder: payload.nativeGeocoder || null
        });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, fallbackRequired: true, code: 'BAD_REQUEST', error: err.message }));
      }
    });
    return;
  }

  // India Post 6-digit PIN lookup helper
  if (req.method === 'GET' && reqPath === '/api/location/pincode') {
    const cleanPin = String(parsedUrl.query.pin || parsedUrl.query.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: 'Valid 6-digit PIN code is required.' }));
      return;
    }
    const known = nutrolixCore.KNOWN_INDIA_POST_PIN_MAP[cleanPin];
    if (known) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, ...known }));
      return;
    }
    const offices = await nutrolixCore.lookupIndiaPostByPincode(cleanPin);
    if (offices.length > 0) {
      const po = offices.find((p) => String(p.DeliveryStatus || '').toLowerCase() === 'delivery') || offices[0];
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: true,
        pincode: cleanPin,
        area: po.Name || '',
        city: [po.Block && po.Block !== 'NA' ? po.Block : '', po.District || po.Division || ''].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
        state: po.State || '',
        district: po.District || ''
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: false, pincode: cleanPin }));
    return;
  }

  // Nutrition Orders API (Durable Firestore + Validation + Idempotency + Notifications)
  if (reqPath === '/api/nutrition-orders' || reqPath === '/api/orders') {
    const ordersFile = path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json');
    if (req.method === 'GET') {
      try {
        const localOrders = safeReadJson(ordersFile, []);
        const byOrderId = new Map();
        for (const o of Array.isArray(localOrders) ? localOrders : []) {
          const oid = String(o.orderId || o.id || '').trim();
          if (oid) byOrderId.set(oid, o);
        }

        // Pull authoritative orders from both Firestore databases
        try {
          const [defRes, namedRes] = await Promise.all([
            nutrolixCore.firestoreListAllDocuments('orders', nutrolixCore.DEFAULT_DB_ID, 2000),
            nutrolixCore.firestoreListAllDocuments('orders', nutrolixCore.NAMED_DB_ID, 2000)
          ]);
          for (const doc of [...defRes.docs, ...namedRes.docs]) {
            const oid = String(doc.orderId || doc.id || doc._docId || '').trim();
            if (!oid) continue;
            const cleanDoc = { ...doc, id: oid, orderId: oid };
            delete cleanDoc._docId;
            delete cleanDoc._docName;
            byOrderId.set(oid, { ...(byOrderId.get(oid) || {}), ...cleanDoc });
          }
        } catch (_) {}

        let data = Array.from(byOrderId.values());
        data.sort((a, b) => {
          const ta = Number(a.timestamp || a.orderTimeMillis || Date.parse(a.createdAt || a.orderTime || 0) || 0);
          const tb = Number(b.timestamp || b.orderTimeMillis || Date.parse(b.createdAt || b.orderTime || 0) || 0);
          return tb - ta;
        });

        const qUid = String(parsedUrl.query.uid || '').trim();
        const qPhone = normalizePhone(parsedUrl.query.phone || '') || (qUid.startsWith('phone_') ? normalizePhone(qUid.slice(6)) : '');
        const qEmail = normalizeEmail(parsedUrl.query.email || '');
        if (qUid || qPhone || qEmail) {
          data = data.filter(o => {
            const oUid = String(o.uid || '').trim();
            const oPhone = customerSync.extractOrderPhone(o);
            const oEmail = customerSync.extractOrderEmail(o);
            return (qUid && oUid && oUid === qUid) || (qPhone && oPhone && oPhone === qPhone) || (qEmail && oEmail && oEmail === qEmail);
          });
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(data));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        let rawPayload = null;
        try {
          rawPayload = JSON.parse(body || '');
        } catch (_) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON request body.' }));
          return;
        }

        const validation = customerSync.validateOrderPayload(rawPayload);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: validation.errors[0], errors: validation.errors }));
          return;
        }

        try {
          const order = validation.normalizedOrder;
          let orders = safeReadJson(ordersFile, []);
          if (!Array.isArray(orders)) orders = [];

          // Idempotency & duplicate order guard (check local + Firestore)
          const existingLocal = orders.find(o =>
            o.orderId === order.orderId ||
            o.id === order.orderId ||
            (order.idempotencyKey && o.idempotencyKey === order.idempotencyKey)
          );
          if (existingLocal) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true, order: existingLocal, deduplicated: true }));
            return;
          }

          const existingFs = await nutrolixCore.firestoreGetFirstAvailable(`orders/${order.orderId}`);
          if (existingFs && existingFs.orderId) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true, order: existingFs, deduplicated: true }));
            return;
          }

          if (order.idempotencyKey) {
            for (const dbId of nutrolixCore.BOTH_DB_IDS) {
              const dupMatches = await nutrolixCore.firestoreRunQuery(
                'orders',
                [{ field: 'idempotencyKey', op: 'EQUAL', value: order.idempotencyKey }],
                dbId,
                1
              );
              if (dupMatches && dupMatches.length > 0) {
                const dupOrder = dupMatches[0];
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ success: true, order: dupOrder, deduplicated: true }));
                return;
              }
            }
          }

          // Persist Healthy Food Discount redemption durably
          await recordHealthyFoodRedemption(order);

          orders.unshift(order);
          safeWriteJson(ordersFile, orders);

          // Persist authoritative order & non-clobbering customer summary to both Firestore DBs
          const fsWrite = await nutrolixCore.firestorePatchBothDbs(`orders/${order.orderId}`, order);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            success: true,
            order,
            firestorePersisted: fsWrite.anySuccess
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: err.message || 'Order creation failed.' }));
        }
      });
      return;
    }
  }


  // Post-checkout notifications are deliberately isolated from order confirmation.
  // A slow push provider must never leave the customer's Place Order button spinning.
  if (reqPath === '/api/notifications/order-placed' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const orderId = String(payload.orderId || '').trim();
        if (!orderId) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Order ID is required.' }));
          return;
        }
        let order = await nutrolixCore.firestoreGetFirstAvailable(`orders/${orderId}`);
        if (!order) {
          const localOrders = safeReadJson(path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json'), []);
          order = (Array.isArray(localOrders) ? localOrders : []).find(o => String(o.orderId || o.id) === orderId);
        }
        if (!order || String(order.orderId || order.id || '') !== orderId) {
          res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Confirmed order not found.' }));
          return;
        }
        if (order.uid) {
                    try {
                      const existingUser = await nutrolixCore.firestoreGetFirstAvailable(`users/${order.uid}`);
                      const bestName = nutrolixCore.pickBestCustomerName(existingUser && existingUser.name, order.customerName);
                      const addr = order.deliveryAddress && typeof order.deliveryAddress === 'object' ? order.deliveryAddress : {};
                      const addrLine = String(addr.address1 || addr.street || '').trim();
                      const addrCity = String(addr.city || '').trim();
                      const addrState = String(addr.state || '').trim();
                      const addrPin = String(addr.pincode || '').replace(/\D/g, '').slice(0, 6);
                      const formattedFullAddr = [addrLine, addrCity, addrState, addrPin].filter(Boolean).join(', ');
                      const nowIso = new Date().toISOString();
                      const nowMs = Date.now();
        
                      const deliveryRecipientPhone =
                        normalizePhone(addr.phone || addr.recipientPhone || order.deliveryPhone) ||
                        order.customerPhone;
                      const deliveryRecipientName = String(addr.name || bestName || '').trim() || bestName;
                      const profileWhatsapp = normalizePhone(
                        (existingUser && existingUser.whatsappNumber) || order.whatsappNumber || order.customerPhone
                      ) || order.customerPhone;

                      await nutrolixCore.firestorePatchBothDbs(`users/${order.uid}`, {
                        uid: order.uid,
                        id: order.uid,
                        name: bestName,
                        phone: order.customerPhone,
                        verifiedPhone: order.customerPhone,
                        whatsappNumber: profileWhatsapp,
                        email: order.customerEmail || (existingUser && existingUser.email) || '',
                        lastOrderId: order.orderId,
                        lastOrderAmount: order.grandTotal,
                        defaultAddress: (existingUser && existingUser.defaultAddress) || addrLine || '',
                        currentAddress: (existingUser && existingUser.currentAddress) || formattedFullAddr || '',
                        lastAddress: formattedFullAddr || (existingUser && existingUser.lastAddress) || '',
                        city: (existingUser && existingUser.city) || addrCity || '',
                        state: (existingUser && existingUser.state) || addrState || '',
                        pincode: (existingUser && existingUser.pincode) || addrPin || '',
                        addressesCleared: false,
                        updatedAt: nowIso,
                        updatedAtMillis: nowMs
                      });

                      if (addrLine && addrPin.length === 6) {
                        const existingAddrsDefault = await nutrolixCore.firestoreListDocuments(`users/${order.uid}/addresses`, nutrolixCore.DEFAULT_DB_ID);
                        const existingAddrsNamed = await nutrolixCore.firestoreListDocuments(`users/${order.uid}/addresses`, nutrolixCore.NAMED_DB_ID);
                        const allExistingAddrs = [...existingAddrsDefault, ...existingAddrsNamed];
                        const normKey = (a) => `${String(a.pincode || '').replace(/\D/g, '').slice(0, 6)}_${String(a.address1 || a.street || '').toLowerCase().replace(/[^a-z0-9]/g, '')}_${normalizePhone(a.phone || '')}`;
                        const targetKey = normKey({ address1: addrLine, pincode: addrPin, phone: deliveryRecipientPhone });
                        const matchedExisting = allExistingAddrs.find((a) => normKey(a) === targetKey);
                        const isFirstAddr = allExistingAddrs.length === 0;
                        const addrId = matchedExisting
                          ? String(matchedExisting.id || matchedExisting._docId || 'addr_primary')
                          : (isFirstAddr ? 'addr_primary' : ('addr_' + require('crypto').createHash('sha1').update(targetKey).digest('hex').slice(0, 10)));

                        const addressRecord = {
                          id: addrId,
                          uid: order.uid,
                          tag: (matchedExisting && matchedExisting.tag) || 'Home',
                          name: deliveryRecipientName,
                          fullName: deliveryRecipientName,
                          phone: deliveryRecipientPhone,
                          whatsappNumber: deliveryRecipientPhone,
                          street: addrLine,
                          address1: addrLine,
                          city: addrCity,
                          state: addrState,
                          pincode: addrPin,
                          isDefault: matchedExisting ? Boolean(matchedExisting.isDefault) : isFirstAddr,
                          updatedAt: nowIso,
                          updatedAtMillis: nowMs
                        };
                        if (Number.isFinite(Number(addr.gpsLat)) && Number.isFinite(Number(addr.gpsLon))) {
                          addressRecord.lat = Number(addr.gpsLat);
                          addressRecord.lon = Number(addr.gpsLon);
                        }
                        await nutrolixCore.firestorePatchBothDbs(`users/${order.uid}/addresses/${addrId}`, addressRecord);
                      }
                    } catch (_) {}
                  }
        const copy = nutrolixCore.buildOrderStatusNotificationCopy(order.orderId || order.id, order.status || 'Order Placed');
        const [customerPush, adminPush] = await Promise.all([
          dispatchPushToCustomer({
            uid: order.uid,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            orderId: order.orderId || order.id,
            status: order.status || 'Order Placed',
            title: copy.title,
            message: copy.message,
            dedupKey: copy.dedupKey
          }).catch(error => ({ error: error.message, deliveryStatus: [] })),
          dispatchPushToAdmins({
            orderId: order.orderId || order.id,
            total: order.grandTotal,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            paymentMethod: order.paymentMethod
          }).catch(error => ({ error: error.message }))
        ]);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, customerPush, adminPush }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message || 'Notification dispatch failed.' }));
      }
    });
    return;
  }

  // Discount Validation APIs (Part B: Healthy Food Exclusivity)
  if (reqPath === '/api/discounts/healthy-food-eligibility' && req.method === 'GET') {
    const phone = parsedUrl.query.phone || '';
    const email = parsedUrl.query.email || '';
    const eligibility = await getCustomerHealthyFoodEligibilityDurable(phone, email);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(eligibility));
    return;
  }

  if (reqPath === '/api/discounts/validate-healthy-food' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { items, customerPhone, customerEmail } = JSON.parse(body || '{}');
        const eligibility = await getCustomerHealthyFoodEligibilityDurable(customerPhone, customerEmail);

        // Calculate subtotal strictly for Healthy Food / Cloud Kitchen meals (Excluding packaged store goods)
        let healthyFoodSubtotal = 0;
        if (Array.isArray(items)) {
          for (const it of items) {
            const cat = (it.category || '').toLowerCase();
            const id = (it.id || '').toLowerCase();
            const isFood = Boolean(
              it.isFood ||
              cat.includes('food') ||
              cat.includes('meal') ||
              cat.includes('thali') ||
              cat.includes('salad') ||
              cat.includes('bowl') ||
              cat.includes('combos') ||
              id.startsWith('food_') ||
              id.startsWith('meal_') ||
              id.startsWith('healthy_')
            );
            if (isFood) {
              healthyFoodSubtotal += (Number(it.price) || 0) * (Number(it.quantity) || 1);
            }
          }
        }

        const minOrder = eligibility.minOrder; // 349 for FIRST100, 249 for SUBSEQUENT50
        const isEligibleForDiscount = healthyFoodSubtotal >= minOrder;
        const discountAmount = isEligibleForDiscount ? eligibility.discount : 0;

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          valid: isEligibleForDiscount,
          offerType: eligibility.offerType,
          discountAmount: discountAmount,
          healthyFoodSubtotal: healthyFoodSubtotal,
          minOrderRequired: minOrder,
          remainingForDiscount: Math.max(0, minOrder - healthyFoodSubtotal),
          title: eligibility.title,
          description: eligibility.description
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Update order status (Authoritative Firestore lookup + Customer Push Notification Triggers)
  if (req.method === 'POST' && (reqPath === '/api/nutrition-orders/status' || reqPath === '/api/orders/status')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let payload = null;
        try {
          payload = JSON.parse(body || '');
        } catch (_) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON request body.' }));
          return;
        }

        const orderId = String(payload.orderId || payload.id || '').trim();
        const rawStatus = String(payload.status || '').trim();
        const courier = String(payload.courier || '').trim();
        const trackingNumber = String(payload.trackingNumber || '').trim();

        if (!orderId || !rawStatus) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'orderId and status are required.' }));
          return;
        }

        const normStatus = nutrolixCore.normalizeOrderStatus(rawStatus);
        const statusToPersist = rawStatus;
        const ordersFile = path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json');
        let orders = safeReadJson(ordersFile, []);
        if (!Array.isArray(orders)) orders = [];

        const idx = orders.findIndex(o => (o.id === orderId || o.orderId === orderId));
        let existingOrder = idx >= 0 ? orders[idx] : null;
        if (!existingOrder) {
          existingOrder = await nutrolixCore.firestoreGetFirstAvailable(`orders/${orderId}`);
        }
        const paymentMethod = String((existingOrder && existingOrder.paymentMethod) || '').toLowerCase();
        const paymentStatus = String((existingOrder && existingOrder.paymentStatus) || '').toLowerCase();
        const requiresOnlinePayment = Boolean(existingOrder && existingOrder.txnid) ||
          /payu|online|upi|card|net.?bank/i.test(paymentMethod);
        if (requiresOnlinePayment && !/^(paid|success|successful|completed|captured)(\b|\s)/i.test(paymentStatus)) {
          res.writeHead(409, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Payment is not confirmed. Order tracking cannot be started.' }));
          return;
        }

        const nowIso = new Date().toISOString();
        const targetPhone = customerSync.extractOrderPhone({
          ...(existingOrder || {}),
          customerPhone: payload.customerPhone || (existingOrder && existingOrder.customerPhone) || ''
        });
        const targetUid = nutrolixCore.canonicalCustomerUid(targetPhone) ||
          String((existingOrder && existingOrder.uid) || payload.uid || '').trim();
        const targetEmail = customerSync.extractOrderEmail({
          ...(existingOrder || {}),
          customerEmail: payload.customerEmail || (existingOrder && existingOrder.customerEmail) || ''
        });

        const updatedOrder = {
          ...(existingOrder || {}),
          id: orderId,
          orderId,
          uid: targetUid,
          customerPhone: targetPhone || (existingOrder && existingOrder.customerPhone) || '',
          customerEmail: targetEmail || (existingOrder && existingOrder.customerEmail) || '',
          status: statusToPersist,
          normalizedStatusKey: normStatus.key,
          statusUpdatedAt: nowIso,
          ...(courier ? { courier } : {}),
          ...(trackingNumber ? { trackingNumber } : {})
        };
        delete updatedOrder._docId;
        delete updatedOrder._docName;

        if (idx >= 0) orders[idx] = updatedOrder;
        else orders.unshift(updatedOrder);
        safeWriteJson(ordersFile, orders);

        const patchPayload = {
          status: statusToPersist,
          normalizedStatusKey: normStatus.key,
          statusUpdatedAt: nowIso,
          ...(targetUid ? { uid: targetUid } : {}),
          ...(targetPhone ? { customerPhone: targetPhone, verifiedPhone: targetPhone } : {}),
          ...(courier ? { courier } : {}),
          ...(trackingNumber ? { trackingNumber } : {})
        };
        const fsRes = await nutrolixCore.firestorePatchBothDbs(`orders/${orderId}`, patchPayload);

        const copy = nutrolixCore.buildOrderStatusNotificationCopy(
          orderId,
          statusToPersist,
          updatedOrder.courier || courier,
          updatedOrder.trackingNumber || trackingNumber
        );
        let logResult = null;
        if (copy && copy.title) {
          try {
            logResult = await dispatchPushToCustomer({
              uid: targetUid,
              customerPhone: targetPhone,
              customerEmail: targetEmail,
              orderId,
              status: copy.statusLabel,
              title: copy.title,
              message: copy.message,
              dedupKey: copy.dedupKey
            });
          } catch (_) {}
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: true,
          order: updatedOrder,
          firestorePersisted: fsRes.anySuccess,
          notificationSent: Boolean(logResult && !logResult.deduplicated),
          deduplicated: Boolean(logResult && logResult.deduplicated),
          pushDelivery: logResult ? logResult.deliveryStatus : [],
          notificationCopy: copy
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message || 'Status update failed.' }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // PAYU LIVE PAYMENT GATEWAY INTEGRATION
  // -------------------------------------------------------------
  const PAYU_KEY = process.env.PAYU_MERCHANT_KEY || 'bbLKDj';
  const PAYU_SALT = process.env.PAYU_MERCHANT_SALT || 'hXZhMuxn8Sq4VHKHxVubFVDQqZRgX8zZ';
  const PAYU_PAYMENT_URL = 'https://secure.payu.in/_payment';

  // Endpoint 1: Initiate PayU Live Payment
  if (req.method === 'POST' && reqPath === '/api/payu/initiate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const orderData = JSON.parse(body || '{}');
        const orderId = orderData.orderId || ('ORD-' + Math.floor(100000 + Math.random() * 900000));
        const txnid = 'NTX_' + orderId + '_' + Date.now().toString(36);
        const numericAmount = Number(orderData.totalAmount || orderData.total || orderData.grandTotal || orderData.amount || 0);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Valid payable amount is required for online payment.' }));
          return;
        }
        const amount = numericAmount.toFixed(2);
        const productinfo = (orderData.items && orderData.items.length)
          ? orderData.items.map(i => i.name).join(', ').substring(0, 90)
          : (orderData.productinfo || 'Nutrolix Functional Nutrition');
        const firstname = (orderData.customerName || orderData.name || orderData.firstname || 'Customer').split(' ')[0] || 'Customer';
        const email = (orderData.customerEmail || orderData.email || 'customer@nutrolix.in').trim();
        const phone = customerSync.extractOrderPhone(orderData);
        if (!nutrolixCore.isValidIndianMobile(phone)) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Valid 10-digit mobile number is required for online payment.' }));
          return;
        }
        const canonicalUid = nutrolixCore.canonicalCustomerUid(phone) || orderData.uid || '';

        // Calculate Official PayU SHA-512 Hash
        const hashString = `${PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_SALT}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        const host = req.headers['host'] || 'nutrolixweb.vercel.app';
        const protocol = (req.headers['x-forwarded-proto'] || 'https');
        const baseUrl = `${protocol}://${host}`;

        const surl = `${baseUrl}/api/payu/response`;
        const furl = `${baseUrl}/api/payu/response`;

        const pendingOrder = {
          ...orderData,
          id: orderId,
          orderId,
          uid: canonicalUid,
          customerPhone: phone,
          verifiedPhone: phone,
          customerEmail: normalizeEmail(email),
          txnid,
          paymentMethod: 'PayU Online Payment (UPI, Cards, NetBanking)',
          paymentStatus: 'PAYMENT_PENDING',
          status: orderData.status || 'Payment Pending',
          grandTotal: numericAmount,
          total: numericAmount,
          amount,
          createdAt: orderData.createdAt || new Date().toISOString(),
          timestamp: Number(orderData.timestamp) || Date.now(),
          orderTimeMillis: Number(orderData.orderTimeMillis) || Date.now()
        };
        // Keep unpaid checkout attempts outside the customer/admin orders collection.
        // They become real orders only after a verified PayU success callback.
        const persistResults = await Promise.all([
          nutrolixCore.firestorePatchBothDbs(`payuPendingOrders/${orderId}`, pendingOrder),
          nutrolixCore.firestorePatchBothDbs(`payuTransactions/${txnid}`, {
            txnid,
            orderId,
            uid: canonicalUid,
            customerPhone: phone,
            customerEmail: normalizeEmail(email),
            amount,
            paymentStatus: 'PAYMENT_PENDING',
            createdAt: pendingOrder.createdAt
          })
        ]);
        if (!persistResults.every(result => result && result.anySuccess)) {
          throw new Error('Unable to securely save pending payment. Please retry payment.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: true,
          action: PAYU_PAYMENT_URL,
          key: PAYU_KEY,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone,
          surl,
          furl,
          hash,
          orderId
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Endpoint 2: PayU Webhook / Callback Handler (Durable across stateless Vercel instances)
  if (req.method === 'POST' && reqPath === '/api/payu/response') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const querystring = require('querystring');
        const params = querystring.parse(body);

        const status = params.status;
        const txnid = params.txnid;
        const amount = params.amount;
        const productinfo = params.productinfo;
        const firstname = params.firstname;
        const email = params.email;
        const receivedHash = params.hash;
        const mihpayid = params.mihpayid || '';

        const resHashString = `${PAYU_SALT}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_KEY}`;
        const calculatedHash = crypto.createHash('sha512').update(resHashString).digest('hex');

        const ordersFile = path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json');
        let orders = safeReadJson(ordersFile, []);
        if (!Array.isArray(orders)) orders = [];
        const orderIdx = orders.findIndex(o => o.txnid === txnid);
        let orderId = txnid && txnid.includes('_') ? txnid.split('_')[1] : '';
        let targetOrder = null;
        let txnDoc = null;
        if (txnid) {
          txnDoc = await nutrolixCore.firestoreGetFirstAvailable(`payuTransactions/${txnid}`);
          if (txnDoc && txnDoc.orderId) orderId = String(txnDoc.orderId);
        }
        if (orderId) {
          targetOrder = await nutrolixCore.firestoreGetFirstAvailable(`payuPendingOrders/${orderId}`);
        }
        // Backward compatibility for payments initiated before this fix.
        if (!targetOrder && orderIdx >= 0) targetOrder = orders[orderIdx];
        if (!targetOrder && orderId) {
          const legacyOrder = await nutrolixCore.firestoreGetFirstAvailable(`orders/${orderId}`);
          if (legacyOrder && legacyOrder.txnid === txnid &&
              String(legacyOrder.paymentStatus || '').toUpperCase().includes('PENDING')) {
            targetOrder = legacyOrder;
          }
        }
        const amountMatches = targetOrder &&
          Number(targetOrder.amount || targetOrder.grandTotal || targetOrder.total).toFixed(2) === Number(amount).toFixed(2);
        const verifiedSuccess = status === 'success' &&
          receivedHash === calculatedHash &&
          Boolean(txnid && orderId && targetOrder && targetOrder.txnid === txnid && amountMatches);

        if (verifiedSuccess) {
          const confirmedOrder = {
            ...(targetOrder || {}),
            id: orderId || (targetOrder && targetOrder.orderId),
            orderId: orderId || (targetOrder && targetOrder.orderId),
            txnid,
            paymentStatus: 'PAID via PayU India',
            status: 'Order Confirmed',
            payuPaymentId: mihpayid,
            statusUpdatedAt: new Date().toISOString()
          };
          delete confirmedOrder._docId;
          delete confirmedOrder._docName;

          const confirmedIdx = orders.findIndex(o => o.orderId === confirmedOrder.orderId || o.id === confirmedOrder.orderId);
          if (confirmedIdx >= 0) orders[confirmedIdx] = confirmedOrder;
          else if (confirmedOrder.orderId) orders.unshift(confirmedOrder);
          safeWriteJson(ordersFile, orders);

          if (confirmedOrder.orderId) {
            await Promise.all([
              nutrolixCore.firestorePatchBothDbs(`orders/${confirmedOrder.orderId}`, confirmedOrder),
              nutrolixCore.firestorePatchBothDbs(`payuTransactions/${txnid}`, {
                paymentStatus: 'PAID via PayU India',
                payuPaymentId: mihpayid,
                updatedAt: confirmedOrder.statusUpdatedAt
              }),
              nutrolixCore.firestoreDeleteBothDbs(`payuPendingOrders/${confirmedOrder.orderId}`),
              recordHealthyFoodRedemption(confirmedOrder)
            ]);

            try {
              const confirmedCopy = nutrolixCore.buildOrderStatusNotificationCopy(confirmedOrder.orderId, 'Order Confirmed');
              await dispatchPushToCustomer({
                uid: confirmedOrder.uid || '',
                customerPhone: customerSync.extractOrderPhone(confirmedOrder),
                customerEmail: customerSync.extractOrderEmail(confirmedOrder) || email || '',
                orderId: confirmedOrder.orderId,
                status: 'Order Confirmed',
                title: confirmedCopy.title,
                message: confirmedCopy.message,
                dedupKey: confirmedCopy.dedupKey
              });
              await dispatchPushToAdmins({
                orderId: confirmedOrder.orderId,
                total: confirmedOrder.grandTotal || Number(amount) || 0,
                customerName: confirmedOrder.customerName || firstname
              });
            } catch (_) {}
          }
          res.writeHead(302, { 'Location': `/orders.html?orderId=${encodeURIComponent(confirmedOrder.orderId || orderId)}&payment=success` });
          res.end();
        } else {
          if (orderId && txnid) {
            const failedAt = new Date().toISOString();
            await Promise.all([
              nutrolixCore.firestorePatchBothDbs(`payuTransactions/${txnid}`, {
                paymentStatus: 'PAYMENT_FAILED',
                failureReason: String(params.error_Message || params.error || 'Payment cancelled or failed').slice(0, 240),
                updatedAt: failedAt
              }),
              nutrolixCore.firestorePatchBothDbs(`payuPendingOrders/${orderId}`, {
                paymentStatus: 'PAYMENT_FAILED',
                status: 'Payment Failed',
                statusUpdatedAt: failedAt
              })
            ]);
            // Only update an old legacy pending record if it was created before
            // pending payments were moved into their own collection.
            if (orderIdx >= 0 && String(orders[orderIdx].paymentStatus || '').toUpperCase().includes('PENDING')) {
              orders[orderIdx].paymentStatus = 'PAYMENT_FAILED';
              orders[orderIdx].status = 'Payment Failed';
              orders[orderIdx].statusUpdatedAt = failedAt;
              safeWriteJson(ordersFile, orders);
              await nutrolixCore.firestorePatchBothDbs(`orders/${orderId}`, {
                paymentStatus: 'PAYMENT_FAILED',
                status: 'Payment Failed',
                statusUpdatedAt: failedAt
              });
            }
          }
          res.writeHead(302, { 'Location': `/cart.html?payment=failed&reason=${encodeURIComponent(params.error_Message || 'Payment cancelled or failed')}` });
          res.end();
        }
      } catch (err) {
        res.writeHead(302, { 'Location': '/cart.html?payment=error' });
        res.end();
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // PHASE 2 API: POST /api/upload-image (Persistent Image Upload)
  // -------------------------------------------------------------
  // PHASE 2 API: POST /api/upload-image (Persistent Image Upload)
  // -------------------------------------------------------------
  // CLOUDINARY SIGNED / SERVER UPLOAD API (DIRECT TO CLOUDINARY DASHBOARD)
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/cloudinary-upload') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Image too large (max 25MB)' }));
        req.destroy();
      }
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const fileData = payload.image || payload.file || payload.imageData || '';
        const settingsFile = path.join(PUBLIC_DIR, 'data', 'store_settings.json');
        const storeSettings = await readCatalogDocOrFallback('store_settings', settingsFile, {});

        const cloudName = payload.cloudName || storeSettings.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || 'muy6zdcd';
        const apiKey = payload.apiKey || storeSettings.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY || '';
        const apiSecret = payload.apiSecret || storeSettings.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET || '';
        const uploadPreset = payload.uploadPreset || storeSettings.cloudinaryPreset || 'ml_default';

        if (!fileData) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          return res.end(JSON.stringify({ success: false, error: 'No image provided' }));
        }

        const timestamp = Math.round(Date.now() / 1000);
        let postDataObj = {};
        if (apiKey && apiSecret) {
          const stringToSign = `folder=nutrolix_catalog&timestamp=${timestamp}${apiSecret}`;
          const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');
          postDataObj = {
            file: fileData,
            api_key: apiKey,
            timestamp: timestamp,
            signature: signature,
            folder: 'nutrolix_catalog'
          };
        } else {
          postDataObj = {
            file: fileData,
            upload_preset: uploadPreset,
            folder: 'nutrolix_catalog'
          };
        }

        const postBody = JSON.stringify(postDataObj);
        const options = {
          hostname: 'api.cloudinary.com',
          path: `/v1_1/${cloudName}/image/upload`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postBody)
          }
        };

        const cReq = https.request(options, (cRes) => {
          let cData = '';
          cRes.on('data', d => cData += d);
          cRes.on('end', () => {
            try {
              const parsed = JSON.parse(cData);
              if (parsed.secure_url) {
                res.writeHead(200, NO_STORE_JSON_HEADERS);
                res.end(JSON.stringify({ success: true, url: parsed.secure_url, public_id: parsed.public_id }));
              } else {
                res.writeHead(200, NO_STORE_JSON_HEADERS);
                res.end(JSON.stringify({ success: false, error: parsed.error?.message || 'Cloudinary upload failed', raw: parsed }));
              }
            } catch (err) {
              res.writeHead(400, NO_STORE_JSON_HEADERS);
              res.end(JSON.stringify({ success: false, error: err.message, raw: cData }));
            }
          });
        });

        cReq.on('error', (e) => {
          res.writeHead(500, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: false, error: e.message }));
        });

        cReq.write(postBody);
        cReq.end();
      } catch (err) {
        res.writeHead(500, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // DURABLE CROSS-DEVICE IMAGE UPLOAD & SERVING API (/api/upload-image + /api/media/:id)
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/upload-image') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        res.writeHead(413, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: false, error: 'Image too large (max 25MB)' }));
        req.destroy();
      }
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        let rawData = String(payload.image || payload.data || payload.imageData || '').trim();
        if (!rawData) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: false, error: 'No image payload provided' }));
          return;
        }
        let mime = 'image/jpeg';
        let ext = '.jpg';
        const dataUrlMatch = rawData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
        if (dataUrlMatch) {
          mime = dataUrlMatch[1].toLowerCase();
          rawData = dataUrlMatch[2].replace(/\s+/g, '');
          if (mime.includes('png')) ext = '.png';
          else if (mime.includes('webp')) ext = '.webp';
          else if (mime.includes('gif')) ext = '.gif';
          else if (mime.includes('svg')) ext = '.svg';
        } else {
          rawData = rawData.replace(/\s+/g, '');
        }

        const buffer = Buffer.from(rawData, 'base64');
        if (!buffer.length) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: false, error: 'Invalid base64 image data' }));
          return;
        }

        const mediaId = 'img_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
        const filename = mediaId + ext;
        const mediaDoc = {
          id: mediaId,
          mime,
          base64: rawData,
          filename,
          updatedAt: new Date().toISOString(),
          updatedAtMillis: Date.now()
        };

        mediaMemoryCache.set(mediaId, mediaDoc);

        try {
          const uploadDir = path.join(PUBLIC_DIR, 'uploads');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          fs.writeFileSync(path.join(uploadDir, filename), buffer);
        } catch (_) {
          try { fs.writeFileSync(path.join('/tmp', filename), buffer); } catch (_) {}
        }

        let firestorePersisted = false;
        try {
          const fsRes = await nutrolixCore.firestorePatchBothDbs(`mediaStore/${mediaId}`, mediaDoc);
          firestorePersisted = Boolean(fsRes && fsRes.anySuccess);
        } catch (_) {}

        const durableUrl = `/api/media/${mediaId}`;
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({
          success: true,
          id: mediaId,
          url: durableUrl,
          imageUrl: durableUrl,
          filename,
          firestorePersisted
        }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: false, error: err.message || 'Image upload failed' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && reqPath.startsWith('/api/media/')) {
    const rawId = reqPath.slice('/api/media/'.length).split('?')[0].split('/')[0];
    const mediaId = rawId.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!mediaId) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end('Not found');
      return;
    }

    let doc = mediaMemoryCache.get(mediaId) || null;
    if (!doc || !doc.base64) {
      try {
        const fsDoc = await nutrolixCore.firestoreGetFirstAvailable(`mediaStore/${mediaId}`);
        if (fsDoc && fsDoc.base64) {
          doc = fsDoc;
          mediaMemoryCache.set(mediaId, doc);
        }
      } catch (_) {}
    }

    if (doc && doc.base64) {
      const buf = Buffer.from(String(doc.base64), 'base64');
      res.writeHead(200, {
        'Content-Type': doc.mime || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Length': buf.length
      });
      res.end(buf);
      return;
    }

    // Optional disk fallback check
    for (const ext of ['.jpg', '.webp', '.png', '.gif', '']) {
      for (const baseDir of [path.join(PUBLIC_DIR, 'uploads'), '/tmp']) {
        const candidate = path.join(baseDir, mediaId + ext);
        if (fs.existsSync(candidate)) {
          const buf = fs.readFileSync(candidate);
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Content-Length': buf.length
          });
          res.end(buf);
          return;
        }
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Media not found');
    return;
  }

  // -------------------------------------------------------------
  // PHASE 2 API: HEALTHY FOOD MENU (Single Image Management)
  // -------------------------------------------------------------
  if (reqPath === '/api/food-menu' || reqPath === '/api/food-menu/') {
    const foodFile = path.join(PUBLIC_DIR, 'data', 'healthy_food_menu.json');
    if (req.method === 'GET') {
      try {
        const meals = await readCatalogDocOrFallback('healthy_food_menu', foodFile, []);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify(meals));
      } catch (e) {
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify([]));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const meal = JSON.parse(body || '{}');
          let meals = await readCatalogDocOrFallback('healthy_food_menu', foodFile, []);
          if (Array.isArray(meal)) {
            meals = meal;
          } else {
            const idx = meals.findIndex(m => m.id === meal.id);
            if (idx >= 0) {
              meals[idx] = { ...meals[idx], ...meal };
            } else {
              if (!meal.id) meal.id = 'food_' + Date.now();
              meals.unshift(meal);
            }
          }
          await writeCatalogDocAndLocal('healthy_food_menu', foodFile, meals);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, meals }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    } else if (req.method === 'DELETE') {
      try {
        const id = parsedUrl.query.id;
        let meals = await readCatalogDocOrFallback('healthy_food_menu', foodFile, []);
        if (id) meals = meals.filter(m => m.id !== id);
        await writeCatalogDocAndLocal('healthy_food_menu', foodFile, meals);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true, meals }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/food-menu/delete') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body || '{}');
        const foodFile = path.join(PUBLIC_DIR, 'data', 'healthy_food_menu.json');
        let meals = await readCatalogDocOrFallback('healthy_food_menu', foodFile, []);
        meals = meals.filter(m => m.id !== id);
        await writeCatalogDocAndLocal('healthy_food_menu', foodFile, meals);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true, meals }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // HEALTHY FOOD CATEGORIES API
  // -------------------------------------------------------------
  if (reqPath === '/api/food-categories' || reqPath === '/api/food-categories/') {
    const catFile = path.join(PUBLIC_DIR, 'data', 'healthy_food_categories.json');
    const defaults = [
      { "id": "cat_high_protein", "name": "High Protein Meals", "icon": "💪", "description": "Formulated with 35g+ bioavailable protein" },
      { "id": "cat_diet_calorie", "name": "Diet & Calorie Conscious", "icon": "🥗", "description": "Under 400 kcal nutrition-dense clean meals" },
      { "id": "cat_detox_juices", "name": "Detox Juices & Smoothies", "icon": "🥤", "description": "Cold-pressed, no added sugar, botanical blends" },
      { "id": "cat_salads_bowls", "name": "Salads & Bowls", "icon": "🥑", "description": "Sprouted ancient grains & superfood matrix" },
      { "id": "cat_millet_khichdi", "name": "Millet Innovations & Porridge", "icon": "🌾", "description": "Gut-healing ancient millets & A2 ghee" }
    ];
    if (req.method === 'GET') {
      try {
        const cats = await readCatalogDocOrFallback('healthy_food_categories', catFile, defaults);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify(cats));
      } catch (e) {
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify(defaults));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          let cats = await readCatalogDocOrFallback('healthy_food_categories', catFile, defaults);

          if (Array.isArray(payload)) {
            cats = payload;
          } else if (payload.action === 'delete') {
            cats = cats.filter(c => c.id !== payload.id && c.name !== payload.name);
          } else {
            const idx = cats.findIndex(c => c.id === payload.id || (payload.name && c.name === payload.name));
            if (idx >= 0) {
              cats[idx] = { ...cats[idx], ...payload };
            } else {
              if (!payload.id) payload.id = 'cat_' + Date.now();
              cats.push(payload);
            }
          }
          await writeCatalogDocAndLocal('healthy_food_categories', catFile, cats);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, categories: cats }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/food-categories/delete') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id, name } = JSON.parse(body || '{}');
        const catFile = path.join(PUBLIC_DIR, 'data', 'healthy_food_categories.json');
        let cats = await readCatalogDocOrFallback('healthy_food_categories', catFile, []);
        cats = cats.filter(c => c.id !== id && (!name || c.name !== name));
        await writeCatalogDocAndLocal('healthy_food_categories', catFile, cats);
        res.writeHead(200, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ success: true, categories: cats }));
      } catch (err) {
        res.writeHead(400, NO_STORE_JSON_HEADERS);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // PHASE 2 API: ADMIN AUTHENTICATION & SECURE ONE-TIME CUSTOMER DATA PURGE
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/admin/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { email, password, pin } = JSON.parse(body || '{}');
        const portalPin = String(process.env.ADMIN_PORTAL_PIN || '9090').trim();
        const submittedPin = String(pin || password || '').trim();
        const cleanEmail = (email || '').toLowerCase().trim() || 'nutrolix.in@gmail.com';
        const isAuth = submittedPin === portalPin;
        if (isAuth) {
          const token = nutrolixCore.signAdminSessionToken(cleanEmail);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            success: true,
            token,
            user: { email: cleanEmail, role: 'ADMIN', name: 'Nutrolix Administrator' }
          }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Invalid 4-digit Admin PIN.' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && reqPath === '/api/admin/customer-data/purge') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const headerAdminToken = req.headers['x-nutrolix-admin-token'] || '';
        const authHeader = req.headers['authorization'] || '';
        let authorizedAdmin = nutrolixCore.verifyAdminSessionToken(headerAdminToken || authHeader);

        if (!authorizedAdmin && authHeader) {
          const decodedUser = await nutrolixCore.verifyFirebaseIdToken(authHeader, __dirname);
          if (decodedUser && decodedUser.uid) {
            if (decodedUser.email === 'nutrolix.in@gmail.com') {
              authorizedAdmin = { email: decodedUser.email, role: 'ADMIN' };
            } else {
              const adminDoc = await nutrolixCore.firestoreGetFirstAvailable(`admins/${decodedUser.uid}`);
              if (adminDoc && (adminDoc.role === 'admin' || adminDoc.isAdmin === true)) {
                authorizedAdmin = { email: decodedUser.email || decodedUser.uid, role: 'ADMIN' };
              }
            }
          }
        }

        if (!authorizedAdmin) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            success: false,
            error: 'Admin authorization required. Authenticate via /api/admin/login or Firebase Admin account.'
          }));
          return;
        }

        let payload = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch (_) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload.' }));
          return;
        }

        const dryRun = payload.dryRun !== false;
        const confirmPhrase = String(payload.confirmPhrase || '').trim();
        const deleteLocalFiles = Boolean(payload.deleteLocalFiles);

        const summary = await nutrolixPurge.purgeCustomerData({
          dryRun,
          confirmPhrase,
          deleteLocalFiles,
          rootDir: __dirname
        });

        if (!dryRun) {
          safeWriteJson(path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json'), []);
          safeWriteJson(path.join(PUBLIC_DIR, 'data', 'users.json'), []);
          safeWriteJson(path.join(PUBLIC_DIR, 'data', 'notification_tokens.json'), []);
          safeWriteJson(path.join(PUBLIC_DIR, 'data', 'notifications_log.json'), []);
          safeWriteJson(path.join(PUBLIC_DIR, 'data', 'customer_discounts.json'), {});
          safeWriteJson(path.join(PUBLIC_DIR, 'data', 'system_reset.json'), {
            resetEpoch: summary.resetEpoch || Date.now(),
            updatedAt: summary.timestamp
          });
        }

        // Write non-PII summary audit record
        const auditId = 'audit_purge_' + Date.now();
        const auditRecord = {
          id: auditId,
          action: 'CUSTOMER_DATA_PURGE',
          mode: summary.mode,
          actor: authorizedAdmin.email || 'admin',
          totals: summary.totals,
          timestamp: summary.timestamp
        };
        try {
          const auditFile = path.join(PUBLIC_DIR, 'data', 'audit_logs.json');
          const logs = safeReadJson(auditFile, []);
          logs.unshift(auditRecord);
          safeWriteJson(auditFile, logs.slice(0, 100));
          await nutrolixCore.firestorePatchBothDbs(`auditLogs/${auditId}`, {
            ...auditRecord,
            totalsJson: JSON.stringify(summary.totals)
          });
        } catch (_) {}

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify({ success: true, ...summary }));
      } catch (err) {
        const code = err.statusCode || 500;
        res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, code: err.code || 'PURGE_ERROR', error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && reqPath === '/api/system/reset-state') {
    let resetEpoch = 0;
    try {
      const localReset = safeReadJson(path.join(PUBLIC_DIR, 'data', 'system_reset.json'), {});
      resetEpoch = Number(localReset && localReset.resetEpoch) || 0;
    } catch (_) {}
    try {
      const fsReset = await nutrolixCore.firestoreGetFirstAvailable('settings/systemReset');
      const fsEpoch = Number(fsReset && fsReset.resetEpoch) || 0;
      if (fsEpoch > resetEpoch) resetEpoch = fsEpoch;
    } catch (_) {}
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ success: true, resetEpoch }));
    return;
  }

  // -------------------------------------------------------------
  // CANONICAL CUSTOMER IDENTITY SYNC ENDPOINT
  // -------------------------------------------------------------
  if (req.method === 'POST' && reqPath === '/api/auth/sync-canonical') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const authHeader = req.headers['authorization'] || '';
        const verifiedUser = await nutrolixCore.verifyFirebaseIdToken(authHeader, __dirname);
        if (!verifiedUser || !verifiedUser.uid) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Valid Firebase ID token is required.' }));
          return;
        }

        let payload = {};
        try { payload = JSON.parse(body || '{}'); } catch (_) {}

        const tokenUid = String(verifiedUser.uid);
        const tokenPhone = normalizePhone(verifiedUser.phoneNumber || (tokenUid.startsWith('phone_') ? tokenUid.slice(6) : ''));
        const bodyPhone = normalizePhone(payload.phone || '');

        if (!nutrolixCore.isValidIndianMobile(tokenPhone)) {
          res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Verified 10-digit mobile identity is required in Firebase token.' }));
          return;
        }

        if (bodyPhone && bodyPhone !== tokenPhone) {
          res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Identity mismatch.' }));
          return;
        }

        const canonicalUid = nutrolixCore.canonicalCustomerUid(tokenPhone);
        const extraProfile = payload.profile && typeof payload.profile === 'object' ? payload.profile : {};
        const merged = await customerSync.mergeLegacyCustomerAccount({
          canonicalUid,
          phone: tokenPhone,
          extraProfile,
          allowProfileOverride: Boolean(payload.allowProfileOverride)
        });

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: true,
          uid: canonicalUid,
          profile: merged.profile,
          addresses: merged.addresses,
          migrationSummary: {
            migratedUids: merged.migratedUids,
            migratedOrdersCount: merged.migratedOrdersCount,
            migratedAddressesCount: merged.migratedAddressesCount
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // FAST2SMS SMART OTP: WhatsApp-first authentication
  // Secrets must exist only in server environment variables.
  // Required: FAST2SMS_API_KEY, FAST2SMS_OTP_ID, FIREBASE_SERVICE_ACCOUNT_JSON
  // -------------------------------------------------------------
  if (reqPath === '/api/auth/whatsapp/send-otp' || reqPath === '/api/auth/whatsapp/verify-otp') {
    const isVerify = reqPath.endsWith('/verify-otp');
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'POST' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed.' }));
      return;
    }
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > 8192) req.destroy();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData || '{}');
        const mobile = normalizePhone(payload.mobile || payload.phone || '');
        if (mobile.length !== 10 || !/^[6-9]\d{9}$/.test(mobile)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Enter a valid 10-digit Indian mobile number.' }));
          return;
        }
        // Google Play reviewer-only test access. This is isolated from normal customer WhatsApp OTP.
        // Configure both values as encrypted production environment variables; never hardcode credentials.
        const reviewerPhone = normalizePhone(process.env.NUTROLIX_REVIEWER_PHONE || '');
        const reviewerOtp = String(process.env.NUTROLIX_REVIEWER_OTP || '').replace(/\D/g, '').slice(0, 10);
        if (reviewerPhone && reviewerOtp && mobile === reviewerPhone) {
          if (!isVerify) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true, sent: true, channel: 'reviewer-test',
              message: 'Reviewer test code is available in the Play Console review instructions.',
              requestId: 'reviewer-test'
            }));
            return;
          }

          const submittedOtp = String(payload.otp || '').replace(/\D/g, '').slice(0, 10);
          const expected = Buffer.from(reviewerOtp);
          const submitted = Buffer.from(submittedOtp);
          const validOtp = submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected);
          if (!validOtp) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Incorrect or expired reviewer test code.' }));
            return;
          }

          const sa = nutrolixCore.parseServiceAccountFromEnv();
          if (!sa) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, code: 'FIREBASE_ADMIN_NOT_CONFIGURED', error: 'Firebase server authentication is not configured.' }));
            return;
          }
          const firebaseApiKey = nutrolixCore.getFirebaseWebApiKey(__dirname);
          if (!firebaseApiKey) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Firebase client configuration is missing.' }));
            return;
          }
          const uid = 'phone_' + mobile;
          const now = Math.floor(Date.now() / 1000);
          const b64 = value => Buffer.from(value).toString('base64url');
          const unsigned = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
            iss: sa.client_email, sub: sa.client_email,
            aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
            iat: now, exp: now + 3600, uid
          }));
          const signer = crypto.createSign('RSA-SHA256');
          signer.update(unsigned);
          const customToken = unsigned + '.' + signer.sign(sa.private_key.replace(/\\n/g, '\n'), 'base64url');
          await new Promise((resolve, reject) => {
            const data = JSON.stringify({ token: customToken, returnSecureToken: true });
            const request = https.request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + encodeURIComponent(firebaseApiKey), {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 15000
            }, response => {
              let raw = '';
              response.on('data', chunk => raw += chunk);
              response.on('end', () => {
                let parsed = {};
                try { parsed = JSON.parse(raw || '{}'); } catch (_) {}
                if (response.statusCode >= 200 && response.statusCode < 300 && parsed.idToken) resolve(parsed);
                else reject(new Error(parsed.error && parsed.error.message ? parsed.error.message : 'Firebase sign-in failed.'));
              });
            });
            request.on('timeout', () => request.destroy(new Error('Firebase sign-in timed out.')));
            request.on('error', reject);
            request.write(data); request.end();
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true, verified: true, customToken, uid,
            profile: {
              uid, id: uid, name: 'Google Play Reviewer', phone: mobile,
              verifiedPhone: mobile, whatsappNumber: mobile, phoneVerified: true,
              verified: true, authProvider: 'phone', providers: ['phone'],
              googleLinked: false, reviewerTestAccount: true
            },
            addresses: []
          }));
          return;
        }

        const apiKey = String(process.env.FAST2SMS_API_KEY || '').trim();
        const otpId = String(process.env.FAST2SMS_OTP_ID || '').trim();
        if (!apiKey || !otpId) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, code: 'FAST2SMS_NOT_CONFIGURED', error: 'WhatsApp OTP service is not configured yet.' }));
          return;
        }
        const endpoint = isVerify ? 'https://www.fast2sms.com/dev/otp/verify' : 'https://www.fast2sms.com/dev/otp/send';
        const requestBody = isVerify ? { mobile, otp: String(payload.otp || '').replace(/\D/g, '').slice(0, 10) } : { otp_id: otpId, mobile };
        if (isVerify && (requestBody.otp.length < 4 || requestBody.otp.length > 10)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Enter the OTP received on WhatsApp.' }));
          return;
        }
        const providerResponse = await new Promise((resolve, reject) => {
          const request = https.request(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': apiKey,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
            },
            timeout: 15000
          }, response => {
            let raw = '';
            response.on('data', chunk => raw += chunk);
            response.on('end', () => {
              try { resolve({ status: response.statusCode || 502, data: JSON.parse(raw || '{}') }); }
              catch (_) { reject(new Error('Fast2SMS returned an invalid response.')); }
            });
          });
          request.on('timeout', () => request.destroy(new Error('Fast2SMS request timed out.')));
          request.on('error', reject);
          request.write(JSON.stringify(requestBody));
          request.end();
        });
        const providerOk = providerResponse.data && providerResponse.data.return === true;
        if (!providerOk) {
          const status = providerResponse.status >= 400 ? providerResponse.status : 400;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            code: 'FAST2SMS_REJECTED',
            error: providerResponse.data.message || providerResponse.data.error || (isVerify ? 'Incorrect or expired OTP.' : 'Unable to send WhatsApp OTP.'),
            providerStatus: providerResponse.data.status_code || providerResponse.status
          }));
          return;
        }
        if (!isVerify) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, sent: true, channel: 'whatsapp', message: 'OTP sent successfully on WhatsApp.', requestId: providerResponse.data.request_id || '' }));
          return;
        }

        const sa = nutrolixCore.parseServiceAccountFromEnv();
        if (!sa) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, code: 'FIREBASE_ADMIN_NOT_CONFIGURED', error: 'Firebase server authentication is not configured.' }));
          return;
        }
        const firebaseApiKey = nutrolixCore.getFirebaseWebApiKey(__dirname);
        if (!firebaseApiKey) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Firebase client configuration is missing.' }));
          return;
        }
        const uid = 'phone_' + mobile;
        const now = Math.floor(Date.now() / 1000);
        const b64 = value => Buffer.from(value).toString('base64url');
        const unsigned = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
          iss: sa.client_email, sub: sa.client_email,
          aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
          iat: now, exp: now + 3600, uid
        }));
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsigned);
        const customToken = unsigned + '.' + signer.sign(sa.private_key.replace(/\\n/g, '\n'), 'base64url');
        await new Promise((resolve, reject) => {
          const data = JSON.stringify({ token: customToken, returnSecureToken: true });
          const request = https.request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + encodeURIComponent(firebaseApiKey), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 15000
          }, response => {
            let raw = '';
            response.on('data', chunk => raw += chunk);
            response.on('end', () => {
              let parsed = {};
              try { parsed = JSON.parse(raw || '{}'); } catch (_) {}
              if (response.statusCode >= 200 && response.statusCode < 300 && parsed.idToken) resolve(parsed);
              else reject(new Error(parsed.error && parsed.error.message ? parsed.error.message : 'Firebase custom sign-in failed.'));
            });
          });
          request.on('timeout', () => request.destroy(new Error('Firebase sign-in timed out.')));
          request.on('error', reject);
          request.write(data); request.end();
        });

        // Merge & fetch existing canonical profile + addresses so returning users immediately get their real profile on every device
        const merged = await customerSync.mergeLegacyCustomerAccount({
          canonicalUid: uid,
          phone: mobile
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          verified: true,
          customToken,
          uid,
          profile: merged.profile || {
            uid, id: uid, name: 'Nutrolix Customer', phone: mobile, verifiedPhone: mobile, whatsappNumber: mobile,
            phoneVerified: true, verified: true, authProvider: 'phone', providers: ['phone'], googleLinked: false
          },
          addresses: merged.addresses || []
        }));
      } catch (error) {
        console.error('Fast2SMS WhatsApp OTP error:', error.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message || 'OTP service temporarily unavailable.' }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // PHASE 2 API: PUSH NOTIFICATIONS (RFC 8291 Web Push & FCM)
  // -------------------------------------------------------------
  if (reqPath === '/api/notifications/config-status' && req.method === 'GET') {
    const sa = nutrolixCore.parseServiceAccountFromEnv();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      hasFirebaseServiceAccount: Boolean(sa),
      hasVapidPublicKey: Boolean(VAPID_PUBLIC_KEY),
      hasVapidPrivateKey: Boolean(VAPID_PRIVATE_KEY),
      hasVapidEnvOverrides: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      hasFast2Sms: Boolean(String(process.env.FAST2SMS_API_KEY || '').trim() && String(process.env.FAST2SMS_OTP_ID || '').trim()),
      webPushLibraryAvailable: Boolean(webpush)
    }));
    return;
  }

  if (reqPath === '/api/notifications/vapid-key' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }));
    return;
  }

  if (reqPath === '/api/notifications/register-token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let sub = null;
        try {
          sub = JSON.parse(body || '');
        } catch (_) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON request body.' }));
          return;
        }

        const authHeader = req.headers['authorization'] || '';
        let verifiedTokenUser = null;
        if (authHeader && authHeader.trim().toLowerCase().startsWith('bearer ')) {
          verifiedTokenUser = await nutrolixCore.verifyFirebaseIdToken(authHeader, __dirname);
          if (!verifiedTokenUser || !verifiedTokenUser.uid) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, error: 'Invalid Firebase Authorization token.' }));
            return;
          }
        }

        const fcmToken = String(sub.fcmToken || ((!sub.subscription || !sub.subscription.endpoint) && sub.token && !String(sub.token).startsWith('http') ? sub.token : '')).trim();
        const subscriptionObj = (sub.subscription && sub.subscription.endpoint)
          ? sub.subscription
          : (sub.endpoint && sub.keys ? { endpoint: sub.endpoint, keys: sub.keys } : null);
        const endpoint = String((subscriptionObj && subscriptionObj.endpoint) || sub.endpoint || fcmToken || sub.token || '').trim();

        if (!endpoint || endpoint.includes('verify_dummy_') || (fcmToken && fcmToken.length < 16)) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'A valid FCM token or Web Push subscription endpoint is required.' }));
          return;
        }

        const tokenUid = verifiedTokenUser ? String(verifiedTokenUser.uid) : '';
        const tokenPhone = verifiedTokenUser
          ? normalizePhone(verifiedTokenUser.phoneNumber || (tokenUid.startsWith('phone_') ? tokenUid.slice(6) : ''))
          : '';
        const bodyPhone = normalizePhone(sub.customerPhone || sub.phone || '');
        const customerPhone = tokenPhone || bodyPhone;
        const bodyUid = String(sub.uid || '').trim();
        if (bodyUid === 'verify_uid_001' || (verifiedTokenUser && bodyPhone && tokenPhone && bodyPhone !== tokenPhone)) {
          res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Token registration identity rejected.' }));
          return;
        }

        const resolvedUid = nutrolixCore.canonicalCustomerUid(customerPhone) || tokenUid || bodyUid;
        const customerEmail = normalizeEmail(sub.customerEmail || sub.email || (verifiedTokenUser && verifiedTokenUser.email) || '');
        const platform = String(sub.platform || 'web').trim().slice(0, 40);
        const deviceId = String(sub.deviceId || '').trim().slice(0, 128);
        const role = String(sub.role || (platform.includes('admin') ? 'admin' : 'customer')).trim().toLowerCase();

        const tokenFile = path.join(PUBLIC_DIR, 'data', 'notification_tokens.json');
        let tokens = safeReadJson(tokenFile, []);
        if (!Array.isArray(tokens)) tokens = [];
        tokens = tokens.filter(t => t && t.uid !== 'verify_uid_001' && !String(t.fcmToken || t.token || '').includes('verify_dummy_'));

        if (deviceId) {
          tokens = tokens.filter(t => !(t.deviceId === deviceId && t.platform === platform && ((t.subscription && t.subscription.endpoint) || t.endpoint || t.fcmToken || t.token) !== endpoint));
        }

        const existingIdx = tokens.findIndex(t => {
          const tEndpoint = (t.subscription && t.subscription.endpoint) || t.endpoint || t.fcmToken || t.token;
          return tEndpoint === endpoint;
        });

        const nowIso = new Date().toISOString();
        const newEntry = {
          uid: resolvedUid,
          role,
          fcmToken,
          token: fcmToken || endpoint,
          subscription: subscriptionObj,
          endpoint,
          customerPhone,
          customerEmail,
          platform,
          deviceId,
          registeredAt: nowIso,
          updatedAt: nowIso,
          updatedAtMillis: Date.now()
        };

        if (existingIdx >= 0) tokens[existingIdx] = { ...tokens[existingIdx], ...newEntry };
        else tokens.push(newEntry);
        safeWriteJson(tokenFile, tokens);

        let firestorePersisted = false;
        const tokenDocId = makeTokenDocId(endpoint);
        const firestoreTokenObj = {
          uid: resolvedUid,
          role,
          token: fcmToken || endpoint,
          fcmToken: fcmToken || '',
          endpoint,
          subscriptionJson: subscriptionObj ? JSON.stringify(subscriptionObj) : '',
          platform,
          ...(deviceId ? { deviceId } : {}),
          customerPhone,
          customerEmail,
          updatedAt: nowIso,
          updatedAtMillis: Date.now()
        };

        try {
          const writes = [
            nutrolixCore.firestorePatchBothDbs(`notificationTokens/${tokenDocId}`, firestoreTokenObj)
          ];
          if (fcmToken) {
            writes.push(nutrolixCore.firestorePatchBothDbs(`fcmTokens/${tokenDocId}`, firestoreTokenObj));
          }
          if (role === 'admin') {
            writes.push(nutrolixCore.firestorePatchBothDbs(`adminTokens/${tokenDocId}`, firestoreTokenObj));
          } else if (resolvedUid) {
            // Keep every customer endpoint, including Web Push-only subscriptions,
            // in the canonical user's subcollection for fast, reliable order delivery.
            writes.push(nutrolixCore.firestorePatchBothDbs(`users/${resolvedUid}/fcmTokens/${tokenDocId}`, firestoreTokenObj));
          }
          const results = await Promise.all(writes);
          firestorePersisted = results.some(r => r && r.anySuccess);
        } catch (_) {}

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: true,
          registered: true,
          uid: resolvedUid,
          role,
          deviceId,
          firestorePersisted,
          storage: firestorePersisted ? 'firestore' : 'local_only'
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/notifications/unregister' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const sub = JSON.parse(body || '{}');
        const endpoint = String((sub.subscription && sub.subscription.endpoint) || sub.endpoint || sub.fcmToken || sub.token || '').trim();
        const customerPhone = normalizePhone(sub.customerPhone || sub.phone || '');
        const resolvedUid = nutrolixCore.canonicalCustomerUid(customerPhone) || String(sub.uid || '').trim();
        if (!endpoint) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Token or endpoint required to unregister.' }));
          return;
        }
        const docId = makeTokenDocId(endpoint);
        const userDocPaths = resolvedUid
          ? nutrolixCore.BOTH_DB_IDS.map((dbId) => ({ path: `users/${resolvedUid}/fcmTokens/${docId}`, dbId }))
          : [];
        await pruneDeadNotificationTargets([endpoint], [endpoint], userDocPaths);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, unregistered: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/notifications/user-history' && req.method === 'GET') {
    const logFile = path.join(PUBLIC_DIR, 'data', 'notifications_log.json');
    try {
      const qUid = String(parsedUrl.query.uid || '').trim();
      const phone = normalizePhone(parsedUrl.query.phone || '') || (qUid.startsWith('phone_') ? normalizePhone(qUid.slice(6)) : '');
      const uid = nutrolixCore.canonicalCustomerUid(phone) || qUid;
      const email = normalizeEmail(parsedUrl.query.email || '');

      if (!uid && !phone && !email) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, notifications: [], unreadCount: 0 }));
        return;
      }

      const byNotifId = new Map();
      const localLogs = safeReadJson(logFile, []);
      for (const l of Array.isArray(localLogs) ? localLogs : []) {
        const lUid = String(l.uid || '').trim();
        const lPhone = normalizePhone(l.customerPhone || l.phone || l.target);
        const lEmail = normalizeEmail(l.customerEmail || l.email);
        if ((uid && lUid && lUid === uid) || (phone && lPhone && lPhone === phone) || (email && lEmail && lEmail === email)) {
          const nid = String(l.id || l.dedupKey || '');
          if (nid) byNotifId.set(nid, l);
        }
      }

      if (uid) {
        try {
          const [defNotifs, namedNotifs] = await Promise.all([
            nutrolixCore.firestoreListAllDocuments(`users/${uid}/notifications`, nutrolixCore.DEFAULT_DB_ID, 100),
            nutrolixCore.firestoreListAllDocuments(`users/${uid}/notifications`, nutrolixCore.NAMED_DB_ID, 100)
          ]);
          for (const doc of [...defNotifs.docs, ...namedNotifs.docs]) {
            const nid = String(doc.id || doc._docId || doc.dedupKey || '');
            if (!nid) continue;
            const cleanDoc = { ...doc, id: nid };
            delete cleanDoc._docId;
            delete cleanDoc._docName;
            byNotifId.set(nid, { ...(byNotifId.get(nid) || {}), ...cleanDoc });
          }
        } catch (_) {}
      }

      const mergedList = Array.from(byNotifId.values()).sort((a, b) => {
        const ta = Date.parse(a.timestamp || 0) || 0;
        const tb = Date.parse(b.timestamp || 0) || 0;
        return tb - ta;
      });

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: true,
        notifications: mergedList.slice(0, 60),
        unreadCount: mergedList.filter(n => !n.read).length
      }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, notifications: [], unreadCount: 0 }));
    }
    return;
  }

  if (reqPath === '/api/notifications/mark-read' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id, notifId, uid, phone, email, markAll } = JSON.parse(body || '{}');
        const targetId = id || notifId;
        const logFile = path.join(PUBLIC_DIR, 'data', 'notifications_log.json');
        const logs = safeReadJson(logFile, []);
        const cleanPhone = normalizePhone(phone || '');
        const resolvedUid = nutrolixCore.canonicalCustomerUid(cleanPhone) || String(uid || '').trim();
        const cleanEmail = normalizeEmail(email || '');
        let updated = 0;

        for (const l of logs) {
          const matchesId = targetId && (l.id === targetId || l.dedupKey === targetId);
          const matchesOwner = markAll && (
            (resolvedUid && l.uid === resolvedUid) ||
            (cleanPhone && normalizePhone(l.customerPhone || l.phone) === cleanPhone) ||
            (cleanEmail && normalizeEmail(l.customerEmail || l.email) === cleanEmail)
          );
          if (matchesId || matchesOwner) {
            l.read = true;
            updated++;
          }
        }
        if (updated > 0) safeWriteJson(logFile, logs);

        if (resolvedUid) {
          if (targetId) {
            await nutrolixCore.firestorePatchBothDbs(`users/${resolvedUid}/notifications/${targetId}`, { read: true });
          } else if (markAll) {
            const fsNotifs = await nutrolixCore.firestoreListDocuments(`users/${resolvedUid}/notifications`, nutrolixCore.DEFAULT_DB_ID);
            await Promise.all(
              fsNotifs
                .filter((n) => !n.read && (n._docId || n.id))
                .map((n) => nutrolixCore.firestorePatchBothDbs(`users/${resolvedUid}/notifications/${n._docId || n.id}`, { read: true }))
            );
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, updated }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/notifications/history') {
    const logFile = path.join(PUBLIC_DIR, 'data', 'notifications_log.json');
    if (req.method === 'GET') {
      try {
        const logs = await readCatalogDocOrFallback('notifications_history', logFile, []);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(logs));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify([]));
      }
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/notifications/broadcast') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const notif = JSON.parse(body || '{}');
        const logFile = path.join(PUBLIC_DIR, 'data', 'notifications_log.json');
        const tokenFile = path.join(PUBLIC_DIR, 'data', 'notification_tokens.json');
        let logs = await readCatalogDocOrFallback('notifications_history', logFile, []);
        if (!Array.isArray(logs)) logs = [];
        let tokens = safeReadJson(tokenFile, []);
        if (!Array.isArray(tokens)) tokens = [];

        // Load durable Web Push + FCM registrations across both Firestore DBs
        try {
          const [ntDef, ntNamed, fcmDef, fcmNamed] = await Promise.all([
            nutrolixCore.firestoreListAllDocuments('notificationTokens', nutrolixCore.DEFAULT_DB_ID, 1000),
            nutrolixCore.firestoreListAllDocuments('notificationTokens', nutrolixCore.NAMED_DB_ID, 1000),
            nutrolixCore.firestoreListAllDocuments('fcmTokens', nutrolixCore.DEFAULT_DB_ID, 1000),
            nutrolixCore.firestoreListAllDocuments('fcmTokens', nutrolixCore.NAMED_DB_ID, 1000)
          ]);
          const durableTokens = [...ntDef.docs, ...ntNamed.docs, ...fcmDef.docs, ...fcmNamed.docs]
            .filter(doc => doc && (doc.fcmToken || doc.token || doc.endpoint || doc.subscriptionJson))
            .map(doc => {
              let parsedSub = doc.subscription || null;
              if (!parsedSub && doc.subscriptionJson) {
                try { parsedSub = JSON.parse(doc.subscriptionJson); } catch (_) {}
              }
              return {
                ...doc,
                subscription: parsedSub,
                fcmToken: doc.fcmToken || (!String(doc.token || '').startsWith('http') ? doc.token : ''),
                token: doc.fcmToken || doc.token || doc.endpoint
              };
            });
          const byToken = new Map();
          [...tokens, ...durableTokens].forEach(rec => {
            const key = rec.fcmToken || (rec.subscription && rec.subscription.endpoint) || rec.endpoint || rec.token;
            if (key) byToken.set(key, { ...(byToken.get(key) || {}), ...rec });
          });
          tokens = Array.from(byToken.values());
        } catch (_) {}

        const title = notif.title || 'Nutrolix Announcement';
        const message = notif.message || notif.body || '';
        const targetUrl = notif.url || '/orders.html';

        let deliveredCount = 0;
        let acceptedCount = 0;
        let failedCount = 0;
        const deadEndpoints = [];
        const deadFcmTokens = [];
        const seenDestinations = new Set();

        for (const tokenRec of tokens) {
          if (tokenRec.role === 'admin') continue;
          const fcmTok = tokenRec.fcmToken || ((!tokenRec.subscription || !tokenRec.subscription.endpoint) && tokenRec.token && !String(tokenRec.token).startsWith('http') ? tokenRec.token : '');
          if (fcmTok && !seenDestinations.has(fcmTok)) {
            seenDestinations.add(fcmTok);
            try {
              const fcmRes = await nutrolixCore.sendFcmV1Message(fcmTok, {
                title,
                body: message,
                orderId: notif.orderId || '',
                url: targetUrl,
                channelId: 'nutrolix_orders_channel_v3',
                data: { type: notif.type || 'PROMOTIONAL' }
              });
              if (fcmRes.sent) deliveredCount++;
              else failedCount++;
              if (fcmRes.permanentFailure) deadFcmTokens.push(fcmTok);
            } catch (_) {
              failedCount++;
            }
          }
          const subEp = tokenRec.subscription && tokenRec.subscription.endpoint;
          if (webpush && subEp && !seenDestinations.has(subEp)) {
            seenDestinations.add(subEp);
            try {
              await webpush.sendNotification(
                tokenRec.subscription,
                JSON.stringify({ title, body: message, orderId: notif.orderId || '', url: targetUrl }),
                { TTL: 86400, urgency: 'high' }
              );
              acceptedCount++;
            } catch (err) {
              failedCount++;
              if (err.statusCode === 410 || err.statusCode === 404) {
                deadEndpoints.push(subEp);
              }
            }
          }
        }

        await pruneDeadNotificationTargets(deadEndpoints, deadFcmTokens, []);

        const entry = {
          id: 'notif_' + Date.now(),
          title,
          message,
          target: notif.target || 'ALL_CUSTOMERS',
          type: notif.type || 'PROMOTIONAL',
          orderId: notif.orderId || null,
          url: targetUrl,
          timestamp: new Date().toISOString(),
          status: 'SENT',
          targetedCount: seenDestinations.size,
          deliveredCount,
          acceptedCount,
          failedCount
        };
        logs.unshift(entry);
        await writeCatalogDocAndLocal('notifications_history', logFile, logs.slice(0, 250));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: true,
          notification: entry,
          targetedCount: seenDestinations.size,
          deliveredCount,
          acceptedCount,
          failedCount,
          prunedCount: deadEndpoints.length + deadFcmTokens.length
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // PHASE 2 API: DURABLE FIRESTORE-BACKED PRODUCT REVIEWS
  // -------------------------------------------------------------
  async function loadAllMergedReviews() {
    const reviewsFile = path.join(PUBLIC_DIR, 'data', 'product_reviews.json');
    const [catalogReviews, defCol, namedCol] = await Promise.all([
      readCatalogDocOrFallback('product_reviews', reviewsFile, []),
      nutrolixCore.firestoreListAllDocuments('productReviews', nutrolixCore.DEFAULT_DB_ID, 500).catch(() => ({ docs: [] })),
      nutrolixCore.firestoreListAllDocuments('productReviews', nutrolixCore.NAMED_DB_ID, 500).catch(() => ({ docs: [] }))
    ]);
    const localRevs = safeReadJson(reviewsFile, []);
    const mergedMap = new Map();

    const addRev = (raw) => {
      if (!raw || typeof raw !== 'object') return;
      const rid = String(raw.id || raw._docId || '').trim();
      if (!rid) return;
      const prev = mergedMap.get(rid) || {};
      mergedMap.set(rid, { ...prev, ...raw, id: rid });
    };

    (Array.isArray(localRevs) ? localRevs : []).forEach(addRev);
    (Array.isArray(catalogReviews) ? catalogReviews : []).forEach(addRev);
    [...(defCol.docs || []), ...(namedCol.docs || [])].forEach(addRev);

    return Array.from(mergedMap.values()).sort((a, b) => {
      const ta = Number(a.createdAtMillis || Date.parse(a.createdAt || 0) || 0);
      const tb = Number(b.createdAtMillis || Date.parse(b.createdAt || 0) || 0);
      return tb - ta;
    });
  }

  function reviewMatchesProductQuery(rev, qProductId, qProductName) {
    if (!qProductId && !qProductName) return true;
    const pidTarget = String(qProductId || '').trim().toLowerCase();
    const pnameTarget = String(qProductName || '').trim().toLowerCase();

    const revIds = [
      rev.productId,
      ...(Array.isArray(rev.productIds) ? rev.productIds : [])
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    const revNames = [
      rev.productName,
      ...(Array.isArray(rev.productNames) ? rev.productNames : [])
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    if (pidTarget && revIds.some(id => id === pidTarget || id.includes(pidTarget) || pidTarget.includes(id))) {
      return true;
    }
    if (pnameTarget && revNames.some(nm => nm === pnameTarget || nm.includes(pnameTarget) || pnameTarget.includes(nm))) {
      return true;
    }
    return false;
  }

  if (reqPath === '/api/product-reviews' || reqPath === '/api/product-reviews/') {
    const reviewsFile = path.join(PUBLIC_DIR, 'data', 'product_reviews.json');
    if (req.method === 'GET') {
      try {
        const reqUrl = new URL(req.url, 'http://localhost');
        const qProductId = reqUrl.searchParams.get('productId') || '';
        const qProductName = reqUrl.searchParams.get('productName') || '';
        const qOrderId = reqUrl.searchParams.get('orderId') || '';
        const includeHidden = reqUrl.searchParams.get('includeHidden') === '1';

        let revs = await loadAllMergedReviews();
        if (!includeHidden) {
          revs = revs.filter(r => r.approved !== false);
        }
        if (qOrderId) {
          const targetOrd = String(qOrderId).trim();
          revs = revs.filter(r => String(r.orderId || '').trim() === targetOrd);
        }
        if (qProductId || qProductName) {
          revs = revs.filter(r => reviewMatchesProductQuery(r, qProductId, qProductName));
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(revs));
      } catch (e) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify([]));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const rawRev = JSON.parse(body || '{}');
          const cleanRating = Math.min(5, Math.max(1, Number(rawRev.rating || 5) || 5));
          const nowIso = new Date().toISOString();
          const nowMs = Date.now();
          const orderIdClean = String(rawRev.orderId || '').trim();

          const existing = await loadAllMergedReviews();
          const existingForOrder = orderIdClean
            ? existing.filter(r => r && String(r.orderId || '').trim() === orderIdClean)
            : [];
          const primaryExisting = existingForOrder[0] || existing.find(r => rawRev.id && r && r.id === rawRev.id) || null;
          const isEdit = Boolean(primaryExisting);

          const revId = primaryExisting
            ? String(primaryExisting.id)
            : (orderIdClean
              ? ('rev_ord_' + orderIdClean.replace(/[^a-zA-Z0-9_-]/g, '_'))
              : String(rawRev.id || ('rev_' + nowMs + '_' + crypto.randomBytes(2).toString('hex'))).trim());

          const rev = {
            id: revId,
            orderId: orderIdClean,
            productId: String(rawRev.productId || (primaryExisting && primaryExisting.productId) || '').trim(),
            productIds: Array.isArray(rawRev.productIds) && rawRev.productIds.length
              ? rawRev.productIds.filter(Boolean).map(String)
              : (rawRev.productId ? [String(rawRev.productId)] : (primaryExisting && Array.isArray(primaryExisting.productIds) ? primaryExisting.productIds : [])),
            productName: String(rawRev.productName || (primaryExisting && primaryExisting.productName) || 'Nutrolix Product').trim(),
            productNames: Array.isArray(rawRev.productNames) && rawRev.productNames.length
              ? rawRev.productNames.filter(Boolean).map(String)
              : (rawRev.productName ? [String(rawRev.productName)] : (primaryExisting && Array.isArray(primaryExisting.productNames) ? primaryExisting.productNames : [])),
            rating: cleanRating,
            comment: String(rawRev.comment || rawRev.text || '').trim(),
            text: String(rawRev.text || rawRev.comment || '').trim(),
            customerName: String(rawRev.customerName || rawRev.name || (primaryExisting && primaryExisting.customerName) || 'Verified Customer').trim(),
            name: String(rawRev.name || rawRev.customerName || (primaryExisting && primaryExisting.name) || 'Verified Customer').trim(),
            customerEmail: normalizeEmail(rawRev.customerEmail || (primaryExisting && primaryExisting.customerEmail) || ''),
            customerPhone: normalizePhone(rawRev.customerPhone || (primaryExisting && primaryExisting.customerPhone) || ''),
            uid: String(rawRev.uid || (primaryExisting && primaryExisting.uid) || '').trim(),
            verified: rawRev.verified !== false,
            approved: primaryExisting ? (primaryExisting.approved !== false) : true,
            edited: isEdit,
            createdAt: (primaryExisting && primaryExisting.createdAt) || nowIso,
            createdAtMillis: Number((primaryExisting && primaryExisting.createdAtMillis) || nowMs),
            updatedAt: nowIso,
            updatedAtMillis: nowMs
          };

          // Enforce strictly 1 review per delivered orderId across local store & Firestore
          const duplicateIds = existingForOrder
            .map(r => r && r.id)
            .filter(id => id && id !== rev.id);

          const filteredExisting = existing.filter(r => {
            if (!r) return false;
            if (r.id === rev.id) return false;
            if (orderIdClean && String(r.orderId || '').trim() === orderIdClean) return false;
            return true;
          });
          const updated = [rev, ...filteredExisting].slice(0, 500);
          await Promise.all([
            writeCatalogDocAndLocal('product_reviews', reviewsFile, updated),
            nutrolixCore.firestorePatchBothDbs(`productReviews/${rev.id}`, rev),
            ...duplicateIds.map((dupId) => nutrolixCore.firestoreDeleteBothDbs(`productReviews/${dupId}`).catch(() => false))
          ]);

          // Keep review_state in sync if review came from a delivered order
          if (rev.orderId) {
            const stateFile = path.join(PUBLIC_DIR, 'data', 'review_state.json');
            const state = await readCatalogDocOrFallback('review_state', stateFile, { dismissed: [], reviewed: [] });
            if (!Array.isArray(state.reviewed)) state.reviewed = [];
            if (!state.reviewed.includes(rev.orderId)) {
              state.reviewed.push(rev.orderId);
              await writeCatalogDocAndLocal('review_state', stateFile, state);
            }
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
          });
          res.end(JSON.stringify({ success: true, updated: isEdit, review: rev }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (req.method === 'POST' && reqPath === '/api/product-reviews/moderate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { reviewId, action } = JSON.parse(body || '{}');
        const reviewsFile = path.join(PUBLIC_DIR, 'data', 'product_reviews.json');
        let revs = await loadAllMergedReviews();
        const target = revs.find(r => (r.id === reviewId || r.orderId === reviewId));

        if (action === 'delete') {
          revs = revs.filter(r => (r.id !== reviewId && r.orderId !== reviewId));
          if (target && target.id) {
            await nutrolixCore.firestoreDeleteBothDbs(`productReviews/${target.id}`);
          }
        } else if (action === 'hide') {
          if (target) {
            target.approved = false;
            await nutrolixCore.firestorePatchBothDbs(`productReviews/${target.id}`, { approved: false });
          }
        } else if (action === 'approve') {
          if (target) {
            target.approved = true;
            await nutrolixCore.firestorePatchBothDbs(`productReviews/${target.id}`, { approved: true });
          }
        }
        await writeCatalogDocAndLocal('product_reviews', reviewsFile, revs);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify({ success: true, reviews: revs }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Persistent Review State Tracking (Dismissals & Completed Reviews in Firestore)
  if (reqPath === '/api/reviews/dismiss' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { orderId } = JSON.parse(body || '{}');
        const stateFile = path.join(PUBLIC_DIR, 'data', 'review_state.json');
        let state = await readCatalogDocOrFallback('review_state', stateFile, { dismissed: [], reviewed: [] });
        if (!Array.isArray(state.dismissed)) state.dismissed = [];
        if (!Array.isArray(state.reviewed)) state.reviewed = [];
        if (orderId && !state.dismissed.includes(orderId)) {
          state.dismissed.push(orderId);
          await writeCatalogDocAndLocal('review_state', stateFile, state);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify({ success: true, dismissed: state.dismissed }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/reviews/mark-reviewed' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { orderId } = JSON.parse(body || '{}');
        const stateFile = path.join(PUBLIC_DIR, 'data', 'review_state.json');
        let state = await readCatalogDocOrFallback('review_state', stateFile, { dismissed: [], reviewed: [] });
        if (!Array.isArray(state.dismissed)) state.dismissed = [];
        if (!Array.isArray(state.reviewed)) state.reviewed = [];
        if (orderId && !state.reviewed.includes(orderId)) {
          state.reviewed.push(orderId);
          await writeCatalogDocAndLocal('review_state', stateFile, state);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify({ success: true, reviewed: state.reviewed }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/reviews/state' && req.method === 'GET') {
    const stateFile = path.join(PUBLIC_DIR, 'data', 'review_state.json');
    const state = await readCatalogDocOrFallback('review_state', stateFile, { dismissed: [], reviewed: [] });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({
      dismissed: Array.isArray(state.dismissed) ? state.dismissed : [],
      reviewed: Array.isArray(state.reviewed) ? state.reviewed : []
    }));
    return;
  }

  // Unified Store Settings (Announcement, Delivery Fee, Free Delivery Threshold, Cloudinary, PayU)
  if (reqPath === '/api/settings' || reqPath === '/api/store-settings') {
    const settingsFile = path.join(PUBLIC_DIR, 'data', 'store_settings.json');
    if (req.method === 'GET') {
      const stored = await readCatalogDocOrFallback('store_settings', settingsFile, {});
      const normalized = normalizeStoreSettingsPayload(stored, {});
      res.writeHead(200, NO_STORE_JSON_HEADERS);
      res.end(JSON.stringify({ ...normalized, success: true, settings: normalized }));
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const prev = await readCatalogDocOrFallback('store_settings', settingsFile, {});
          const merged = normalizeStoreSettingsPayload(payload, prev);
          await writeCatalogDocAndLocal('store_settings', settingsFile, merged);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ ...merged, success: true, settings: merged }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // Store Coupons
  if (reqPath === '/api/coupons' || reqPath === '/api/store-coupons') {
    const couponsFile = path.join(PUBLIC_DIR, 'data', 'store_coupons.json');
    if (req.method === 'GET') {
      const data = await readCatalogDocOrFallback('store_coupons', couponsFile, [
        { code: 'NUTRO10', title: '10% OFF on All Products', type: 'percentage', value: 10, discountPercent: 10, minOrder: 0, active: true },
        { code: 'NUTRO15', title: '15% OFF on Orders > ₹499', type: 'percentage', value: 15, discountPercent: 15, minOrder: 499, active: true },
        { code: 'NUTRO20', title: '20% OFF on Orders > ₹1499', type: 'percentage', value: 20, discountPercent: 20, minOrder: 1499, active: true }
      ]);
      res.writeHead(200, NO_STORE_JSON_HEADERS);
      res.end(JSON.stringify(Array.isArray(data) ? data : []));
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const newCoupons = JSON.parse(body || '[]');
          await writeCatalogDocAndLocal('store_coupons', couponsFile, Array.isArray(newCoupons) ? newCoupons : []);
          res.writeHead(200, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ success: true, coupons: newCoupons }));
        } catch (err) {
          res.writeHead(400, NO_STORE_JSON_HEADERS);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // Registered Customers & Users (Firestore-backed + Non-clobbering merge)
  if (reqPath === '/api/users') {
    if (req.method === 'GET') {
      const ordersFile = path.join(PUBLIC_DIR, 'data', 'nutrition_orders.json');
      const usersFile = path.join(PUBLIC_DIR, 'data', 'users.json');
      const usersMap = {};

      const addUserRecord = (u) => {
        if (!u) return;
        const phone = normalizePhone(u.verifiedPhone || u.phone || u.whatsappNumber || (String(u.uid || '').startsWith('phone_') ? String(u.uid).slice(6) : ''));
        const key = nutrolixCore.canonicalCustomerUid(phone) || String(u.uid || u.id || u.email || '').trim();
        if (!key) return;
        const prev = usersMap[key] || {};
        usersMap[key] = {
          ...prev,
          ...u,
          uid: key,
          id: key,
          phone: phone || prev.phone || '',
          verifiedPhone: phone || prev.verifiedPhone || '',
          name: nutrolixCore.pickBestCustomerName(prev.name, u.name)
        };
      };

      const savedUsers = safeReadJson(usersFile, []);
      if (Array.isArray(savedUsers)) savedUsers.forEach(addUserRecord);

      try {
        const [defUsers, namedUsers] = await Promise.all([
          nutrolixCore.firestoreListAllDocuments('users', nutrolixCore.DEFAULT_DB_ID, 1500),
          nutrolixCore.firestoreListAllDocuments('users', nutrolixCore.NAMED_DB_ID, 1500)
        ]);
        for (const doc of [...defUsers.docs, ...namedUsers.docs]) {
          const clean = { ...doc };
          delete clean._docId;
          delete clean._docName;
          addUserRecord(clean);
        }
      } catch (_) {}

      const orders = safeReadJson(ordersFile, []);
      if (Array.isArray(orders)) {
        orders.forEach(o => {
          const phone = customerSync.extractOrderPhone(o);
          const email = customerSync.extractOrderEmail(o);
          const name = nutrolixCore.pickBestCustomerName(o.customer && o.customer.name, o.customerName);
          const key = nutrolixCore.canonicalCustomerUid(phone) || String(o.uid || email || '').trim();
          if (key) {
            const addr = o.deliveryAddress && typeof o.deliveryAddress === 'object'
              ? `${o.deliveryAddress.address1 || ''}, ${o.deliveryAddress.city || ''} - ${o.deliveryAddress.pincode || ''}`
              : (o.address || '');
            if (!usersMap[key]) {
              usersMap[key] = {
                id: key,
                uid: key,
                name,
                phone: phone || '',
                email: email || '',
                lastAddress: addr,
                totalOrders: 1,
                totalSpend: Number(o.grandTotal || o.total || o.amount || 0),
                updatedAt: o.createdAt || new Date().toISOString()
              };
            } else {
              usersMap[key].totalOrders = (usersMap[key].totalOrders || 0) + 1;
              usersMap[key].totalSpend = (usersMap[key].totalSpend || 0) + Number(o.grandTotal || o.total || o.amount || 0);
              usersMap[key].name = nutrolixCore.pickBestCustomerName(usersMap[key].name, name);
              if (addr) usersMap[key].lastAddress = addr;
            }
          }
        });
      }

      const userList = Object.values(usersMap);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(userList));
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const user = JSON.parse(body || '{}');
          const usersFile = path.join(PUBLIC_DIR, 'data', 'users.json');
          let savedUsers = safeReadJson(usersFile, []);
          if (!Array.isArray(savedUsers)) savedUsers = [];
          const cleanPhone = normalizePhone(user.verifiedPhone || user.phone || user.whatsappNumber || (String(user.uid || '').startsWith('phone_') ? String(user.uid).slice(6) : ''));
          const key = nutrolixCore.canonicalCustomerUid(cleanPhone) || String(user.uid || user.id || normalizeEmail(user.email) || '').trim();
          if (key) {
            const existingFs = await nutrolixCore.firestoreGetFirstAvailable(`users/${key}`);
            const idx = savedUsers.findIndex(u =>
              (u.uid && u.uid === key) ||
              (cleanPhone && normalizePhone(u.phone || u.verifiedPhone) === cleanPhone) ||
              (u.email && user.email && normalizeEmail(u.email) === normalizeEmail(user.email)) ||
              (u.id === key)
            );
            const existingLocal = idx >= 0 ? savedUsers[idx] : {};
            const mergedUser = {
              ...(existingFs || {}),
              ...existingLocal,
              ...user,
              id: key,
              uid: key,
              phone: cleanPhone || existingLocal.phone || (existingFs && existingFs.phone) || '',
              verifiedPhone: cleanPhone || existingLocal.verifiedPhone || (existingFs && existingFs.verifiedPhone) || '',
              name: nutrolixCore.pickBestCustomerName(user.name, existingFs && existingFs.name, existingLocal.name),
              updatedAt: new Date().toISOString(),
              updatedAtMillis: Date.now()
            };
            delete mergedUser._docId;
            delete mergedUser._docName;

            if (idx >= 0) savedUsers[idx] = mergedUser;
            else savedUsers.unshift(mergedUser);
            safeWriteJson(usersFile, savedUsers);

            await nutrolixCore.firestorePatchBothDbs(`users/${key}`, mergedUser);

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true, user: mergedUser }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, user }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // Saved Delivery Addresses API (Dual-DB Permanent Save / Set Default / Delete)
  if (
    req.method === 'POST' &&
    (reqPath === '/api/users/addresses/save' ||
      reqPath === '/api/users/addresses/delete' ||
      reqPath === '/api/users/addresses/default' ||
      reqPath === '/api/users/addresses/list')
  ) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const authHeader = req.headers['authorization'] || '';
        let verifiedUser = null;
        if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
          verifiedUser = await nutrolixCore.verifyFirebaseIdToken(authHeader, __dirname);
          if (!verifiedUser || !verifiedUser.uid) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, error: 'Invalid Firebase authentication token.' }));
            return;
          }
        }

        const rawUid = String((verifiedUser && verifiedUser.uid) || payload.uid || '').trim();
        const derivedPhone = normalizePhone(
          (verifiedUser && (verifiedUser.phoneNumber || (String(verifiedUser.uid || '').startsWith('phone_') ? String(verifiedUser.uid).slice(6) : ''))) ||
          payload.phone ||
          (rawUid.startsWith('phone_') ? rawUid.slice(6) : '')
        );
        const canonicalUid = nutrolixCore.canonicalCustomerUid(derivedPhone) || rawUid;

        if (!canonicalUid || (!verifiedUser && !(rawUid.startsWith('phone_') && nutrolixCore.isValidIndianMobile(derivedPhone)))) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: 'Verified customer session is required.' }));
          return;
        }

        let result;
        if (reqPath === '/api/users/addresses/save') {
          result = await customerSync.saveCustomerAddressRecord({
            uid: canonicalUid,
            phone: derivedPhone,
            address: payload.address || {}
          });
        } else if (reqPath === '/api/users/addresses/default') {
          result = await customerSync.setDefaultCustomerAddressRecord({
            uid: canonicalUid,
            phone: derivedPhone,
            addressId: payload.addressId || payload.id || ''
          });
        } else if (reqPath === '/api/users/addresses/delete') {
          result = await customerSync.deleteCustomerAddressRecord({
            uid: canonicalUid,
            phone: derivedPhone,
            addressId: payload.addressId || payload.id || '',
            addressKey: payload.addressKey || ''
          });
        } else {
          const addresses = await customerSync.listCanonicalAddresses(canonicalUid);
          result = { success: true, uid: canonicalUid, addresses };
        }

        // Keep local users.json cache in sync on empty/update so it never resurrects stale addresses
        try {
          const usersFile = path.join(PUBLIC_DIR, 'data', 'users.json');
          const savedUsers = safeReadJson(usersFile, []);
          if (Array.isArray(savedUsers)) {
            const idx = savedUsers.findIndex((u) => u && (u.uid === canonicalUid || u.id === canonicalUid));
            if (idx >= 0) {
              if (Array.isArray(result.addresses) && result.addresses.length === 0) {
                savedUsers[idx].defaultAddress = '';
                savedUsers[idx].address1 = '';
                savedUsers[idx].currentAddress = '';
                savedUsers[idx].lastAddress = '';
                savedUsers[idx].city = '';
                savedUsers[idx].state = '';
                savedUsers[idx].pincode = '';
                savedUsers[idx].addressesCleared = true;
              } else if (Array.isArray(result.addresses) && result.addresses.length > 0) {
                const def = result.addresses.find((a) => a.isDefault) || result.addresses[0];
                savedUsers[idx].defaultAddress = def.street || def.address1 || '';
                savedUsers[idx].address1 = def.street || def.address1 || '';
                savedUsers[idx].city = def.city || '';
                savedUsers[idx].state = def.state || '';
                savedUsers[idx].pincode = def.pincode || '';
                savedUsers[idx].addressesCleared = false;
              }
              safeWriteJson(usersFile, savedUsers);
            }
          }
        } catch (_) {}

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ...result, uid: canonicalUid }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING & CLEAN ROUTING
  // -------------------------------------------------------------
  // Safety guard: Any unhandled API route must NEVER return HTML fallback
  if (reqPath.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: `API route not found: ${reqPath}`, success: false }));
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/food' || reqPath === '/food/') {
    reqPath = '/food.html';
  } else if (reqPath === '/shop' || reqPath === '/shop/') {
    reqPath = '/shop.html';
  } else if (reqPath === '/orders' || reqPath === '/orders/' || reqPath === '/track' || reqPath === '/tracking') {
    reqPath = '/orders.html';
  } else if (reqPath === '/product' || reqPath.startsWith('/product/') || reqPath.startsWith('/product.html')) {
    reqPath = '/product.html';
  } else if (reqPath === '/about' || reqPath === '/about/' || reqPath === '/story' || reqPath === '/vision') {
    reqPath = '/about.html';
  } else if (reqPath === '/contact' || reqPath === '/contact/') {
    reqPath = '/contact.html';
  } else if (reqPath === '/blogs' || reqPath === '/blogs/' || reqPath === '/blog' || reqPath.startsWith('/blog/')) {
    reqPath = '/blogs.html';
  } else if (reqPath === '/cart' || reqPath === '/cart/' || reqPath === '/checkout' || reqPath === '/checkout/') {
    reqPath = '/cart.html';
  } else if (reqPath === '/account' || reqPath === '/account/' || reqPath === '/wishlist') {
    reqPath = '/account.html';
  } else if (reqPath === '/faqs' || reqPath === '/faqs/') {
    reqPath = '/faqs.html';
  } else if (reqPath === '/shipping' || reqPath === '/shipping/') {
    reqPath = '/shipping.html';
  } else if (reqPath === '/refund' || reqPath === '/refund/') {
    reqPath = '/refund.html';
  } else if (reqPath === '/cancellation' || reqPath === '/cancellation/') {
    reqPath = '/cancellation.html';
  } else if (reqPath === '/terms' || reqPath === '/terms/') {
    reqPath = '/terms.html';
  } else if (reqPath === '/privacy' || reqPath === '/privacy/') {
    reqPath = '/privacy.html';
  } else if (reqPath === '/admin' || reqPath === '/admin/') {
    reqPath = '/admin.html';
  } else if (reqPath === '/firebase-messaging-sw.js') {
    reqPath = '/sw.js';
  } else if (reqPath === '/app' || reqPath === '/app/' || reqPath === '/app.html' || reqPath === '/customer' || reqPath === '/customer/' || reqPath === '/customer.html') {
    res.writeHead(302, { 'Location': '/', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end();
    return;
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(filePath)) {
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
          filePath = htmlPath;
        } else {
          // Check if requested path is a blog article slug or blog path
          const cleanSlug = reqPath.replace(/^\/+/, '').split('?')[0];
          let isBlogMatch = false;
          try {
            const blogsFile = path.join(PUBLIC_DIR, 'data', 'blogs.json');
            if (fs.existsSync(blogsFile)) {
              const bl = JSON.parse(fs.readFileSync(blogsFile, 'utf8') || '[]');
              isBlogMatch = bl.some(b => (b.slug && b.slug === cleanSlug) || (b.id && b.id === cleanSlug));
            }
          } catch (_) {}

          if (isBlogMatch || cleanSlug.startsWith('blog/') || cleanSlug.startsWith('article/') || cleanSlug === 'article') {
            filePath = path.join(PUBLIC_DIR, 'article.html');
          } else {
            filePath = path.join(PUBLIC_DIR, 'index.html');
          }
        }
      } else {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }

      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      };
      if (path.basename(filePath) === 'sw.js') {
        headers['Service-Worker-Allowed'] = '/';
      }
      if (ext === '.apk' || ext === '.dat' || ext === '.zip') {
        const downloadName = ext === '.dat' ? path.basename(filePath).replace(/\.dat$/, '') : path.basename(filePath);
        headers['Content-Disposition'] = `attachment; filename="${downloadName}"`;
      }
      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Nutrolix Web & AI Server active on http://0.0.0.0:${PORT}`);
  });
}

module.exports = server;
