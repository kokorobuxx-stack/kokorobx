(function() {
  'use strict';

  var KEY = 'kokorbx_site_theme';
  var root = document.documentElement;

  function getTheme() {
    try {
      return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
    } catch (error) {
      return 'light';
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (error) {}
  }

  function applyTheme(theme) {
    root.setAttribute('data-koko-theme', theme);
    root.style.colorScheme = theme;
    document.querySelectorAll('.koko-theme-toggle').forEach(function(button) {
      var dark = theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.innerHTML =
        '<span class="theme-icon" aria-hidden="true">' +
          (dark
            ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 1.8v2.4M12 19.8v2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none"><path d="M20.3 14.8A7.6 7.6 0 0 1 9.2 3.7 8.9 8.9 0 1 0 20.3 14.8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>') +
        '</span><span class="theme-label">' + (dark ? 'Light' : 'Dark') + '</span>';
    });
  }

  function createButton() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-pill koko-theme-toggle';
    button.setAttribute('aria-label', 'Ganti tema website');
    return button;
  }

  function mountToggle() {
    var button = document.querySelector('.koko-theme-toggle');
    if (!button) {
      var security = document.querySelector('.security-pill');
      if (security && security.parentNode) {
        button = createButton();
        security.parentNode.replaceChild(button, security);
      } else {
        var holder = document.querySelector('.header-actions, .header-right');
        if (!holder) return;
        button = createButton();
        var before = holder.querySelector('.online-pill, .live-badge, .btn-admin') || holder.firstElementChild;
        holder.insertBefore(button, before);
      }
    }

    button.addEventListener('click', function() {
      var next = root.getAttribute('data-koko-theme') === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      applyTheme(next);
    });

    applyTheme(getTheme());
  }

  applyTheme(getTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle);
  } else {
    mountToggle();
  }
})();
