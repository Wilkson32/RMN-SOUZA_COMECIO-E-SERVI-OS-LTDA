/* RMN — comportamento compartilhado entre todas as páginas */
(function () {
  'use strict';
  var KEY = 'rmn_orcamento', USER = 'rmn_usuario', WA = '5581994162132';
  var read = function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  var write = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var getQuote = function () { return read(KEY) || []; };
  var norm = function (s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  var page = location.pathname.split('/').pop() || 'index.html';

  /* ---------- selo de contagem no botão de orçamento ---------- */
  function updateBadge() {
    var total = getQuote().reduce(function (n, i) { return n + i.qty; }, 0);
    document.querySelectorAll('.btn-cart').forEach(function (el) {
      var b = el.querySelector('.cart-badge');
      if (!b) { b = document.createElement('span'); b.className = 'cart-badge'; el.appendChild(b); }
      b.textContent = total; b.hidden = total === 0;
    });
  }

  /* ---------- login: mostra nome no cabeçalho ---------- */
  function updateUser() {
    var u = read(USER);
    document.querySelectorAll('.btn-login').forEach(function (el) {
      el.innerHTML = '<i class="fa-solid fa-user"></i> ' + (u ? esc(u.nome.split(' ')[0]) : 'Entrar');
    });
  }

  /* ---------- aviso (toast) ---------- */
  var toastTimer;
  function toast(html) {
    var t = document.querySelector('.pt-toast');
    if (!t) { t = document.createElement('div'); t.className = 'pt-toast'; document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  /* ---------- adicionar ao orçamento ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.product-card .btn-add-cart, .product-card .btn-buy');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.product-card');
    var tEl = card.querySelector('.product-title, h3');
    var img = card.querySelector('img');
    if (!tEl) return;
    var title = tEl.textContent.trim().replace(/\s+/g, ' ');
    var q = getQuote(), found = q.filter(function (i) { return i.t === title; })[0];
    if (found) found.qty++;
    else q.push({ t: title, i: img ? img.getAttribute('src') : '', u: page, qty: 1 });
    write(KEY, q); updateBadge();
    toast('<i class="fa-solid fa-circle-check"></i> Adicionado ao orçamento · <a href="orcamento.html">Ver orçamento</a>');
  });

  /* ---------- busca ---------- */
  function initSearch() {
    var box = document.getElementById('search-results');
    if (!box) return;
    var q = (new URLSearchParams(location.search).get('q') || '').trim();
    document.querySelectorAll('.search-bar input[name="q"]').forEach(function (i) { i.value = q; });
    var terms = norm(q).split(/\s+/).filter(Boolean);
    var list = (window.PRODUCTS || []).filter(function (p) {
      var hay = norm(p.t + ' ' + p.c);
      return !terms.length || terms.every(function (t) { return hay.indexOf(t) > -1; });
    });
    document.getElementById('search-summary').textContent = q
      ? list.length + ' resultado(s) para “' + q + '”' : 'Todos os produtos (' + list.length + ')';
    document.getElementById('search-empty').hidden = list.length > 0;
    box.innerHTML = list.map(function (p) {
      return '<div class="product-card result-card">' +
        (p.i ? '<img class="product-img" src="' + esc(p.i) + '" alt="' + esc(p.t) + '" loading="lazy">' : '') +
        '<a class="cat-tag" href="' + p.u + '">' + esc(p.c) + '</a>' +
        '<h3 class="product-title">' + esc(p.t) + '</h3>' +
        '<a href="orcamento.html" class="btn-add-cart"><i class="fa-solid fa-cart-plus"></i> Solicite o Orçamento</a></div>';
    }).join('');
  }

  /* ---------- página de orçamento ---------- */
  function initQuote() {
    var box = document.getElementById('quote-list');
    if (!box) return;
    var u = read(USER);
    if (u) document.getElementById('q-nome').value = u.nome;

    function render() {
      var q = getQuote();
      if (!q.length) {
        box.innerHTML = '<div class="empty-state"><i class="fa-solid fa-cart-shopping"></i><h2>Seu orçamento está vazio</h2>' +
          '<p>Adicione produtos nos departamentos para solicitar valores.</p>' +
          '<a href="index.html" class="btn-primary-lg">Explorar produtos</a></div>';
        return;
      }
      box.innerHTML = q.map(function (it, n) {
        return '<div class="q-item">' +
          (it.i ? '<img src="' + esc(it.i) + '" alt="">' : '<div class="q-noimg"><i class="fa-solid fa-box"></i></div>') +
          '<div class="q-info"><a href="' + esc(it.u) + '">' + esc(it.t) + '</a><small>Ver no departamento</small></div>' +
          '<div class="q-qty"><button data-a="-" data-n="' + n + '" aria-label="Diminuir">−</button><strong>' + it.qty +
          '</strong><button data-a="+" data-n="' + n + '" aria-label="Aumentar">+</button></div>' +
          '<button class="q-rm" data-a="x" data-n="' + n + '" aria-label="Remover"><i class="fa-regular fa-trash-can"></i></button></div>';
      }).join('');
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var q = getQuote(), n = +b.dataset.n;
      if (b.dataset.a === '+') q[n].qty++;
      if (b.dataset.a === '-') q[n].qty = Math.max(1, q[n].qty - 1);
      if (b.dataset.a === 'x') q.splice(n, 1);
      write(KEY, q); render(); updateBadge();
    });
    document.getElementById('q-clear').addEventListener('click', function () {
      if (confirm('Limpar todos os itens do orçamento?')) { write(KEY, []); render(); updateBadge(); }
    });
    document.getElementById('q-send').addEventListener('click', function () {
      var q = getQuote();
      if (!q.length) { toast('Adicione ao menos um produto.'); return; }
      var nome = document.getElementById('q-nome').value.trim();
      if (!nome) { toast('Informe seu nome para continuar.'); document.getElementById('q-nome').focus(); return; }
      var tel = document.getElementById('q-tel').value.trim(), obs = document.getElementById('q-obs').value.trim();
      var msg = 'Olá! Gostaria de solicitar um orçamento na RMN Souza Comércio e Serviços LTDA.\n\n*Cliente:* ' + nome +
        (tel ? '\n*Contato:* ' + tel : '') + '\n\n*Itens:*\n' +
        q.map(function (i) { return '• ' + i.qty + 'x ' + i.t; }).join('\n') + (obs ? '\n\n*Obs.:* ' + obs : '');
      window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
    render();
  }

  /* ---------- login ---------- */
  function initAuth() {
    var form = document.getElementById('auth-form');
    if (!form) return;
    var logged = document.getElementById('auth-logged');
    function show() {
      var u = read(USER);
      form.hidden = !!u; logged.hidden = !u;
      document.getElementById('auth-title').textContent = u ? 'Minha Conta' : 'Entrar';
      document.getElementById('auth-sub').hidden = !!u;
      if (u) document.getElementById('a-hello').textContent = u.nome;
      updateUser();
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      write(USER, { nome: document.getElementById('a-nome').value.trim(), email: document.getElementById('a-email').value.trim() });
      show();
    });
    document.getElementById('a-logout').addEventListener('click', function () { localStorage.removeItem(USER); show(); });
    show();
  }

  /* ---------- menu Departamentos (toque/clique no celular) ---------- */
  function initMenu() {
    var btn = document.querySelector('.btn-departamentos'), menu = document.querySelector('.dropdown-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && !btn.contains(e.target)) { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMenu();
    updateBadge(); updateUser(); initSearch(); initQuote(); initAuth();
  });
})();
