function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diset');
  }

  return { url, key };
}

async function supabaseFetch(path, opts = {}) {
  const { url, key } = getConfig();
  const res = await fetch(url + path, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Supabase error ' + res.status + ': ' + err);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

function rowToOrder(row) {
  const statusMap = {
    bukti_masuk: 'pending',
    completed: 'success',
    complete: 'success',
    done: 'success',
    rejected: 'failed',
    cancelled: 'failed',
    canceled: 'failed',
  };
  const status = statusMap[row.status] || row.status || 'pending';

  return {
    id: row.id || row.order_id || '',
    username: row.username || row.roblox_username || row.user || '-',
    gpId: row.gp_id || row.gamepass_id || '',
    robux: Number(row.robux || 0),
    price: Number(row.price || row.total || row.amount || 0),
    method: row.method || row.payment_method || row.metode || '-',
    status,
    time: row.created_at ? new Date(row.created_at).getTime() : row.time || Date.now(),
    hasProof: !!(row.proof_url || row.has_proof || row.bukti_url),
    proofImage: row.proof_url || row.bukti_url || null,
    proofViewed: !!row.proof_viewed,
    sentAt: row.sent_at ? new Date(row.sent_at).getTime() : null,
    emailSent: !!row.email_sent,
    emailSentAt: row.email_sent_at ? new Date(row.email_sent_at).getTime() : null,
    email: row.email || '',
    _fromSupabase: true,
  };
}

module.exports = {
  getConfig,
  rowToOrder,
  supabaseFetch,
};
