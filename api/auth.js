const { readJsonBody, setCors } = require('./_lib/http');
const { legacyHashPass } = require('./_lib/password');
const { supabaseFetch } = require('./_lib/supabase');
const {
  SESSION_COOKIE,
  appendCookies,
  clearCookie,
  sessionUserFromReq,
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
    return res.status(404).json({ error: 'Auth route tidak ditemukan' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
