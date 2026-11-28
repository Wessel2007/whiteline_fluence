// Vercel Serverless Function: GET /api/downloads?dias=30
// Repassa ao servidor do CVT Monitor o pedido dos números de downloads, para a página
// cvt-monitor-downloads.html. A senha é o próprio DOWNLOAD_TOKEN, digitado na página e
// enviado no "Authorization: Bearer"; quem confere é o servidor (com limite de tentativas).
// Precisa de CVT_SERVER nas variáveis de ambiente da Vercel (o mesmo do /api/download).
module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('');
  }
  const server = process.env.CVT_SERVER;
  if (!server) return res.status(503).json({ error: 'not_configured' });
  const auth = String(req.headers.authorization || '');
  if (!/^Bearer [\w-]{24,200}$/.test(auth)) return res.status(401).json({ error: 'unauthorized' });
  const dias = Math.min(Math.max(parseInt((req.query && req.query.dias) || '30', 10) || 30, 1), 366);
  try {
    const r = await fetch(server.replace(/\/+$/, '') + '/v1/downloads?dias=' + dias, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(6000),
    });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(r.status).send(body);
  } catch (e) {
    console.error('downloads:', e && e.message);
    return res.status(502).json({ error: 'server_unavailable' });
  }
};
