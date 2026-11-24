const server = require('../server.js');
const { Readable } = require('stream');

module.exports = (req, res) => {
  // Determine real route path on Vercel (supports both API __route and SSR/SEO __page)
  let effectiveUrl = req.url || '/api';
  let targetPath = '';

  const getSingleParam = (val) => (Array.isArray(val) ? val[val.length - 1] : val);

  // 1. Explicit SSR/SEO page rewrite (?__page=/products/slug, /sitemap.xml, /robots.txt, /)
  if (req.query && req.query.__page !== undefined) {
    const rawPage = String(getSingleParam(req.query.__page) || '/');
    targetPath = rawPage.startsWith('/') ? rawPage : '/' + rawPage;
  } else if (effectiveUrl.includes('__page=')) {
    const match = effectiveUrl.match(/__page=([^&]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      targetPath = decoded.startsWith('/') ? decoded : '/' + decoded;
    }
  }
  // 2. Standard API rewrite (?__route=...)
  else if (req.query && (req.query.__route || req.query.__path || req.query['0'])) {
    const sub = getSingleParam(req.query.__route || req.query.__path || req.query['0']);
    const cleanSub = String(sub || '').replace(/^\/+/, '');
    targetPath = cleanSub.startsWith('api/') ? '/' + cleanSub : '/api/' + cleanSub;
  } else if (req.headers && req.headers['x-matched-path'] && req.headers['x-matched-path'] !== '/api/index.js') {
    targetPath = req.headers['x-matched-path'];
  } else if (req.headers && req.headers['x-forwarded-uri']) {
    targetPath = req.headers['x-forwarded-uri'];
  } else if (req.headers && req.headers['x-now-route-matches']) {
    const match = String(req.headers['x-now-route-matches']).match(/1=([^&]+)/);
    if (match && match[1]) {
      targetPath = '/api/' + decodeURIComponent(match[1]).replace(/^\/+/, '');
    }
  } else if (effectiveUrl.includes('__route=')) {
    const match = effectiveUrl.match(/__route=([^&]+)/);
    if (match && match[1]) {
      targetPath = '/api/' + decodeURIComponent(match[1]).replace(/^\/+/, '');
    }
  }

  if (targetPath) {
    const cleanTargetPath = targetPath.split('?')[0] || '/';
    const searchParams = new URLSearchParams();
    const internalKeys = new Set(['__route', '__path', '__page', '0']);

    // Preserve any query parameters present on original req.url or targetPath
    for (const rawUrl of [req.url, targetPath]) {
      const qIdx = String(rawUrl || '').indexOf('?');
      if (qIdx >= 0) {
        const sp = new URLSearchParams(String(rawUrl).slice(qIdx + 1));
        for (const [k, v] of sp.entries()) {
          if (!internalKeys.has(k)) {
            searchParams.set(k, v);
          }
        }
      }
    }

    // Merge Vercel-parsed req.query parameters (excluding internal rewrite params)
    if (req.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (internalKeys.has(k) || v === undefined) continue;
        if (Array.isArray(v)) {
          if (v.length > 0) searchParams.set(k, String(v[v.length - 1]));
        } else {
          searchParams.set(k, String(v));
        }
      }
    }

    const qs = searchParams.toString();
    effectiveUrl = qs ? `${cleanTargetPath}?${qs}` : cleanTargetPath;
  }

  // If Vercel already consumed the body into req.body and the stream has ended
  if (req.body !== undefined && (req.readableEnded || req._readableState?.ended)) {
    const rawBody = typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body);
    const stream = new Readable();
    stream._read = () => {};
    stream.push(rawBody);
    stream.push(null);

    stream.headers = req.headers || {};
    stream.method = req.method;
    stream.url = effectiveUrl;
    stream.query = req.query || {};
    stream.cookies = req.cookies || {};
    stream.connection = req.connection || {};
    stream.socket = req.socket || {};

    server.emit('request', stream, res);
    return;
  }

  req.url = effectiveUrl;
  server.emit('request', req, res);
};
