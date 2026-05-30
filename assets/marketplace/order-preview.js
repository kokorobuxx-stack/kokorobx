(function() {
  'use strict';

  var pages = [
    { href: 'marketplace-preview.html', label: 'Marketplace' },
    { href: 'robux5hari.html', label: 'Robux 5 Hari' },
    { href: 'robuxvilog.html', label: 'VILOG' },
    { href: 'robuxusername.html', label: 'Username' },
    { href: 'giftgp.html', label: 'Gift GP' },
    { href: 'akunroblox.html', label: 'Akun Roblox' },
    { href: 'transaksi.html', label: 'Transaksi' }
  ];

  function currentFile() {
    var file = location.pathname.split('/').pop() || 'index.html';
    return file.toLowerCase();
  }

  function injectTabs() {
    if (document.querySelector('.koko-product-tabs')) return;
    var header = document.querySelector('header');
    if (!header || !header.parentNode) return;
    var current = currentFile();
    var nav = document.createElement('nav');
    nav.className = 'koko-product-tabs';
    nav.setAttribute('aria-label', 'Navigasi produk KokoRBX');
    nav.innerHTML = '<div class="koko-product-tabs-inner">' + pages.map(function(page) {
      var active = current === page.href.toLowerCase() || (current === 'gift-gp.html' && page.href === 'giftgp.html');
      return '<a class="koko-product-tab' + (active ? ' active' : '') + '" href="' + page.href + '">' + page.label + '</a>';
    }).join('') + '</div>';
    header.parentNode.insertBefore(nav, header.nextSibling);
  }

  function improveHeader() {
    var logo = document.querySelector('header .logo, header .brand');
    if (logo) logo.setAttribute('href', 'marketplace-preview.html');

    var host = document.querySelector('.header-right') || document.querySelector('.header-actions');
    if (!host || host.querySelector('.koko-market-link')) return;
    var link = document.createElement('a');
    link.className = 'koko-market-link';
    link.href = 'marketplace-preview.html';
    link.textContent = 'Marketplace';
    host.insertBefore(link, host.firstChild);
  }

  function injectHeroMedia() {
    var hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.hero-logo') || hero.querySelector('.koko-order-hero-media')) return;
    var current = currentFile();
    var images = {
      'robux5hari.html': 'assets/logo-robux-5day.png',
      'robuxvilog.html': 'assets/logo-robux-vilog.png',
      'robuxusername.html': 'assets/logo-robux-username.png'
    };
    var src = images[current];
    if (!src) return;
    var media = document.createElement('a');
    media.className = 'koko-order-hero-media';
    media.href = '#';
    media.setAttribute('aria-label', 'Produk KokoRBX');
    media.innerHTML = '<img src="' + src + '" alt="Produk KokoRBX">';
    hero.appendChild(media);
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('koko-order-preview');
    document.body.classList.add('koko-order-' + currentFile().replace(/\.html$/i, '').replace(/[^a-z0-9]+/g, '-'));
    improveHeader();
    injectTabs();
    injectHeroMedia();
  });
})();
