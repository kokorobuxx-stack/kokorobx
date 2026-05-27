const { setCors } = require('./_lib/http');
const { loadRateSettings, DEFAULT_RATES } = require('./_lib/rates');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const settings = await loadRateSettings();
    return res.status(200).json(settings);
  } catch (err) {
    return res.status(200).json({
      rates: DEFAULT_RATES,
      defaults: DEFAULT_RATES,
      source: 'default',
      warning: err.message,
      updatedAt: null,
    });
  }
};
