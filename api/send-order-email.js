const { readJsonBody, setCors } = require('./_lib/http');
const { requireAdmin } = require('./_lib/admin-auth');

function getEmailConfig() {
  return {
    serviceId: process.env.EMAILJS_SERVICE_ID || '',
    templateId: process.env.EMAILJS_TEMPLATE_ID || '',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID || '',
    privateKey: process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN || '',
  };
}

function formatRupiah(value) {
  return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
}

function formatRobux(value) {
  return Number(value || 0).toLocaleString('id-ID') + ' R$';
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAdmin(req, res)) return;

  const cfg = getEmailConfig();
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    return res.status(500).json({
      code: 'EMAILJS_CONFIG_MISSING',
      error: 'EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, dan EMAILJS_PUBLIC_KEY belum diset di Vercel',
    });
  }

  const { toEmail, order } = readJsonBody(req);
  const email = String(toEmail || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Email customer tidak ada di data order' });
  }
  if (!order || !order.id) {
    return res.status(400).json({ error: 'Data order tidak valid' });
  }

  const payload = {
    service_id: cfg.serviceId,
    template_id: cfg.templateId,
    user_id: cfg.publicKey,
    template_params: {
      to_email: email,
      to_name: order.username || 'Customer',
      order_id: order.id,
      robux: formatRobux(order.robux),
      total: formatRupiah(order.price),
      metode: order.method || '-',
      dikirim_at: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      roblox_link: 'https://www.roblox.com/my/money',
    },
  };

  if (cfg.privateKey) payload.accessToken = cfg.privateKey;

  try {
    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await emailRes.text();
    if (!emailRes.ok) {
      return res.status(502).json({
        error: 'EmailJS error ' + emailRes.status + ': ' + text,
      });
    }

    return res.status(200).json({ ok: true, message: 'Email terkirim ke ' + email });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
