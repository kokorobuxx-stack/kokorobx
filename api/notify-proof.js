const { readJsonBody, setCors } = require('./_lib/http');

async function sendTelegramPhoto(imageBase64, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diset');
  }

  const [meta, b64] = imageBase64.split(',');
  if (!meta || !b64) throw new Error('Format gambar tidak valid');

  const mime = (meta.match(/:(.*?);/) || ['', 'image/jpeg'])[1];
  const ext = mime.includes('png') ? 'png' : 'jpg';
  const bytes = Buffer.from(b64, 'base64');

  const fd = new FormData();
  fd.append('chat_id', chatId);
  fd.append('photo', new Blob([bytes], { type: mime }), 'bukti.' + ext);
  fd.append('caption', String(caption || '').slice(0, 1000));

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    throw new Error('Telegram error ' + res.status + ': ' + await res.text());
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, caption } = readJsonBody(req);
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length > 5_000_000) {
      return res.status(400).json({ error: 'Gambar bukti tidak valid' });
    }

    await sendTelegramPhoto(imageBase64, caption);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
