// Vercel Serverless Function: GET /api/stats
// Lê o perfil público do TikTok e devolve os contadores (o Instagram é atualizado à mão no index.html).
const USER = 'whitelinefluence';
const TTL = 120 * 1000;
// UA de iPhone: com UA de desktop o TikTok responde um desafio anti-bot e o Instagram omite os seguidores
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let cache = null; // { at, data }

async function get(url, headers = {}, opts = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    signal: AbortSignal.timeout(opts.timeout || 6000),
    redirect: opts.redirect || 'follow',
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}${res.headers.get('location') ? ' ' + res.headers.get('location') : ''}`);
  return res;
}

// Da Vercel o TikTok às vezes devolve um número atrasado (4597 x 4612 real).
// Por isso também usa a API do tokcounter.com, que faz a leitura do lado deles.
async function tiktokCounter() {
  const data = await (await get(`https://tiktok-api.tokcounter.com/user/data/${USER}`, { Accept: 'application/json' }, { timeout: 5000 })).json();
  const s = data && data.success && data.id === USER && data.stats;
  if (!s || typeof s.followers !== 'number') throw new Error('tokcounter: resposta sem seguidores');
  return { followers: s.followers, likes: typeof s.likes === 'number' ? s.likes : null };
}

// Reserva: leitura direta do perfil (o parâmetro único e os headers no-cache evitam respostas guardadas no caminho)
async function tiktokDireto() {
  const html = await (await get(`https://www.tiktok.com/@${USER}?_r=${Date.now()}`, { 'Cache-Control': 'no-cache', Pragma: 'no-cache' })).text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const stats = JSON.parse(m[1]).__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.stats;
      if (stats && stats.followerCount != null) return { followers: stats.followerCount, likes: stats.heartCount };
    } catch (e) { /* cai no regex abaixo */ }
  }
  const f = html.match(/"followerCount":(\d+)/), h = html.match(/"heartCount":(\d+)/);
  if (!f) throw new Error('tiktok: stats não encontrados');
  return { followers: +f[1], likes: h ? +h[1] : null };
}

// As duas fontes atrasam de jeitos diferentes: o tokcounter devolve cache ("cache":true, 4643 x 4691 real)
// e a leitura direta da Vercel às vezes chega velha. Busca as duas juntas e fica com o maior número,
// já que um valor atrasado quase sempre é menor (seguidores e curtidas crescem).
async function tiktok() {
  const r = await Promise.allSettled([tiktokCounter(), tiktokDireto()]);
  const ok = r.filter(x => x.status === 'fulfilled').map(x => x.value);
  if (!ok.length) throw new Error(r.map(x => x.reason && x.reason.message).join(' | '));
  const maior = campo => ok.reduce((m, v) => (typeof v[campo] === 'number' && (m == null || v[campo] > m) ? v[campo] : m), null);
  return { followers: maior('followers'), likes: maior('likes') };
}

// Instagram fica de fora: ele bloqueia os IPs da Vercel e o instastatistics.com fechou o acesso (403/401).
// O número é atualizado à mão no index.html (IG_SEGUIDORES).

// Checagem de número plausível: as fontes são serviços de terceiros, então um bug ou ataque do lado
// deles não pode virar "0" ou "9 milhões" no site.
const MAX = 1e9;
const QUEDA_MAX = 0.2;    // aceita cair até 20% de uma vez
const SALTO_MAX = 0.5;    // aceita subir até 50% de uma vez
const INSISTENCIA = 3;    // mudança brusca vista 3 vezes seguidas é aceita (cresceu de verdade ou o valor guardado é que estava errado)
const suspeitas = {};     // { 'tiktok.followers': { valor, vezes } } — mudança brusca à espera de confirmação

function plausivel(chave, novo, antigo) {
  if (!Number.isInteger(novo) || novo <= 0 || novo > MAX) {
    console.error(`${chave}: valor inválido descartado (${novo})`);
    return false;
  }
  if (typeof antigo !== 'number' || antigo <= 0) return true; // sem histórico (instância nova): só a checagem absoluta
  const variacao = (novo - antigo) / antigo;
  if (variacao >= -QUEDA_MAX && variacao <= SALTO_MAX) { delete suspeitas[chave]; return true; }
  // Só conta como confirmação se o valor suspeito se repetir (margem de 5%); um valor diferente recomeça a contagem
  const s = suspeitas[chave];
  suspeitas[chave] = s && Math.abs(novo - s.valor) <= s.valor * 0.05 ? { valor: novo, vezes: s.vezes + 1 } : { valor: novo, vezes: 1 };
  if (suspeitas[chave].vezes >= INSISTENCIA) {
    console.warn(`${chave}: mudança brusca confirmada ${INSISTENCIA}x seguidas, aceitando (${antigo} -> ${novo})`);
    delete suspeitas[chave];
    return true;
  }
  console.warn(`${chave}: mudança brusca ignorada (${antigo} -> ${novo}), mantendo o anterior`);
  return false;
}

// Monta o resultado de uma rede campo a campo: cada número suspeito mantém o último valor bom
function validar(rede, novo, anterior) {
  if (!novo) return anterior;
  const out = {};
  for (const [campo, n] of Object.entries(novo)) {
    const antigo = anterior ? anterior[campo] : null;
    if (n == null) out[campo] = antigo ?? null;
    else out[campo] = plausivel(`${rede}.${campo}`, n, antigo) ? n : antigo ?? null;
  }
  return out.followers == null ? anterior : out;
}

let inflight = null;

async function refresh() {
  const [tt] = await Promise.allSettled([tiktok()]);
  // Loga só a mensagem, sem stack nem HTML das redes
  if (tt.status === 'rejected') console.error('tiktok:', tt.reason && tt.reason.message);
  const prev = cache ? cache.data : { tiktok: null };
  cache = {
    at: Date.now(),
    data: {
      tiktok: validar('tiktok', tt.status === 'fulfilled' ? tt.value : null, prev.tiktok),
      updatedAt: new Date().toISOString(),
    },
  };
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('');
  }
  if (!cache || Date.now() - cache.at > TTL) {
    // Requisições simultâneas compartilham a mesma busca, sem multiplicar acessos às redes
    if (!inflight) inflight = refresh().finally(() => { inflight = null; });
    await inflight;
  }
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify(cache.data));
};
