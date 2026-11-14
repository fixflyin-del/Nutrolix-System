/**
 * Nutrolix Cloud Database Bridge (Firebase Firestore v10 + Compat)
 * Connects Customer Web App, Mobile App, Android APK, and Admin Terminal to live Firebase Firestore.
 */
(function() {
  if (typeof window.NUTROLIX_API_HOST === 'undefined') {
    window.NUTROLIX_API_HOST = (window.location && window.location.protocol === 'file:')
      ? 'https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app'
      : '';
  }

  const firebaseConfig = {
    apiKey: "AIzaSyBuhfsAcQYge5kp71vHA4qgQhpA7ryur-A",
    authDomain: "com-aistudio-nutrolix-fo-56ac8.firebaseapp.com",
    projectId: "com-aistudio-nutrolix-fo-56ac8",
    storageBucket: "com-aistudio-nutrolix-fo-56ac8.firebasestorage.app",
    messagingSenderId: "836516139018",
    appId: "1:836516139018:android:6ec9886f508ace4b1f4ff3"
  };

  let firestoreDb = null;

  function initDb() {
    try {
      if (typeof firebase !== 'undefined') {
        if (!firebase.apps || !firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        if (typeof firebase.firestore === 'function') {
          firestoreDb = firebase.firestore();
        }
      }
    } catch (err) {
      console.warn('Firebase init warning:', err.message);
    }
    return firestoreDb;
  }

  initDb();

  function cleanPhone(p) {
    if (!p) return '';
    return String(p).replace(/\D/g, '').slice(-10);
  }

  function hashTokenId(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return 'tok_' + Math.abs(h).toString(36) + '_' + s.length;
  }

  window.NutrolixFirebase = {
    config: firebaseConfig,
    getDb: function() {
      if (!firestoreDb) initDb();
      return firestoreDb;
    },

    // 1. ORDERS REAL-TIME SYNC
    saveOrder: async function(orderData) {
      const db = this.getDb();
      const skipApi = Boolean(orderData && orderData._skipApi);
      const cleanOrder = { ...(orderData || {}) };
      delete cleanOrder._skipApi;

      if (!cleanOrder.orderId) {
        cleanOrder.orderId = cleanOrder.id || ('ORD-' + Math.floor(100000 + Math.random() * 900000));
      }
      if (!cleanOrder.id) cleanOrder.id = cleanOrder.orderId;
      if (!cleanOrder.createdAt) cleanOrder.createdAt = new Date().toISOString();
      if (!cleanOrder.timestamp) cleanOrder.timestamp = Date.now();
      if (!cleanOrder.orderTimeMillis) cleanOrder.orderTimeMillis = cleanOrder.timestamp;

      const authUid = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser)
        ? firebase.auth().currentUser.uid
        : '';
      if (!cleanOrder.uid && authUid) {
        cleanOrder.uid = authUid;
      }

      if (db) {
        try {
          await db.collection('orders').doc(cleanOrder.orderId).set(cleanOrder, { merge: true });
        } catch (e) {
          console.warn('Firestore order save fallback:', e.message);
        }
      }

      // Sync customer summary profile under UID when available
      if (cleanOrder.uid || (cleanOrder.customer && (cleanOrder.customer.phone || cleanOrder.customer.email))) {
        this.saveUser({
          uid: cleanOrder.uid || '',
          id: cleanOrder.uid || cleanOrder.customer?.phone || cleanOrder.customer?.email,
          name: cleanOrder.customer?.name || cleanOrder.customerName || 'Customer',
          phone: cleanOrder.customer?.phone || cleanOrder.customerPhone || '',
          whatsappNumber: cleanOrder.whatsappNumber || cleanOrder.customer?.whatsappNumber || cleanOrder.customer?.phone || '',
          email: cleanOrder.customer?.email || cleanOrder.customerEmail || '',
          lastAddress: cleanOrder.deliveryAddress
            ? [cleanOrder.deliveryAddress.address1, cleanOrder.deliveryAddress.city, cleanOrder.deliveryAddress.pincode].filter(Boolean).join(', ')
            : '',
          lastOrderId: cleanOrder.orderId,
          lastOrderAmount: Number(cleanOrder.grandTotal || cleanOrder.total || 0),
          updatedAt: cleanOrder.createdAt
        }).catch(() => {});
      }

      if (!skipApi) {
        try {
          const host = window.NUTROLIX_API_HOST || '';
          await fetch(host + '/api/nutrition-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanOrder)
          });
        } catch (_) {}
      }

      try {
        const local = JSON.parse(localStorage.getItem('nutrolix_customer_orders') || '[]')
          .filter(o => (o.id || o.orderId) !== cleanOrder.orderId);
        local.unshift(cleanOrder);
        localStorage.setItem('nutrolix_customer_orders', JSON.stringify(local.slice(0, 60)));
      } catch (_) {}

      return cleanOrder;
    },

    // Admin global listener
    subscribeOrders: function(onData, onError) {
      const db = this.getDb();
      if (!db) return null;
      try {
        return db.collection('orders').onSnapshot(
          snapshot => {
            const orders = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const oid = data.orderId || data.id || doc.id;
              orders.push({ ...data, id: oid, orderId: oid });
            });
            orders.sort((a, b) => {
              const ta = Number(a.timestamp || a.orderTimeMillis || Date.parse(a.createdAt || a.orderTime || 0) || 0);
              const tb = Number(b.timestamp || b.orderTimeMillis || Date.parse(b.createdAt || b.orderTime || 0) || 0);
              return tb - ta;
            });
            onData(orders.slice(0, 200));
          },
          err => { if (onError) onError(err); }
        );
      } catch (e) {
        return null;
      }
    },

    // Customer-scoped UID order listener (strictly compliant with zero-trust rules)
    subscribeUserOrders: function(uid, onData, onError) {
      const db = this.getDb();
      if (!db || !uid) return null;
      try {
        return db.collection('orders').where('uid', '==', uid).onSnapshot(
          snapshot => {
            const orders = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const oid = data.orderId || data.id || doc.id;
              orders.push({ ...data, id: oid, orderId: oid });
            });
            orders.sort((a, b) => {
              const ta = Number(a.timestamp || a.orderTimeMillis || Date.parse(a.createdAt || a.orderTime || 0) || 0);
              const tb = Number(b.timestamp || b.orderTimeMillis || Date.parse(b.createdAt || b.orderTime || 0) || 0);
              return tb - ta;
            });
            onData(orders);
          },
          err => { if (onError) onError(err); }
        );
      } catch (e) {
        return null;
      }
    },

    // 2. CUSTOMER PROFILES & ADDRESS BOOK
    saveUserProfile: async function(uid, userData) {
      const db = this.getDb();
      const targetUid = String(uid || (userData && userData.uid) || '').trim();
      if (!db || !targetUid) return null;
      const payload = {
        ...(userData || {}),
        uid: targetUid,
        id: targetUid,
        updatedAt: new Date().toISOString(),
        updatedAtMillis: Date.now()
      };
      try {
        await db.collection('users').doc(targetUid).set(payload, { merge: true });
      } catch (e) {
        console.warn('Firestore saveUserProfile notice:', e.message);
      }
      return payload;
    },

    fetchUserProfile: async function(uid) {
      const db = this.getDb();
      if (!db || !uid) return null;
      try {
        const doc = await db.collection('users').doc(uid).get();
        return doc.exists ? { uid: doc.id, id: doc.id, ...doc.data() } : null;
      } catch (e) {
        return null;
      }
    },

    saveUser: async function(userData) {
      const db = this.getDb();
      if (!db || !userData) return null;
      const key = String(userData.uid || userData.id || userData.phone || userData.email || '').trim();
      if (!key) return null;
      const payload = {
        ...userData,
        id: key,
        updatedAt: userData.updatedAt || new Date().toISOString(),
        updatedAtMillis: Date.now()
      };
      try {
        await db.collection('users').doc(key).set(payload, { merge: true });
      } catch (e) {
        console.warn('Firestore saveUser notice:', e.message);
      }
      return payload;
    },

    subscribeUsers: function(onData, onError) {
      const db = this.getDb();
      if (!db) return null;
      try {
        return db.collection('users').onSnapshot(
          snapshot => {
            const users = [];
            snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
            users.sort((a, b) => {
              const ta = Number(a.updatedAtMillis || Date.parse(a.updatedAt || a.lastLoginAt || 0) || 0);
              const tb = Number(b.updatedAtMillis || Date.parse(b.updatedAt || b.lastLoginAt || 0) || 0);
              return tb - ta;
            });
            onData(users);
          },
          err => { if (onError) onError(err); }
        );
      } catch (e) {
        return null;
      }
    },

    saveUserAddress: async function(uid, addressObj) {
      const db = this.getDb();
      if (!addressObj) return null;
      const cleanAddr = {
        ...addressObj,
        id: addressObj.id || ('addr_' + Date.now().toString(36)),
        uid: uid || '',
        updatedAt: new Date().toISOString(),
        updatedAtMillis: Date.now()
      };
      if (db && uid) {
        try {
          await db.collection('users').doc(uid).collection('addresses').doc(cleanAddr.id).set(cleanAddr, { merge: true });
        } catch (e) {
          console.warn('Firestore saveUserAddress notice:', e.message);
        }
      }
      return cleanAddr;
    },

    fetchUserAddresses: async function(uid) {
      const db = this.getDb();
      if (!db || !uid) return [];
      try {
        const snap = await db.collection('users').doc(uid).collection('addresses').get();
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => Number(b.updatedAtMillis || 0) - Number(a.updatedAtMillis || 0));
        return list;
      } catch (e) {
        return [];
      }
    },

    deleteUserAddress: async function(uid, addrId) {
      const db = this.getDb();
      if (!db || !uid || !addrId) return false;
      try {
        await db.collection('users').doc(uid).collection('addresses').doc(addrId).delete();
        return true;
      } catch (e) {
        return false;
      }
    },

    mergeAccountDataToUid: async function(oldUid, newUid, extraProfile = {}) {
      const db = this.getDb();
      if (!db || !newUid) return;
      try {
        if (oldUid && oldUid !== newUid) {
          const oldProfileDoc = await db.collection('users').doc(oldUid).get().catch(() => null);
          const oldData = (oldProfileDoc && oldProfileDoc.exists) ? oldProfileDoc.data() : {};
          const merged = {
            ...oldData,
            ...extraProfile,
            uid: newUid,
            id: newUid,
            linkedFromUid: oldUid,
            updatedAt: new Date().toISOString(),
            updatedAtMillis: Date.now()
          };
          await db.collection('users').doc(newUid).set(merged, { merge: true });
        } else {
          await this.saveUserProfile(newUid, extraProfile);
        }
      } catch (e) {
        console.warn('mergeAccountDataToUid notice:', e.message);
      }
    },

    // 3. FCM TOKENS & USER NOTIFICATION HISTORY
    saveFcmToken: async function(uid, tokenObj) {
      const db = this.getDb();
      if (!db || !uid || !tokenObj) return false;
      const rawTok = tokenObj.fcmToken || tokenObj.token || tokenObj.endpoint;
      if (!rawTok) return false;
      const docId = hashTokenId(rawTok);
      try {
        await db.collection('users').doc(uid).collection('fcmTokens').doc(docId).set({
          uid,
          token: rawTok,
          fcmToken: tokenObj.fcmToken || rawTok,
          platform: tokenObj.platform || 'web',
          customerPhone: cleanPhone(tokenObj.customerPhone || tokenObj.phone || ''),
          customerEmail: String(tokenObj.customerEmail || tokenObj.email || '').toLowerCase().trim(),
          updatedAt: new Date().toISOString(),
          updatedAtMillis: Date.now()
        }, { merge: true });
        return true;
      } catch (e) {
        return false;
      }
    },

    subscribeUserNotifications: function(uid, onData, onError) {
      const db = this.getDb();
      if (!db || !uid) return null;
      try {
        return db.collection('users').doc(uid).collection('notifications').onSnapshot(
          snap => {
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => {
              const ta = Date.parse(a.timestamp || 0) || 0;
              const tb = Date.parse(b.timestamp || 0) || 0;
              return tb - ta;
            });
            onData(list.slice(0, 50));
          },
          err => { if (onError) onError(err); }
        );
      } catch (e) {
        return null;
      }
    },

    markNotificationRead: async function(uid, notifId) {
      const db = this.getDb();
      if (!db || !uid || !notifId) return;
      try {
        await db.collection('users').doc(uid).collection('notifications').doc(notifId).set({ read: true }, { merge: true });
      } catch (_) {}
    },

    updateOrderStatus: async function(orderId, statusData) {
      const db = this.getDb();
      if (db) {
        try {
          await db.collection('orders').doc(orderId).set({
            ...statusData,
            statusUpdatedAt: statusData.statusUpdatedAt || new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn('Firestore update order status fallback:', e.message);
        }
      }
      try {
        const host = window.NUTROLIX_API_HOST || '';
        await fetch(host + '/api/nutrition-orders/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, ...statusData })
        });
      } catch (_) {}
    },

    // 4. PRODUCTS REAL-TIME SYNC
    saveProduct: async function(productData) {
      const db = this.getDb();
      if (!productData.id) productData.id = 'prod_' + Date.now().toString(36);
      productData.updatedAt = new Date().toISOString();

      if (db) {
        try { await db.collection('products').doc(productData.id).set(productData, { merge: true }); } catch (_) {}
      }
      try {
        const host = window.NUTROLIX_API_HOST || '';
        await fetch(host + '/api/nutrition-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
      } catch (_) {}
      return productData;
    },

    deleteProduct: async function(productId) {
      const db = this.getDb();
      if (db) {
        try { await db.collection('products').doc(productId).delete(); } catch (_) {}
      }
      try {
        const host = window.NUTROLIX_API_HOST || '';
        await fetch(host + '/api/nutrition-products/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: productId })
        });
      } catch (_) {}
    },

    subscribeProducts: function(onData) {
      const db = this.getDb();
      if (!db) return null;
      try {
        return db.collection('products').onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const prods = [];
              snapshot.forEach(doc => prods.push({ id: doc.id, ...doc.data() }));
              if (prods.length > 0) {
                window.nutroProducts = prods;
                onData(prods);
              }
            }
          },
          err => console.warn('Products sync notice:', err.message)
        );
      } catch (e) {
        return null;
      }
    },

    // 5. STORE SETTINGS & PAYU CONFIG
    saveStoreSettings: async function(settings) {
      const db = this.getDb();
      if (db) {
        try { await db.collection('settings').doc('store').set(settings, { merge: true }); } catch (_) {}
      }
      try {
        localStorage.setItem('nutrolix_store_settings', JSON.stringify(settings));
        const host = window.NUTROLIX_API_HOST || '';
        await fetch(host + '/api/store-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
      } catch (_) {}
    },

    subscribeStoreSettings: function(onData) {
      const db = this.getDb();
      if (!db) return null;
      try {
        return db.collection('settings').doc('store').onSnapshot(
          doc => {
            if (doc.exists) {
              const data = doc.data();
              try { localStorage.setItem('nutrolix_store_settings', JSON.stringify(data)); } catch (_) {}
              onData(data);
            }
          },
          err => console.warn('Store settings sync notice:', err.message)
        );
      } catch (e) {
        return null;
      }
    },

    // 6. BLOGS REAL-TIME SYNC
    saveBlog: async function(blogData) {
      const db = this.getDb();
      if (!blogData.id) blogData.id = 'blog_' + Date.now().toString(36);
      if (db) {
        try { await db.collection('blogs').doc(blogData.id).set(blogData, { merge: true }); } catch (_) {}
      }
      try {
        const host = window.NUTROLIX_API_HOST || '';
        await fetch(host + '/api/blogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blogData)
        });
      } catch (_) {}
      return blogData;
    },

    deleteBlog: async function(blogId) {
      const db = this.getDb();
      if (db) {
        try { await db.collection('blogs').doc(blogId).delete(); } catch (_) {}
      }
      try {
        const host = window.NUTROLIX_API_HOST || '';
        await fetch(host + '/api/blogs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: blogId })
        });
      } catch (_) {}
    },

    subscribeBlogs: function(onData) {
      const db = this.getDb();
      if (!db) return null;
      try {
        return db.collection('blogs').onSnapshot(
          snapshot => {
            if (!snapshot.empty) {
              const blogs = [];
              snapshot.forEach(doc => blogs.push({ id: doc.id, ...doc.data() }));
              window.nutroBlogs = blogs;
              onData(blogs);
            }
          },
          err => console.warn('Blogs sync notice:', err.message)
        );
      } catch (e) {
        return null;
      }
    }
  };
})();
