const midtransClient = require('midtrans-client');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION !== 'false';
const MIDTRANS_NOTIFY_ON_CREATE = process.env.MIDTRANS_NOTIFY_ON_CREATE === 'true';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return {};
    }
  }
  return req.body;
}

async function sendTelegram(order) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  const text = [
    'ORDER TOP UP ROBUX',
    '',
    `ID Pesanan: ${order.order_id}`,
    `Waktu: ${now}`,
    `Username Roblox: ${order.username || '-'}`,
    `Gamepass ID: ${order.gamepass_id || '-'}`,
    `Paket: ${Number(order.robux || 0).toLocaleString('id-ID')} Robux`,
    `Total: Rp ${Number(order.gross_amount || 0).toLocaleString('id-ID')}`,
    `Pembayaran: ${order.payment_method || '-'}`,
    'Status: Menunggu Pembayaran',
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
    }),
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.MIDTRANS_SERVER_KEY) {
    return res.status(500).json({ error: 'MIDTRANS_SERVER_KEY belum diset' });
  }

  const body = parseBody(req);
  const {
    order_id,
    gross_amount,
    item_name,
    username,
    gamepass_id,
    robux,
    payment_method,
  } = body;

  const amount = Number(gross_amount);

  if (!order_id || !item_name || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Data transaksi tidak lengkap atau tidak valid' });
  }

  try {
    const snap = new midtransClient.Snap({
      isProduction: MIDTRANS_IS_PRODUCTION,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });

    const finishUrl =
      process.env.PAYMENT_FINISH_URL ||
      req.headers.origin ||
      'https://kokorbx.vercel.app';

    const parameter = {
      transaction_details: {
        order_id,
        gross_amount: amount,
      },
      item_details: [
        {
          id: order_id,
          price: amount,
          quantity: 1,
          name: item_name,
        },
      ],
      customer_details: {
        first_name: username || 'Player',
        notes: `Gamepass ID: ${gamepass_id || '-'} | Robux: ${robux || '-'}`,
      },
      callbacks: {
        finish: finishUrl,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    if (MIDTRANS_NOTIFY_ON_CREATE) {
      sendTelegram({
        order_id,
        username,
        gamepass_id,
        robux,
        gross_amount: amount,
        payment_method,
      }).catch(console.error);
    }

    return res.status(200).json({
      snap_token: transaction.token,
      redirect_url: transaction.redirect_url,
    });
  } catch (err) {
    console.error('Midtrans error:', err);
    return res.status(500).json({
      error: 'Gagal membuat transaksi',
      detail: err.message,
    });
  }
};
