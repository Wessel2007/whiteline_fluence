// Vercel Serverless Function: GET /api/vagas
// Conta quantas licenças do CVT Monitor já foram pagas na Cakto, para o contador
// "restam X de 100" do lote de lançamento. O total do lote fica no CONFIG do cvt-monitor.js.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   CAKTO_CLIENT_ID      chave de API da Cakto (Integrações > Cakto API), escopos: read + orders
//   CAKTO_CLIENT_SECRET  segredo da mesma chave
//   CAKTO_PRODUCT_ID     id do produto CVT Monitor na Cakto
//   CAKTO_DESDE          (opcional) data do lançamento, AAAA-MM-DD: vendas pagas antes disso
//                        (testes de checkout, por exemplo) não entram na conta
//
// Sem as variáveis, responde { vendidos: null } e a página simplesmente não mostra o contador.
const API = 'https://api.cakto.com.br/public_api';
const TTL = 60 * 1000;

let token = null;  // { valor, expira }
let cache = null;  // { at, vendidos }
let inflight = null;

async function pegarToken() {
  if (token && Date.now() < token.expira) return token.valor;
  const res = await fetch(`${API}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.CAKTO_CLIENT_ID, client_secret: process.env.CAKTO_CLIENT_SECRET }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`token -> ${res.status}`);
  const d = await res.json();
  // Guarda o token até 5 min antes de expirar (a Cakto limita a emissão de tokens)
  token = { valor: d.access_token, expira: Date.now() + Math.max(60, (d.expires_in || 3600) - 300) * 1000 };
  return token.valor;
}

async function contarVendas() {
  const q = new URLSearchParams({ product: process.env.CAKTO_PRODUCT_ID, status: 'paid', limit: '1' });
  if (process.env.CAKTO_DESDE) q.set('paidAt__gte', process.env.CAKTO_DESDE);
  const res = await fetch(`${API}/orders/?${q}`, {
    headers: { Authorization: `Bearer ${await pegarToken()}` },
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 401) token = null; // token revogado: pede outro na próxima
  if (!res.ok) throw new Error(`orders -> ${res.status}`);
  const d = await res.json();
  if (!Number.isInteger(d.count) || d.count < 0) throw new Error('orders: resposta sem count');
  return d.count;
}

async function refresh() {
  try {
    cache = { at: Date.now(), vendidos: await contarVendas() };
  } catch (e) {
    // Loga só a mensagem; mantém o último número bom, se houver
    console.error('cakto:', e && e.message);
    if (cache) cache.at = Date.now() - TTL + 15 * 1000; // tenta de novo em 15 s
  }
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('');
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const { CAKTO_CLIENT_ID, CAKTO_CLIENT_SECRET, CAKTO_PRODUCT_ID } = process.env;
  if (!CAKTO_CLIENT_ID || !CAKTO_CLIENT_SECRET || !CAKTO_PRODUCT_ID) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).send(JSON.stringify({ vendidos: null }));
  }
  if (!cache || Date.now() - cache.at > TTL) {
    // Requisições simultâneas compartilham a mesma consulta à Cakto
    if (!inflight) inflight = refresh().finally(() => { inflight = null; });
    await inflight;
  }
  const vendidos = cache ? cache.vendidos : null;
  res.setHeader('Cache-Control', vendidos == null ? 'public, s-maxage=30' : 'public, s-maxage=60, stale-while-revalidate=120');
  res.status(200).send(JSON.stringify({ vendidos, updatedAt: new Date().toISOString() }));
};
