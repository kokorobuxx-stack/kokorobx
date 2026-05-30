const { setCors } = require('./_lib/http');
const { rowToOrder, supabaseFetch } = require('./_lib/supabase');
const { isSettingsUsername } = require('./_lib/rates');

function cleanOrder(order) {
  return {
    id: order.id,
    username: order.username,
    robux: order.robux,
    price: order.price,
    method: order.method,
    status: order.status,
    time: order.time,
    hasProof: order.hasProof,
    sentAt: order.sentAt,
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const id = String((req.query && req.query.id) || '').trim().toUpperCase();
    if (!/^RBX-\d{6,}$/.test(id)) {
      return res.status(400).json({ error: 'Format ID order tidak valid' });
    }

    const rows = await supabaseFetch(
      '/rest/v1/orders?id=eq.' + encodeURIComponent(id) +
        '&select=id,username,gp_id,robux,price,method,status,created_at,has_proof,proof_url,proof_viewed,sent_at,email_sent,email_sent_at&limit=1'
    );

    if (!rows || rows.length === 0 || isSettingsUsername(rows[0].username)) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    return res.status(200).json({ order: cleanOrder(rowToOrder(rows[0])) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
