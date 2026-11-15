const fs = require('fs');
const path = require('path');
const core = require('./nutrolix-core');

const TARGET_CUSTOMER_COLLECTIONS = [
  'users',
  'orders',
  'notificationTokens',
  'fcmTokens',
  'notificationDedups',
  'notificationDeliveries',
  'customerDiscounts'
];

const USER_SUBCOLLECTIONS = ['addresses', 'fcmTokens', 'notifications'];

const PRESERVED_COLLECTIONS = [
  'admins',
  'adminTokens',
  'products',
  'meals',
  'categories',
  'banners',
  'coupons',
  'settings',
  'blogs',
  'kitchens',
  'reviews',
  'hero_products',
  'catalogStore'
];

const CONFIRM_PHRASE_REQUIRED = 'DELETE ALL CUSTOMER DATA';

function isTargetCustomerCollection(name) {
  return TARGET_CUSTOMER_COLLECTIONS.includes(String(name || '').trim());
}

function isPreservedCollection(name) {
  return PRESERVED_COLLECTIONS.includes(String(name || '').trim());
}

async function listCollectionInBatches(collectionPath, databaseId, maxDocs = 2000) {
  const docs = [];
  let pageToken = '';
  let truncated = false;
  do {
    const page = await core.firestoreListCollectionPaginated(collectionPath, databaseId, 200, pageToken);
    docs.push(...page.docs);
    pageToken = page.nextPageToken;
    if (docs.length >= maxDocs && pageToken) {
      truncated = true;
      break;
    }
  } while (pageToken);
  return { docs: docs.slice(0, maxDocs), truncated };
}

async function purgeCustomerData({
  dryRun = true,
  confirmPhrase = '',
  deleteLocalFiles = false,
  maxDocsPerCollection = 2000,
  rootDir = path.join(__dirname, '..')
} = {}) {
  const isDryRun = dryRun !== false;
  if (!isDryRun && String(confirmPhrase || '').trim() !== CONFIRM_PHRASE_REQUIRED) {
    const err = new Error(`Confirmation phrase must match exact text: "${CONFIRM_PHRASE_REQUIRED}"`);
    err.code = 'CONFIRM_PHRASE_REQUIRED';
    err.statusCode = 400;
    throw err;
  }

  const summary = {
    mode: isDryRun ? 'DRY_RUN' : 'EXECUTE',
    dryRun: isDryRun,
    timestamp: new Date().toISOString(),
    preservedCollections: [...PRESERVED_COLLECTIONS],
    targetCollections: [...TARGET_CUSTOMER_COLLECTIONS],
    databases: {},
    totals: {
      matched: 0,
      deleted: 0,
      failed: 0,
      truncatedCollections: 0
    },
    localFilesReset: []
  };

  for (const dbId of core.BOTH_DB_IDS) {
    const dbReport = {};
    for (const col of TARGET_CUSTOMER_COLLECTIONS) {
      const colStats = {
        matched: 0,
        deleted: 0,
        failed: 0,
        truncated: false,
        sampleDocIds: [],
        subcollections: {}
      };

      const { docs, truncated } = await listCollectionInBatches(col, dbId, maxDocsPerCollection);
      colStats.matched = docs.length;
      colStats.truncated = truncated;
      if (truncated) summary.totals.truncatedCollections++;
      colStats.sampleDocIds = docs.slice(0, 10).map((d) => String(d._docId || 'unknown'));
      summary.totals.matched += docs.length;

      for (const doc of docs) {
        const docId = doc._docId;
        if (!docId) continue;

        if (col === 'users') {
          for (const sub of USER_SUBCOLLECTIONS) {
            const subPath = `users/${docId}/${sub}`;
            const { docs: subDocs } = await listCollectionInBatches(subPath, dbId, maxDocsPerCollection);
            if (!colStats.subcollections[sub]) {
              colStats.subcollections[sub] = { matched: 0, deleted: 0, failed: 0 };
            }
            colStats.subcollections[sub].matched += subDocs.length;
            summary.totals.matched += subDocs.length;

            if (!isDryRun) {
              for (const sd of subDocs) {
                if (!sd._docId) continue;
                const okSub = await core.firestoreDeleteDocument(`${subPath}/${sd._docId}`, dbId);
                if (okSub) {
                  colStats.subcollections[sub].deleted++;
                  summary.totals.deleted++;
                } else {
                  colStats.subcollections[sub].failed++;
                  summary.totals.failed++;
                }
              }
            }
          }
        }

        if (!isDryRun) {
          const ok = await core.firestoreDeleteDocument(`${col}/${docId}`, dbId);
          if (ok) {
            colStats.deleted++;
            summary.totals.deleted++;
          } else {
            colStats.failed++;
            summary.totals.failed++;
          }
        }
      }

      dbReport[col] = colStats;
    }
    summary.databases[dbId] = dbReport;
  }

  if (!isDryRun && deleteLocalFiles) {
    const dataDir = path.join(rootDir, 'public', 'data');
    const resetTargets = [
      { file: 'users.json', empty: [] },
      { file: 'nutrition_orders.json', empty: [] },
      { file: 'notification_tokens.json', empty: [] },
      { file: 'notifications_log.json', empty: [] },
      { file: 'food_discount_redemptions.json', empty: {} }
    ];
    for (const target of resetTargets) {
      const fullPath = path.join(dataDir, target.file);
      try {
        if (fs.existsSync(fullPath)) {
          fs.writeFileSync(fullPath, JSON.stringify(target.empty, null, 2), 'utf8');
          summary.localFilesReset.push(target.file);
        }
      } catch (_) {}
    }
  }

  return summary;
}

module.exports = {
  TARGET_CUSTOMER_COLLECTIONS,
  USER_SUBCOLLECTIONS,
  PRESERVED_COLLECTIONS,
  CONFIRM_PHRASE_REQUIRED,
  isTargetCustomerCollection,
  isPreservedCollection,
  purgeCustomerData
};
