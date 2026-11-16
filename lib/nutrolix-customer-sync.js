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

  const deliveryRecipientPhone =
    core.normalizePhone(addrObj.phone || addrObj.recipientPhone || raw.deliveryPhone || raw.recipientPhone) ||
    String(addrObj.phone || raw.deliveryPhone || '').trim() ||
    cleanPhone;
  const deliveryRecipientName = String(addrObj.name || raw.recipientName || bestName || '').trim() || bestName;

  const normalizedDeliveryAddress = typeof raw.deliveryAddress === 'string'
    ? {
        name: deliveryRecipientName,
        phone: deliveryRecipientPhone,
        recipientPhone: deliveryRecipientPhone,
        whatsappNumber: deliveryRecipientPhone,
        address1: raw.deliveryAddress.trim(),
        city: String(addrObj.city || raw.city || '').trim(),
        state: String(addrObj.state || raw.state || '').trim(),
        pincode
      }
    : {
        ...addrObj,
        name: deliveryRecipientName,
        phone: deliveryRecipientPhone,
        recipientPhone: deliveryRecipientPhone,
        whatsappNumber: deliveryRecipientPhone,
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
    deliveryPhone: deliveryRecipientPhone,
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

  const clearedByUser = docs.some((d) => Boolean(d.addressesCleared)) && !allowProfileOverride;
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
    city: clearedByUser ? '' : pickFirstNonEmpty('city'),
    state: clearedByUser ? '' : pickFirstNonEmpty('state'),
    pincode: clearedByUser ? '' : pickFirstNonEmpty('pincode'),
    defaultAddress: clearedByUser ? '' : pickFirstNonEmpty('defaultAddress'),
    address1: clearedByUser ? '' : pickFirstNonEmpty('address1'),
    lastAddress: clearedByUser ? '' : pickFirstNonEmpty('lastAddress'),
    addressesCleared: clearedByUser,
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

async function collectUserUidVariants(canonicalUid, phone) {
  const uids = new Set();
  const cleanPhone = core.normalizePhone(phone || (String(canonicalUid || '').startsWith('phone_') ? String(canonicalUid).slice(6) : ''));
  const resolvedUid = canonicalUid || core.canonicalCustomerUid(cleanPhone);
  if (resolvedUid) uids.add(resolvedUid);
  if (cleanPhone) {
    uids.add(cleanPhone);
    uids.add(`+91${cleanPhone}`);
    uids.add(`phone_${cleanPhone}`);
  }
  if (resolvedUid) {
    const userDocs = await Promise.allSettled(
      core.BOTH_DB_IDS.map((dbId) => core.firestoreGetDocument(`users/${resolvedUid}`, dbId))
    );
    for (const r of userDocs) {
      const doc = r.status === 'fulfilled' ? r.value : null;
      if (doc && Array.isArray(doc.linkedLegacyUids)) {
        doc.linkedLegacyUids.forEach((x) => x && uids.add(String(x)));
      }
      if (doc && doc.linkedFromUid) uids.add(String(doc.linkedFromUid));
    }
  }
  return { resolvedUid, cleanPhone, uidVariants: Array.from(uids) };
}

async function listCanonicalAddresses(resolvedUid) {
  if (!resolvedUid) return [];
  const byId = new Map();
  const dbResults = await Promise.allSettled(
    core.BOTH_DB_IDS.map((dbId) => core.firestoreListDocuments(`users/${resolvedUid}/addresses`, dbId))
  );
  for (const r of dbResults) {
    const docs = r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [];
    for (const d of docs) {
      const id = String(d.id || d._docId || '').trim();
      if (!id) continue;
      const clean = { ...d, id, uid: resolvedUid };
      delete clean._docId;
      delete clean._docName;
      const prev = byId.get(id);
      if (!prev || Number(clean.updatedAtMillis || 0) >= Number(prev.updatedAtMillis || 0)) {
        byId.set(id, clean);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => Number(b.updatedAtMillis || 0) - Number(a.updatedAtMillis || 0));
}

async function saveCustomerAddressRecord({ uid, phone, address }) {
  const { resolvedUid, cleanPhone } = await collectUserUidVariants(uid, phone);
  if (!resolvedUid || !address || typeof address !== 'object') {
    return { success: false, addresses: [] };
  }
  const existing = await listCanonicalAddresses(resolvedUid);
  const street = String(address.street || address.address1 || '').trim();
  const pincode = String(address.pincode || '').replace(/\D/g, '').slice(0, 6);
  const addrId = String(address.id || ('addr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6))).trim();
  const makeDefault = Boolean(address.isDefault) || existing.length === 0;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const addrPhone =
    core.normalizePhone(address.phone || address.recipientPhone || address.whatsappNumber) ||
    String(address.phone || '').trim() ||
    cleanPhone;

  const record = {
    ...address,
    id: addrId,
    uid: resolvedUid,
    tag: String(address.tag || 'Home').trim() || 'Home',
    street,
    address1: street,
    city: String(address.city || '').trim(),
    state: String(address.state || '').trim(),
    pincode,
    phone: addrPhone,
    whatsappNumber: addrPhone,
    isDefault: makeDefault,
    updatedAt: nowIso,
    updatedAtMillis: nowMs
  };

  const patchTasks = [];
  if (makeDefault && existing.length > 0) {
    for (const item of existing) {
      if (item.id !== addrId && item.isDefault) {
        patchTasks.push(
          core.firestorePatchBothDbs(`users/${resolvedUid}/addresses/${item.id}`, {
            isDefault: false,
            updatedAt: nowIso,
            updatedAtMillis: nowMs
          })
        );
      }
    }
  }

  patchTasks.push(core.firestorePatchBothDbs(`users/${resolvedUid}/addresses/${addrId}`, record));
  if (makeDefault) {
    patchTasks.push(
      core.firestorePatchBothDbs(`users/${resolvedUid}`, {
        defaultAddress: street,
        address1: street,
        currentAddress: [street, record.city, record.state, pincode].filter(Boolean).join(', '),
        city: record.city,
        state: record.state,
        pincode,
        addressesCleared: false,
        updatedAt: nowIso,
        updatedAtMillis: nowMs
      })
    );
  } else {
    patchTasks.push(
      core.firestorePatchBothDbs(`users/${resolvedUid}`, {
        addressesCleared: false,
        updatedAt: nowIso,
        updatedAtMillis: nowMs
      })
    );
  }

  await Promise.allSettled(patchTasks);
  const addresses = await listCanonicalAddresses(resolvedUid);
  return { success: true, address: record, addresses };
}

async function setDefaultCustomerAddressRecord({ uid, phone, addressId }) {
  const { resolvedUid } = await collectUserUidVariants(uid, phone);
  if (!resolvedUid || !addressId) return { success: false, addresses: [] };
  const existing = await listCanonicalAddresses(resolvedUid);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  let chosen = null;

  await Promise.allSettled(
    existing.map((item) => {
      const isTarget = item.id === addressId;
      if (isTarget) chosen = { ...item, isDefault: true, updatedAt: nowIso, updatedAtMillis: nowMs };
      return core.firestorePatchBothDbs(`users/${resolvedUid}/addresses/${item.id}`, {
        isDefault: isTarget,
        updatedAt: nowIso,
        updatedAtMillis: nowMs
      });
    })
  );

  if (chosen) {
    const line = String(chosen.street || chosen.address1 || '').trim();
    await core.firestorePatchBothDbs(`users/${resolvedUid}`, {
      defaultAddress: line,
      address1: line,
      currentAddress: [line, chosen.city, chosen.state, chosen.pincode].filter(Boolean).join(', '),
      city: chosen.city || '',
      state: chosen.state || '',
      pincode: chosen.pincode || '',
      addressesCleared: false,
      updatedAt: nowIso,
      updatedAtMillis: nowMs
    });
  }

  const addresses = await listCanonicalAddresses(resolvedUid);
  return { success: true, addresses };
}

async function deleteCustomerAddressRecord({ uid, phone, addressId, addressKey = '' }) {
  const { resolvedUid, uidVariants } = await collectUserUidVariants(uid, phone);
  if (!resolvedUid) {
    return { success: false, addresses: [], deletedCount: 0 };
  }

  const targetId = String(addressId || '').trim();
  const targetKey = String(addressKey || '').trim().toLowerCase();
  let deletedCount = 0;

  // Delete matching address doc across BOTH databases and ALL UID variants in parallel
  const variantTasks = [];
  for (const variantUid of uidVariants) {
    if (targetId) {
      variantTasks.push(
        core.firestoreDeleteBothDbs(`users/${variantUid}/addresses/${targetId}`).then((delRes) => {
          if (delRes && delRes.anySuccess) deletedCount++;
        }).catch(() => {})
      );
    }
    for (const dbId of core.BOTH_DB_IDS) {
      variantTasks.push(
        (async () => {
          const docs = await core.firestoreListDocuments(`users/${variantUid}/addresses`, dbId);
          const matchingDeletes = [];
          for (const d of docs) {
            const docId = String(d._docId || d.id || '').trim();
            const docKey = normalizeAddrKey(d).toLowerCase();
            if (
              docId &&
              (
                (targetId && docId === targetId) ||
                (targetKey && docKey && docKey === targetKey)
              )
            ) {
              matchingDeletes.push(
                core.firestoreDeleteDocument(`users/${variantUid}/addresses/${docId}`, dbId).then((ok) => {
                  if (ok) deletedCount++;
                }).catch(() => {})
              );
            }
          }
          if (matchingDeletes.length > 0) await Promise.allSettled(matchingDeletes);
        })().catch(() => {})
      );
    }
  }
  await Promise.allSettled(variantTasks);

  // Recompute remaining addresses on canonical UID
  let remaining = await listCanonicalAddresses(resolvedUid);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  if (remaining.length === 0) {
    // Clear profile default address fields across both DBs & legacy UIDs so the deleted
    // address can NEVER be resurrected on next hydration / page refresh.
    const clearedFields = {
      defaultAddress: '',
      address1: '',
      currentAddress: '',
      lastAddress: '',
      city: '',
      state: '',
      pincode: '',
      addressesCleared: true,
      updatedAt: nowIso,
      updatedAtMillis: nowMs
    };
    await Promise.allSettled(
      uidVariants.map((variantUid) => core.firestorePatchBothDbs(`users/${variantUid}`, clearedFields))
    );
  } else {
    let defaultAddr = remaining.find((a) => a.isDefault);
    const updateOps = [];
    if (!defaultAddr) {
      defaultAddr = { ...remaining[0], isDefault: true };
      remaining = remaining.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
      updateOps.push(
        core.firestorePatchBothDbs(`users/${resolvedUid}/addresses/${defaultAddr.id}`, {
          isDefault: true,
          updatedAt: nowIso,
          updatedAtMillis: nowMs
        })
      );
    }
    const defLine = String(defaultAddr.street || defaultAddr.address1 || '').trim();
    updateOps.push(
      core.firestorePatchBothDbs(`users/${resolvedUid}`, {
        defaultAddress: defLine,
        address1: defLine,
        currentAddress: [defLine, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(', '),
        city: defaultAddr.city || '',
        state: defaultAddr.state || '',
        pincode: defaultAddr.pincode || '',
        addressesCleared: false,
        updatedAt: nowIso,
        updatedAtMillis: nowMs
      })
    );
    await Promise.allSettled(updateOps);
  }

  return {
    success: true,
    uid: resolvedUid,
    deletedCount,
    addresses: remaining,
    addressesCleared: remaining.length === 0
  };
}

module.exports = {
  extractOrderPhone,
  extractOrderEmail,
  validateOrderPayload,
  classifyDeliveryAttempt,
  buildMergedCustomerProfile,
  mergeLegacyCustomerAccount,
  saveCustomerAddressRecord,
  setDefaultCustomerAddressRecord,
  deleteCustomerAddressRecord,
  listCanonicalAddresses
};
