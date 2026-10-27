// 订单状态机 + T+3 工作日自动解付（跳过周末）
const store = require('./store');

// 计算从 start 起第 n 个工作日（跳过周六日）
function addBusinessDays(start, n) {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

function acceptOrder(orderId, flyerId) {
  const db = store.getDB();
  const o = db.orders.find(x => x.id === orderId);
  if (!o) return { error: '订单不存在' };
  if (o.status !== 'pending') return { error: '订单已被接或已完成' };
  o.status = 'active';
  o.flyerId = flyerId || 'u_flyer1';
  store.save();
  return { ok: true, order: o };
}

function completeOrder(orderId) {
  const db = store.getDB();
  const o = db.orders.find(x => x.id === orderId);
  if (!o || o.status !== 'active') return { error: '订单状态不可完成（需先接单）' };
  o.status = 'completed';
  o.completedAt = Date.now();
  o.t3Date = addBusinessDays(new Date(), 3).getTime();
  store.save();
  return { ok: true, order: o, releaseDate: o.t3Date };
}

// 把到点的已完成订单自动解付到飞手余额
function releaseDueOrders() {
  const db = store.getDB();
  const now = Date.now();
  let count = 0;
  for (const o of db.orders) {
    if (o.status === 'completed' && o.t3Date && now >= o.t3Date) {
      o.status = 'released';
      o.releasedAt = now;
      const flyer = db.users.find(u => u.id === o.flyerId);
      if (flyer) flyer.balance = (flyer.balance || 0) + o.fee;
      count++;
    }
  }
  if (count) store.save();
  return count;
}

module.exports = { addBusinessDays, acceptOrder, completeOrder, releaseDueOrders };
