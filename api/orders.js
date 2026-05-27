const { readJsonBody, setCors } = require('./_lib/http');
const { rowToOrder, supabaseFetch } = require('./_lib/supabase');
const { isSettingsUsername } = require('./_lib/rates');

function publicOrderPatch(patch) {
  const clean = {};
  if (patch.status === 'cancelled' || patch.status === 'bukti_masuk') clean.status = patch.status;
  if (patch.proof_url) clean.proof_url = patch.proof_url;
  if (patch.has_proof === true) clean.has_proof = true;
  if (patch.proof_viewed === false) clean.proof_viewed = false;
  return clean;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const username = req.query && req.query.username;
      if (!username) return res.status(400).json({ error: 'Username wajib diisi' });
      if (isSettingsUsername(username)) return res.status(400).json({ error: 'Username tidak valid' });

      const rows = await supabaseFetch(
        '/rest/v1/orders?username=eq.' + encodeURIComponent(username) + '&order=created_at.desc'
      );
      return res.status(200).json(rows.map(rowToOrder));
    }

    if (req.method === 'POST') {
      const order = readJsonBody(req);
      if (!order.id || !order.username) {
        return res.status(400).json({ error: 'Data order belum lengkap' });
      }
      if (isSettingsUsername(order.username)) {
        return res.status(400).json({ error: 'Username tidak valid' });
      }

      await supabaseFetch('/rest/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          id: order.id,
          username: order.username,
          gp_id: order.gpId || '',
          robux: Number(order.robux) || 0,
          price: Number(order.price) || 0,
          method: order.method || '',
          status: 'pending',
          email: order.email || '',
          has_proof: false,
          proof_viewed: false,
          created_at: new Date().toISOString(),
        }),
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const id = req.query && req.query.id;
      const patch = publicOrderPatch(readJsonBody(req));
      if (!id || Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'Update order tidak valid' });
      }

      await supabaseFetch('/rest/v1/orders?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
