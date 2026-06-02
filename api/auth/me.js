const { sessionUserFromReq } = require('./_lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = sessionUserFromReq(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    authenticated: !!user,
    user: user || null,
  });
};
