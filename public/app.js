// 天枢网页版前端逻辑（零框架，原生 JS）
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const FLYER = 'u_flyer1'; // 演示当前登录飞手
const STATUS_TEXT = { pending: '待接', active: '进行中', completed: '已完成', released: '已解付' };

// ---------- Tab 切换 ----------
$$('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.go)));
function switchTab(name) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.go === name));
  $$('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  if (name === 'hall') loadOrders();
  if (name === 'tasks') loadMyTasks();
  if (name === 'mall') loadProducts();
  if (name === 'pay') loadPay();
  if (name === 'me') loadMe();
  if (name === 'cashier') loadCashier();
}

// ---------- 数据加载 ----------
async function api(path, opts) {
  const r = await fetch(path, opts);
  return r.json();
}

async function loadStats() {
  const s = await api('/api/stats');
  $('#statChip').textContent = `订单${s.orders} · 待接${s.pending} · 线索${s.leads}`;
}

async function loadOrders() {
  const { orders } = await api('/api/orders');
  const list = $('#orderList');
  list.innerHTML = orders.filter(o => o.status === 'pending').map(o => `
    <div class="card">
      <h3>${o.title}</h3>
      <div class="meta"><span>📍 ${o.from} → ${o.to}</span><span>📦 ${o.payload} ${o.weight}kg</span><span>💰 ¥${o.fee}</span></div>
      <span class="badge b-pending">${STATUS_TEXT[o.status]}</span>
      <div><button class="act" onclick="accept('${o.id}')">立即接单</button></div>
    </div>`).join('') || '<p class="hint">暂无待接订单。</p>';
}

window.accept = async function (id) {
  await api('/api/orders/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id, flyerId: FLYER }) });
  loadOrders(); loadStats();
};

async function loadMyTasks() {
  const { orders } = await api('/api/orders');
  const mine = orders.filter(o => o.flyerId === FLYER);
  $('#myTasks').innerHTML = mine.map(o => `
    <div class="card">
      <h3>${o.title}</h3>
      <div class="meta"><span>📍 ${o.from} → ${o.to}</span><span>💰 ¥${o.fee}</span></div>
      <span class="badge b-${o.status}">${STATUS_TEXT[o.status]}</span>
      ${o.status === 'active' ? `<div><button class="act" onclick="complete('${o.id}')">标记完成（触发T+3解付）</button></div>` : ''}
      ${o.status === 'completed' ? `<div class="hint">T+3 工作日自动解付至余额</div>` : ''}
    </div>`).join('') || '<p class="hint">您还没有接单，去抢单大厅看看。</p>';
}
window.complete = async function (id) {
  await api('/api/orders/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id }) });
  loadMyTasks(); loadStats();
};

async function loadProducts() {
  const { products } = await api('/api/products');
  $('#productList').innerHTML = products.map(p => `
    <div class="card">
      <h3>${p.name}</h3>
      <div class="meta"><span>💰 ¥${p.price}</span><span>佣金 ${(p.commissionRate * 100).toFixed(0)}%</span><span>🏭 ${p.supplier}</span></div>
      <div><button class="act" onclick="buy('${p.id}')">下单（演示）</button></div>
    </div>`).join('');
}
window.buy = async function (id) {
  await api('/api/mall/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, buyerId: 'u_admin', referrerCode: 'FLY-QIANG', qty: 1 }) });
  alert('已下单，分销佣金记入 FLY-QIANG 余额'); loadPay(); loadStats();
};

async function loadPay() {
  const all = await api('/api/users');
  const me = all.users.find(u => u.id === FLYER);
  $('#payInfo').innerHTML = `
    <div class="row"><span>当前飞手</span><b>${me.name}</b></div>
    <div class="row"><span>可提现余额</span><b style="color:var(--ok)">¥${me.balance}</b></div>
    <div class="row"><span>解付规则</span><span>T+3 工作日自动到账</span></div>
    <p class="hint">完成订单后系统在第 3 个工作日自动解付至余额（跳过周末）。</p>`;
}

async function loadMe() {
  const all = await api('/api/users');
  const me = all.users.find(u => u.id === FLYER);
  const leads = await api('/api/leads');
  $('#meInfo').innerHTML = `
    <div class="row"><span>昵称</span><b>${me.name}</b></div>
    <div class="row"><span>角色</span><b>${me.role === 'flyer' ? '飞手' : '运营'}</b></div>
    <div class="row"><span>城市</span><b>${me.city || '—'}</b></div>
    <div class="row"><span>分销码</span><b>${me.referralCode}</b></div>
    <div class="row"><span>余额</span><b style="color:var(--ok)">¥${me.balance}</b></div>
    <p class="hint">已收集合作线索 ${leads.leads.length} 条（来自智能体·星探）。</p>`;
}

// ---------- 收银台（支付宝 Vibe Pay）----------
async function payNow() {
  const r = await api('/api/pay/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: '天枢积分', amount: 1.00, buyerId: 'u_admin' })
  });
  if (r.mode === 'sandbox') {
    await api(r.payUrl);
    $('#payResult').textContent = '✅ 支付成功（沙箱模拟），商户已收到 ¥' + r.amount;
    loadCashier();
  } else {
    $('#payResult').textContent = '请前往支付宝完成支付：' + r.gateway;
  }
}
async function loadCashier() {
  const { payments, mode } = await api('/api/pay/list');
  $('#cashierList').innerHTML = (payments.length
    ? payments.map(p => `<div class="row"><span>${p.subject}</span><b>¥${p.amount}</b></div>`).join('')
    : '<p class="hint">暂无收款记录。</p>') + `<p class="hint">当前模式：${mode === 'real' ? '真实收款' : '沙箱演示'}</p>`;
}

// ---------- 智能体团队 ----------
const drawer = $('#agentDrawer');
$('#agentFab').addEventListener('click', () => drawer.classList.remove('hidden'));
$('#agentClose').addEventListener('click', () => drawer.classList.add('hidden'));

function addMsg(who, text, isUser) {
  const log = $('#agentLog');
  const div = document.createElement('div');
  div.className = 'msg ' + (isUser ? 'user' : 'bot');
  div.innerHTML = (isUser ? '' : `<div class="who">${who}</div>`) + text.replace(/\n/g, '<br>');
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function askAgent(text) {
  if (!text.trim()) return;
  addMsg('我', text, true);
  $('#agentText').value = '';
  const r = await api('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, flyerId: FLYER }) });
  addMsg(r.agent, r.reply, false);
}
$('#agentSend').addEventListener('click', () => askAgent($('#agentText').value));
$('#agentText').addEventListener('keydown', e => { if (e.key === 'Enter') askAgent($('#agentText').value); });
$$('.agent-suggest button').forEach(b => b.addEventListener('click', () => askAgent(b.dataset.q)));

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// 启动
loadStats();
loadOrders();
