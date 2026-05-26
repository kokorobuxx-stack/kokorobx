const { readJsonBody, setCors } = require('./_lib/http');
const { legacyHashPass } = require('./_lib/password');
const { supabaseFetch } = require('./_lib/supabase');

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
