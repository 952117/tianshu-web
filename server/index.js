// 天枢网页版 HTTP 服务（零依赖：仅用 Node 内置模块）
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const order = require('./order');
const mall = require('./mall');
const dispatch = require('./dispatch');
const agents = require('./agents');
const pay = require('./pay');

store.load();

const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', c => { d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { resolve({}); } });
  });
}

async function handleApi(req, res, u) {
  const db = store.getDB();
  const p = u.pathname;

  if (req.method === 'GET' && p === '/api/orders') return sendJSON(res, 200, { orders: db.orders });
  if (req.method === 'GET' && p === '/api/products') return sendJSON(res, 200, { products: db.products });
  if (req.method === 'GET' && p === '/api/leads') return sendJSON(res, 200, { leads: db.leads });
  if (req.method === 'GET' && p === '/api/users') return sendJSON(res, 200, { users: db.users });
  if (req.method === 'GET' && p === '/api/stats') {
    const released = order.releaseDueOrders();
    return sendJSON(res, 200, {
      users: db.users.length,
      orders: db.orders.length,
      pending: db.orders.filter(o => o.status === 'pending').length,
      leads: db.leads.length,
      dist: db.distributions.length,
      releasedJustNow: released
    });
  }
  if (req.method === 'POST' && p === '/api/orders/accept') {
    const b = await readBody(req);
    const r = order.acceptOrder(b.orderId, b.flyerId || 'u_flyer1');
    return sendJSON(res, r.ok ? 200 : 400, r);
  }
  if (req.method === 'POST' && p === '/api/orders/complete') {
    const b = await readBody(req);
    const r = order.completeOrder(b.orderId);
    return sendJSON(res, r.ok ? 200 : 400, r);
  }
  if (req.method === 'POST' && p === '/api/mall/buy') {
    const b = await readBody(req);
    const r = mall.buyProduct(b.productId, b.buyerId || 'u_admin', b.referrerCode, b.qty || 1);
    return sendJSON(res, r.ok ? 200 : 400, r);
  }
  if (req.method === 'POST' && p === '/api/agent') {
    const b = await readBody(req);
    const r = await agents.handleMessage(b.text || '', { flyerId: b.flyerId });
    return sendJSON(res, 200, Object.assign({ time: Date.now() }, r));
  }
  // 收银台：支付宝 Vibe Pay（沙箱/正式双模式）
  if (req.method === 'POST' && p === '/api/pay/create') {
    const b = await readBody(req);
    return sendJSON(res, 200, pay.createOrder(b));
  }
  if (req.method === 'GET' && p === '/api/pay/mock') {
    const r = pay.recordPayment({
      outTradeNo: u.searchParams.get('outTradeNo'),
      subject: u.searchParams.get('subject') || '天枢服务',
      amount: Number(u.searchParams.get('amt') || 0),
      buyerId: u.searchParams.get('buyerId') || 'u_admin'
    });
    return sendJSON(res, 200, r);
  }
  if (req.method === 'GET' && p === '/api/pay/list') {
    return sendJSON(res, 200, { payments: store.getDB().payments, mode: pay.loadConfig().enabled ? 'real' : 'sandbox' });
  }
  return sendJSON(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/')) {
    try { await handleApi(req, res, u); }
    catch (e) { sendJSON(res, 500, { error: String(e) }); }
    return;
  }
  // 静态资源
  let rel = u.pathname === '/' ? '/index.html' : u.pathname;
  const fp = path.join(PUBLIC, rel);
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
  if (!fs.existsSync(fp)) { res.writeHead(404); return res.end('not found'); }
  const ext = path.extname(fp);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('天枢网页版运行中： http://localhost:' + PORT));
