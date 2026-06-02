const { SESSION_COOKIE, appendCookies, clearCookie } = require('./_lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  appendCookies(res, [clearCookie(SESSION_COOKIE)]);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
};
