// Página de downloads do CVT Monitor (cvt-monitor-downloads.html), só para o dono do app.
// Arquivo separado porque a CSP do site (vercel.json) não permite script inline.
(function () {
  'use strict';

  var CHAVE = 'cvt-downloads-senha';
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var num = function (n) { return Number(n || 0).toLocaleString('pt-BR'); };
  var dataBr = function (d) { var p = d.split('-'); return p[2] + '/' + p[1]; };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  var senha = null;
  var dias = 30;

  function lerGuardada() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function guardar(v) { try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE); } catch (e) { /* sem storage */ } }

  function erro(msg) {
    var el = $('[data-erro]');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function mostrarLogin(msg) {
    $('[data-painel]').hidden = true;
    $('[data-login]').hidden = false;
    erro(msg);
  }

  // Lista de todos os dias do período, com zero onde não houve download
  function diasDoPeriodo(porDia, n) {
    var mapa = {};
    porDia.forEach(function (d) { mapa[d.dia] = d; });
    var out = [];
    var hoje = new Date(Date.now() - 3 * 3600 * 1000); // Brasília
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(hoje.getTime() - i * 86400000).toISOString().slice(0, 10);
      out.push(mapa[d] || { dia: d, total: 0, unicos: 0, origens: {} });
    }
    return out;
  }

  function desenhar(r) {
    $('[data-v="total"]').textContent = num(r.periodo.total);
    $('[data-v="media"]').textContent = 'média de ' + (r.periodo.total / r.dias).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' por dia';
    $('[data-v="unicos"]').textContent = num(r.periodo.unicos);
    $('[data-v="geral"]').textContent = num(r.geral.total);
    $('[data-v="desde"]').textContent = r.geral.desde ? 'contando desde ' + r.geral.desde.split('-').reverse().join('/') : 'nenhum download ainda';

    var todos = diasDoPeriodo(r.porDia, r.dias);
    var max = Math.max.apply(null, todos.map(function (d) { return d.total; }).concat([1]));
    $('[data-bars]').innerHTML = todos.map(function (d) {
      var h = Math.round(d.total / max * 100);
      return '<i' + (d.total ? '' : ' class="zero"') + ' style="height:' + h + '%" title="' + dataBr(d.dia) + ': ' + d.total + '"></i>';
    }).join('');
    $('[data-v="ini"]').textContent = dataBr(todos[0].dia);
    $('[data-v="fim"]').textContent = 'hoje';

    var origens = Object.keys(r.porOrigem).map(function (k) { return [k, r.porOrigem[k]]; })
      .sort(function (a, b) { return b[1].total - a[1].total; });
    $('[data-origens]').innerHTML = origens.length ? origens.map(function (o) {
      var pct = r.periodo.total ? Math.round(o[1].total / r.periodo.total * 100) : 0;
      return '<div class="row"><span class="k">' + esc(o[0]) + '</span><span class="v">' + num(o[1].total) + ' · ' + pct + '%</span></div>';
    }).join('') : '<p style="margin:0">Nenhum download no período.</p>';

    $('[data-lista]').innerHTML = r.porDia.length ? r.porDia.map(function (d) {
      var o = Object.keys(d.origens).map(function (k) { return esc(k) + ' ' + d.origens[k]; }).join(' · ');
      return '<div class="row"><span class="k">' + dataBr(d.dia) + '<span class="s">' + o + '</span></span>' +
        '<span class="v">' + num(d.total) + ' downloads<span class="s">' + num(d.unicos) + ' pessoas</span></span></div>';
    }).join('') : '<p style="margin:0">Nenhum download no período.</p>';

    $$('[data-dias]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-dias')) === r.dias)); });
    $('[data-login]').hidden = true;
    $('[data-painel]').hidden = false;
  }

  function carregar() {
    var botao = $('[data-entrar]');
    botao.disabled = true;
    return fetch('api/downloads?dias=' + dias, { headers: { Authorization: 'Bearer ' + senha, Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
      })
      .then(function (r) {
        if (r.status === 200) return desenhar(r.body);
        if (r.status === 401) { guardar(null); return mostrarLogin('Senha errada.'); }
        if (r.status === 429) return mostrarLogin('Muitas tentativas erradas. Espere 15 minutos.');
        if (r.status === 503) return mostrarLogin('O contador ainda não foi configurado na Vercel (CVT_SERVER).');
        mostrarLogin('O servidor não respondeu. Tente de novo em instantes.');
      })
      .catch(function () { mostrarLogin('Sem conexão. Tente de novo.'); })
      .then(function () { botao.disabled = false; });
  }

  $('[data-form]').addEventListener('submit', function (ev) {
    ev.preventDefault();
    senha = $('[data-senha]').value.trim();
    if (!senha) return;
    guardar($('[data-lembrar]').checked ? senha : null);
    erro('');
    carregar();
  });

  $$('[data-dias]').forEach(function (b) {
    b.addEventListener('click', function () { dias = Number(b.getAttribute('data-dias')); carregar(); });
  });

  $('[data-sair]').addEventListener('click', function () {
    guardar(null);
    senha = null;
    $('[data-senha]').value = '';
    mostrarLogin('');
  });

  var guardada = lerGuardada();
  if (guardada) { senha = guardada; $('[data-lembrar]').checked = true; carregar(); }
})();
