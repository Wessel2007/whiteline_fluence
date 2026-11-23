// CVT Monitor: landing page do app.
// Arquivo separado porque a CSP do site (vercel.json) não permite script inline.
(function () {
  'use strict';

  // ===================================================================
  // CONFIGURAÇÃO: é só mexer aqui
  // ===================================================================
  var CONFIG = {
    // Link do checkout da Cakto. Vazio = pré-lançamento (botões "Me avise").
    // Preenchido = vendas abertas (botões "Comprar" levam para a Cakto).
    caktoUrl: 'https://pay.cakto.com.br/cdm58z2',

    // Link do checkout da oferta com o preço cheio (precoDepois), usado quando o
    // lote de lançamento esgota. Crie as duas ofertas no mesmo produto da Cakto.
    caktoUrlDepois: 'https://pay.cakto.com.br/7jkkqrz',

    // Lote de lançamento: as primeiras N licenças saem por "preco"; depois, "precoDepois".
    // O contador "restam X" vem de /api/vagas (vendas pagas na Cakto) e só aparece
    // com as vendas abertas e as variáveis CAKTO_* configuradas na Vercel.
    loteTotal: 100,

    // Link do APK para o teste grátis. Vazio = botão de download escondido.
    // Ex.: 'downloads/cvt-monitor.apk' (arquivo dentro de site/downloads/).
    apkUrl: 'downloads/cvt-monitor.apk',

    // Impressão digital SHA-256 do APK publicado em apkUrl, mostrada embaixo do botão de
    // download com o aviso "baixe só por aqui". Vazio = não mostra. Gere com:
    //   Get-FileHash cvt-monitor.apk -Algorithm SHA256   (PowerShell)
    // e cole em minúsculas. Atualize junto com o APK, a cada versão nova.
    apkSha256: '0727538fac3f85e1845c1fbf9d8701fbc79b18d98ddcecab767031f56630092d',

    // Versão do APK publicado (ex.: '1.0.0'), mostrada junto da impressão digital.
    apkVersao: '1.0.5',

    // Preço (texto, com vírgula). precoDepois = preço cheio depois do
    // lançamento; deixe '' para não mostrar.
    preco: '39,90',
    precoDepois: '49,90',

    // Instagram que recebe os "me avise" (direct)
    instagram: 'whitelinefluence',
    msgAvise: 'Oi! Quero ser avisado quando o CVT Monitor for lançado. Meu carro é um Fluence ',
  };
  // ===================================================================

  var live = !!CONFIG.caktoUrl;
  var motion = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (motion) document.documentElement.classList.add('wl-anim');

  var $ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var fmt = function (x, d) {
    d = d || 0;
    return Number(x || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  // ===== Ano do rodapé =====
  $('[data-ano]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ===== Aviso rápido (toast) =====
  var toast = document.querySelector('[data-toast]');
  var toastT;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 4200);
  }

  // ===== Preço, lote de lançamento, estado de lançamento e botões =====
  $('[data-only="pre"]').forEach(function (el) { el.hidden = live; });
  $('[data-only="live"]').forEach(function (el) { el.hidden = !live; });

  // restantes: null = ainda não sabemos (pré-lançamento ou /api/vagas sem resposta)
  var lote = { total: CONFIG.loteTotal, restantes: null };
  var esgotado = function () { return live && lote.restantes === 0; };
  var precoAtual = function () { return esgotado() && CONFIG.precoDepois ? CONFIG.precoDepois : CONFIG.preco; };
  var urlCompra = function () { return esgotado() && CONFIG.caktoUrlDepois ? CONFIG.caktoUrlDepois : CONFIG.caktoUrl; };
  var arrow = '<span class="wl-arrow" aria-hidden="true">→</span>';

  function aplicarPreco() {
    var esg = esgotado();
    var temContador = live && lote.restantes != null && !esg;
    $('[data-preco]').forEach(function (el) { el.textContent = precoAtual(); });
    $('[data-preco-lote]').forEach(function (el) { el.textContent = CONFIG.preco; });
    $('[data-preco-depois]').forEach(function (el) { el.textContent = CONFIG.precoDepois; });
    $('[data-lote-total]').forEach(function (el) { el.textContent = lote.total; });
    // Sem preço cheio, não existe "lote": somem os textos de lote e o preço riscado
    $('[data-preco-depois-wrap]').forEach(function (el) { el.hidden = !CONFIG.precoDepois || esg; });
    $('[data-lote="aberto"]').forEach(function (el) { el.hidden = !CONFIG.precoDepois || esg; });
    $('[data-lote="esgotado"]').forEach(function (el) { el.hidden = !!CONFIG.precoDepois && !esg; });
    $('[data-lote-count-wrap]').forEach(function (el) { el.hidden = !temContador; });
    if (temContador) {
      $('[data-lote-restam]').forEach(function (el) { el.textContent = lote.restantes; });
      $('[data-lote-bar]').forEach(function (el) {
        el.style.width = Math.round((lote.total - lote.restantes) / lote.total * 100) + '%';
      });
    }
    if (!live) return;
    $('[data-cta]').forEach(function (a) {
      a.href = urlCompra();
      a.removeAttribute('target');
      a.innerHTML = 'Comprar · R$ ' + precoAtual() + ' ' + arrow;
    });
    $('[data-cta-short]').forEach(function (a) {
      a.href = urlCompra();
      a.textContent = 'Comprar';
    });
  }
  aplicarPreco();

  // Vendas abertas: busca quantas licenças do lote já foram pagas
  if (live && CONFIG.precoDepois && lote.total > 0 && window.fetch) {
    fetch('api/vagas', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Number.isInteger(d.vendidos) || d.vendidos < 0) return;
        lote.restantes = Math.max(0, lote.total - d.vendidos);
        aplicarPreco();
      })
      .catch(function () { /* sem contador: a página segue sem o "restam X" */ });
  }

  var dmUrl = 'https://ig.me/m/' + CONFIG.instagram;

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('sem clipboard'));
  }

  // Pré-lançamento: copia a mensagem pronta e abre o direct do Instagram
  if (!live) {
    $('[data-cta]').forEach(function (a) {
      a.href = dmUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.addEventListener('click', function () {
        copy(CONFIG.msgAvise).then(function () {
          showToast('Mensagem copiada! É só colar no direct e enviar.');
        }, function () {
          showToast('Manda um “me avisa do CVT Monitor” no direct que eu te chamo no lançamento.');
        });
      });
    });
  }

  // ===== Pop-up do lote de lançamento =====
  // Aparece uma vez a cada 3 dias: na intenção de sair (mouse indo para a barra do
  // navegador, no computador), depois de rolar até o fim das telas do app (#telas) ou após 50 s
  // na página. Não aparece se a pessoa já está na seção de preço, já clicou em comprar ou
  // acabou de baixar o app (nessa visita ela vai testar primeiro).
  var pop = document.querySelector('[data-pop]');
  var POP_KEY = 'cvtm-pop';
  var POP_PAUSA = 3 * 24 * 60 * 60 * 1000;
  var popVisto = false;
  try { popVisto = Date.now() - Number(localStorage.getItem(POP_KEY) || 0) < POP_PAUSA; } catch (e) { /* sem storage: mostra 1x nesta visita */ }

  var precoSec = document.getElementById('preco');
  // Mede na hora (e não por observer, que chega atrasado quando a pessoa pula direto para #preco)
  function noPreco() {
    if (!precoSec) return false;
    var r = precoSec.getBoundingClientRect();
    return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
  }

  function abrirPop() {
    if (!pop || popVisto || pop.open || typeof pop.showModal !== 'function' || noPreco()) return;
    popVisto = true;
    try { localStorage.setItem(POP_KEY, String(Date.now())); } catch (e) { /* ignora */ }
    pop.showModal();
  }
  function fecharPop() { if (pop && pop.open) pop.close(); }

  if (pop && typeof pop.showModal === 'function' && !popVisto) {
    // Já clicou num botão de compra / me avise: não precisa do pop-up
    $('[data-cta],[data-cta-short]').forEach(function (a) {
      if (!pop.contains(a)) a.addEventListener('click', function () { popVisto = true; });
    });
    $('[data-apk]').forEach(function (a) { a.addEventListener('click', function () { popVisto = true; }); });
    $('[data-pop-close]').forEach(function (b) { b.addEventListener('click', fecharPop); });
    $('[data-cta]', pop).forEach(function (a) { a.addEventListener('click', function () { setTimeout(fecharPop, 300); }); });
    // Clique no fundo escuro fecha
    pop.addEventListener('click', function (e) { if (e.target === pop) fecharPop(); });

    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY <= 0) abrirPop();
    });
    var gatilho = document.getElementById('telas');
    if (gatilho && 'IntersectionObserver' in window) {
      var go = new IntersectionObserver(function (es) {
        // Só quando a pessoa terminou de ver as telas do app (a seção saiu por cima da tela)
        // Espera a rolagem assentar: quem clicou em "Preço" no menu só passa pela seção no caminho
        if (!es[0].isIntersecting && es[0].boundingClientRect.top < 0) { go.disconnect(); setTimeout(abrirPop, 1500); }
      });
      go.observe(gatilho);
    }
    setTimeout(abrirPop, 50 * 1000);
  }

  if (CONFIG.apkUrl) {
    $('[data-apk]').forEach(function (a) { a.href = CONFIG.apkUrl; });
    $('[data-apk-wrap]').forEach(function (el) { el.hidden = false; });
    if (CONFIG.apkSha256) {
      $('[data-apk-sha-val]').forEach(function (el) { el.textContent = CONFIG.apkSha256.toLowerCase(); });
      if (CONFIG.apkVersao) $('[data-apk-ver]').forEach(function (el) { el.textContent = 'Versão ' + CONFIG.apkVersao + '. '; });
      $('[data-apk-sha]').forEach(function (el) { el.hidden = false; });
    }
  }

  // ===== Surgir ao rolar =====
  var reveals = $('[data-reveal]');
  if (motion && 'IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ===================================================================
  // Simulação do app (mesma lógica do modo demonstração do CVT Monitor).
  // Anima o celular do topo ([data-ph], tela Painel) e a marquinha da
  // escala de "Por que monitorar" ([data-scale-mark]).
  // ===================================================================
  var phones = $('[data-ph]');
  var marks = $('[data-scale-mark]');
  if (!phones.length && !marks.length) return;

  var tick = 0;
  var cl = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var rnd = function (a) { return (Math.random() - 0.5) * a; };

  var v = { cvt: 74, rpm: 1650, speed: 48, eng: 88, ratio: 1.12, acc: 1.4 };

  // Ciclo do celular do topo (em passos de 700 ms, ~22 s no total): fica tranquilo,
  // esquenta até ~101 °C (o balão de voz aparece ao passar de 90 °C), segura e esfria.
  // Só roda com animações ligadas.
  var HERO_CYCLE = 32, HERO_START = 5; // começa 5 passos antes da subida (~3,5 s)
  var heroT = 0;
  var heroCycling = function () { return motion && phones.length > 0; };
  function heroTarget() {
    var p = (heroT + HERO_START) % HERO_CYCLE;
    if (p < 10) return 80 + Math.sin(p / 3) * 1.5;   // tranquilo
    if (p < 16) return 80 + (p - 9) / 6 * 21;        // esquentando
    if (p < 22) return 101 + Math.sin(p) * 0.8;      // atenção
    if (p < 30) return 101 - (p - 21) / 8 * 21;      // esfriando
    return 80;
  }

  function target() {
    if (heroCycling()) return heroTarget();
    // Sem o ciclo: passeia entre ~72 e ~86 °C, como um dia comum de trânsito
    return 79 + Math.sin(tick / 26) * 7;
  }

  function sim(warm) {
    var follow = warm ? 0.05 : heroCycling() ? 0.6 : 0.08;
    v.cvt = cl(v.cvt + (target() - v.cvt) * follow + rnd(0.5), 20, 135);
    v.speed = cl(v.speed + rnd(9) + (60 - v.speed) * 0.03, 0, 130);
    v.acc = cl(v.acc + rnd(0.8), 0, 8);
    v.ratio = cl(2.2 - v.speed / 55 + rnd(0.05), 0.45, 2.3);
    v.rpm = cl(800 + v.speed * 20 + v.acc * 120 + rnd(80), 700, 6000);
    v.eng = cl(v.eng + (91 - v.eng) * 0.05 + rnd(0.4), 70, 110);
  }
  for (var i = 0; i < 80; i++) { tick = i; sim(true); }

  var band = function (t) { return t < 90 ? 0 : t < 110 ? 1 : 2; };
  var STATES = [
    { label: 'TRANQUILO', head: 'Temperatura ideal', body: 'O câmbio está trabalhando na faixa certa. Pode dirigir normalmente.', icon: 'check_circle' },
    { label: 'ATENÇÃO', head: 'Câmbio esquentando', body: 'Dirija com suavidade. Evite acelerações fortes, subidas longas e trânsito pesado por enquanto.', icon: 'warning' },
    { label: 'MUITO QUENTE', head: 'Reduza agora', body: 'Diminua a velocidade e, se puder, pare em local seguro com o motor em marcha lenta até a temperatura baixar.', icon: 'local_fire_department' },
  ];

  // Marcas do medidor (geradas uma vez)
  $('[data-g-ticks]').forEach(function (g) {
    var out = '';
    for (var t = 0; t <= 22; t++) {
      var a = (135 + 270 * t / 22) * Math.PI / 180, mj = t % 2 === 0, r1 = 104, r2 = mj ? 94 : 99;
      out += '<line x1="' + (150 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (150 + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (150 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (150 + r2 * Math.sin(a)).toFixed(1) +
        '" stroke="var(--a-tx)" stroke-width="' + (mj ? 2 : 1) + '" opacity="' + (mj ? 0.55 : 0.25) + '"/>';
    }
    g.innerHTML = out;
  });

  function set(key, val) {
    $('[data-v="' + key + '"]').forEach(function (el) { if (el.textContent !== String(val)) el.textContent = val; });
  }

  function render() {
    var bnd = band(v.cvt), st = STATES[bnd];
    var frac = cl((v.cvt - 20) / 110, 0, 1);
    var ang = (135 + 270 * frac) * Math.PI / 180;
    var gear = v.ratio > 2 ? 1 : v.ratio > 1.5 ? 2 : v.ratio > 1.15 ? 3 : v.ratio > 0.9 ? 4 : v.ratio > 0.72 ? 5 : v.ratio > 0.58 ? 6 : 7;

    phones.forEach(function (p) { p.classList.remove('b0', 'b1', 'b2'); p.classList.add('b' + bnd); });
    heroVoice(bnd);
    $('[data-g-arc]').forEach(function (c) { c.setAttribute('stroke-dasharray', (556 * frac).toFixed(1) + ' 742'); });
    $('[data-g-needle]').forEach(function (l) {
      l.setAttribute('x1', (150 + 100 * Math.cos(ang)).toFixed(1)); l.setAttribute('y1', (150 + 100 * Math.sin(ang)).toFixed(1));
      l.setAttribute('x2', (150 + 126 * Math.cos(ang)).toFixed(1)); l.setAttribute('y2', (150 + 126 * Math.sin(ang)).toFixed(1));
    });

    set('cvt', Math.round(v.cvt));
    set('sLabel', st.label); set('sHead', st.head); set('sBody', st.body); set('sIcon', st.icon);
    set('eng', Math.round(v.eng)); set('rpm', fmt(v.rpm)); set('speed', fmt(v.speed)); set('gear', 'D' + gear);

    // Faixas da seção "Por que monitorar": a marquinha acompanha a temperatura
    marks.forEach(function (el) {
      // As faixas têm 70fr / 20fr / 20fr = 20–90 / 90–110 / 110–130 °C, então a escala é linear de 20 a 130
      el.style.left = ((cl(v.cvt, 20, 130) - 20) / 110 * 100).toFixed(1) + '%';
    });
  }

  // ===== Balão "Alerta por voz" do topo =====
  // Aparece quando o celular do topo sobe de faixa, com a mesma frase que o app fala,
  // e some quando volta para o verde. Sem animações, fica parado como no HTML.
  var heroBubble = motion && phones.length ? document.querySelector('[data-hero-voice]') : null;
  var heroBubbleTxt = heroBubble && heroBubble.querySelector('[data-hero-voice-txt]');
  var heroBand = 0;
  if (heroBubble) heroBubble.classList.add('is-off');
  function heroVoice(bnd) {
    if (!heroBubble || bnd === heroBand) return;
    if (bnd > heroBand) {
      heroBubbleTxt.textContent = bnd === 1
        ? '“Atenção. Temperatura do câmbio em ' + Math.round(v.cvt) + ' graus.”'
        : '“Alerta. Câmbio muito quente. Reduza a velocidade.”';
      heroBubble.classList.remove('is-off');
    } else if (bnd === 0) {
      heroBubble.classList.add('is-off');
    }
    heroBand = bnd;
  }

  // ===== Loop: só roda com a aba visível e o celular ou a escala na tela =====
  var visible = 0;
  var timer = null;
  function step() { tick++; heroT++; sim(false); render(); }
  function sync() {
    var run = visible > 0 && !document.hidden;
    if (run && !timer) timer = setInterval(step, 700);
    if (!run && timer) { clearInterval(timer); timer = null; }
  }
  render();
  if ('IntersectionObserver' in window) {
    var seen = new Set();
    var po = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
      visible = seen.size;
      sync();
    });
    phones.concat(marks).forEach(function (p) { po.observe(p); });
  } else {
    visible = 1;
  }
  document.addEventListener('visibilitychange', sync);
  sync();
})();
