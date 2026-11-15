const core = require('./nutrolix-core');

function extractOrderPhone(order) {
  if (!order || typeof order !== 'object') return '';
  const c = order.customer && typeof order.customer === 'object' ? order.customer : {};
  const fromUid = String(order.uid || '').startsWith('phone_') ? String(order.uid).slice(6) : '';
  return (
    core.normalizePhone(
      order.customerPhone ||
      order.verifiedPhone ||
      order.phone ||
      order.whatsappNumber ||
      c.verifiedPhone ||
      c.phone ||
      c.whatsappNumber ||
      fromUid ||
      ''
    ) || ''
  );
}

function extractOrderEmail(order) {
  if (!order || typeof order !== 'object') return '';
  const c = order.customer && typeof order.customer === 'object' ? order.customer : {};
  return core.normalizeEmail(order.customerEmail || order.email || c.email || '');
}

function validateOrderPayload(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Order payload must be a JSON object.'], normalizedOrder: null };
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  if (items.length === 0) {
    errors.push('Order must contain at least one item.');
  } else {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== 'object') {
        errors.push(`Item at index ${i} is invalid.`);
        continue;
      }
      const qty = Number(it.qty !== undefined ? it.qty : it.quantity !== undefined ? it.quantity : 1);
      const unitPrice = Number(it.price !== undefined ? it.price : it.discountedPrice !== undefined ? it.discountedPrice : 0);
      if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
        errors.push(`Item "${it.name || it.mealName || i}" has an invalid quantity.`);
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.push(`Item "${it.name || it.mealName || i}" has an invalid price.`);
      }
    }
  }

  const cleanPhone = extractOrderPhone(raw);
  if (!core.isValidIndianMobile(cleanPhone)) {
    errors.push('A valid 10-digit Indian WhatsApp/mobile number is required.');
  }

  const deliveryType = String(raw.deliveryType || 'delivery').toLowerCase().trim();
  const addrObj = raw.deliveryAddress && typeof raw.deliveryAddress === 'object'
    ? raw.deliveryAddress
    : (typeof raw.deliveryAddress === 'string' ? { address1: raw.deliveryAddress } : {});
  const address1 = String(addrObj.address1 || addrObj.street || raw.address1 || '').trim();
  const pincode = String(addrObj.pincode || raw.pincode || '').replace(/\D/g, '').slice(0, 6);

  if (deliveryType !== 'pickup') {
    if (address1.length < 3) {
      errors.push('Delivery address line is required.');
    }
    if (pincode.length !== 6) {
      errors.push('A valid 6-digit delivery PIN code is required.');
    }
  }

  const grandTotal = Number(raw.grandTotal !== undefined ? raw.grandTotal : raw.total);
  if (!Number.isFinite(grandTotal) || grandTotal < 0) {
    errors.push('Order total must be a valid non-negative number.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalizedOrder: null };
  }

  const canonicalUid = core.canonicalCustomerUid(cleanPhone);
  const incomingUid = String(raw.uid || '').trim();
  const resolvedUid = canonicalUid || incomingUid;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const rawOrderId = String(raw.orderId || raw.id || '').trim();
  const orderId = rawOrderId || ('ORD-' + Math.floor(100000 + Math.random() * 900000));
  const bestName = core.pickBestCustomerName(
    raw.customerName,
    raw.customer && raw.customer.name
  );
  const cleanEmail = extractOrderEmail(raw);
  const idempotencyKey = String(raw.idempotencyKey || raw.clientRequestId || orderId).trim();

  const normalizedDeliveryAddress = typeof raw.deliveryAddress === 'string'
    ? {
        address1: raw.deliveryAddress.trim(),
        city: String(addrObj.city || raw.city || '').trim(),
        state: String(addrObj.state || raw.state || '').trim(),
        pincode
      }
    : {
        ...addrObj,
        address1,
        city: String(addrObj.city || raw.city || '').trim(),
        state: String(addrObj.state || raw.state || '').trim(),
        pincode
      };

  const normalizedOrder = {
    ...raw,
    id: orderId,
    orderId,
    uid: resolvedUid,
    idempotencyKey,
    customerPhone: cleanPhone,
    verifiedPhone: cleanPhone,
    whatsappNumber: core.normalizePhone(raw.whatsappNumber || (raw.customer && raw.customer.whatsappNumber) || cleanPhone) || cleanPhone,
    customerName: bestName,
    customerEmail: cleanEmail,
    customer: {
      ...(raw.customer && typeof raw.customer === 'object' ? raw.customer : {}),
      name: bestName,
      phone: cleanPhone,
      verifiedPhone: cleanPhone,
      whatsappNumber: core.normalizePhone(raw.whatsappNumber || (raw.customer && raw.customer.whatsappNumber) || cleanPhone) || cleanPhone,
      email: cleanEmail
    },
    deliveryAddress: normalizedDeliveryAddress,
    grandTotal,
    total: grandTotal,
    subtotal: Number.isFinite(Number(raw.subtotal)) ? Number(raw.subtotal) : grandTotal,
    discount: Number.isFinite(Number(raw.discount)) ? Number(raw.discount) : 0,
    foodDiscount: Number.isFinite(Number(raw.foodDiscount)) ? Number(raw.foodDiscount) : 0,
    shipping: Number.isFinite(Number(raw.shipping)) ? Number(raw.shipping) : 0,
    status: String(raw.status || 'Order Placed').trim() || 'Order Placed',
    createdAt: raw.createdAt || nowIso,
    orderTime: raw.orderTime || raw.createdAt || nowIso,
    timestamp: Number(raw.timestamp) || nowMs,
    orderTimeMillis: Number(raw.orderTimeMillis || raw.timestamp) || nowMs
  };

  return { valid: true, errors: [], normalizedOrder };
}

function classifyDeliveryAttempt({
  channel = 'unknown',
  targetId = '',
  sent = false,
  accepted = false,
  statusCode = 0,
  permanentFailure = false,
  detail = ''
}) {
  let state = 'failed';
  if (sent) {
    state = 'delivered';
  } else if (accepted) {
    state = 'accepted';
  } else if (
    String(detail || '').includes('UNCONFIGURED') ||
    String(detail || '').includes('SKIPPED') ||
    String(detail || '').includes('NO_TOKENS') ||
    String(detail || '').includes('UNAVAILABLE')
  ) {
    state = 'unavailable';
  }
  return {
    channel,
    targetId: targetId ? String(targetId).slice(-18) : '',
    state,
    statusCode: Number(statusCode || 0),
    permanentFailure: Boolean(permanentFailure),
    detail: String(detail || '')
  };
}

function normalizeAddrKey(addr) {
  const line = String(addr.address1 || addr.street || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const pin = String(addr.pincode || '').replace(/\D/g, '').slice(0, 6);
  return line && pin ? `${pin}_${line}` : String(addr.id || addr._docId || '');
}

function buildMergedCustomerProfile({
  matchedUserDocs = [],
  extraProfile = {},
  cleanPhone,
  resolvedUid,
  legacyUids = new Set(),
  allowProfileOverride = false
}) {
  const safeExtra = extraProfile && typeof extraProfile === 'object' ? extraProfile : {};
  const docs = Array.isArray(matchedUserDocs) ? matchedUserDocs.filter(Boolean) : [];

  const existingCreatedAt = docs
    .map((d) => d.createdAt)
    .filter(Boolean)
    .sort()[0] || safeExtra.createdAt || new Date().toISOString();

  const mergedName = allowProfileOverride
    ? core.pickBestCustomerName(safeExtra.name, ...docs.map((d) => d.name))
    : core.pickBestCustomerName(...docs.map((d) => d.name), safeExtra.name);

  const pickFirstNonEmpty = (field) => {
    if (allowProfileOverride && safeExtra[field] && String(safeExtra[field]).trim()) {
      return String(safeExtra[field]).trim();
    }
    for (const d of docs) {
      if (d[field] && String(d[field]).trim()) return String(d[field]).trim();
    }
    if (safeExtra[field] && String(safeExtra[field]).trim()) {
      return String(safeExtra[field]).trim();
    }
    return '';
  };

  const mergedEmail = core.normalizeEmail(pickFirstNonEmpty('email'));
  const previousLinked = new Set();
  for (const d of docs) {
    if (Array.isArray(d.linkedLegacyUids)) {
      d.linkedLegacyUids.forEach((x) => x && previousLinked.add(String(x)));
    }
    if (d.linkedFromUid) previousLinked.add(String(d.linkedFromUid));
  }
  legacyUids.forEach((u) => previousLinked.add(u));
  previousLinked.delete(resolvedUid);

  const nowIso = new Date().toISOString();
  return {
    uid: resolvedUid,
    id: resolvedUid,
    name: mergedName,
    email: mergedEmail,
    phone: cleanPhone,
    verifiedPhone: cleanPhone,
    whatsappNumber: core.normalizePhone(pickFirstNonEmpty('whatsappNumber') || cleanPhone) || cleanPhone,
    photo: pickFirstNonEmpty('photo'),
    city: pickFirstNonEmpty('city'),
    state: pickFirstNonEmpty('state'),
    pincode: pickFirstNonEmpty('pincode'),
    defaultAddress: pickFirstNonEmpty('defaultAddress'),
    lastAddress: pickFirstNonEmpty('lastAddress'),
    providers: ['phone'],
    phoneVerified: true,
    googleLinked: false,
    authProvider: 'phone',
    verified: true,
    authSession: true,
    linkedLegacyUids: Array.from(previousLinked),
    createdAt: existingCreatedAt,
    updatedAt: nowIso,
    updatedAtMillis: Date.now()
  };
}

async function mergeLegacyCustomerAccount({ canonicalUid, phone, extraProfile = {}, allowProfileOverride = false }) {
  const cleanPhone = core.normalizePhone(phone);
  const resolvedUid = canonicalUid || core.canonicalCustomerUid(cleanPhone);
  if (!resolvedUid || !cleanPhone) {
    return { profile: null, addresses: [], migratedUids: [], migratedOrdersCount: 0, migratedAddressesCount: 0 };
  }

  const matchedUserDocs = [];
  const legacyUids = new Set();

  for (const dbId of core.BOTH_DB_IDS) {
    const canonicalDoc = await core.firestoreGetDocument(`users/${resolvedUid}`, dbId);
    if (canonicalDoc) matchedUserDocs.push(canonicalDoc);

    const directPhoneDoc = await core.firestoreGetDocument(`users/${cleanPhone}`, dbId);
    if (directPhoneDoc) {
      matchedUserDocs.push(directPhoneDoc);
      legacyUids.add(cleanPhone);
    }

    const { docs: allUsers } = await core.firestoreListAllDocuments('users', dbId, 1500);
    for (const u of allUsers) {
      const uPhone = core.normalizePhone(u.verifiedPhone || u.phone || u.whatsappNumber || (String(u.uid || '').startsWith('phone_') ? String(u.uid).slice(6) : ''));
      const docId = String(u._docId || u.uid || u.id || '').trim();
      if (uPhone === cleanPhone || docId === cleanPhone || docId === `+91${cleanPhone}`) {
        matchedUserDocs.push(u);
        if (docId && docId !== resolvedUid) legacyUids.add(docId);
        if (u.uid && String(u.uid).trim() && String(u.uid).trim() !== resolvedUid) {
          legacyUids.add(String(u.uid).trim());
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const mergedProfile = buildMergedCustomerProfile({
    matchedUserDocs,
    extraProfile,
    cleanPhone,
    resolvedUid,
    legacyUids,
    allowProfileOverride
  });

  await core.firestorePatchBothDbs(`users/${resolvedUid}`, mergedProfile);

  // Merge addresses from canonical & legacy UIDs across both DBs
  const uidSearchSet = new Set([resolvedUid, ...legacyUids]);
  const addressMap = new Map();
  const canonicalExistingKeys = new Set();

  for (const searchUid of uidSearchSet) {
    for (const dbId of core.BOTH_DB_IDS) {
      const addrDocs = await core.firestoreListDocuments(`users/${searchUid}/addresses`, dbId);
      for (const a of addrDocs) {
        const key = normalizeAddrKey(a);
        if (!key) continue;
        if (searchUid === resolvedUid) {
          canonicalExistingKeys.add(key);
        }
        const existing = addressMap.get(key);
        const cleanId = String(a.id || a._docId || ('addr_' + Buffer.from(key).toString('hex').slice(0, 10)));
        const normAddr = {
          ...a,
          id: cleanId,
          uid: resolvedUid,
          updatedAt: a.updatedAt || nowIso,
          updatedAtMillis: Number(a.updatedAtMillis) || Date.now()
        };
        delete normAddr._docId;
        delete normAddr._docName;
        if (!existing || Number(normAddr.updatedAtMillis || 0) >= Number(existing.updatedAtMillis || 0)) {
          addressMap.set(key, normAddr);
        }
      }
    }
  }

  let migratedAddressesCount = 0;
  const mergedAddresses = [];
  for (const [key, addrObj] of addressMap.entries()) {
    mergedAddresses.push(addrObj);
    if (!canonicalExistingKeys.has(key)) {
      await core.firestorePatchBothDbs(`users/${resolvedUid}/addresses/${addrObj.id}`, addrObj);
      migratedAddressesCount++;
    }
  }
  mergedAddresses.sort((a, b) => Number(b.updatedAtMillis || 0) - Number(a.updatedAtMillis || 0));

  // Re-attribute legacy orders & notifications & tokens matching this phone or legacy UIDs
  let migratedOrdersCount = 0;
  for (const dbId of core.BOTH_DB_IDS) {
    const { docs: allOrders } = await core.firestoreListAllDocuments('orders', dbId, 2000);
    for (const ord of allOrders) {
      const ordPhone = extractOrderPhone(ord);
      const ordUid = String(ord.uid || '').trim();
      const docId = ord._docId || ord.orderId || ord.id;
      if (!docId) continue;
      if ((ordPhone === cleanPhone || uidSearchSet.has(ordUid)) && ordUid !== resolvedUid) {
        const ok = await core.firestorePatchDocument(
          `orders/${docId}`,
          {
            uid: resolvedUid,
            customerPhone: cleanPhone,
            verifiedPhone: cleanPhone,
            migratedFromUid: ordUid || ''
          },
          dbId
        );
        if (ok) migratedOrdersCount++;
      }
    }

    for (const colName of ['fcmTokens', 'notificationTokens']) {
      const { docs: tokDocs } = await core.firestoreListAllDocuments(colName, dbId, 1000);
      for (const td of tokDocs) {
        const tPhone = core.normalizePhone(td.customerPhone || td.phone);
        const tUid = String(td.uid || '').trim();
        const tDocId = td._docId;
        if (!tDocId) continue;
        if ((tPhone === cleanPhone || uidSearchSet.has(tUid)) && tUid !== resolvedUid) {
          await core.firestorePatchDocument(
            `${colName}/${tDocId}`,
            { uid: resolvedUid, customerPhone: cleanPhone },
            dbId
          );
          if (td.fcmToken || td.token) {
            const subTok = { ...td, uid: resolvedUid, customerPhone: cleanPhone };
            delete subTok._docId;
            delete subTok._docName;
            await core.firestorePatchDocument(`users/${resolvedUid}/fcmTokens/${tDocId}`, subTok, dbId);
          }
        }
      }
    }

    for (const legUid of legacyUids) {
      const legNotifs = await core.firestoreListDocuments(`users/${legUid}/notifications`, dbId);
      for (const n of legNotifs) {
        const nDocId = n._docId || n.id;
        if (!nDocId) continue;
        const cleanNotif = { ...n, uid: resolvedUid };
        delete cleanNotif._docId;
        delete cleanNotif._docName;
        await core.firestorePatchDocument(`users/${resolvedUid}/notifications/${nDocId}`, cleanNotif, dbId);
      }
    }
  }

  return {
    profile: mergedProfile,
    addresses: mergedAddresses,
    migratedUids: Array.from(new Set([...(mergedProfile.linkedLegacyUids || []), ...legacyUids])),
    migratedOrdersCount,
    migratedAddressesCount
  };
}

module.exports = {
  extractOrderPhone,
  extractOrderEmail,
  validateOrderPayload,
  classifyDeliveryAttempt,
  buildMergedCustomerProfile,
  mergeLegacyCustomerAccount
};
