const { readJsonBody, setCors } = require('./_lib/http');
const { supabaseFetch } = require('./_lib/supabase');
const { DEFAULT_RATES, loadRateSettings, normalizeRate } = require('./_lib/rates');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = readJsonBody(req);
    const orderId = body.id || 'GGP-' + Math.floor(100000 + Math.random() * 900000);
    const username = String(body.username || '').trim();
    const displayName = String(body.displayName || body.display_name || '').trim();
    const contact = String(body.contact || '').trim();
    const game = String(body.game || '').trim();
    const gamepass = String(body.gamepass || '').trim();
    const totalRobux = Number(String(body.totalRobux || body.robux || '0').replace(/[^\d]/g, ''));
    let rate = normalizeRate(body.rate, DEFAULT_RATES.giftgp);

    if (!username || !game || !gamepass || !totalRobux) {
      return res.status(400).json({ error: 'Data request Gift GP belum lengkap' });
    }

    try {
      const settings = await loadRateSettings();
      rate = normalizeRate(settings.rates && settings.rates.giftgp, DEFAULT_RATES.giftgp);
    } catch (err) {
      rate = normalizeRate(body.rate, DEFAULT_RATES.giftgp);
    }
    const price = totalRobux * rate;

    const detail = [
      'Format Ingame Gifting',
      `Username: ${username}`,
      `Display name: ${displayName || '-'}`,
      `Nama game: ${game}`,
      `Nama gamepass: ${gamepass}`,
      `Total robux: ${totalRobux.toLocaleString('id-ID')}`,
      `Total bayar: Rp ${price.toLocaleString('id-ID')}`,
      'Note: Pastikan format yang kamu isi sudah sesuai!',
    ].join(' | ');

    await supabaseFetch('/rest/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        id: orderId,
        username,
        gp_id: detail,
        robux: totalRobux,
        price,
        method: 'Gift GP Ingame',
        status: 'pending',
        email: contact,
        has_proof: false,
        proof_viewed: false,
        created_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({ ok: true, id: orderId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
