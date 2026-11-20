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
    caktoUrl: '',

    // Link do checkout da oferta com o preço cheio (precoDepois), usado quando o
    // lote de lançamento esgota. Crie as duas ofertas no mesmo produto da Cakto.
    caktoUrlDepois: '',

    // Lote de lançamento: as primeiras N licenças saem por "preco"; depois, "precoDepois".
    // O contador "restam X" vem de /api/vagas (vendas pagas na Cakto) e só aparece
    // com as vendas abertas e as variáveis CAKTO_* configuradas na Vercel.
    loteTotal: 100,

    // Link do APK para o teste grátis. Vazio = botão de download escondido.
    // Ex.: 'downloads/cvt-monitor.apk' (arquivo dentro de site/downloads/).
    apkUrl: '',

    // Impressão digital SHA-256 do APK publicado em apkUrl, mostrada embaixo do botão de
    // download com o aviso "baixe só por aqui". Vazio = não mostra. Gere com:
    //   Get-FileHash cvt-monitor.apk -Algorithm SHA256   (PowerShell)
    // e cole em minúsculas. Atualize junto com o APK, a cada versão nova.
    apkSha256: '',

    // Versão do APK publicado (ex.: '1.0.0'), mostrada junto da impressão digital.
    apkVersao: '',

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
  // navegador, no computador), depois de rolar até o fim de "Por dentro do app" ou após 50 s
  // na página. Não aparece se a pessoa já está na seção de preço ou já clicou em comprar.
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
    $('[data-pop-close]').forEach(function (b) { b.addEventListener('click', fecharPop); });
    $('[data-cta]', pop).forEach(function (a) { a.addEventListener('click', function () { setTimeout(fecharPop, 300); }); });
    // Clique no fundo escuro fecha
    pop.addEventListener('click', function (e) { if (e.target === pop) fecharPop(); });

    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY <= 0) abrirPop();
    });
    var gatilho = document.getElementById('app');
    if (gatilho && 'IntersectionObserver' in window) {
      var go = new IntersectionObserver(function (es) {
        // Só quando a pessoa terminou de ver o app (a seção saiu por cima da tela)
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
  // Roda no celular do topo ([data-ph]). O celular de "Por dentro do app"
  // ([data-demo]) mostra prints reais do app e só troca de imagem.
  // ===================================================================
  var phones = $('[data-ph]');
  var demo = document.querySelector('[data-demo]');
  if (!phones.length && !demo) return;

  var N = 80;
  var scen = 'normal';
  var tick = 0;
  var chartKey = 'cvt';
  var userActed = false; // voz só depois de um clique da pessoa
  var cl = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var rnd = function (a) { return (Math.random() - 0.5) * a; };

  var v = { cvt: 74, rpm: 1650, speed: 48, eng: 88, intake: 31, sec: 1.6, pri: 0.9, lu: 0.6, ratio: 1.12, acc: 1.4, slip: 8, bat: 14.1,
    det: 148320, detStart: 148320, kml: 12.4, avg: 11.8, fuel: 58, dist: 23.4, time: 1960, used: 1.98, max: 74, above: 0 };
  var h = { cvt: [], eng: [], rpm: [], speed: [], kml: [] };

  // Ciclo do celular do topo (em passos de 700 ms, ~22 s no total): fica tranquilo,
  // esquenta até ~101 °C (o balão de voz aparece ao passar de 90 °C), segura e esfria.
  // Só roda no cenário Normal e com animações ligadas.
  var HERO_CYCLE = 32, HERO_START = 5; // começa 5 passos antes da subida (~3,5 s)
  var heroT = 0;
  var heroCycling = function () { return motion && phones.length > 0 && scen === 'normal'; };
  function heroTarget() {
    var p = (heroT + HERO_START) % HERO_CYCLE;
    if (p < 10) return 80 + Math.sin(p / 3) * 1.5;   // tranquilo
    if (p < 16) return 80 + (p - 9) / 6 * 21;        // esquentando
    if (p < 22) return 101 + Math.sin(p) * 0.8;      // atenção
    if (p < 30) return 101 - (p - 21) / 8 * 21;      // esfriando
    return 80;
  }

  function target() {
    if (scen === 'atencao') return 99;
    if (scen === 'quente') return 116;
    if (heroCycling()) return heroTarget();
    // Normal: passeia entre ~72 e ~86 °C, como um dia comum de trânsito
    return 79 + Math.sin(tick / 26) * 7;
  }

  function sim(warm) {
    var follow = warm ? 0.05 : heroCycling() ? 0.6 : 0.08;
    v.cvt = cl(v.cvt + (target() - v.cvt) * follow + rnd(0.5), 20, 135);
    v.speed = cl(v.speed + rnd(9) + (60 - v.speed) * 0.03, 0, 130);
    v.acc = cl(v.acc + rnd(0.8), 0, 8);
    v.ratio = cl(2.2 - v.speed / 55 + rnd(0.05), 0.45, 2.3);
    v.rpm = cl(800 + v.speed * 20 + v.acc * 120 + rnd(80), 700, 6000);
    v.sec = cl(1.2 + v.acc * 0.35 + rnd(0.1), 0.6, 6);
    v.pri = cl(v.sec * 0.62 + rnd(0.05), 0.3, 5);
    v.lu = v.speed > 20 ? 1 : 0;
    v.slip = v.speed > 20 ? Math.round(cl(4 + rnd(8), 0, 20)) : Math.round(80 + rnd(40));
    v.eng = cl(v.eng + (91 - v.eng) * 0.05 + rnd(0.4), 70, 110);
    v.intake = cl(v.intake + rnd(0.4), 22, 45);
    v.bat = cl(14.1 + rnd(0.12), 12, 14.6);
    v.kml = v.speed < 3 ? 0 : cl(26 - v.rpm / 180 - v.acc * 0.8 + rnd(1.2), 3, 30);
    if (!warm) {
      if (v.cvt > 90) { v.det += Math.round((v.cvt - 90) * 0.8); v.above += 0.7; }
      v.max = Math.max(v.max, Math.round(v.cvt));
      v.dist += v.speed * 0.7 / 3600; v.time += 0.7;
      v.used += v.kml ? (v.speed * 0.7 / 3600) / v.kml : 0.0002;
      v.avg = v.dist / Math.max(v.used, 0.01);
      v.fuel = cl(v.fuel - 0.002, 0, 100);
    }
    for (var k in h) { h[k].push(v[k]); if (h[k].length > N) h[k].shift(); }
  }
  for (var i = 0; i < N; i++) { tick = i; sim(true); }
  v.max = Math.round(v.cvt);

  var band = function (t) { return t < 90 ? 0 : t < 110 ? 1 : 2; };
  var STATES = [
    { label: 'TRANQUILO', head: 'Temperatura ideal', body: 'O câmbio está trabalhando na faixa certa. Pode dirigir normalmente.', icon: 'check_circle' },
    { label: 'ATENÇÃO', head: 'Câmbio esquentando', body: 'Dirija com suavidade. Evite acelerações fortes, subidas longas e trânsito pesado por enquanto.', icon: 'warning' },
    { label: 'MUITO QUENTE', head: 'Reduza agora', body: 'Diminua a velocidade e, se puder, pare em local seguro com o motor em marcha lenta até a temperatura baixar.', icon: 'local_fire_department' },
  ];
  var COLORS = ['var(--a-ok)', 'var(--a-warn)', 'var(--a-hot)'];
  var CHARTS = {
    cvt: ['Óleo do câmbio', '°C', 0, 'Faixas amarela e vermelha marcam 90°C e 110°C. A linha tracejada é a velocidade, para relacionar o aquecimento com o jeito de dirigir.'],
    eng: ['Motor', '°C', 0, 'Últimos 60 segundos. A linha tracejada é a velocidade.'],
    rpm: ['Rotação', 'rpm', 0, 'Últimos 60 segundos. A linha tracejada é a velocidade.'],
    speed: ['Velocidade', 'km/h', 0, 'Últimos 60 segundos.'],
  };

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

  // Barras do consumo
  var fuelBars = document.querySelector('[data-fuel-bars]');
  if (fuelBars) for (var b = 0; b < 30; b++) fuelBars.appendChild(document.createElement('i'));

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
    set('max', v.max + '°C');
    set('above', Math.floor(v.above / 60) + ' min ' + String(Math.floor(v.above % 60)).padStart(2, '0') + ' s');
    set('intake', Math.round(v.intake)); set('gearN', gear + 'ª'); set('ratio', fmt(v.ratio, 2));
    set('lu', v.lu ? 'Travado' : 'Livre'); set('slip', fmt(v.slip));
    set('sec', fmt(v.sec, 2)); set('pri', fmt(v.pri, 2)); set('bat', fmt(v.bat, 1));

    // Gráfico
    var cd = CHARTS[chartKey], ser = h[chartKey], lo, hi;
    if (chartKey === 'cvt') { lo = 40; hi = 130; }
    else { lo = Math.min.apply(null, ser); hi = Math.max.apply(null, ser); var pad = (hi - lo) * 0.2 || 1; lo -= pad; hi += pad; }
    var W = 300, H = 170, yOf = function (x) { return H - (x - lo) / (hi - lo) * H; };
    var pts = ser.map(function (x, j) { return (j * W / (N - 1)).toFixed(1) + ',' + yOf(x).toFixed(1); }).join(' ');
    var spPts = h.speed.map(function (x, j) { return (j * W / (N - 1)).toFixed(1) + ',' + (H - x / 140 * H).toFixed(1); }).join(' ');
    $('[data-c-line]').forEach(function (el) { el.setAttribute('points', pts); });
    $('[data-c-speed]').forEach(function (el) { el.setAttribute('points', spPts); });
    $('[data-c-hot]').forEach(function (el) { el.setAttribute('height', yOf(110).toFixed(1)); });
    $('[data-c-warn]').forEach(function (el) { el.setAttribute('y', yOf(110).toFixed(1)); el.setAttribute('height', (yOf(90) - yOf(110)).toFixed(1)); });
    var avg = ser.reduce(function (a, c) { return a + c; }, 0) / ser.length;
    var disp = function (x) { return fmt(x); };
    set('chName', cd[0]); set('chUnit', cd[1]); set('chNote', cd[3]);
    set('chCur', disp(ser[ser.length - 1]));
    set('chMin', disp(Math.min.apply(null, ser))); set('chAvg', disp(avg)); set('chMax', disp(Math.max.apply(null, ser)));
    $('[data-v="chCur"]').forEach(function (el) { el.style.color = chartKey === 'cvt' ? COLORS[bnd] : 'var(--a-tx)'; });

    // Fluido
    var pct = v.det / 210000;
    set('detPct', fmt(pct * 100) + '%'); set('det', fmt(v.det));
    set('detSess', '+' + fmt(v.det - v.detStart)); set('detLeft', fmt(Math.max(0, 210000 - v.det)));
    $('[data-det-bar]').forEach(function (el) {
      el.style.width = Math.min(100, pct * 100).toFixed(1) + '%';
      el.style.background = pct > 0.9 ? 'var(--a-hot)' : pct > 0.7 ? 'var(--a-warn)' : 'var(--a-acc)';
    });

    // Consumo
    set('kml', v.kml ? fmt(v.kml, 1) : '—');
    set('lph', v.speed < 3 ? 'parado · 0,8 L/h' : fmt(100 / Math.max(v.kml, 0.1), 1) + ' L/100 km');
    set('avg', fmt(v.avg, 1)); set('range', fmt(v.fuel / 100 * 60 * v.avg));
    set('dist', fmt(v.dist, 1)); set('time', Math.floor(v.time / 60));
    if (fuelBars) {
      var fb = h.kml.slice(-30), bars = fuelBars.children;
      for (var q = 0; q < bars.length; q++) bars[q].style.height = Math.max(4, (fb[q] || 0) / 30 * 52).toFixed(0) + 'px';
    }

    // Faixas da seção "Por que monitorar": a marquinha acompanha a temperatura
    $('[data-scale-mark]').forEach(function (el) {
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

  // ===== Notificação e voz =====
  var banner = demo && demo.querySelector('[data-banner]');
  var bannerT;
  var voiceBox = document.querySelector('[data-voice]');
  var voiceWrap = document.querySelector('[data-voice-wrap]');
  if (voiceWrap && 'speechSynthesis' in window) voiceWrap.hidden = false;

  // temp: a mesma temperatura mostrada na print do Painel
  function alertBand(bnd, temp) {
    var t = temp + '°C';
    var msg = bnd === 1
      ? { title: 'Câmbio em atenção · ' + t, body: 'Dirija com suavidade e evite acelerações fortes.', speak: 'Atenção. Temperatura do câmbio em ' + temp + ' graus.' }
      : { title: 'Câmbio muito quente · ' + t, body: 'Reduza a velocidade. Se puder, pare em local seguro.', speak: 'Alerta. Câmbio muito quente. Reduza a velocidade.' };
    if (banner) {
      banner.querySelector('[data-banner-title]').textContent = msg.title;
      banner.querySelector('[data-banner-body]').textContent = msg.body;
      banner.style.setProperty('--bc', COLORS[bnd]);
      banner.hidden = false;
      clearTimeout(bannerT);
      bannerT = setTimeout(function () { banner.hidden = true; }, 5500);
    }
    if (userActed && voiceBox && voiceBox.checked && 'speechSynthesis' in window) {
      try {
        var u = new SpeechSynthesisUtterance(msg.speak);
        u.lang = 'pt-BR';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  }
  if (banner) banner.addEventListener('click', function () { banner.hidden = true; });

  // ===== Prints do celular de "Por dentro do app" =====
  // Painel e Gráficos têm uma print por cenário do simulador; as outras abas, uma só.
  var PRINT_TEMP = { atencao: 101, quente: 112 }; // temperatura que aparece em cada print do Painel
  function shotKey() {
    var tab = demo.getAttribute('data-tab');
    if (tab === 'painel') return 'painel-' + scen;
    if (tab === 'graf') return scen === 'normal' ? 'graf-normal' : 'graf-esquentando';
    return tab;
  }
  function showShot() {
    if (!demo) return;
    var key = shotKey();
    $('[data-shot]', demo).forEach(function (img) {
      var on = img.getAttribute('data-shot') === key;
      img.classList.toggle('is-on', on);
      if (on) img.removeAttribute('aria-hidden'); else img.setAttribute('aria-hidden', 'true');
    });
  }

  // ===== Abas do celular e lista de recursos =====
  function goTab(tab) {
    if (!demo) return;
    demo.setAttribute('data-tab', tab);
    showShot();
    $('[data-go]').forEach(function (btn) {
      var on = btn.getAttribute('data-go') === tab;
      if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', on);
      else btn.setAttribute('aria-pressed', on);
    });
  }
  $('[data-go]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goTab(btn.getAttribute('data-go'));
      // No celular o aparelho fica acima da lista: rola até ele para mostrar a troca
      if (btn.classList.contains('wl-feat') && window.matchMedia('(max-width:1060px)').matches && demo) {
        demo.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' });
      }
    });
  });

  $('[data-chart-key]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      chartKey = btn.getAttribute('data-chart-key');
      if (demo) demo.setAttribute('data-chart', chartKey);
      $('[data-chart-key]').forEach(function (o) { o.setAttribute('aria-pressed', o === btn); });
      render();
    });
  });

  $('[data-scen]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      userActed = true;
      var antes = scen;
      scen = btn.getAttribute('data-scen');
      $('[data-scen]').forEach(function (o) { o.setAttribute('aria-pressed', o === btn); });
      if (demo) demo.setAttribute('data-scen', scen);
      if (scen !== 'normal') goTab('painel'); else showShot();
      // Alerta quando sobe de faixa (como no app)
      var rank = { normal: 0, atencao: 1, quente: 2 };
      if (rank[scen] > rank[antes]) alertBand(rank[scen], PRINT_TEMP[scen]);
    });
  });
  if (voiceBox) voiceBox.addEventListener('change', function () { userActed = true; });

  // ===== Loop: só roda com a aba visível e algum celular na tela =====
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
    phones.concat($('[data-scale-mark]')).forEach(function (p) { po.observe(p); });
  } else {
    visible = 1;
  }
  document.addEventListener('visibilitychange', sync);
  sync();
})();
