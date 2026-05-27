const { readJsonBody, setCors } = require('./_lib/http');
const { requireAdmin } = require('./_lib/admin-auth');
const { loadRateSettings, saveRateSettings } = require('./_lib/rates');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await loadRateSettings());
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = readJsonBody(req);
      return res.status(200).json(await saveRateSettings(body.rates || body));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
