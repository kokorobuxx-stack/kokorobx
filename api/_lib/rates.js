const { supabaseFetch } = require('./supabase');

const SETTINGS_USERNAME = '__kokorbx_settings__';

const DEFAULT_RATES = {
  gamepass: 120,
  username: 140,
  vilogA: 160,
  vilogB: 160,
  giftgp: 140,
};

const RATE_ROWS = {
  gamepass: {
    id: '__kokorbx_rate_gamepass',
    method: 'rate:gamepass',
    label: 'Sistem Gamepass',
  },
  username: {
    id: '__kokorbx_rate_username',
    method: 'rate:username',
    label: 'Via Username',
  },
  vilogA: {
    id: '__kokorbx_rate_vilog_a',
    method: 'rate:vilogA',
    label: 'Sistem Vilog Paket A',
  },
  vilogB: {
    id: '__kokorbx_rate_vilog_b',
    method: 'rate:vilogB',
    label: 'Sistem Vilog Paket B',
  },
  giftgp: {
    id: '__kokorbx_rate_giftgp',
    method: 'rate:giftgp',
    label: 'Gift GP Ingame',
  },
};

const LEGACY_RATE_ROWS = {
  vilog: {
    id: '__kokorbx_rate_vilog',
    method: 'rate:vilog',
  },
};

function normalizeRate(value, fallback) {
  const n = Number(String(value || '').replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function keyFromRow(row) {
  const byId = Object.keys(RATE_ROWS).find(key => RATE_ROWS[key].id === row.id);
  if (byId) return byId;
  const byLegacyId = Object.keys(LEGACY_RATE_ROWS).find(key => LEGACY_RATE_ROWS[key].id === row.id);
  if (byLegacyId) return byLegacyId;
  const method = String(row.method || '');
  if (method.startsWith('rate:')) return method.slice(5);
  return '';
}

function rowsToRateSettings(rows) {
  const rates = { ...DEFAULT_RATES };
  const found = {};
  let legacyVilogRate = null;
  let source = 'default';
  let updatedAt = null;

  (rows || []).forEach(row => {
    const key = keyFromRow(row);
    if (key === 'vilog') {
      legacyVilogRate = normalizeRate(row.price, DEFAULT_RATES.vilogA);
      source = 'server';
      if (row.created_at && (!updatedAt || new Date(row.created_at) > new Date(updatedAt))) {
        updatedAt = row.created_at;
      }
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_RATES, key)) return;
    rates[key] = normalizeRate(row.price, DEFAULT_RATES[key]);
    found[key] = true;
    source = 'server';
    if (row.created_at && (!updatedAt || new Date(row.created_at) > new Date(updatedAt))) {
      updatedAt = row.created_at;
    }
  });

  if (legacyVilogRate) {
    if (!found.vilogA) rates.vilogA = legacyVilogRate;
    if (!found.vilogB) rates.vilogB = legacyVilogRate;
  }

  return { rates, defaults: DEFAULT_RATES, source, updatedAt };
}

async function loadRateSettings() {
  const rows = await supabaseFetch(
    '/rest/v1/orders?username=eq.' + encodeURIComponent(SETTINGS_USERNAME) +
      '&status=eq.settings&select=id,method,price,created_at'
  );
  return rowsToRateSettings(rows);
}

async function saveRateSettings(inputRates) {
  const now = new Date().toISOString();
  const rows = Object.keys(DEFAULT_RATES).map(key => ({
    id: RATE_ROWS[key].id,
    username: SETTINGS_USERNAME,
    gp_id: '',
    robux: 0,
    price: normalizeRate(inputRates && inputRates[key], DEFAULT_RATES[key]),
    method: RATE_ROWS[key].method,
    status: 'settings',
    email: '',
    has_proof: false,
    proof_viewed: true,
    created_at: now,
  }));

  await supabaseFetch('/rest/v1/orders?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });

  return rowsToRateSettings(rows);
}

function isSettingsUsername(username) {
  return String(username || '') === SETTINGS_USERNAME;
}

module.exports = {
  DEFAULT_RATES,
  SETTINGS_USERNAME,
  isSettingsUsername,
  loadRateSettings,
  normalizeRate,
  saveRateSettings,
};
