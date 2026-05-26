const { setCors } = require('./_lib/http');
const { supabaseFetch } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const username = String((req.query && req.query.username) || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username tidak valid' });
    }

    const rows = await supabaseFetch(
      `/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=id`
    );

    return res.status(200).json({ taken: rows.length > 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
