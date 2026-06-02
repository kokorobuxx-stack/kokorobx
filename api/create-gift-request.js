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
    const username = String(body.robloxUsername || body.buyerUsername || body.username || '').trim();
    const recipientUsername = String(body.recipientUsername || body.targetUsername || body.giftUsername || body.username || '').trim();
    const displayName = String(body.displayName || body.display_name || '').trim();
    const contact = String(body.contact || '').trim();
    const game = String(body.game || '').trim();
    const gamepass = String(body.gamepass || '').trim();
    const passId = String(body.passId || body.pass_id || '').trim();
    const totalRobux = Number(String(body.totalRobux || body.robux || '0').replace(/[^\d]/g, ''));
    let rate = normalizeRate(body.rate, DEFAULT_RATES.giftgp);

    if (!username || !game || !gamepass) {
      return res.status(400).json({ error: 'Data request Gift GP belum lengkap' });
    }

    try {
      const settings = await loadRateSettings();
      rate = normalizeRate(settings.rates && settings.rates.giftgp, DEFAULT_RATES.giftgp);
    } catch (err) {
      rate = normalizeRate(body.rate, DEFAULT_RATES.giftgp);
    }
    const price = totalRobux ? totalRobux * rate : 0;

    const detail = [
      'Format Ingame Gifting',
      `Username tujuan: ${recipientUsername || username}`,
      `Display name: ${displayName || '-'}`,
      `Buyer login: ${username}`,
      `Nama game: ${game}`,
      `Nama gamepass: ${gamepass}`,
      `ID gamepass Roblox: ${passId || '-'}`,
      `Total robux: ${totalRobux ? totalRobux.toLocaleString('id-ID') + ' R$' : 'Manual - tanya admin'}`,
      `Kurs: Rp ${rate.toLocaleString('id-ID')} / R$`,
      `Total bayar: ${price ? 'Rp ' + price.toLocaleString('id-ID') : 'Menunggu admin'}`,
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
