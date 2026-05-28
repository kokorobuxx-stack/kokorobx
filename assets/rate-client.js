(function () {
  const DEFAULT_RATES = {
    gamepass: 120,
    username: 140,
    vilogA: 160,
    vilogB: 160,
    giftgp: 140,
  };

  const CACHE_KEY = 'kokorbx_rate_settings_v1';
  const API_BASE = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'https://chisatobobaaaa.vercel.app'
    : '';

  function normalizeRate(value, fallback) {
    const n = Number(String(value || '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  }

  function normalizeSettings(raw) {
    const input = raw && raw.rates ? raw.rates : raw || {};
    const legacyVilog = normalizeRate(input.vilog, DEFAULT_RATES.vilogA);
    return {
      rates: {
        gamepass: normalizeRate(input.gamepass, DEFAULT_RATES.gamepass),
        username: normalizeRate(input.username, DEFAULT_RATES.username),
        vilogA: normalizeRate(input.vilogA, legacyVilog),
        vilogB: normalizeRate(input.vilogB, legacyVilog),
        giftgp: normalizeRate(input.giftgp, DEFAULT_RATES.giftgp),
      },
      source: raw && raw.source ? raw.source : 'default',
      updatedAt: raw && raw.updatedAt ? raw.updatedAt : null,
    };
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return cached ? normalizeSettings(cached) : normalizeSettings({ rates: DEFAULT_RATES });
    } catch (err) {
      return normalizeSettings({ rates: DEFAULT_RATES });
    }
  }

  async function load() {
    const fallback = readCache();
    try {
      const res = await fetch(API_BASE + '/api/orders?action=rates&ts=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Rate request failed');
      const data = normalizeSettings(await res.json());
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (err) {
      return fallback;
    }
  }

  function formatRupiah(value) {
    return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
  }

  function calcPrice(robux, rate) {
    return Math.round(Number(robux || 0) * Number(rate || 0));
  }

  window.KokoRates = {
    DEFAULT_RATES,
    calcPrice,
    formatRupiah,
    load,
    normalizeRate,
  };
})();
