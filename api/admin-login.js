const { readJsonBody, setCors } = require('./_lib/http');
const { createAdminToken, verifyCredentials } = require('./_lib/admin-auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = readJsonBody(req);
    if (!username || !password || !verifyCredentials(username, password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    return res.status(200).json({
      token: createAdminToken(username),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
