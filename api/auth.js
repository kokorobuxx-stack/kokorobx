const crypto = require('crypto');
const { readJsonBody, setCors } = require('./_lib/http');
const { legacyHashPass } = require('./_lib/password');
const { supabaseFetch } = require('./_lib/supabase');
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
  sessionUserFromReq,
  sign,
} = require('./_lib/session');

function sessionFromUser(user) {
  return {
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name || '',
    wa: user.wa || '',
    joinedAt: user.joined_at,
  };
}

function appendParam(path, key, value) {
  const url = new URL(path || '/akun.html', 'https://koko-rbx.local');
  url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identity, password } = readJsonBody(req);
  const normalized = String(identity || '').trim().toLowerCase();
  if (!normalized || !password) {
    return res.status(400).json({ error: 'Email/username dan password wajib diisi' });
  }

  const field = normalized.includes('@') ? 'email' : 'username';
  const hashed = legacyHashPass(String(password));
  const rows = await supabaseFetch(
    `/rest/v1/users?${field}=eq.${encodeURIComponent(normalized)}&password=eq.${encodeURIComponent(hashed)}&select=*`
  );

  if (!rows || rows.length === 0) {
    return res.status(401).json({ error: 'Email/username atau password salah' });
  }

  return res.status(200).json({ session: sessionFromUser(rows[0]) });
}

async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = readJsonBody(req);
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const email = String(body.email || '').trim().toLowerCase();
  const wa = String(body.wa || '').trim();
  const password = String(body.password || '');

  if (!firstName || !username || !email || !password) {
    return res.status(400).json({ error: 'Data akun belum lengkap' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username 3-20 karakter, hanya huruf/angka/underscore' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Format email tidak valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }

  const existingUsername = await supabaseFetch(
    `/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=id`
  );
  if (existingUsername.length > 0) {
    return res.status(409).json({ field: 'username', error: 'Username sudah dipakai' });
  }

  const existingEmail = await supabaseFetch(
    `/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id`
  );
  if (existingEmail.length > 0) {
    return res.status(409).json({ field: 'email', error: 'Email sudah terdaftar' });
  }

  const newUser = {
    id: 'USR-' + Math.floor(100000 + Math.random() * 900000),
    first_name: firstName,
    last_name: lastName,
    username,
    email,
    wa,
    password: legacyHashPass(password),
    joined_at: new Date().toISOString(),
  };

  const rows = await supabaseFetch('/rest/v1/users', {
    method: 'POST',
    body: JSON.stringify(newUser),
  });

  return res.status(200).json({
    session: sessionFromUser(rows[0] || newUser),
  });
}

async function handleCheckUsername(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const username = String((req.query && req.query.username) || '').trim().toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username tidak valid' });
  }

  const rows = await supabaseFetch(
    `/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=id`
  );

  return res.status(200).json({ taken: rows.length > 0 });
}

function handleMe(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = sessionUserFromReq(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ authenticated: !!user, user: user || null });
}

function handleLogout(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  appendCookies(res, [clearCookie(SESSION_COOKIE)]);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}

function handleRobloxStart(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.ROBLOX_CLIENT_ID;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = process.env.ROBLOX_REDIRECT_URI || `${appUrl}/api/auth/roblox/callback`;
  const returnTo = safeReturnTo(req.query && req.query.returnTo, '/akun.html');

  if (!clientId || !process.env.ROBLOX_CLIENT_SECRET) {
    return redirect(res, appendParam(returnTo, 'oauth', 'missing-env'));
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
}

async function handleRobloxCallback(req, res) {
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
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = String((req.query && req.query.action) || '').trim();
    if (action === 'login') return handleLogin(req, res);
    if (action === 'register') return handleRegister(req, res);
    if (action === 'check-username') return handleCheckUsername(req, res);
    if (action === 'me') return handleMe(req, res);
    if (action === 'logout') return handleLogout(req, res);
    if (action === 'roblox-start') return handleRobloxStart(req, res);
    if (action === 'roblox-callback') return handleRobloxCallback(req, res);
    return res.status(404).json({ error: 'Auth route tidak ditemukan' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
