const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS;
}

function sign(payload) {
  const key = secret();
  if (!key) throw new Error('ADMIN_SESSION_SECRET atau ADMIN_PASS belum diset');

  const encoded = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verify(token) {
  const key = secret();
  if (!key || !token || !token.includes('.')) return null;

  const [encoded, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', key).update(encoded).digest('base64url');

  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(decodeBase64url(encoded));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function verifyCredentials(username, password) {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    throw new Error('ADMIN_USER dan ADMIN_PASS belum diset');
  }
  return username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS;
}

function createAdminToken(username) {
  return sign({
    sub: username,
    role: 'admin',
    exp: Date.now() + TOKEN_TTL_MS,
  });
}

function requireAdmin(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = verify(token);
  if (!payload || payload.role !== 'admin') {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return payload;
}

module.exports = {
  createAdminToken,
  requireAdmin,
  verifyCredentials,
};
