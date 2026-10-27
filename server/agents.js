// 天枢智能体团队：中枢编排 + 多智能体协作（客服小枢 / 调度官 / 星探获客）
const store = require('./store');

// ---- 知识库（RAG 片段，接入 BP / 隐私指引 / 设计决策）----
const KNOWLEDGE = {
  about: '天枢TIANSHU是磨洞半岛集团旗下的全球低空经济操作系统，不造飞机、不做末端配送，而是做城市级低空的调度网与数字底座，靠网络效应与四方收入形成护城河。',
  revenue: '四方收入模型：平台（调度费/佣金）+ 飞手（接单/分销佣金）+ 政府（税收/就业/标杆）+ 供应商（上行货品销售）。',
  privacy: '天枢是人工智能应用，使用AI功能时输入的文本/图片会被处理用于生成结果；我们不会将对话用于无关用途，也不会未经同意向第三方提供。用户可在设置中删除历史对话。',
  order: '订单状态：pending(待接)→active(进行中)→completed(已完成)→released(已解付)。完成后的T+3个工作日自动解付到飞手余额（跳过周末）。',
  mall: '飞手可凭referralCode分销保靖县农产品（黄金茶/柑橘/黄桃/腊肉/毛尖/百合），平台佣金8–12%，分销佣金5%，供应商T+3结算。'
};

// 意图识别（关键词路由）
function classifyIntent(text) {
  const t = text || '';
  if (/隐私|个人信息|数据安全|授权|收集/.test(t)) return 'privacy';
  if (/怎么赚|赚钱|佣金|收益|收入|分成|结算/.test(t)) return 'revenue';
  if (/接单|订单|调度|解付|运货|配送|状态|到哪/.test(t)) return 'dispatch';
  if (/买|商城|商品|农产品|分销|黄金茶|柑橘|黄桃|腊肉/.test(t)) return 'mall';
  if (/注册|加入|合作|成为飞手|意向|留个|联系|电话|怎么上/.test(t)) return 'lead';
  if (/你好|在吗|你是|介绍|是什么|天枢/.test(t)) return 'about';
  return 'general';
}

// 意图 → 负责智能体
function intentToAgent(intent) {
  const map = {
    privacy: '客服·小枢', revenue: '客服·小枢', about: '客服·小枢', general: '客服·小枢',
    dispatch: '调度官·天枢', mall: '调度官·天枢', lead: '星探·天枢'
  };
  return map[intent] || '客服·小枢';
}

// 模型调用封装：配置 LLM_API_KEY 后生效，否则返回 null 走规则兜底
async function callLLM(system, userText) {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: userText }] })
    });
    const j = await r.json();
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
  } catch (e) {
    return null;
  }
}

// 统一入口：返回 { agent, intent, reply, lead? }
async function handleMessage(text, ctx = {}) {
  const intent = classifyIntent(text);
  const agent = intentToAgent(intent);
  const db = store.getDB();

  // 星探·获客：抽取线索并建档
  if (intent === 'lead') {
    const phone = (text.match(/(1[3-9]\d{9})/) || [])[1] ||
                  (text.match(/(\d{3,4}[-\s]?\d{7,8})/) || [])[1] || null;
    const name = (text.match(/(?:我叫|我是)([\u4e00-\u9fa5]{2,4})/) || [])[1] || null;
    const city = (text.match(/(保靖县|迁陵镇|茶峒镇|复兴镇|湘西|龙山)/) || [])[1] || null;
    const lead = {
      id: 'L' + Date.now(), name, phone, city,
      intent: '飞手/货主合作', note: String(text).slice(0, 200), createdAt: Date.now()
    };
    db.leads.push(lead);
    store.save();
    return {
      agent: '星探·天枢', intent,
      reply: `已收到合作意向，天枢星探已为您建档（编号 ${lead.id}）。` +
             (phone ? `我们将通过 ${phone} 与您联系。` : '请留下联系方式以便跟进。'),
      lead
    };
  }

  // 调度官：订单/解付状态
  if (intent === 'dispatch') {
    const open = db.orders.filter(o => o.status === 'pending').length;
    const mine = ctx.flyerId ? db.orders.filter(o => o.flyerId === ctx.flyerId) : [];
    const mineText = mine.length
      ? '您参与的订单：' + mine.map(o => o.id + '(' + o.status + ')').join('、')
      : '您暂未接单，可在抢单大厅挑选。';
    return { agent: '调度官·天枢', intent, reply: `当前待接订单 ${open} 单。${mineText} 完成后的 T+3 工作日自动解付到余额。` };
  }

  // 调度官：商城分销
  if (intent === 'mall') {
    const list = db.products.map(p => `${p.name} ¥${p.price}（佣金${(p.commissionRate * 100).toFixed(0)}%）`).join('；');
    return { agent: '调度官·天枢', intent, reply: `天枢商城在售：${list}。飞手凭 referralCode 分销可获佣金，供应商 T+3 结算。` };
  }

  // 客服小枢：知识库 + LLM 兜底
  const kb = KNOWLEDGE[intent] || KNOWLEDGE.about;
  const system = '你是天枢TIANSHU的智能客服小枢，只基于以下知识用简体中文简洁回答，不要编造：' + JSON.stringify(KNOWLEDGE);
  const llm = await callLLM(system, text);
  const reply = llm || (kb + '\n（当前为无模型兜底回复；配置 LLM_API_KEY 后可由大模型生成更自然的回答。）');
  return { agent, intent, reply };
}

module.exports = { handleMessage, classifyIntent, KNOWLEDGE, intentToAgent };
