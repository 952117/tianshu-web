// 调度匹配引擎（轻量：按城市关键字匹配待接订单）
const store = require('./store');

function matchOrders(city) {
  const db = store.getDB();
  return db.orders.filter(o =>
    o.status === 'pending' && (!city || o.from.includes(city) || o.to.includes(city))
  );
}

module.exports = { matchOrders };
