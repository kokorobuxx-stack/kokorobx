const { readJsonBody, setCors } = require('./_lib/http');
const { getConfig, supabaseFetch } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, imageBase64 } = readJsonBody(req);
    if (!orderId || !imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length > 5_000_000) {
      return res.status(400).json({ error: 'Data bukti tidak valid' });
    }

    const { url, key } = getConfig();
    const [meta, b64] = imageBase64.split(',');
    if (!meta || !b64) return res.status(400).json({ error: 'Format gambar tidak valid' });

    const mime = (meta.match(/:(.*?);/) || ['', 'image/jpeg'])[1];
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const filePath = 'bukti/' + orderId + '_' + Date.now() + '.' + ext;
    const bytes = Buffer.from(b64, 'base64');

    const uploadRes = await fetch(url + '/storage/v1/object/proofs/' + filePath, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': mime,
        'x-upsert': 'true',
      },
      body: new Blob([bytes], { type: mime }),
    });

    if (!uploadRes.ok) {
      return res.status(500).json({ error: 'Upload bukti gagal', detail: await uploadRes.text() });
    }

    const publicUrl = url + '/storage/v1/object/public/proofs/' + filePath;
    await supabaseFetch('/rest/v1/orders?id=eq.' + encodeURIComponent(orderId), {
      method: 'PATCH',
      body: JSON.stringify({
        proof_url: publicUrl,
        has_proof: true,
        status: 'bukti_masuk',
      }),
    });

    return res.status(200).json({ ok: true, publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
