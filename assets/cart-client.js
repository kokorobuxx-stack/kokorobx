(function() {
  'use strict';

  var STORAGE_KEY = 'kokorbx_cart_v1';
  var drawer;
  var backdrop;
  var listEl;
  var countEls = [];
  var toastTimer;

  function rupiah(value) {
    var number = Number(value || 0);
    return 'Rp ' + number.toLocaleString('id-ID');
  }

  function readText(selector) {
    var el = document.querySelector(selector);
    return el ? String(el.textContent || '').trim() : '';
  }

  function readValue(selector) {
    var el = document.querySelector(selector);
    return el ? String(el.value || '').trim() : '';
  }

  function cleanDash(value) {
    var text = String(value || '').trim();
    return text && !/^[\s\-–—]+$/.test(text) ? text : '';
  }

  function parseNumber(value) {
    var digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }

  function getCart() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function productNameByPath() {
    var path = location.pathname.toLowerCase();
    if (path.includes('robux5hari')) return 'Robux 5 Hari';
    if (path.includes('robuxvilog')) return 'Robux Via Login';
    if (path.includes('robuxusername')) return 'Robux Username';
    if (path.includes('giftgp') || path.includes('gift-gp')) return 'Gift GP Ingame';
    if (path.includes('akunroblox')) return 'Akun Roblox';
    return 'KokoRBX';
  }

  function currentOrderItem() {
    var product = productNameByPath();
    var giftPriceEl = document.getElementById('sum-price');

    if (giftPriceEl) {
      var giftRobux = parseNumber(readText('#sum-total'));
      var giftPrice = parseNumber(readText('#sum-price'));
      return {
        id: Date.now() + '-' + Math.random().toString(16).slice(2),
        product: product,
        packageName: giftRobux ? giftRobux.toLocaleString('id-ID') + ' R$' : '',
        robux: giftRobux,
        price: giftPrice,
        username: cleanDash(readText('#sum-user')),
        detail: [readValue('#game'), readValue('#gamepass')].filter(Boolean).join(' / '),
        url: location.pathname.split('/').pop() || 'giftgp.html',
        time: Date.now()
      };
    }

    var robux = parseNumber(readText('#sum-rbx'));
    var price = parseNumber(readText('#sum-total'));
    var packageName = cleanDash(readText('#sum-pkg')) || (robux ? robux.toLocaleString('id-ID') + ' R$' : '');
    var service = cleanDash(readText('#sum-gp')) || product;
    var request = cleanDash(readText('#sum-order'));
    var pay = cleanDash(readText('#sum-pay'));

    return {
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      product: service,
      packageName: packageName,
      robux: robux,
      price: price,
      username: cleanDash(readText('#sum-user')),
      detail: [request, pay].filter(Boolean).join(' / '),
      url: location.pathname.split('/').pop() || 'index.html',
      time: Date.now()
    };
  }

  function toast(message, isError) {
    var el = document.querySelector('.koko-cart-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'koko-cart-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.color = isError ? '#fc5c7d' : '#39d98a';
    el.style.borderColor = isError ? 'rgba(252,92,125,.45)' : 'rgba(57,217,138,.38)';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      el.classList.remove('show');
    }, 2400);
  }

  function render() {
    var items = getCart();
    countEls.forEach(function(el) {
      el.textContent = String(items.length);
    });

    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<div class="koko-cart-empty">Keranjang masih kosong. Pilih paket dulu, lalu tambah ke keranjang.</div>';
    } else {
      listEl.innerHTML = items.map(function(item) {
        var meta = [
          item.packageName || '',
          item.username ? 'User: ' + item.username : '',
          item.detail || ''
        ].filter(Boolean).join('<br>');
        return '<article class="koko-cart-item" data-id="' + item.id + '">' +
          '<div class="koko-cart-item-top">' +
            '<div class="koko-cart-item-title">' + escapeHtml(item.product || 'KokoRBX') + '</div>' +
            '<div class="koko-cart-price">' + rupiah(item.price) + '</div>' +
          '</div>' +
          '<div class="koko-cart-meta">' + (meta || 'Detail belum lengkap') + '</div>' +
          '<div class="koko-cart-actions">' +
            '<a class="koko-cart-link" href="' + escapeAttr(item.url || 'index.html') + '">Buka</a>' +
            '<button class="koko-cart-remove" type="button" data-remove="' + item.id + '">Hapus</button>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    var total = items.reduce(function(sum, item) { return sum + Number(item.price || 0); }, 0);
    var totalEl = document.querySelector('.koko-cart-total strong');
    if (totalEl) totalEl.textContent = rupiah(total);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function addCurrentItem() {
    var item = currentOrderItem();
    return addItem(item);
  }

  function addItem(item) {
    item = item || {};
    item.id = item.id || (Date.now() + '-' + Math.random().toString(16).slice(2));
    item.time = item.time || Date.now();
    item.url = item.url || (location.pathname.split('/').pop() || 'index.html');
    if (!item.price || (!item.robux && !item.packageName)) {
      toast('Pilih paket atau isi total Robux dulu.', true);
      return false;
    }

    var cart = getCart();
    cart.unshift(item);
    saveCart(cart.slice(0, 20));
    render();
    openDrawer();
    toast('Masuk keranjang.');
    return true;
  }

  function openDrawer() {
    if (!drawer || !backdrop) return;
    render();
    drawer.classList.add('show');
    backdrop.classList.add('show');
  }

  function closeDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.remove('show');
    backdrop.classList.remove('show');
  }

  function injectHeaderButton() {
    var host = document.querySelector('.header-actions') || document.querySelector('.header-right');
    if (!host || host.querySelector('.koko-cart-button')) return;
    host.classList.add('koko-cart-host');

    var btn = document.createElement('button');
    btn.className = 'koko-cart-button';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Buka keranjang');
    btn.innerHTML = '<svg class="koko-cart-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.2 7h13.1l-1.2 7.2a2 2 0 0 1-2 1.7H9.4a2 2 0 0 1-2-1.6L6.2 7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 4h1.6l.6 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.4 20h.1M16.5 20h.1" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><span class="koko-cart-button-text">Keranjang</span><span class="koko-cart-count">0</span>';
    btn.addEventListener('click', openDrawer);
    host.insertBefore(btn, host.firstChild);
    countEls.push(btn.querySelector('.koko-cart-count'));
  }

  function injectAddButton() {
    if (document.querySelector('.koko-cart-add')) return;

    var target = document.getElementById('btn-order');
    if (!target) {
      var giftActions = document.querySelector('.actions');
      if (giftActions) target = giftActions;
    }
    if (!target) return;

    var btn = document.createElement('button');
    btn.className = 'koko-cart-add';
    btn.type = 'button';
    btn.textContent = 'Tambah ke Keranjang';
    btn.addEventListener('click', addCurrentItem);

    if (target.classList && target.classList.contains('actions')) {
      target.parentNode.insertBefore(btn, target.nextSibling);
    } else {
      target.parentNode.insertBefore(btn, target.nextSibling);
    }
  }

  function injectDrawer() {
    if (document.querySelector('.koko-cart-drawer')) return;
    backdrop = document.createElement('div');
    backdrop.className = 'koko-cart-backdrop';
    backdrop.addEventListener('click', closeDrawer);

    drawer = document.createElement('aside');
    drawer.className = 'koko-cart-drawer';
    drawer.setAttribute('aria-label', 'Keranjang KokoRBX');
    drawer.innerHTML =
      '<div class="koko-cart-head">' +
        '<div><div class="koko-cart-title">Keranjang</div><div class="koko-cart-subtitle">Simpan paket sebelum order.</div></div>' +
        '<button class="koko-cart-close" type="button" aria-label="Tutup">X</button>' +
      '</div>' +
      '<div class="koko-cart-list"></div>' +
      '<div class="koko-cart-foot">' +
        '<div class="koko-cart-total"><span>Total estimasi</span><strong>Rp 0</strong></div>' +
        '<button class="koko-cart-clear" type="button">Kosongkan Keranjang</button>' +
      '</div>';

    listEl = drawer.querySelector('.koko-cart-list');
    drawer.querySelector('.koko-cart-close').addEventListener('click', closeDrawer);
    drawer.querySelector('.koko-cart-clear').addEventListener('click', function() {
      saveCart([]);
      render();
    });
    drawer.addEventListener('click', function(event) {
      var removeId = event.target && event.target.getAttribute('data-remove');
      if (!removeId) return;
      saveCart(getCart().filter(function(item) { return item.id !== removeId; }));
      render();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closeDrawer();
  });

  document.addEventListener('DOMContentLoaded', function() {
    injectHeaderButton();
    injectDrawer();
    injectAddButton();
    render();
  });

  window.KokoCart = {
    addCurrent: addCurrentItem,
    addItem: addItem,
    open: openDrawer,
    close: closeDrawer,
    getItems: getCart
  };
})();
