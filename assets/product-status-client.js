(function() {
  'use strict';

  var STORAGE_KEY = 'kokorbx_product_status';
  var DEFAULTS = {
    robux5hari: 'stok',
    robuxvilog: 'stok',
    robuxusername: 'stok',
    giftgp: 'stok',
    marketplace: 'maintenance'
  };
  var PAGE_IDS = {
    'robux5hari.html': 'robux5hari',
    'robuxvilog.html': 'robuxvilog',
    'robuxusername.html': 'robuxusername',
    'giftgp.html': 'giftgp',
    'gift-gp.html': 'giftgp'
  };
  var LABELS = {
    stok: 'Stok ready',
    habis: 'Stok habis',
    maintenance: 'Maintenance'
  };

  function pageName() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function normalize(value, fallback) {
    var raw = String(value || '').trim().toLowerCase();
    return raw === 'stok' || raw === 'habis' || raw === 'maintenance' ? raw : fallback;
  }

  function readCached() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
      return Object.assign({}, DEFAULTS, parsed);
    } catch (error) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function apiBase() {
    return (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'https://koko-rbx.vercel.app'
      : '';
  }

  async function loadStatuses() {
    try {
      var res = await fetch(apiBase() + '/api/orders?action=product-status&ts=' + Date.now(), { cache: 'no-store' });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal load status produk');
      var merged = Object.assign({}, DEFAULTS, data.products || {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch (error) {
      return readCached();
    }
  }

  function ensureStyle() {
    if (document.getElementById('product-status-client-style')) return;
    var style = document.createElement('style');
    style.id = 'product-status-client-style';
    style.textContent = [
      '.product-lock-banner{width:min(860px,calc(100% - 28px));margin:14px auto 0;border:1px solid rgba(255,200,87,.34);background:rgba(255,200,87,.10);color:var(--text,#1E2A55);border-radius:14px;padding:12px 14px;font-family:inherit;font-size:13px;font-weight:800;line-height:1.5;text-align:center}',
      '.product-lock-banner span{color:var(--muted,#7080A8);font-weight:700}',
      'body[data-product-locked="true"] #btn-order,body[data-product-locked="true"] #mob-bar-btn,body[data-product-locked="true"] #gift-form button[type="submit"]{opacity:.55!important;cursor:not-allowed!important;filter:grayscale(.25)}'
    ].join('');
    document.head.appendChild(style);
  }

  function insertBanner(status) {
    if (document.querySelector('.product-lock-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'product-lock-banner';
    banner.innerHTML = (LABELS[status] || 'Produk belum tersedia') + '<br><span>Produk ini sedang ditutup sementara dari admin panel. Silakan pilih produk utama lain atau hubungi admin.</span>';
    var header = document.querySelector('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  function disableOrder(status) {
    document.body.dataset.productLocked = 'true';
    document.body.dataset.productStatus = status;
    ensureStyle();
    insertBanner(status);

    var text = status === 'habis' ? 'STOK HABIS' : 'MAINTENANCE';
    document.querySelectorAll('#btn-order, #mob-bar-btn, #gift-form button[type="submit"]').forEach(function(button) {
      button.disabled = true;
      button.textContent = text;
      button.setAttribute('aria-disabled', 'true');
    });

    if (typeof window.placeOrder === 'function' && !window.placeOrder.__statusGuarded) {
      var blocked = function() {
        alert('Produk ini sedang ' + (LABELS[status] || status) + '. Pilih produk lain atau hubungi admin.');
        return false;
      };
      blocked.__statusGuarded = true;
      window.placeOrder = blocked;
    }

    var form = document.getElementById('gift-form');
    if (form && !form.__statusGuarded) {
      form.__statusGuarded = true;
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert('Produk ini sedang ' + (LABELS[status] || status) + '. Pilih produk lain atau hubungi admin.');
      }, true);
    }

    if (!document.__productStatusClickGuarded) {
      document.__productStatusClickGuarded = true;
      document.addEventListener('click', function(event) {
        if (document.body.dataset.productLocked !== 'true') return;
        if (!event.target.closest('#btn-order, #mob-bar-btn, #gift-form button[type="submit"]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        alert('Produk ini sedang ' + (LABELS[document.body.dataset.productStatus] || document.body.dataset.productStatus) + '. Pilih produk lain atau hubungi admin.');
      }, true);
    }
  }

  document.addEventListener('DOMContentLoaded', async function() {
    var id = PAGE_IDS[pageName()];
    if (!id) return;
    var statuses = await loadStatuses();
    var status = normalize(statuses[id], DEFAULTS[id] || 'stok');
    if (status !== 'stok') disableOrder(status);
  });
})();
