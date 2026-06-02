(function() {
  'use strict';

  var STORAGE_KEY = 'kokorbx_panel_orders_v1';
  var ACTIVE_KEY = 'kokorbx_panel_active_order';

  function safeParse(value, fallback) {
    try {
      var parsed = JSON.parse(value || '');
      return parsed || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readOrders() {
    var orders = safeParse(localStorage.getItem(STORAGE_KEY), []);
    return Array.isArray(orders) ? orders : [];
  }

  function writeOrders(orders) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }

  function makeId(prefix) {
    return (prefix || 'TRX') + '-' + Math.floor(100000 + Math.random() * 900000);
  }

  function now() {
    return Date.now();
  }

  function normalizeOrder(input) {
    input = input || {};
    var id = input.id || makeId(input.prefix || 'TRX');
    var title = input.product || input.title || 'Custom Roblox';
    var buyerText = input.buyerMessage || input.detail || 'Halo, aku mau order ' + title + '.';
    return {
      id: id,
      product: title,
      category: input.category || 'custom',
      image: input.image || '',
      price: Number(input.price || 0),
      priceText: input.priceText || (input.price ? 'Rp ' + Number(input.price).toLocaleString('id-ID') : 'Menunggu admin'),
      status: input.status || 'Menunggu admin',
      buyer: input.buyer || input.username || 'Buyer KokoRBX',
      username: input.username || '',
      user: input.user || input.username || '',
      kokoUserId: input.kokoUserId || '',
      robloxUserId: input.robloxUserId || input.userId || '',
      userId: input.userId || input.robloxUserId || '',
      robloxUsername: input.robloxUsername || input.username || '',
      robloxDisplayName: input.robloxDisplayName || input.displayName || '',
      buyerUsername: input.buyerUsername || input.username || input.buyer || '',
      buyerDisplayName: input.buyerDisplayName || input.robloxDisplayName || input.buyer || '',
      recipientUsername: input.recipientUsername || '',
      loginProvider: input.loginProvider || '',
      detail: input.detail || '',
      source: input.source || location.pathname.split('/').pop() || 'marketplace',
      createdAt: input.createdAt || now(),
      updatedAt: now(),
      messages: input.messages || [
        {
          role: 'system',
          text: 'Transaksi dibuat di panel KokoRBX. Admin akan cek detail dan balas di chat ini.',
          time: now(),
        },
        {
          role: 'buyer',
          text: buyerText,
          time: now() + 1,
        },
      ],
      timeline: input.timeline || [
        { label: 'Order dibuat', time: now(), done: true },
        { label: 'Diskusi admin', time: null, done: false },
        { label: 'Pembayaran', time: null, done: false },
        { label: 'Selesai', time: null, done: false },
      ],
    };
  }

  function saveOrder(order) {
    var orders = readOrders();
    var index = orders.findIndex(function(item) { return item.id === order.id; });
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.unshift(order);
    }
    writeOrders(orders);
    localStorage.setItem(ACTIVE_KEY, order.id);
    return order;
  }

  function createOrder(input) {
    return saveOrder(normalizeOrder(input));
  }

  function updateOrder(id, patch) {
    var orders = readOrders();
    var index = orders.findIndex(function(item) { return item.id === id; });
    if (index < 0) return null;
    var current = orders[index];
    var next = Object.assign({}, current, patch || {}, { updatedAt: now() });
    orders[index] = next;
    writeOrders(orders);
    localStorage.setItem(ACTIVE_KEY, id);
    return next;
  }

  function addMessage(id, role, text) {
    var orders = readOrders();
    var index = orders.findIndex(function(item) { return item.id === id; });
    if (index < 0 || !String(text || '').trim()) return null;
    var current = orders[index];
    current.messages = Array.isArray(current.messages) ? current.messages : [];
    current.messages.push({
      role: role || 'buyer',
      text: String(text).trim(),
      time: now(),
    });
    current.updatedAt = now();
    orders[index] = current;
    writeOrders(orders);
    localStorage.setItem(ACTIVE_KEY, id);
    return current;
  }

  function setActive(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
  }

  function getActiveId() {
    return localStorage.getItem(ACTIVE_KEY) || '';
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  }

  window.KokoPanel = {
    addMessage: addMessage,
    clearAll: clearAll,
    createOrder: createOrder,
    getActiveId: getActiveId,
    readOrders: readOrders,
    saveOrder: saveOrder,
    setActive: setActive,
    updateOrder: updateOrder,
  };
})();
