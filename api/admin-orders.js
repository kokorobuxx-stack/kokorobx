const { readJsonBody, setCors } = require('./_lib/http');
const { requireAdmin } = require('./_lib/admin-auth');
const { rowToOrder, supabaseFetch } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const rows = await supabaseFetch('/rest/v1/orders?order=created_at.desc&limit=500');
      return res.status(200).json(rows.map(rowToOrder));
    }

    if (req.method === 'PATCH') {
      const { id, patch } = readJsonBody(req);
      if (!id || !patch || typeof patch !== 'object') {
        return res.status(400).json({ error: 'ID atau data update tidak valid' });
      }

      await supabaseFetch('/rest/v1/orders?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ error: 'ID order wajib diisi' });

      await supabaseFetch('/rest/v1/orders?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
