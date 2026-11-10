const server = require('../server.js');
const { Readable } = require('stream');
const url = require('url');

module.exports = (req, res) => {
  // Determine real API path on Vercel
  let effectiveUrl = req.url || '/api';
  let targetPath = '';

  // 1. From __route or __path query parameter
  if (req.query && (req.query.__route || req.query.__path || req.query['0'])) {
    const sub = req.query.__route || req.query.__path || req.query['0'];
    targetPath = '/api/' + String(sub).replace(/^\/+/, '');
  } else if (req.headers && req.headers['x-matched-path']) {
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
    effectiveUrl = targetPath;
  }

  // If Vercel already consumed the body into req.body and the stream has ended
  if (req.body !== undefined && (req.readableEnded || req._readableState?.ended)) {
    const rawBody = typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body);
    const stream = new Readable();
    stream._read = () => {};
    stream.push(rawBody);
    stream.push(null);

    // Forward properties
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
