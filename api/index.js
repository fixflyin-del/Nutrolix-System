const server = require('../server.js');
const { Readable } = require('stream');

module.exports = (req, res) => {
  // Determine real API path on Vercel
  let effectiveUrl = req.url || '/api';
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && (effectiveUrl.startsWith('/api/index.js') || effectiveUrl === '/api' || effectiveUrl === '/api/')) {
    effectiveUrl = matchedPath;
  } else if (effectiveUrl.startsWith('/api/index.js')) {
    if (req.query && req.query['0']) {
      effectiveUrl = '/api/' + req.query['0'];
    }
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
