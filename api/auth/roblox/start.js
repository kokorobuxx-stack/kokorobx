const crypto = require('crypto');
const {
  RETURN_COOKIE,
  STATE_COOKIE,
  appendCookies,
  cookie,
  redirect,
  safeReturnTo,
} = require('../_lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.ROBLOX_CLIENT_ID;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = process.env.ROBLOX_REDIRECT_URI || `${appUrl}/api/auth/roblox/callback`;
  const returnTo = safeReturnTo(req.query && req.query.returnTo, '/akun.html');

  if (!clientId || !process.env.ROBLOX_CLIENT_SECRET) {
    const url = new URL(returnTo, 'https://koko-rbx.local');
    url.searchParams.set('oauth', 'missing-env');
    return redirect(res, url.pathname + url.search + url.hash);
  }

  const state = crypto.randomBytes(24).toString('base64url');
  appendCookies(res, [
    cookie(STATE_COOKIE, state, { maxAge: 600 }),
    cookie(RETURN_COOKIE, returnTo, { maxAge: 600 }),
  ]);

  const authUrl = new URL('https://apis.roblox.com/oauth/v1/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile');
  authUrl.searchParams.set('state', state);

  return redirect(res, authUrl.toString());
};
