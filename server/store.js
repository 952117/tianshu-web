// 数据层：内存 + JSON 文件持久化（零依赖）
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }

const defaultDB = {
  users: [
    { id: 'u_admin',  name: '天枢运营',   role: 'admin', city: '',        phone: '',           referralCode: 'TS-ADMIN',  balance: 0, createdAt: Date.now() },
    { id: 'u_flyer1', name: '飞手·阿强', role: 'flyer', city: '保靖县',  phone: '138****0001', referralCode: 'FLY-QIANG', balance: 0, createdAt: Date.now() }
  ],
  orders: [
    { id: 'ORD-1001', title: '黄金茶 20kg 县城→茶峒镇', from: '保靖县', to: '茶峒镇', payload: '黄金茶', weight: 20, fee: 120, status: 'pending', flyerId: null, ownerId: 'u_admin', createdAt: Date.now() - 86400000, completedAt: null, releasedAt: null, t3Date: null },
    { id: 'ORD-1002', title: '柑橘 50kg 迁陵镇→复兴镇', from: '迁陵镇', to: '复兴镇', payload: '柑橘',   weight: 50, fee: 200, status: 'pending', flyerId: null, ownerId: 'u_admin', createdAt: Date.now() - 3600000, completedAt: null, releasedAt: null, t3Date: null }
  ],
  products: [
    { id: 'P001', name: '保靖黄金茶(礼盒)', price: 288, commissionRate: 0.10, supplier: '保靖县农产品合作社' },
    { id: 'P002', name: '湘西柑橘(5斤装)',  price: 39,  commissionRate: 0.12, supplier: '保靖县农产品合作社' },
    { id: 'P003', name: '龙山黄桃(礼盒)',  price: 99,  commissionRate: 0.10, supplier: '龙山供销社' },
    { id: 'P004', name: '湘西腊肉(2斤)',   price: 78,  commissionRate: 0.08, supplier: '保靖县农产品合作社' }
  ],
  distributions: [],
  leads: [],
  payments: [],
  conversations: []
};

let db = null;

function load() {
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); return; } catch (e) { /* fallthrough */ }
  }
  db = JSON.parse(JSON.stringify(defaultDB));
  save();
}

function save() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getDB() { if (!db) load(); return db; }

function recordPayment(p) {
  const db = getDB();
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
  const m = db.users.find(u => u.id === 'u_admin');
  if (m) m.balance = (m.balance || 0) + pay.amount;
  save();
  return pay;
}

module.exports = { load, save, getDB, DATA_DIR, recordPayment };
