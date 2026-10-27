// 支付宝 Vibe Pay 收款/付款接入脚手架（沙箱 / 正式双模式）
// ------------------------------------------------------------------
// 真实接入需本人用支付宝账号完成（Vibe Pay 让个人也能收款，无需企业/个体户）：
//   1) 打开 alipay.alipay.com → 一站式接入 → Vibe Pay AI应用收款 → 网页应用 → 通过Agent接入
//   2) 按提示：扫码授权 → 用密钥工具生成私钥 → 把下方环境变量填入项目 .env
//   3) 人审通常 1–2 小时通过，即可真实收款
// 环境变量见 .env.example：ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / ALIPAY_GATEWAY
// ------------------------------------------------------------------
const store = require('./store');

// 占位值（pending-vibepay 等）视为未配置，避免云端强制填占位值后误入"真实模式"
const isPlaceholder = v => !v || /^pending/i.test(String(v).trim());

function loadConfig() {
  return {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipaydev.com/gateway.do',
    enabled: !(isPlaceholder(process.env.ALIPAY_APP_ID) || isPlaceholder(process.env.ALIPAY_PRIVATE_KEY))
  };
}

function genOutTradeNo() {
  return 'TS' + Date.now() + Math.floor(Math.random() * 1000);
}

// 创建支付单：真实模式返回支付宝下单信息；沙箱模式返回可模拟支付的单号
function createOrder({ subject = '天枢服务', amount = 1.00, buyerId = 'u_admin' } = {}) {
  const cfg = loadConfig();
  const outTradeNo = genOutTradeNo();
  if (cfg.enabled) {
    // 真实模式：此处由支付宝 Vibe Pay / 官方 SDK 完成签名与下单，返回跳转链接或支付表单
    // Vibe Pay 通常由 Agent 自动注入 Skill，下面预留接口，配置好密钥后补全即可
    return {
      mode: 'real', outTradeNo, subject, amount,
      gateway: cfg.gateway,
      note: '已检测到支付宝密钥，请在支付宝控制台完成 Vibe Pay 授权后由 Agent 注入下单逻辑'
    };
  }
  // 沙箱/演示模式：未配置密钥时模拟一单，便于演示完整收款流程
  return {
    mode: 'sandbox', outTradeNo, subject, amount,
    payUrl: `/api/pay/mock?outTradeNo=${outTradeNo}&amt=${amount}&subject=${encodeURIComponent(subject)}`,
    note: '沙箱模拟：未配置支付宝密钥，仅用于演示「创建订单 → 支付 → 商户到账」全流程'
  };
}

// 模拟支付成功并记账（沙箱用；真实环境由支付宝异步通知 /api/pay/notify 触发）
function recordPayment(p) {
  const db = store.getDB();
  const pay = {
    id: p.outTradeNo || ('P' + Date.now()),
    subject: p.subject || '天枢服务',
    amount: Number(p.amount || 0),
    buyerId: p.buyerId || 'u_admin',
    merchantId: 'u_admin',
    status: 'success',
    createdAt: Date.now()
  };
  db.payments.push(pay);
  const m = db.users.find(u => u.id === 'u_admin'); // 商户（天枢运营）余额增加
  if (m) m.balance = (m.balance || 0) + pay.amount;
  store.save();
  return pay;
}

// 真实环境需用支付宝公钥验签（建议用官方 SDK），此处为占位
function verifyNotify(params) {
  const cfg = loadConfig();
  return { verified: false, sandbox: !cfg.enabled };
}

module.exports = { loadConfig, createOrder, recordPayment, verifyNotify, genOutTradeNo };
