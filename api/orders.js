const { readJsonBody, setCors } = require('./_lib/http');
const { lookupRobloxProfiles, maskUsername, profileForUsername } = require('./_lib/roblox-public');
const robloxGiftCatalog = require('./_lib/roblox-gift-catalog');
const { rowToOrder, supabaseFetch } = require('./_lib/supabase');
const {
  DEFAULT_PRODUCT_STATUS,
  DEFAULT_RATES,
  SETTINGS_USERNAME,
  isSettingsUsername,
  loadProductStatus,
  loadRateSettings,
} = require('./_lib/rates');

function publicOrderPatch(patch) {
  const clean = {};
  if (patch.status === 'cancelled' || patch.status === 'bukti_masuk') clean.status = patch.status;
  if (patch.proof_url) clean.proof_url = patch.proof_url;
  if (patch.has_proof === true) clean.has_proof = true;
  if (patch.proof_viewed === false) clean.proof_viewed = false;
  return clean;
}

function isActiveSale(order) {
  const status = String(order.status || '').toLowerCase();
  return status !== 'failed' && status !== 'cancelled' && status !== 'canceled';
}

async function publicStats(rows) {
  const orders = rows
    .map(rowToOrder)
    .filter(order => order.username && !isSettingsUsername(order.username));
  const activeOrders = orders.filter(isActiveSale);
  const totalOrders = activeOrders.length;
  const totalRobux = activeOrders.reduce((sum, order) => sum + (Number(order.robux) || 0), 0);
  const leaderboardMap = new Map();

  activeOrders.forEach(order => {
    const username = order.username || 'Customer';
    const current = leaderboardMap.get(username) || {
      username,
      robux: 0,
      orders: 0,
      lastTime: 0,
    };
    current.robux += Number(order.robux) || 0;
    current.orders += 1;
    current.lastTime = Math.max(current.lastTime, Number(order.time) || 0);
    leaderboardMap.set(username, current);
  });

  const leaderboard = Array.from(leaderboardMap.values())
    .sort((a, b) => (b.robux - a.robux) || (b.orders - a.orders) || (b.lastTime - a.lastTime))
    .slice(0, 5);
  const recentOrders = activeOrders
    .slice()
    .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0))
    .slice(0, 5)
    .map(order => ({
      id: order.id,
      username: order.username || 'Customer',
      robux: Number(order.robux) || 0,
      method: order.method || 'Robux',
      status: order.status || 'pending',
      time: Number(order.time) || Date.now(),
    }));

  const profiles = await lookupRobloxProfiles([
    ...leaderboard.map(item => item.username),
    ...recentOrders.map(item => item.username),
  ]);

  function publicBuyer(item) {
    const profile = profileForUsername(item.username, profiles);
    return {
      username: profile.maskedUsername || maskUsername(item.username),
      publicName: profile.maskedUsername || maskUsername(item.username),
      avatarUrl: profile.avatarUrl || '',
      profileUrl: profile.profileUrl || '',
      robloxUserId: profile.robloxUserId || null,
    };
  }

  return {
    totalOrders,
    totalRobux,
    leaderboard: leaderboard.map(item => ({
      ...publicBuyer(item),
      robux: item.robux,
      orders: item.orders,
      lastTime: item.lastTime,
    })),
    recentOrders: recentOrders.map(item => ({
      ...publicBuyer(item),
      id: item.id,
      robux: item.robux,
      method: item.method,
      status: item.status,
      time: item.time,
    })),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET' && req.query && req.query.action === 'rates') {
      try {
        return res.status(200).json(await loadRateSettings());
      } catch (err) {
        return res.status(200).json({
          rates: DEFAULT_RATES,
          defaults: DEFAULT_RATES,
          source: 'default',
          warning: err.message,
          updatedAt: null,
        });
      }
    }

    if (req.method === 'GET' && req.query && req.query.action === 'product-status') {
      try {
        return res.status(200).json(await loadProductStatus());
      } catch (err) {
        return res.status(200).json({
          products: DEFAULT_PRODUCT_STATUS,
          defaults: DEFAULT_PRODUCT_STATUS,
          source: 'default',
          warning: err.message,
          updatedAt: null,
        });
      }
    }

    if (req.method === 'GET' && req.query && req.query.action === 'public-stats') {
      const rows = await supabaseFetch(
        '/rest/v1/orders?username=neq.' + encodeURIComponent(SETTINGS_USERNAME) +
          '&select=id,username,gp_id,robux,price,method,status,created_at,has_proof,proof_url,proof_viewed,sent_at,email_sent,email_sent_at' +
          '&order=created_at.desc&limit=1000'
      );
      return res.status(200).json(await publicStats(rows));
    }

    if (req.method === 'GET' && req.query && req.query.action === 'roblox-gift-catalog') {
      return robloxGiftCatalog(req, res);
    }

    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (id) {
        const rows = await supabaseFetch(
          '/rest/v1/orders?id=eq.' + encodeURIComponent(id) + '&limit=1'
        );
        const order = rows && rows[0] ? rowToOrder(rows[0]) : null;
        if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
        return res.status(200).json(order);
      }

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
