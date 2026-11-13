/**
 * Nutrolix Cloud Database Bridge (Firebase Firestore v10 + Compat)
 * Connects Customer Web App, Mobile App, and Admin Terminal to live Firebase Firestore.
 * Supports standalone static deployment (Netlify, Cloud Run, Vercel, VPS).
 */
(function() {
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
          console.log('✅ Nutrolix: Firebase Firestore connected successfully.');
        }
      }
    } catch (err) {
      console.warn('Firebase init warning:', err.message);
    }
    return firestoreDb;
  }

  // Auto-init on script load
  initDb();

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

      if (db) {
        try {
          await db.collection('orders').doc(cleanOrder.orderId).set(cleanOrder, { merge: true });
          console.log('✅ Order synced to Firestore:', cleanOrder.orderId);
        } catch (e) {
          console.warn('Firestore order save fallback:', e.message);
        }
      }

      // Also save/upsert customer profile into users collection
      if (cleanOrder.customer && (cleanOrder.customer.phone || cleanOrder.customer.email)) {
        this.saveUser({
          id: cleanOrder.customer.phone || cleanOrder.customer.email,
          name: cleanOrder.customer.name || 'Customer',
          phone: cleanOrder.customer.phone || '',
          email: cleanOrder.customer.email || '',
          lastAddress: cleanOrder.deliveryAddress
            ? [cleanOrder.deliveryAddress.address1, cleanOrder.deliveryAddress.city, cleanOrder.deliveryAddress.pincode].filter(Boolean).join(', ')
            : '',
          lastOrderId: cleanOrder.orderId,
          lastOrderAmount: Number(cleanOrder.grandTotal || cleanOrder.total || 0),
          updatedAt: cleanOrder.createdAt
        }).catch(() => {});
      }

      // Also dispatch to local/cloud server API if accessible and not already dispatched
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

      // Cache in localStorage for immediate offline customer tracking
      try {
        const local = JSON.parse(localStorage.getItem('nutrolix_customer_orders') || '[]')
          .filter(o => (o.id || o.orderId) !== cleanOrder.orderId);
        local.unshift(cleanOrder);
        localStorage.setItem('nutrolix_customer_orders', JSON.stringify(local.slice(0, 50)));
      } catch (_) {}

      return cleanOrder;
    },

    subscribeOrders: function(onData, onError) {
      const db = this.getDb();
      if (!db) return null;
      try {
        // Query whole collection without orderBy('timestamp') so Kotlin APK docs (which use orderTimeMillis) are never filtered out
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
          err => {
            if (onError) onError(err);
          }
        );
      } catch (e) {
        console.warn('Subscribe orders error:', e);
        return null;
      }
    },

    saveUser: async function(userData) {
      const db = this.getDb();
      if (!db || !userData) return null;
      const key = String(userData.uid || userData.phone || userData.email || userData.id || '').trim();
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
          err => {
            if (onError) onError(err);
          }
        );
      } catch (e) {
        return null;
      }
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

    // 2. PRODUCTS REAL-TIME SYNC
    saveProduct: async function(productData) {
      const db = this.getDb();
      if (!productData.id) {
        productData.id = 'prod_' + Date.now().toString(36);
      }
      productData.updatedAt = new Date().toISOString();

      if (db) {
        try {
          await db.collection('products').doc(productData.id).set(productData, { merge: true });
          console.log('✅ Product synced to Firestore:', productData.id);
        } catch (e) {
          console.warn('Firestore saveProduct error:', e.message);
        }
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
        try {
          await db.collection('products').doc(productId).delete();
        } catch (e) {
          console.warn('Firestore deleteProduct error:', e.message);
        }
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

    // 3. STORE SETTINGS & PAYU CONFIG
    saveStoreSettings: async function(settings) {
      const db = this.getDb();
      if (db) {
        try {
          await db.collection('settings').doc('store').set(settings, { merge: true });
          console.log('✅ Store settings synced to Firestore.');
        } catch (e) {
          console.warn('Firestore saveStoreSettings error:', e.message);
        }
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

    // 4. BLOGS REAL-TIME SYNC
    saveBlog: async function(blogData) {
      const db = this.getDb();
      if (!blogData.id) blogData.id = 'blog_' + Date.now().toString(36);
      if (db) {
        try {
          await db.collection('blogs').doc(blogData.id).set(blogData, { merge: true });
        } catch (e) {
          console.warn('Firestore saveBlog error:', e.message);
        }
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
