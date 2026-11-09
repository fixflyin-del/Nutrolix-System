const server = require('../server.js');
const { Readable } = require('stream');

module.exports = (req, res) => {
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
    stream.url = req.url;
    stream.query = req.query || {};
    stream.cookies = req.cookies || {};
    stream.connection = req.connection || {};
    stream.socket = req.socket || {};

    server.emit('request', stream, res);
    return;
  }

  server.emit('request', req, res);
};
