const { setCors } = require('./_lib/http');
const { supabaseFetch } = require('./_lib/supabase');
const { SETTINGS_USERNAME } = require('./_lib/rates');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await supabaseFetch(
      '/rest/v1/orders?select=*&username=neq.' + encodeURIComponent(SETTINGS_USERNAME) +
        '&order=created_at.desc&limit=1000'
    );
    const totalOrders = rows.length;
    const totalRobux = rows.reduce((sum, order) => sum + (Number(order.robux) || 0), 0);
    const recentOrders = rows.slice(0, 5).map(order => ({
      username: order.username || 'Seseorang',
      robux: Number(order.robux) || 0,
      time: order.created_at || null,
      package: order.package || order.method || 'Robux',
    }));

    return res.status(200).json({
      totalOrders,
      totalRobux,
      recentOrders,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
