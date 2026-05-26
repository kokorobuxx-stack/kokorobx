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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
