(function() {
  'use strict';

  var PROFILE_KEY = 'kokorbx_roblox_profile';
  var SESSION_KEY = 'rbx_session';
  var V2_KEY = 'kokorbx_orders_v2';
  var OVERRIDE_KEY = 'kokorbx_order_status_overrides';
  var PENDING_CHECKOUT_KEY = 'kokorbx_pending_checkout';
  var API_BASE = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'https://koko-rbx.vercel.app'
    : '';
  var remoteOrdersCache = [];
  var remoteOrdersKey = '';

  var STATUS = {
    all: 'Semua',
    payment: 'Menunggu Pembayaran',
    process: 'Diproses Admin',
    sent: 'Sudah Terkirim',
    done: 'Selesai',
    refund: 'Pengembalian Dana',
    cancel: 'Dibatalkan',
  };

  var STATUS_ORDER = [
    STATUS.all,
    STATUS.payment,
    STATUS.process,
    STATUS.sent,
    STATUS.done,
    STATUS.refund,
    STATUS.cancel,
  ];

  var SUCCESS_STATUSES = [STATUS.sent, STATUS.done];
  var PROCESSING_STATUSES = [STATUS.payment, STATUS.process];

  function readJson(key, fallback) {
    try {
      var parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function rupiah(value) {
    var number = Number(value || 0);
    return number ? 'Rp ' + number.toLocaleString('id-ID') : 'Rp -';
  }

  function formatRobux(value) {
    var number = Number(value || 0);
    return number ? number.toLocaleString('id-ID') + ' R$' : '-';
  }

  function formatDate(value) {
    var date = new Date(Number(value || 0) || value || Date.now());
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function lower(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getProfile() {
    var profile = readJson(PROFILE_KEY, null);
    var session = readJson(SESSION_KEY, null);
    if (profile && (profile.username || profile.robloxUsername)) {
      var profileRobloxId = profile.robloxUserId || profile.userId || null;
      return {
        kokoUserId: profile.kokoUserId || (profileRobloxId ? 'rbx_' + profileRobloxId : null),
        robloxUserId: profileRobloxId,
        username: profile.robloxUsername || profile.username || '',
        displayName: profile.robloxDisplayName || profile.displayName || profile.username || '',
        avatarUrl: profile.robloxAvatar || profile.headshotUrl || profile.avatarUrl || '',
        verified: !!profile.verified,
        loginProvider: profile.loginProvider || 'roblox_public_profile',
      };
    }
    if (session && (session.username || session.robloxUsername)) {
      var sessionRobloxId = session.robloxUserId || session.userId || null;
      return {
        kokoUserId: session.kokoUserId || (sessionRobloxId ? 'rbx_' + sessionRobloxId : null),
        robloxUserId: sessionRobloxId,
        username: session.robloxUsername || session.username || '',
        displayName: session.robloxDisplayName || session.displayName || session.username || '',
        avatarUrl: session.robloxAvatar || session.avatarUrl || '',
        verified: !!session.verified,
        loginProvider: session.loginProvider || session.source || 'local_session',
      };
    }
    return null;
  }

  function isLoggedIn() {
    var profile = getProfile();
    return !!(profile && profile.username);
  }

  function currentUserKey() {
    var profile = getProfile();
    if (!profile) return '';
    return String(profile.robloxUserId || profile.username || '').toLowerCase();
  }

  function attachBuyerIdentity(order) {
    var profile = getProfile();
    var cleanOrder = Object.assign({}, order || {});
    if (!profile || !profile.username) return cleanOrder;

    var originalUsername = clean(cleanOrder.username || cleanOrder.robloxUsername || cleanOrder.user || cleanOrder.buyer || '');
    if (originalUsername && lower(originalUsername) !== lower(profile.username)) {
      cleanOrder.recipientUsername = cleanOrder.recipientUsername || originalUsername;
    }
    cleanOrder.kokoUserId = cleanOrder.kokoUserId || profile.kokoUserId || (profile.robloxUserId ? 'rbx_' + profile.robloxUserId : '');
    cleanOrder.robloxUserId = cleanOrder.robloxUserId || cleanOrder.userId || profile.robloxUserId || '';
    cleanOrder.userId = cleanOrder.userId || cleanOrder.robloxUserId || '';
    cleanOrder.username = profile.username;
    cleanOrder.user = profile.username;
    cleanOrder.robloxUsername = profile.username;
    cleanOrder.robloxDisplayName = profile.displayName || profile.username;
    cleanOrder.buyerUsername = profile.username;
    cleanOrder.buyerDisplayName = profile.displayName || profile.username;
    cleanOrder.buyer = profile.username;
    cleanOrder.loginProvider = cleanOrder.loginProvider || profile.loginProvider || 'roblox_oauth';
    return cleanOrder;
  }

  function normalizeStatus(input) {
    var raw = String(input || '').trim();
    var key = raw.toLowerCase().replace(/[_-]+/g, ' ');

    if (!raw) return STATUS.payment;
    if (key === 'semua') return STATUS.all;
    if (/menunggu|pending|belum bayar|waiting|bukti belum/.test(key)) return STATUS.payment;
    if (/bukti masuk|process|proses|diproses|review|menunggu admin|menunggu seller|seller/.test(key)) return STATUS.process;
    if (/terkirim|dikirim|sent|delivered/.test(key)) return STATUS.sent;
    if (/selesai|success|sukses|done|complete|completed/.test(key)) return STATUS.done;
    if (/refund|pengembalian/.test(key)) return STATUS.refund;
    if (/batal|cancel|failed|gagal|rejected|ditolak/.test(key)) return STATUS.cancel;
    return raw;
  }

  function statusKey(status) {
    var normalized = normalizeStatus(status);
    if (normalized === STATUS.payment) return 'payment';
    if (normalized === STATUS.process) return 'process';
    if (normalized === STATUS.sent) return 'sent';
    if (normalized === STATUS.done) return 'done';
    if (normalized === STATUS.refund) return 'refund';
    if (normalized === STATUS.cancel) return 'cancel';
    return 'process';
  }

  function statusClass(status) {
    return 'status-' + statusKey(status);
  }

  function productImage(order) {
    var key = String(order.productName || order.product || order.method || '').toLowerCase();
    if (/vilog|login/.test(key)) return 'assets/logo-robux-vilog.png';
    if (/username/.test(key)) return 'assets/logo-robux-username.png';
    if (/gift|gamepass|gp/.test(key)) return 'assets/logo-gift-gp.png';
    if (/akun/.test(key)) return 'assets/logo-akun-roblox.png';
    if (/item/.test(key)) return 'assets/logo-item-limited.png';
    if (/joki|farm/.test(key)) return 'assets/logo-joki-farming.png';
    return 'assets/logo-robux-5day.png';
  }

  function categoryFromOrder(order) {
    var text = String(order.category || order.productType || order.method || order.product || order.productName || '').toLowerCase();
    if (/gift|gamepass|gp/.test(text)) return 'Gift GP';
    if (/akun/.test(text)) return 'Akun Roblox';
    if (/item/.test(text)) return 'Item Game';
    if (/joki|farm/.test(text)) return 'Jasa';
    return 'Robux';
  }

  function normalizeOrder(input, source) {
    input = input || {};
    var id = clean(input.orderId || input.id || input.invoice || input.oid);
    if (!id) return null;

    var overrides = readJson(OVERRIDE_KEY, {});
    var rawStatus = overrides[id] || input.status || input.orderStatus || STATUS.payment;
    var status = normalizeStatus(rawStatus);
    var robux = Number(input.robuxAmount || input.robux || input.rbx || input.totalRobux || 0);
    var productName = clean(input.productName || input.product || input.title || input.method || input.gpId || input.gp_id || '');

    if (!productName && robux) productName = 'Robux ' + robux.toLocaleString('id-ID');
    if (!productName) productName = 'Produk KokoRBX';

    var price = Number(input.totalPrice || input.price || input.amount || input.total || 0);
    var username = clean(input.robloxUsername || input.username || input.user || input.buyer || input._storageUsername);
    var created = input.createdAt || input.created_at || input.time || input.created || Date.now();
    var updated = input.updatedAt || input.updated_at || input.sentAt || input.sent_at || created;

    return {
      id: id,
      kokoUserId: input.kokoUserId || input.koko_user_id || '',
      robloxUserId: input.robloxUserId || input.roblox_user_id || input.userId || '',
      robloxUsername: username,
      productId: input.productId || input.gpId || input.gp_id || '',
      productName: productName,
      productType: input.productType || categoryFromOrder(input),
      category: categoryFromOrder(input),
      robuxAmount: robux,
      quantity: Number(input.quantity || input.qty || 1),
      totalPrice: price,
      priceText: input.priceText || (price ? rupiah(price) : 'Konfirmasi admin'),
      paymentMethod: input.paymentMethod || input.method || input.payMethod || '-',
      status: status,
      createdAt: Number(new Date(created).getTime()) || Number(created) || Date.now(),
      updatedAt: Number(new Date(updated).getTime()) || Number(updated) || Date.now(),
      image: input.image || input.productImage || productImage(input),
      detail: input.detail || input.packageLabel || input.packageName || input.gpId || '',
      adminNote: input.adminNote || input.note || 'Admin akan memproses pesanan sesuai antrean dan status pembayaran.',
      source: source || input.source || 'local',
      productUrl: input.productUrl || input.url || productUrl(productName),
    };
  }

  function productUrl(name) {
    var key = String(name || '').toLowerCase();
    if (/vilog|login/.test(key)) return 'robuxvilog.html';
    if (/username/.test(key)) return 'robuxusername.html';
    if (/gift|gamepass|gp/.test(key)) return 'giftgp.html';
    if (/akun/.test(key)) return 'akunroblox.html';
    return 'robux5hari.html';
  }

  function readArrayKey(key) {
    var value = readJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  function withStorageUsername(item, username) {
    if (!item || typeof item !== 'object') return item;
    return Object.assign({}, item, { _storageUsername: username });
  }

  function profileMatches(order, profile) {
    if (!profile) return false;
    var username = lower(order.robloxUsername);
    var orderUserId = lower(order.robloxUserId);
    var kokoUserId = lower(order.kokoUserId);
    var profileUsername = lower(profile.username);
    var profileId = lower(profile.robloxUserId);
    var profileKokoId = lower(profile.kokoUserId);

    if (profileId && orderUserId && profileId === orderUserId) return true;
    if (profileKokoId && kokoUserId && profileKokoId === kokoUserId) return true;
    if (profileUsername && username && profileUsername === username) return true;
    return false;
  }

  function collectOrders() {
    var profile = getProfile();
    if (!profile) return [];
    var raw = [];
    remoteOrdersCache.forEach(function(item) { raw.push({ item: item, source: 'api' }); });
    readArrayKey(V2_KEY).forEach(function(item) { raw.push({ item: item, source: 'v2' }); });
    readArrayKey('rbx_orders').forEach(function(item) { raw.push({ item: item, source: 'robux' }); });
    readArrayKey('kokorbx_panel_orders_v1').forEach(function(item) { raw.push({ item: item, source: 'panel' }); });

    if (profile && profile.username) {
      readArrayKey('rbx_orders_u_' + profile.username).forEach(function(item) {
        raw.push({ item: withStorageUsername(item, profile.username), source: 'robux' });
      });
    }

    for (var i = 0; i < localStorage.length; i += 1) {
      var key = localStorage.key(i);
      if (!key || !key.indexOf || key.indexOf('rbx_orders_u_') !== 0) continue;
      var owner = key.slice('rbx_orders_u_'.length);
      readArrayKey(key).forEach(function(item) { raw.push({ item: withStorageUsername(item, owner), source: 'robux' }); });
    }

    var byId = new Map();
    raw.forEach(function(entry) {
      var order = normalizeOrder(entry.item, entry.source);
      if (!order) return;
      if (profile && !profileMatches(order, profile)) return;
      var existing = byId.get(order.id);
      if (!existing || Number(order.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
        byId.set(order.id, order);
      }
    });

    return Array.from(byId.values()).sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  }

  async function loadRemoteOrders(force) {
    var profile = getProfile();
    if (!profile || !profile.username) {
      remoteOrdersCache = [];
      remoteOrdersKey = '';
      return;
    }
    var key = String(profile.robloxUserId || profile.username).toLowerCase();
    if (!force && remoteOrdersKey === key) return;
    remoteOrdersKey = key;
    try {
      var response = await fetch(API_BASE + '/api/orders?username=' + encodeURIComponent(profile.username), { cache: 'no-store' });
      var data = await response.json();
      remoteOrdersCache = response.ok && Array.isArray(data) ? data : [];
    } catch (error) {
      remoteOrdersCache = [];
    }
    document.dispatchEvent(new CustomEvent('kokorbx:orders-updated'));
  }

  function counts(orders) {
    var success = orders.filter(function(order) {
      return SUCCESS_STATUSES.indexOf(order.status) >= 0;
    });
    return {
      total: orders.length,
      processing: orders.filter(function(order) { return PROCESSING_STATUSES.indexOf(order.status) >= 0; }).length,
      successCount: success.length,
      successRobux: success.reduce(function(sum, order) { return sum + Number(order.robuxAmount || 0); }, 0),
    };
  }

  function actionLabel(status) {
    if (status === STATUS.payment) return 'Bayar Sekarang';
    if (status === STATUS.process) return 'Lihat Detail';
    if (status === STATUS.sent) return 'Konfirmasi Selesai';
    if (status === STATUS.done) return 'Beli Lagi';
    if (status === STATUS.cancel) return 'Pesan Lagi';
    if (status === STATUS.refund) return 'Lihat Refund';
    return 'Lihat Detail';
  }

  function orderCard(order, compact) {
    var image = order.image || productImage(order);
    var imageHtml = image
      ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(order.productName) + '" loading="lazy">'
      : '<span>K</span>';
    var meta = [
      order.category,
      order.robuxAmount ? formatRobux(order.robuxAmount) : '',
      order.quantity ? order.quantity + ' item' : '',
      order.robloxUsername ? '@' + order.robloxUsername : '',
    ].filter(Boolean).join(' - ');

    return '<article class="koko-order-card" data-order-id="' + escapeHtml(order.id) + '">' +
      '<div class="koko-order-status ' + statusClass(order.status) + '">' + escapeHtml(order.status) + '</div>' +
      '<div class="koko-order-body">' +
        '<div class="koko-order-date">' + escapeHtml(formatDate(order.createdAt)) + '</div>' +
        '<div class="koko-order-main">' +
          '<div class="koko-order-image">' + imageHtml + '</div>' +
          '<div><div class="koko-order-name">' + escapeHtml(order.productName) + '</div>' +
          '<div class="koko-order-meta">' + escapeHtml(meta || 'Detail produk KokoRBX') + '</div></div>' +
        '</div>' +
        '<div class="koko-order-footer">' +
          '<div class="koko-order-total"><span>Total Pembelian</span><strong>' + escapeHtml(order.priceText || rupiah(order.totalPrice)) + '</strong></div>' +
          '<button class="koko-order-action" type="button" data-order-action="' + escapeHtml(order.id) + '">' + escapeHtml(actionLabel(order.status)) + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function emptyState(title, message) {
    return '<div class="koko-empty-state">' +
      '<div class="koko-empty-art">?</div>' +
      '<strong>' + escapeHtml(title) + '</strong>' +
      '<p>' + escapeHtml(message) + '</p>' +
    '</div>';
  }

  function updateOrderStatus(id, status) {
    var overrides = readJson(OVERRIDE_KEY, {});
    overrides[id] = status;
    writeJson(OVERRIDE_KEY, overrides);
    document.dispatchEvent(new CustomEvent('kokorbx:orders-updated'));
  }

  function orderById(id) {
    return collectOrders().find(function(order) { return order.id === id; }) || null;
  }

  async function fetchOrderById(id) {
    try {
      var response = await fetch(API_BASE + '/api/order-status?id=' + encodeURIComponent(id), { cache: 'no-store' });
      var data = await response.json();
      if (!response.ok || !data.order) return null;
      var order = normalizeOrder(data.order, 'api');
      var profile = getProfile();
      if (profile && !profileMatches(order, profile)) return null;
      return order;
    } catch (error) {
      return null;
    }
  }

  function timeline(order) {
    var status = statusKey(order.status);
    var rank = { payment: 1, process: 2, sent: 4, done: 5, refund: 2, cancel: 1 }[status] || 1;
    var steps = [
      'Pesanan dibuat',
      'Pembayaran diterima',
      'Admin memproses pesanan',
      'Produk / Robux dikirim',
      'Pesanan selesai',
    ];
    return '<div class="koko-progress">' + steps.map(function(label, index) {
      var done = (index + 1) <= rank;
      return '<div class="koko-progress-step ' + (done ? 'is-done' : '') + '">' +
        '<span class="koko-progress-dot">' + (done ? 'OK' : (index + 1)) + '</span>' +
        '<span>' + escapeHtml(label) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function detailRows(rows) {
    return '<div class="koko-detail-grid">' + rows.map(function(row) {
      return '<div class="koko-detail-row"><span>' + escapeHtml(row[0]) + '</span><strong>' + escapeHtml(row[1] || '-') + '</strong></div>';
    }).join('') + '</div>';
  }

  function ensureModal() {
    var modal = document.getElementById('koko-order-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'koko-order-modal';
    modal.className = 'koko-order-modal-backdrop';
    modal.innerHTML =
      '<div class="koko-order-modal" role="dialog" aria-modal="true">' +
        '<div class="koko-order-modal-head">' +
          '<div><div class="koko-order-modal-title" data-modal-title>Detail Pesanan</div>' +
          '<div class="koko-order-modal-sub" data-modal-sub>Timeline dan detail order KokoRBX.</div></div>' +
          '<button class="koko-order-close" type="button" aria-label="Tutup">X</button>' +
        '</div>' +
        '<div class="koko-order-modal-body" data-modal-body></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.koko-order-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function(event) {
      if (event.target === modal) closeModal();
    });
    return modal;
  }

  function openDetail(order) {
    if (!order) return;
    var modal = ensureModal();
    modal.querySelector('[data-modal-title]').textContent = order.status;
    modal.querySelector('[data-modal-sub]').textContent = order.id + ' - ' + order.productName;
    modal.querySelector('[data-modal-body]').innerHTML =
      '<section class="koko-mini-section"><h3>Timeline Pesanan</h3>' + timeline(order) + '</section>' +
      '<section class="koko-mini-section"><h3>Detail Produk</h3>' + detailRows([
        ['ID Pesanan', order.id],
        ['Produk', order.productName],
        ['Kategori', order.category],
        ['Jumlah', order.robuxAmount ? formatRobux(order.robuxAmount) : String(order.quantity || 1) + ' item'],
      ]) + '</section>' +
      '<section class="koko-mini-section"><h3>Detail Akun Roblox</h3>' + detailRows([
        ['Username', order.robloxUsername ? '@' + order.robloxUsername : '-'],
        ['User ID Roblox', order.robloxUserId || '-'],
      ]) + '</section>' +
      '<section class="koko-mini-section"><h3>Detail Pembayaran</h3>' + detailRows([
        ['Total', order.priceText || rupiah(order.totalPrice)],
        ['Metode', order.paymentMethod],
        ['Tanggal', formatDate(order.createdAt)],
      ]) + '</section>' +
      '<section class="koko-mini-section"><h3>Catatan Admin</h3><p class="koko-order-meta">' + escapeHtml(order.adminNote) + '</p></section>' +
      '<a class="koko-primary-action" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="https://wa.me/6281996112019?text=' + encodeURIComponent('Halo KokoRBX, aku mau tanya order ' + order.id) + '" target="_blank" rel="noopener">Hubungi Admin</a>';
    modal.classList.add('show');
  }

  function closeModal() {
    var modal = document.getElementById('koko-order-modal');
    if (modal) modal.classList.remove('show');
  }

  function runOrderAction(order) {
    if (!order) return;
    if (order.status === STATUS.payment) {
      location.href = 'payment.html?id=' + encodeURIComponent(order.id);
      return;
    }
    if (order.status === STATUS.sent) {
      updateOrderStatus(order.id, STATUS.done);
      return;
    }
    if (order.status === STATUS.done || order.status === STATUS.cancel) {
      location.href = order.productUrl || 'index.html#produk';
      return;
    }
    openDetail(order);
  }

  function renderHistoryPage() {
    var page = document.querySelector('[data-koko-history-page]');
    if (!page) return;
    var tabs = page.querySelector('[data-history-tabs]');
    var list = page.querySelector('[data-history-list]');
    var search = page.querySelector('[data-history-search]');
    var filter = page.querySelector('[data-history-filter]');
    var state = { status: STATUS.all, query: '', category: 'Semua' };

    function drawTabs() {
      tabs.innerHTML = STATUS_ORDER.map(function(status) {
        return '<button class="koko-tab-btn ' + (state.status === status ? 'is-active' : '') + '" type="button" data-status="' + escapeHtml(status) + '">' + escapeHtml(status) + '</button>';
      }).join('');
    }

    function filteredOrders() {
      var query = state.query.toLowerCase();
      return collectOrders().filter(function(order) {
        var statusOk = state.status === STATUS.all || order.status === state.status;
        var categoryOk = state.category === 'Semua' || order.category === state.category;
        var text = [order.productName, order.category, order.id, order.robloxUsername].join(' ').toLowerCase();
        return statusOk && categoryOk && (!query || text.indexOf(query) >= 0);
      });
    }

    function drawList() {
      var orders = filteredOrders();
      list.innerHTML = orders.length
        ? orders.map(function(order) { return orderCard(order); }).join('')
        : emptyState('Belum ada pesanan yang diproses', 'Pesanan kamu akan muncul di sini setelah melakukan pembelian.');
    }

    drawTabs();
    drawList();
    if (page.dataset.historyBound === 'true') return;
    page.dataset.historyBound = 'true';

    tabs.addEventListener('click', function(event) {
      var button = event.target.closest('[data-status]');
      if (!button) return;
      state.status = button.getAttribute('data-status');
      drawTabs();
      drawList();
    });

    if (search) {
      search.addEventListener('input', function() {
        state.query = search.value || '';
        drawList();
      });
    }

    if (filter) {
      filter.addEventListener('change', function() {
        state.category = filter.value || 'Semua';
        drawList();
      });
    }

    list.addEventListener('click', function(event) {
      var action = event.target.closest('[data-order-action]');
      var card = event.target.closest('[data-order-id]');
      var id = action ? action.getAttribute('data-order-action') : (card && card.getAttribute('data-order-id'));
      if (!id) return;
      var order = orderById(id);
      if (action) {
        event.stopPropagation();
        runOrderAction(order);
      } else {
        openDetail(order);
      }
    });
  }

  function renderCheckResult(container, order) {
    if (!order) {
      container.innerHTML = emptyState('Pesanan tidak ditemukan', 'Pastikan ID pesanan sudah benar dan akun Roblox kamu sesuai.');
      return;
    }
    container.innerHTML =
      '<article class="koko-order-card" style="margin-top:14px">' +
        '<div class="koko-order-status ' + statusClass(order.status) + '">' + escapeHtml(order.status) + '</div>' +
        '<div class="koko-order-body">' +
          detailRows([
            ['ID Pesanan', order.id],
            ['Nama Produk', order.productName],
            ['Username Roblox', order.robloxUsername ? '@' + order.robloxUsername : '-'],
            ['User ID Roblox', order.robloxUserId || '-'],
            ['Jumlah', order.robuxAmount ? formatRobux(order.robuxAmount) : String(order.quantity || 1) + ' item'],
            ['Total Pembayaran', order.priceText || rupiah(order.totalPrice)],
            ['Metode Pembayaran', order.paymentMethod],
            ['Tanggal Order', formatDate(order.createdAt)],
            ['Status Pesanan', order.status],
          ]) +
          timeline(order) +
          '<button class="koko-order-action" type="button" data-check-detail="' + escapeHtml(order.id) + '">Lihat Detail</button>' +
        '</div>' +
      '</article>';
  }

  function renderCheckPage() {
    var page = document.querySelector('[data-koko-check-page]');
    if (!page) return;
    var form = page.querySelector('[data-check-form]');
    var input = page.querySelector('[data-check-input]');
    var result = page.querySelector('[data-check-result]');

    async function checkId(id) {
      id = String(id || '').trim().toUpperCase();
      if (!id) {
        result.innerHTML = emptyState('Masukkan ID pesanan', 'Gunakan ID seperti RBX-123456 atau invoice KokoRBX kamu.');
        return;
      }
      if (!getProfile()) {
        result.innerHTML = emptyState('Login Roblox dulu', 'Hubungkan akun Roblox agar sistem bisa memastikan pesanan ini milik kamu.');
        return;
      }
      result.innerHTML = emptyState('Mencari pesanan', 'Sistem sedang mengecek ID pesanan dan akun Roblox kamu.');
      renderCheckResult(result, orderById(id) || await fetchOrderById(id));
    }

    if (page.dataset.checkBound !== 'true') {
      page.dataset.checkBound = 'true';
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        checkId(input.value);
      });

      result.addEventListener('click', function(event) {
        var button = event.target.closest('[data-check-detail]');
        if (!button) return;
        openDetail(orderById(button.getAttribute('data-check-detail')));
      });

      var params = new URLSearchParams(location.search);
      if (params.get('id')) {
        input.value = params.get('id');
        checkId(params.get('id'));
      } else {
        result.innerHTML = emptyState('Cek pesanan KokoRBX', 'Masukkan ID pesanan untuk melihat status dan timeline terbaru.');
      }
    }
  }

  function renderAccountWidgets() {
    var page = document.querySelector('[data-koko-account-page]');
    if (!page) return;
    var orders = collectOrders();
    var c = counts(orders);
    var success = orders.filter(function(order) { return SUCCESS_STATUSES.indexOf(order.status) >= 0; });
    var processing = orders.filter(function(order) { return PROCESSING_STATUSES.indexOf(order.status) >= 0; });

    page.querySelectorAll('[data-profile-total-orders], [data-account-success-orders]').forEach(function(node) {
      node.textContent = c.successCount.toLocaleString('id-ID');
    });
    page.querySelectorAll('[data-profile-total-robux], [data-account-success-robux]').forEach(function(node) {
      node.textContent = c.successRobux.toLocaleString('id-ID') + ' R$';
    });
    page.querySelectorAll('[data-account-processing-count]').forEach(function(node) {
      node.textContent = c.processing.toLocaleString('id-ID');
    });

    var processingList = page.querySelector('[data-processing-orders]');
    if (processingList) {
      processingList.innerHTML = processing.length
        ? processing.slice(0, 3).map(function(order) { return orderCard(order, true); }).join('')
        : emptyState('Tidak ada pesanan diproses', 'Order dengan status menunggu pembayaran atau diproses admin akan tampil di sini.');
    }

    var successList = page.querySelector('[data-success-orders]');
    if (successList) {
      successList.innerHTML = success.length
        ? success.slice(0, 3).map(function(order) { return orderCard(order, true); }).join('')
        : emptyState('Belum ada Robux berhasil dibeli', 'Transaksi baru masuk ke bagian ini setelah status Sudah Terkirim atau Selesai.');
    }
  }

  function openAuthGuard(message) {
    var node = document.querySelector('.koko-auth-guard');
    if (!node) {
      node = document.createElement('div');
      node.className = 'koko-auth-guard';
      node.innerHTML =
        '<div class="koko-auth-box">' +
          '<h2>Login diperlukan</h2>' +
          '<p data-auth-message></p>' +
          '<div class="koko-auth-actions">' +
            '<a class="primary" data-auth-oauth href="#">Login dengan Roblox</a>' +
            '<button type="button" data-auth-close>Nanti dulu</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(node);
      node.querySelector('[data-auth-close]').addEventListener('click', function() {
        node.classList.remove('show');
      });
    }
    var returnTo = location.pathname.split('/').pop() + location.search + location.hash;
    localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ returnTo: returnTo, time: Date.now() }));
    node.querySelector('[data-auth-message]').textContent = message || 'Silakan login dengan Roblox terlebih dahulu untuk melanjutkan checkout.';
    node.querySelector('[data-auth-oauth]').href = API_BASE + '/api/auth/roblox/start?returnTo=' + encodeURIComponent(returnTo);
    node.classList.add('show');
  }

  function installCheckoutGuard() {
    document.addEventListener('click', function(event) {
      var target = event.target.closest('#btn-order, #mob-bar-btn, #gift-form button[type="submit"], [data-require-login]');
      if (!target) return;
      if (isLoggedIn()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openAuthGuard('Silakan login dengan Roblox terlebih dahulu untuk melanjutkan checkout.');
    }, true);

    document.addEventListener('submit', function(event) {
      if (!event.target || event.target.id !== 'gift-form') return;
      if (isLoggedIn()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openAuthGuard('Silakan login dengan Roblox terlebih dahulu untuk membuat pesanan.');
    }, true);
  }

  function syncPendingCheckout() {
    var params = new URLSearchParams(location.search);
    var returnTo = params.get('returnTo');
    if (!returnTo || !isLoggedIn()) return;
    localStorage.removeItem(PENDING_CHECKOUT_KEY);
  }

  document.addEventListener('DOMContentLoaded', function() {
    installCheckoutGuard();
    syncPendingCheckout();
    renderHistoryPage();
    renderCheckPage();
    renderAccountWidgets();
    loadRemoteOrders();
  });

  document.addEventListener('kokorbx:orders-updated', function() {
    renderAccountWidgets();
    renderHistoryPage();
    renderCheckPage();
  });

  window.addEventListener('kokorbx:roblox-profile', function() {
    loadRemoteOrders(true);
    renderAccountWidgets();
    renderHistoryPage();
    renderCheckPage();
  });

  window.KokoTransactions = {
    collectOrders: collectOrders,
    counts: counts,
    isLoggedIn: isLoggedIn,
    openDetail: openDetail,
    openAuthGuard: openAuthGuard,
    loadRemoteOrders: loadRemoteOrders,
    normalizeStatus: normalizeStatus,
    statuses: STATUS,
    updateOrderStatus: updateOrderStatus,
    getProfile: getProfile,
    attachBuyerIdentity: attachBuyerIdentity,
  };
})();
