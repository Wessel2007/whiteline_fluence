// Guia de compra: checklist com marcações salvas no navegador, cópia da mensagem pronta e índice que acompanha a leitura.
// Arquivo separado porque a CSP do site (vercel.json) não permite script inline.
(function () {
  'use strict';

  var STORAGE_KEY = 'wl-guia-checklist-v1';
  var motion = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (motion) document.documentElement.classList.add('wl-anim');

  // Reinicia uma animação CSS ligada a uma classe (para tocar de novo a cada clique)
  function replay(el, cls) {
    if (!motion || !el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // localStorage pode estar bloqueado (aba anônima, cookies desligados): o checklist funciona, só não lembra
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // ===== Checklist =====
  // Cada item vira: [caixa "conferido"] texto  [Não se aplica]. As duas marcações se excluem.
  function initChecklist() {
    var list = document.querySelector('[data-checklist]');
    if (!list) return;
    var items = Array.prototype.slice.call(list.children);
    var state = load(); // { "0": "ok" | "na" }
    var total = items.length;

    var rows = items.map(function (li, i) {
      var text = li.textContent.trim();
      li.textContent = '';
      li.className = 'wl-ck';

      var main = document.createElement('label');
      main.className = 'wl-ck-main';
      var ok = document.createElement('input');
      ok.type = 'checkbox';
      var box = document.createElement('span');
      box.className = 'wl-ck-box';
      box.setAttribute('aria-hidden', 'true');
      var txt = document.createElement('span');
      txt.className = 'wl-ck-text';
      txt.textContent = text;
      main.append(ok, box, txt);

      var naLabel = document.createElement('label');
      naLabel.className = 'wl-ck-na';
      var na = document.createElement('input');
      na.type = 'checkbox';
      na.setAttribute('aria-label', 'Não se aplica: ' + text);
      var naTxt = document.createElement('span');
      naTxt.textContent = 'Não se aplica';
      naTxt.setAttribute('aria-hidden', 'true');
      naLabel.append(na, naTxt);

      li.append(main, naLabel);

      ok.addEventListener('change', function () {
        if (ok.checked) na.checked = false;
        update(i);
      });
      na.addEventListener('change', function () {
        if (na.checked) ok.checked = false;
        update(i);
      });

      if (state[i] === 'ok') ok.checked = true;
      else if (state[i] === 'na') na.checked = true;
      return { li: li, ok: ok, na: na };
    });

    var $ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
    var clearBtn = document.querySelector('[data-ck-clear]');
    var progress = document.querySelector('[data-ck-progress]');
    var confirmTimer;

    function setText(sel, v) { $(sel).forEach(function (el) { el.textContent = v; }); }

    var complete = document.querySelector('[data-ck-complete]');
    var lastDone = -1;

    function update(changed) {
      var nOk = 0, nNa = 0;
      rows.forEach(function (r, i) {
        var v = r.ok.checked ? 'ok' : r.na.checked ? 'na' : '';
        r.li.classList.toggle('is-ok', v === 'ok');
        r.li.classList.toggle('is-na', v === 'na');
        if (v === 'ok') nOk++;
        if (v === 'na') nNa++;
        if (v) state[i] = v; else delete state[i];
      });
      var done = nOk + nNa;
      var pct = Math.round(done / total * 100);
      setText('[data-ck-done]', done);
      setText('[data-ck-total]', total);
      setText('[data-ck-ok]', nOk);
      setText('[data-ck-na]', nNa);
      setText('[data-ck-pend]', total - done);
      setText('[data-ck-mini]', done + ' de ' + total);
      $('[data-ck-bar]').forEach(function (el) { el.style.width = pct + '%'; });
      if (progress) progress.setAttribute('aria-valuenow', pct);
      if (clearBtn) clearBtn.disabled = done === 0;
      if (complete) complete.hidden = done !== total;
      if (changed != null) {
        save(state);
        replay(rows[changed].li, 'is-flash');
        $('[data-ck-done]').forEach(function (el) { replay(el, 'is-bump'); });
        if (done === total && lastDone < total) confetti(document.querySelector('.wl-check'));
      }
      lastDone = done;
    }

    // Limpar pede um segundo toque para não apagar tudo sem querer
    if (clearBtn) {
      var label = clearBtn.textContent;
      var reset = function () {
        clearTimeout(confirmTimer);
        clearBtn.classList.remove('is-confirm');
        clearBtn.textContent = label;
      };
      clearBtn.addEventListener('click', function () {
        if (!clearBtn.classList.contains('is-confirm')) {
          clearBtn.classList.add('is-confirm');
          clearBtn.textContent = 'Toque de novo para limpar';
          confirmTimer = setTimeout(reset, 3500);
          return;
        }
        rows.forEach(function (r) { r.ok.checked = false; r.na.checked = false; });
        state = {};
        save(state);
        reset();
        update();
        clearBtn.textContent = 'Marcações limpas ✓';
        confirmTimer = setTimeout(reset, 2000);
      });
    }

    // Outra aba mexeu no checklist: acompanha
    window.addEventListener('storage', function (e) {
      if (e.key !== STORAGE_KEY) return;
      state = load();
      rows.forEach(function (r, i) { r.ok.checked = state[i] === 'ok'; r.na.checked = state[i] === 'na'; });
      update();
    });

    update();
  }

  // Confete vermelho e branco saindo do contador quando o checklist fica completo
  function confetti(box) {
    if (!motion || !box) return;
    var origin = box.querySelector('.wl-check-count');
    var bx = box.getBoundingClientRect(), o = origin.getBoundingClientRect();
    var x0 = o.left - bx.left + 40, y0 = o.top - bx.top + 30;
    var cores = ['#e3262c', '#ff3b3f', '#f4f3f1', '#c81e24'];
    for (var i = 0; i < 36; i++) {
      var c = document.createElement('i');
      c.className = 'wl-confetti';
      var ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 220;
      c.style.left = x0 + 'px';
      c.style.top = y0 + 'px';
      c.style.background = cores[i % cores.length];
      c.style.setProperty('--x', Math.round(Math.cos(ang) * dist) + 'px');
      c.style.setProperty('--y', Math.round(Math.sin(ang) * dist * .7 + 120) + 'px');
      c.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      c.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
      box.appendChild(c);
      c.addEventListener('animationend', function () { this.remove(); });
    }
  }

  // ===== Animações de entrada e barra de leitura =====
  function initMotion() {
    // Barra de leitura (funciona mesmo com menos movimento: só acompanha a rolagem)
    var bar = document.querySelector('.wl-read > i');
    if (bar) {
      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var max = document.documentElement.scrollHeight - innerHeight;
          bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      onScroll();
    }

    if (!motion || !('IntersectionObserver' in window)) {
      document.documentElement.classList.remove('wl-anim');
      return;
    }

    // Título: cada palavra vira um <span class="wl-w"> com atraso crescente
    var h1 = document.querySelector('.wl-h1');
    if (h1) {
      var n = 0;
      Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
        // Palavra que já veio num <span> (o "usado" vermelho): troca por uma cópia nova. O original já está
        // desenhado visível; só ganhar a classe faria ele "transicionar" para invisível e voltar, sem animar.
        if (node.nodeType === 1) {
          var copia = node.cloneNode(true);
          copia.classList.add('wl-w');
          copia.style.setProperty('--i', n++);
          h1.replaceChild(copia, node);
          return;
        }
        if (node.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = 'wl-w';
          w.textContent = part;
          w.style.setProperty('--i', n++);
          frag.appendChild(w);
        });
        h1.replaceChild(frag, node);
      });
      requestAnimationFrame(function () { requestAnimationFrame(function () { document.documentElement.classList.add('wl-in'); }); });
    }

    // Elementos que surgem ao rolar; irmãos entram em cascata
    var sel = [
      '.wl-crumbs', '.wl-eyebrow', '.wl-sub', '.wl-lead p', '.wl-rule', '.wl-disclaimer', '.wl-toc',
      '.wl-num', '.wl-h2', '.wl-h3', '.wl-content p', '.wl-list li', '.wl-table tbody tr', '.wl-msg',
      '.wl-story', '.wl-callout', '.wl-formula > *', '.wl-decide > div', '.wl-check', '.wl-end',
      '.wl-sources li', '.wl-end-ctas > a'
    ].join(',');
    var els = Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (el) {
      // não anima o que já está dentro de outro bloco animado (o bloco entra inteiro)
      var p = el.parentElement.closest('.wl-story, .wl-callout, .wl-decide, .wl-check, .wl-end, .wl-msg, .wl-formula, .wl-toc');
      return !p || el.parentElement.matches('.wl-formula, .wl-decide, .wl-end-ctas');
    });
    els.forEach(function (el) {
      el.classList.add('wl-r');
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return els.indexOf(c) > -1; });
      el.style.setProperty('--d', Math.min(sibs.indexOf(el), 8));
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });

    // Pulou direto para uma seção (índice, link com #): mostra na hora o que ficou acima, sem esperar a rolagem
    var revealAbove = function () {
      els.forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in'); });
    };
    window.addEventListener('hashchange', function () { setTimeout(revealAbove, 50); });
    if (location.hash) setTimeout(revealAbove, 50);
  }

  // ===== Copiar a mensagem pronta para o vendedor =====
  function initCopy() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
      var label = btn.textContent;
      var timer;
      btn.addEventListener('click', function () {
        var src = document.querySelector(btn.getAttribute('data-copy'));
        if (!src) return;
        var text = src.textContent.trim();
        var done = function (ok) {
          btn.textContent = ok ? 'Mensagem copiada ✓' : 'Selecione e copie';
          clearTimeout(timer);
          timer = setTimeout(function () { btn.textContent = label; }, 2000);
          if (!ok) selectText(src);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          done(false);
        }
      });
    });
  }
  function selectText(el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  // ===== Índice: destaca a parte que está sendo lida e mostra o botão "Índice" no celular =====
  function initToc() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.wl-toc a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current;
    var setActive = function (id) {
      if (id === current) return;
      current = id;
      links.forEach(function (a) {
        var on = a === map[id];
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    };

    var toc = document.getElementById('indice');
    var fab = document.querySelector('.wl-totoc');

    if (!('IntersectionObserver' in window)) return;

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });

    // Botão flutuante: aparece depois que o índice sai da tela e some perto do rodapé
    if (toc && fab) {
      var tocGone = false, nearEnd = false;
      var sync = function () { fab.classList.toggle('is-on', tocGone && !nearEnd); };
      new IntersectionObserver(function (en) {
        tocGone = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
        sync();
      }).observe(toc);
      var footer = document.querySelector('.wl-footer');
      if (footer) new IntersectionObserver(function (en) { nearEnd = en[0].isIntersecting; sync(); }).observe(footer);
    }
  }

  initMotion();
  initChecklist();
  initCopy();
  initToc();

  // Ano do rodapé sempre atual (o HTML já traz um valor para quando o script não roda)
  var ano = document.querySelector('[data-ano]');
  if (ano) ano.textContent = new Date().getFullYear();
})();
