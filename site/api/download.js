// Vercel Serverless Function: GET /api/download?o=<origem>
// Conta o download do APK no servidor do CVT Monitor (Cloudflare) e entrega o arquivo.
// O botão "Baixar o app grátis" da landing aponta para cá (ver cvt-monitor.js).
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   CVT_SERVER          endereço do servidor de licenças (https://cvt-monitor-licenca....workers.dev)
//   CVT_DOWNLOAD_TOKEN  o mesmo DOWNLOAD_TOKEN configurado no servidor (secrets/download_token.txt)
//
// Sem as variáveis, ou se o servidor não responder em 1,5 s, o download sai do mesmo jeito:
// só não é contado. O IP vai para o servidor apenas para contar "pessoas diferentes no dia"
// (lá vira um hash que é apagado em 2 dias); nada é guardado aqui.
const APK = '/downloads/cvt-monitor.apk';
const ORIGEM_RE = /^[a-z0-9._-]{1,40}$/;
// Prévias de link (WhatsApp, Instagram, Facebook...) e robôs de busca não contam
const ROBO_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|curl|wget|python|headless/i;

async function contar(req) {
  const server = process.env.CVT_SERVER;
  const token = process.env.CVT_DOWNLOAD_TOKEN;
  if (!server || !token) return;
  if (ROBO_RE.test(req.headers['user-agent'] || '')) return;
  const o = String((req.query && req.query.o) || '').trim().toLowerCase();
  const ip = String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0]).trim();
  try {
    await fetch(server.replace(/\/+$/, '') + '/v1/download', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem: ORIGEM_RE.test(o) ? o : 'site', ip: ip.slice(0, 64) }),
      signal: AbortSignal.timeout(1500),
    });
  } catch (e) {
    console.error('contador de downloads:', e && e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('');
  }
  if (req.method === 'GET') await contar(req);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.statusCode = 302;
  res.setHeader('Location', APK);
  res.end();
};
