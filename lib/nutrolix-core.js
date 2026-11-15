const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FIREBASE_PROJECT_ID = 'com-aistudio-nutrolix-fo-56ac8';
const DEFAULT_DB_ID = '(default)';
const NAMED_DB_ID = 'ai-studio-android-nutrolix-53a14619-b244-4a3d-9101-a841b657720b';
const BOTH_DB_IDS = [DEFAULT_DB_ID, NAMED_DB_ID];

let cachedAccessToken = null;
let cachedTokenExpiresAtMs = 0;
let ephemeralRuntimeHmacSecret = null;

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
  'customer',
  'guest customer',
  'guest',
  'user',
  'unknown'
]);

function isMeaningfulCustomerName(name) {
  const clean = String(name || '').trim();
  return clean.length > 0 && !PLACEHOLDER_NAMES.has(clean.toLowerCase());
}

function pickBestCustomerName(...candidates) {
  for (const c of candidates) {
    if (isMeaningfulCustomerName(c)) {
      return String(c).trim();
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

async function reverseGeocodeFree(lat, lon) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon) || Math.abs(numLat) > 90 || Math.abs(numLon) > 180) {
    return { success: false, fallbackRequired: true, code: 'INVALID_COORDS', error: 'Invalid latitude or longitude.' };
  }

  try {
    const nominatimPath = `/reverse?format=jsonv2&lat=${encodeURIComponent(numLat)}&lon=${encodeURIComponent(numLon)}&addressdetails=1&zoom=18&accept-language=en`;
    const nomResp = await httpsJsonRequest({
      hostname: 'nominatim.openstreetmap.org',
      port: 443,
      path: nominatimPath,
      method: 'GET',
      headers: {
        'User-Agent': 'NutrolixWellnessApp/2.0 (https://nutrolixweb.vercel.app; support@nutrolix.in)',
        Accept: 'application/json'
      }
    });
    if (nomResp.statusCode >= 200 && nomResp.statusCode < 300) {
      const parsedNom = parseNominatimGeocodeResponse(numLat, numLon, nomResp.data);
      if (parsedNom.success) return parsedNom;
    }
  } catch (_) {}

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
      if (parsedBdc.success) return parsedBdc;
    }
  } catch (err) {
    return {
      success: false,
      fallbackRequired: true,
      code: 'GEOCODE_ERROR',
      error: err.message || 'Free reverse geocoding request failed.'
    };
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

  const fcmBody = {
    message: {
      token: String(fcmToken).trim(),
      notification: {
        title: String(payload.title || 'Nutrolix Order Update'),
        body: String(payload.body || '')
      },
      data: stringData,
      android: {
        priority: 'HIGH',
        notification: {
          channel_id: payload.channelId || 'nutrolix_orders_channel',
          sound: 'default'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        fcm_options: {
          link: payload.url || '/orders.html'
        }
      }
    }
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
    if (res.statusCode !== 200 || !res.data || !res.data.name) return null;
    return decodeFirestoreDoc(res.data);
  } catch (_) {
    return null;
  }
}

async function firestoreGetFirstAvailable(docPath) {
  for (const dbId of BOTH_DB_IDS) {
    const doc = await firestoreGetDocument(docPath, dbId);
    if (doc) return doc;
  }
  return null;
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
  deduplicatePushTargets
};
