const { readJsonBody, setCors } = require('./_lib/http');
const { supabaseFetch } = require('./_lib/supabase');

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
    const contact = String(body.contact || '').trim();
    const game = String(body.game || '').trim();
    const gamepass = String(body.gamepass || '').trim();
    const totalRobux = Number(String(body.totalRobux || body.robux || '0').replace(/[^\d]/g, ''));

    if (!username || !game || !gamepass || !totalRobux) {
      return res.status(400).json({ error: 'Data request Gift GP belum lengkap' });
    }

    const detail = [
      'Format Ingame Gifting',
      `Username: ${username}`,
      `Nama game: ${game}`,
      `Nama gamepass: ${gamepass}`,
      `Total robux: ${totalRobux.toLocaleString('id-ID')}`,
      'Note: Pastikan format yang kamu isi sudah sesuai!',
    ].join(' | ');

    await supabaseFetch('/rest/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        id: orderId,
        username,
        gp_id: detail,
        robux: totalRobux,
        price: 0,
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
