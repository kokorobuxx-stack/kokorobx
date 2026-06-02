(function() {
  'use strict';

  var PROFILE_KEY = 'kokorbx_roblox_profile';
  var SESSION_KEY = 'rbx_session';
  var ADMIN_TOKEN_KEY = 'kokorbx_admin_token';
  var API_BASE = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'https://koko-rbx.vercel.app'
    : '';
  var profileCache = readProfile();
  var toastTimer = null;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char];
    });
  }

  function initials(value) {
    var clean = String(value || 'RBX').replace(/[^a-zA-Z0-9_ ]/g, '').trim();
    if (!clean) return 'RB';
    var parts = clean.split(/[\s_]+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readProfile() {
    var profile = readJson(PROFILE_KEY, null);
    if (!profile || !profile.username || !profile.userId) return null;
    return profile;
  }

  function saveProfile(profile) {
    var clean = {
      userId: Number(profile.userId),
      username: String(profile.username || '').trim(),
      displayName: String(profile.displayName || profile.username || '').trim(),
      avatarUrl: profile.avatarUrl || profile.headshotUrl || '',
      headshotUrl: profile.headshotUrl || profile.avatarUrl || '',
      profileUrl: profile.profileUrl || '',
      status: 'Username Roblox Terhubung',
      verified: false,
      verificationLabel: 'Belum Terverifikasi',
      connectedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      username: clean.username,
      robloxUserId: clean.userId,
      displayName: clean.displayName,
      avatarUrl: clean.headshotUrl || clean.avatarUrl,
      source: 'roblox-public-profile',
    }));
    profileCache = clean;
    return clean;
  }

  function removeProfile() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SESSION_KEY);
    profileCache = null;
    renderAllSlots();
    applyProfileToForms(null);
    hydrateAccountPage(null);
    toast('Akun Roblox terhubung sudah dihapus.');
  }

  function isAdminSession() {
    try {
      if (sessionStorage.getItem(ADMIN_TOKEN_KEY)) return true;
    } catch (error) {}
    var session = readJson(SESSION_KEY, null);
    var role = String((session && session.role) || '').toLowerCase();
    return role === 'admin' || role === 'owner';
  }

  function avatarMarkup(profile, sizeClass) {
    var label = (profile && (profile.displayName || profile.username)) || 'Roblox';
    var src = profile && (profile.headshotUrl || profile.avatarUrl);
    return '<span class="koko-profile-avatar ' + (sizeClass || '') + '">' +
      (src
        ? '<img src="' + escapeHtml(src) + '" alt="Avatar Roblox ' + escapeHtml(label) + '" loading="lazy">'
        : '<span>' + escapeHtml(initials(label)) + '</span>') +
    '</span>';
  }

  function findHeaderHolders() {
    return Array.from(document.querySelectorAll('.header-actions, .header-right'));
  }

  function normalizeHeader(holder) {
    if (!holder) return;
    holder.querySelectorAll('#user-bar, #login-bar, a[href="rbxstore_auth.html"]').forEach(function(node) {
      node.style.display = 'none';
    });
    holder.querySelectorAll('.logout-btn, button[onclick*="logoutStore"], a[href*="rbxstore_auth.html"]').forEach(function(node) {
      node.style.display = 'none';
    });
    Array.from(holder.children).forEach(function(node) {
      if (node.classList && node.classList.contains('koko-profile-slot')) return;
      var text = String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (text === 'keluar' || text === 'masuk' || /^@?tamu_\d+/.test(text)) {
        node.style.display = 'none';
      }
    });
    holder.querySelectorAll('a[href="admin.html"], .btn-admin').forEach(function(link) {
      link.style.display = isAdminSession() ? '' : 'none';
    });
  }

  function ensureSlot(holder) {
    if (!holder) return null;
    normalizeHeader(holder);
    var existing = holder.querySelector('.koko-profile-slot');
    if (existing) return existing;

    var slot = document.createElement('div');
    slot.className = 'koko-profile-slot';
    var before = holder.querySelector('a[href="admin.html"], .btn-admin, .online-pill, .live-badge') || null;
    holder.insertBefore(slot, before);
    return slot;
  }

  function renderConnected(slot, profile) {
    slot.innerHTML =
      '<a class="koko-mini-profile" href="akun.html" aria-label="Buka halaman akun Roblox">' +
        avatarMarkup(profile) +
        '<span class="koko-profile-name">' + escapeHtml(profile.displayName || profile.username) + '</span>' +
        '<span class="koko-profile-caret" aria-hidden="true">&gt;</span>' +
      '</a>';
  }

  function renderDisconnected(slot) {
    slot.innerHTML =
      '<button class="koko-connect-btn" type="button">' +
        '<span class="koko-profile-avatar" aria-hidden="true">RB</span>' +
        '<span>Hubungkan Roblox</span>' +
      '</button>';
    slot.querySelector('button').addEventListener('click', function() {
      openConnectModal('');
    });
  }

  function renderAllSlots() {
    document.documentElement.classList.add('kokorbx-profile-ready');
    document.documentElement.classList.toggle('kokorbx-has-admin', isAdminSession());
    findHeaderHolders().forEach(function(holder) {
      var slot = ensureSlot(holder);
      if (!slot) return;
      var profile = readProfile();
      if (profile) renderConnected(slot, profile);
      else renderDisconnected(slot);
    });
  }

  function closeMenus() {
    document.querySelectorAll('.koko-profile-slot.is-open').forEach(function(slot) {
      slot.classList.remove('is-open');
      var button = slot.querySelector('.koko-mini-profile');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  }

  function getModal() {
    var modal = document.getElementById('koko-profile-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'koko-profile-modal';
    modal.className = 'koko-profile-modal-backdrop';
    modal.innerHTML =
      '<div class="koko-profile-modal" role="dialog" aria-modal="true" aria-labelledby="koko-profile-modal-title">' +
        '<div class="koko-profile-modal-head">' +
          '<div>' +
            '<div class="koko-profile-modal-title" id="koko-profile-modal-title">Hubungkan Roblox</div>' +
            '<div class="koko-profile-modal-sub" id="koko-profile-modal-sub">Masukkan username Roblox. KokoRBX hanya mengambil data publik: avatar, display name, username, dan user ID.</div>' +
          '</div>' +
          '<button class="koko-profile-close" type="button" aria-label="Tutup">x</button>' +
        '</div>' +
        '<form class="koko-profile-form" id="koko-profile-form">' +
          '<div class="koko-profile-field">' +
            '<label for="koko-profile-username">Username Roblox</label>' +
            '<input id="koko-profile-username" autocomplete="username" placeholder="Contoh: tama_6505" required>' +
          '</div>' +
          '<div class="koko-profile-safety">KokoRBX tidak pernah meminta password, cookie, kode 2FA, atau kode backup Roblox kamu.</div>' +
          '<div class="koko-profile-error" id="koko-profile-error"></div>' +
          '<button class="koko-profile-submit" id="koko-profile-submit" type="submit">Cek dan Hubungkan</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.koko-profile-close').addEventListener('click', closeConnectModal);
    modal.addEventListener('click', function(event) {
      if (event.target === modal) closeConnectModal();
    });
    modal.querySelector('#koko-profile-form').addEventListener('submit', submitProfile);
    return modal;
  }

  function openConnectModal(prefill) {
    var modal = getModal();
    var input = modal.querySelector('#koko-profile-username');
    var error = modal.querySelector('#koko-profile-error');
    error.classList.remove('show');
    error.textContent = '';
    input.value = prefill || (profileCache && profileCache.username) || '';
    modal.classList.add('show');
    setTimeout(function() { input.focus(); }, 30);
  }

  function closeConnectModal() {
    var modal = document.getElementById('koko-profile-modal');
    if (modal) modal.classList.remove('show');
  }

  function openInfoModal(title, message) {
    var existing = document.getElementById('koko-profile-info-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'koko-profile-info-modal';
    modal.className = 'koko-profile-modal-backdrop show';
    modal.innerHTML =
      '<div class="koko-profile-modal" role="dialog" aria-modal="true">' +
        '<div class="koko-profile-modal-head">' +
          '<div><div class="koko-profile-modal-title">' + escapeHtml(title) + '</div>' +
          '<div class="koko-profile-modal-sub">' + escapeHtml(message) + '</div></div>' +
          '<button class="koko-profile-close" type="button" aria-label="Tutup">x</button>' +
        '</div>' +
        '<div class="koko-profile-form">' +
          '<div class="koko-profile-safety">Fitur bonus member akan hadir nanti. Saat ini tidak ada klaim bonus, kupon, poin, atau reward aktif.</div>' +
          '<button class="koko-profile-submit" type="button">Mengerti</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelectorAll('button').forEach(function(button) {
      button.addEventListener('click', function() { modal.remove(); });
    });
    modal.addEventListener('click', function(event) {
      if (event.target === modal) modal.remove();
    });
  }

  async function submitProfile(event) {
    event.preventDefault();
    var modal = getModal();
    var input = modal.querySelector('#koko-profile-username');
    var button = modal.querySelector('#koko-profile-submit');
    var error = modal.querySelector('#koko-profile-error');
    var username = String(input.value || '').trim();

    error.classList.remove('show');
    error.textContent = '';
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      error.textContent = 'Username Roblox tidak valid.';
      error.classList.add('show');
      return;
    }

    button.disabled = true;
    button.textContent = 'Mengecek username...';

    try {
      var response = await fetch(API_BASE + '/api/roblox-user?username=' + encodeURIComponent(username), { cache: 'no-store' });
      var data = await response.json();
      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.error || 'Username Roblox tidak ditemukan.');
      }

      var profile = saveProfile(data.profile);
      closeConnectModal();
      renderAllSlots();
      applyProfileToForms(profile);
      hydrateAccountPage(profile);
      toast('Akun Roblox berhasil dihubungkan.');
      window.dispatchEvent(new CustomEvent('kokorbx:roblox-profile', { detail: profile }));
    } catch (err) {
      error.textContent = err.message || 'Username Roblox tidak ditemukan.';
      error.classList.add('show');
    } finally {
      button.disabled = false;
      button.textContent = 'Cek dan Hubungkan';
    }
  }

  function applyProfileToForms(profile) {
    var active = profile || readProfile();
    if (!active) return;
    var usernameInputs = document.querySelectorAll('input#username, input[name="username"], input[data-roblox-username]');
    usernameInputs.forEach(function(input) {
      var current = String(input.value || '').trim();
      if (!current || /^tamu_\d+$/i.test(current) || input.dataset.profileAutofill === '1') {
        input.value = active.username;
        input.dataset.profileAutofill = '1';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    var displayInputs = document.querySelectorAll('input#displayName, input[name="displayName"], input[data-roblox-display]');
    displayInputs.forEach(function(input) {
      var current = String(input.value || '').trim();
      if (!current || input.dataset.profileAutofill === '1') {
        input.value = active.displayName || active.username;
        input.dataset.profileAutofill = '1';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    document.querySelectorAll('.summary, .preview-panel').forEach(function(panel) {
      if (panel.querySelector('.koko-buyer-summary')) return;
      var summary = document.createElement('div');
      summary.className = 'koko-buyer-summary';
      summary.innerHTML =
        avatarMarkup(active) +
        '<div><strong>' + escapeHtml(active.displayName || active.username) + '</strong>' +
        '<span>@' + escapeHtml(active.username) + ' - Belum Terverifikasi</span></div>';
      panel.insertBefore(summary, panel.firstElementChild);
    });
  }

  function countLocalOrders(profile) {
    if (!profile) return { total: 0, robux: 0 };
    var keys = [SESSION_KEY, 'rbx_orders', 'rbx_orders_u_' + profile.username];
    var seen = new Set();
    var total = 0;
    var robux = 0;
    keys.forEach(function(key) {
      if (key === SESSION_KEY) return;
      var rows = readJson(key, []);
      if (!Array.isArray(rows)) return;
      rows.forEach(function(order) {
        if (!order || !order.id || seen.has(order.id)) return;
        var user = String(order.username || '').toLowerCase();
        if (user && user !== String(profile.username).toLowerCase()) return;
        seen.add(order.id);
        total += 1;
        robux += Number(order.robux || order.totalRobux || 0) || 0;
      });
    });
    return { total: total, robux: robux };
  }

  function hydrateAccountPage(profile) {
    var page = document.querySelector('[data-koko-account-page]');
    if (!page) return;
    var active = profile || readProfile();
    page.classList.toggle('is-connected', !!active);
    page.querySelectorAll('[data-profile-avatar]').forEach(function(node) {
      node.innerHTML = active ? avatarMarkup(active, 'large') : avatarMarkup(null, 'large');
    });
    page.querySelectorAll('[data-profile-display]').forEach(function(node) {
      node.textContent = active ? (active.displayName || active.username) : 'Belum terhubung';
    });
    page.querySelectorAll('[data-profile-username]').forEach(function(node) {
      node.textContent = active ? '@' + active.username : 'Hubungkan username Roblox dulu';
    });
    page.querySelectorAll('[data-profile-userid]').forEach(function(node) {
      node.textContent = active ? 'User ID: ' + active.userId : 'User ID belum tersedia';
    });
    page.querySelectorAll('[data-profile-status]').forEach(function(node) {
      node.textContent = active ? 'Username Roblox Terhubung' : 'Belum Terhubung';
    });
    page.querySelectorAll('[data-profile-verify]').forEach(function(node) {
      node.textContent = active ? 'Belum Terverifikasi' : 'Belum Aktif';
    });
    var counts = countLocalOrders(active);
    page.querySelectorAll('[data-profile-total-orders]').forEach(function(node) {
      node.textContent = counts.total.toLocaleString('id-ID');
    });
    page.querySelectorAll('[data-profile-total-robux]').forEach(function(node) {
      node.textContent = counts.robux.toLocaleString('id-ID') + ' R$';
    });
    page.querySelectorAll('[data-connect-profile]').forEach(function(button) {
      button.textContent = active ? 'Ganti Username Roblox' : 'Hubungkan Roblox';
      button.onclick = function() { openConnectModal(active && active.username); };
    });
    page.querySelectorAll('[data-remove-profile]').forEach(function(button) {
      button.disabled = !active;
      button.onclick = removeProfile;
    });
    page.querySelectorAll('[data-verify-profile]').forEach(function(button) {
      button.onclick = function() {
        openInfoModal(
          'Verifikasi kepemilikan belum aktif',
          'Fitur verifikasi kepemilikan akun Roblox akan digunakan untuk fitur reward atau bonus di masa depan. Saat ini belum aktif.'
        );
      };
    });
  }

  function toast(message) {
    var node = document.getElementById('koko-profile-toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'koko-profile-toast';
      node.className = 'koko-profile-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      node.classList.remove('show');
    }, 2800);
  }

  function init() {
    renderAllSlots();
    applyProfileToForms(profileCache);
    hydrateAccountPage(profileCache);
    document.addEventListener('click', closeMenus);
    window.addEventListener('storage', function(event) {
      if (event.key === PROFILE_KEY || event.key === SESSION_KEY) {
        profileCache = readProfile();
        renderAllSlots();
        applyProfileToForms(profileCache);
        hydrateAccountPage(profileCache);
      }
    });
  }

  window.KokoRobloxProfile = {
    get: readProfile,
    connect: openConnectModal,
    remove: removeProfile,
    toast: toast,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
