// Vercel Serverless Function: GET /api/stats
// Lê os perfis públicos do TikTok e do Instagram e devolve os contadores.
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

async function tiktok() {
  const html = await (await get(`https://www.tiktok.com/@${USER}`)).text();
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

function parseAbbrev(s) {
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

// A API interna (web_profile_info) exige login; o og:description da página traz "742 Followers, ..."
// Para IPs de datacenter (Vercel) o Instagram costuma mandar para o login, mas robôs de pré-visualização
// de link (WhatsApp, Facebook, Twitter...) recebem as meta tags. Tenta um UA de cada vez até um dar certo.
const IG_UAS = [
  UA,
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.23.20.0',
  'Twitterbot/1.0',
];

async function instagramWith(ua) {
  // redirect manual: um 302 para /accounts/login vira erro com o destino no log
  const html = await (await get(`https://www.instagram.com/${USER}/`, { 'User-Agent': ua }, { timeout: 4000, redirect: 'manual' })).text();
  const m = html.match(/<meta[^>]+(?:property|name)="og:description"[^>]+content="([^"]+)"/i);
  const f = m && m[1].match(/([\d.,]+\s*[KMB]?)\s+Followers/i);
  if (!f) throw new Error(`seguidores não encontrados (${m ? 'og sem Followers' : /accounts\/login/.test(html) ? 'página de login' : 'sem og:description'})`);
  return { followers: parseAbbrev(f[1]) };
}

async function instagram() {
  const erros = [];
  const fim = Date.now() + 8000; // não estoura o tempo da função mesmo se todos falharem
  for (const ua of IG_UAS) {
    if (Date.now() > fim) break;
    try { return await instagramWith(ua); }
    catch (e) { erros.push(`[${ua.split(/[\s/]/)[0]}] ${e.message}`); }
  }
  throw new Error(erros.join(' | '));
}

let inflight = null;

async function refresh() {
  const [tt, ig] = await Promise.allSettled([tiktok(), instagram()]);
  // Loga só a mensagem, sem stack nem HTML das redes
  if (tt.status === 'rejected') console.error('tiktok:', tt.reason && tt.reason.message);
  if (ig.status === 'rejected') console.error('instagram:', ig.reason && ig.reason.message);
  const prev = cache ? cache.data : { tiktok: null, instagram: null };
  cache = {
    at: Date.now(),
    data: {
      tiktok: tt.status === 'fulfilled' ? tt.value : prev.tiktok,
      instagram: ig.status === 'fulfilled' ? ig.value : prev.instagram,
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
