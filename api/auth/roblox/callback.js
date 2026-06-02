const {
  RETURN_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  appendCookies,
  clearCookie,
  cookie,
  parseCookies,
  redirect,
  safeReturnTo,
  sign,
} = require('../_lib/session');

function appendParam(path, key, value) {
  const url = new URL(path || '/akun.html', 'https://koko-rbx.local');
  url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parseCookies(req);
  const returnTo = safeReturnTo(cookies[RETURN_COOKIE], '/akun.html');
  const state = String((req.query && req.query.state) || '');
  const code = String((req.query && req.query.code) || '');

  appendCookies(res, [clearCookie(STATE_COOKIE), clearCookie(RETURN_COOKIE)]);

  if (req.query && req.query.error) {
    return redirect(res, appendParam(returnTo, 'oauth', 'cancelled'));
  }

  if (!state || state !== cookies[STATE_COOKIE] || !code) {
    return redirect(res, appendParam(returnTo, 'oauth', 'invalid-state'));
  }

  const clientId = process.env.ROBLOX_CLIENT_ID;
  const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = process.env.ROBLOX_REDIRECT_URI || `${appUrl}/api/auth/roblox/callback`;

  if (!clientId || !clientSecret) {
    return redirect(res, appendParam(returnTo, 'oauth', 'missing-env'));
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Roblox OAuth token gagal.');
    }

    const userResponse = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    });
    const userInfo = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !userInfo.sub) {
      throw new Error(userInfo.error_description || userInfo.error || 'Profil Roblox OAuth gagal dimuat.');
    }

    const username = userInfo.preferred_username || userInfo.name || userInfo.nickname || `Roblox_${userInfo.sub}`;
    const displayName = userInfo.nickname || userInfo.name || username;
    const user = {
      kokoUserId: `rbx_${userInfo.sub}`,
      robloxUserId: String(userInfo.sub),
      robloxUsername: String(username),
      robloxDisplayName: String(displayName),
      robloxAvatar: userInfo.picture || '',
      verified: true,
      loginProvider: 'roblox_oauth',
      status: 'Roblox OAuth Resmi Terhubung',
      lastLoginAt: new Date().toISOString(),
    };

    appendCookies(res, [
      cookie(SESSION_COOKIE, sign({
        user,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
      }), { maxAge: 60 * 60 * 24 * 30 }),
    ]);

    return redirect(res, appendParam(returnTo, 'auth', 'roblox'));
  } catch (error) {
    return redirect(res, appendParam(returnTo, 'oauth', 'failed'));
  }
};
