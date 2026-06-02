const crypto = require('crypto');

const SESSION_COOKIE = 'koko_session';
const STATE_COOKIE = 'koko_oauth_state';
const RETURN_COOKIE = 'koko_oauth_return';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64url(input) {
  let value = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Buffer.from(value, 'base64').toString('utf8');
}

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-change-this-session-secret';
}

function sign(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret()).update(parts[0]).digest('base64url');
  if (Buffer.byteLength(parts[1]) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(fromBase64url(parts[0]));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function parseCookies(req) {
  return String((req.headers && req.headers.cookie) || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((out, part) => {
      const index = part.indexOf('=');
      if (index < 0) return out;
      out[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1));
      return out;
    }, {});
}

function cookie(name, value, options = {}) {
  const pieces = [
    encodeURIComponent(name) + '=' + encodeURIComponent(value || ''),
    'Path=/',
    'SameSite=Lax',
    'Secure',
  ];
  if (options.httpOnly !== false) pieces.push('HttpOnly');
  if (options.maxAge != null) pieces.push('Max-Age=' + Number(options.maxAge));
  return pieces.join('; ');
}

function clearCookie(name) {
  return cookie(name, '', { maxAge: 0 });
}

function appendCookies(res, values) {
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader('Set-Cookie', list.concat(values));
}

function safeReturnTo(value, fallback = '/akun.html') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const app = new URL(process.env.APP_URL || 'https://koko-rbx.vercel.app');
      const url = new URL(raw);
      if (url.origin !== app.origin) return fallback;
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return fallback;
    }
  }
  if (raw.startsWith('/')) return raw;
  if (/^[a-z0-9_.-]+\.html/i.test(raw)) return '/' + raw;
  return fallback;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function sessionUserFromReq(req) {
  const cookies = parseCookies(req);
  const session = verify(cookies[SESSION_COOKIE]);
  return session && session.user ? session.user : null;
}

module.exports = {
  RETURN_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  appendCookies,
  clearCookie,
  cookie,
  parseCookies,
  redirect,
  safeReturnTo,
  sessionUserFromReq,
  sign,
  verify,
};
