// 商城分销：referralCode 分销佣金 + 平台佣金
const store = require('./store');

function buyProduct(productId, buyerId, referrerCode, qty = 1) {
  const db = store.getDB();
  const p = db.products.find(x => x.id === productId);
  if (!p) return { error: '商品不存在' };
  const amount = p.price * qty;
  const commission = Math.round(amount * p.commissionRate * 100) / 100;
  const dist = {
    id: 'D' + Date.now(), productId, buyerId: buyerId || 'u_admin',
    referrerCode: referrerCode || null, qty, amount, commission, createdAt: Date.now()
  };
  db.distributions.push(dist);
  // 分销商佣金记账
  if (referrerCode) {
    const ref = db.users.find(u => u.referralCode === referrerCode);
    if (ref) ref.balance = (ref.balance || 0) + commission;
  }
  // 平台佣金（货值 - 分销佣金）
  const admin = db.users.find(u => u.role === 'admin');
  if (admin) admin.balance = (admin.balance || 0) + (amount - commission);
  store.save();
  return { ok: true, dist, platformFee: amount - commission };
}

module.exports = { buyProduct };
