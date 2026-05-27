const { readJsonBody, setCors } = require('./_lib/http');
const { requireAdmin } = require('./_lib/admin-auth');
const { rowToOrder, supabaseFetch } = require('./_lib/supabase');
const { SETTINGS_USERNAME } = require('./_lib/rates');

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function sendOrderEmail(req, res) {
  const cfg = getEmailConfig();
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    return res.status(500).json({
      code: 'EMAILJS_CONFIG_MISSING',
      error: 'EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, dan EMAILJS_PUBLIC_KEY belum diset di Vercel',
    });
  }

  const { toEmail, order } = readJsonBody(req);
  const email = String(toEmail || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email customer tidak ada di data order' });
  if (!isValidEmail(email)) {
    return res.status(400).json({
      code: 'EMAIL_CUSTOMER_INVALID',
      error: 'Email customer tidak valid: ' + email,
    });
  }
  if (!order || !order.id) return res.status(400).json({ error: 'Data order tidak valid' });

  const payload = {
    service_id: cfg.serviceId,
    template_id: cfg.templateId,
    user_id: cfg.publicKey,
    template_params: {
      to_email: email,
      email,
      reply_to: email,
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

  const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await emailRes.text();
  if (!emailRes.ok) {
    if (emailRes.status === 403 && /non-browser environments/i.test(text)) {
      return res.status(403).json({
        code: 'EMAILJS_NON_BROWSER_DISABLED',
        error: 'EmailJS belum mengizinkan kirim dari backend. Admin akan mencoba kirim dari browser.',
      });
    }
    return res.status(502).json({ error: 'EmailJS error ' + emailRes.status + ': ' + text });
  }

  return res.status(200).json({ ok: true, message: 'Email terkirim ke ' + email });
}

function sendEmailConfig(res) {
  const cfg = getEmailConfig();
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    return res.status(500).json({
      code: 'EMAILJS_CONFIG_MISSING',
      error: 'EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, dan EMAILJS_PUBLIC_KEY belum diset di Vercel',
    });
  }

  return res.status(200).json({
    serviceId: cfg.serviceId,
    templateId: cfg.templateId,
    publicKey: cfg.publicKey,
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET' && req.query && req.query.action === 'email-config') {
      return sendEmailConfig(res);
    }

    if (req.method === 'POST' && req.query && req.query.action === 'send-email') {
      return await sendOrderEmail(req, res);
    }

    if (req.method === 'GET') {
      const rows = await supabaseFetch(
        '/rest/v1/orders?username=neq.' + encodeURIComponent(SETTINGS_USERNAME) +
          '&order=created_at.desc&limit=500'
      );
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
