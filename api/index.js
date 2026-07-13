require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('./store');
const auth = require('./middleware/auth');
const wechat = require('./wechat');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const DAILY_FREE_LIMIT = 50;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Helpers ────────────────────────────────────────
function readUsers() { return store.readJSON('users.json'); }
function writeUsers(data) { store.writeJSON('users.json', data); }
function readPayments() { return store.readJSON('payments.json'); }
function writePayments(data) { store.writeJSON('payments.json', data); }
function readProgress() { return store.readJSON('progress.json'); }
function writeProgress(data) { store.writeJSON('progress.json', data); }

// ─── Plans ──────────────────────────────────────────
const PLANS = {
  daily: { name: '日度会员', price: 0.99, days: 1 },
  weekly: { name: '周度会员', price: 1.99, days: 7 },
  lifetime: { name: '永久会员', price: 2.99, days: 36500 }
};

// ─── Auth Routes ───────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: '请填写所有字段' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const users = readUsers();
    if (users.find(u => u.email === email || u.username === username)) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      _id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      membership: 'free',
      membershipExpireAt: null,
      dailyQuestionsLeft: DAILY_FREE_LIMIT,
      dailyResetAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, membership: user.membership, membershipExpireAt: user.membershipExpireAt, dailyQuestionsLeft: user.dailyQuestionsLeft } });
  } catch (e) {
    res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请填写邮箱和密码' });

    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const now = new Date();
    const resetAt = new Date(user.dailyResetAt);
    if (now.toDateString() !== resetAt.toDateString()) {
      user.dailyQuestionsLeft = DAILY_FREE_LIMIT;
      user.dailyResetAt = now.toISOString();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    writeUsers(users);
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, membership: user.membership, membershipExpireAt: user.membershipExpireAt, dailyQuestionsLeft: user.dailyQuestionsLeft } });
  } catch (e) {
    res.status(500).json({ error: '登录失败' });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  try {
    const users = readUsers();
    const user = users.find(u => u._id === req.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (user.membership !== 'free' && user.membershipExpireAt && new Date() > new Date(user.membershipExpireAt)) {
      user.membership = 'free';
      user.membershipExpireAt = null;
    }

    const now = new Date();
    if (now.toDateString() !== new Date(user.dailyResetAt).toDateString()) {
      user.dailyQuestionsLeft = DAILY_FREE_LIMIT;
      user.dailyResetAt = now.toISOString();
    }

    writeUsers(users);
    res.json({ id: user._id, username: user.username, email: user.email, membership: user.membership, membershipExpireAt: user.membershipExpireAt, dailyQuestionsLeft: user.dailyQuestionsLeft, createdAt: user.createdAt });
  } catch (e) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ─── Payment Routes ────────────────────────────────
app.get('/api/plans', (req, res) => res.json(PLANS));

app.post('/api/payment/create', auth, (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: '无效的套餐' });

    const orderId = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 8);
    const payments = readPayments();
    payments.push({
      _id: uuidv4(),
      userId: req.userId,
      orderId,
      plan,
      amount: PLANS[plan].price,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    writePayments(payments);

    res.json({ orderId, plan, amount: PLANS[plan].price, name: PLANS[plan].name });
  } catch (e) {
    res.status(500).json({ error: '创建订单失败' });
  }
});

app.post('/api/payment/callback', auth, (req, res) => {
  try {
    const { orderId } = req.body;
    const payments = readPayments();
    const payment = payments.find(p => p.orderId === orderId && p.userId === req.userId);
    if (!payment) return res.status(404).json({ error: '订单不存在' });
    if (payment.status === 'paid') return res.json({ success: true, message: '已支付' });

    payment.status = 'paid';
    payment.paidAt = new Date().toISOString();
    writePayments(payments);

    const planInfo = PLANS[payment.plan];
    const users = readUsers();
    const user = users.find(u => u._id === req.userId);
    user.membership = payment.plan;
    user.membershipExpireAt = new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000).toISOString();
    user.dailyQuestionsLeft = 999999;
    writeUsers(users);

    res.json({ success: true, membership: user.membership, membershipExpireAt: user.membershipExpireAt });
  } catch (e) {
    res.status(500).json({ error: '支付回调处理失败' });
  }
});

app.get('/api/payment/history', auth, (req, res) => {
  try {
    const payments = readPayments().filter(p => p.userId === req.userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: '获取支付记录失败' });
  }
});

// ─── WeChat Pay Routes ─────────────────────────────
app.post('/api/payment/wechat/create', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: '无效的套餐' });

    const planInfo = PLANS[plan];
    const orderId = 'WX' + Date.now() + Math.random().toString(36).slice(2, 8);
    const amountFen = Math.round(planInfo.price * 100);

    // 如果未配置微信支付参数，返回模拟模式
    if (!wechat.WECHAT_CONFIG.mchId || !wechat.WECHAT_CONFIG.privateKey) {
      const payments = readPayments();
      payments.push({
        _id: uuidv4(),
        userId: req.userId,
        orderId,
        plan,
        amount: planInfo.price,
        method: 'wechat',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      writePayments(payments);
      return res.json({
        orderId,
        plan,
        amount: planInfo.price,
        name: planInfo.name,
        codeUrl: null,
        mockMode: true,
        message: '微信支付未配置，使用模拟模式'
      });
    }

    // 调用微信支付下单
    const result = await wechat.createNativeOrder({
      outTradeNo: orderId,
      description: `${planInfo.name} - 会计刷题`,
      amount: amountFen
    });

    // 保存订单
    const payments = readPayments();
    payments.push({
      _id: uuidv4(),
      userId: req.userId,
      orderId,
      plan,
      amount: planInfo.price,
      method: 'wechat',
      status: 'pending',
      codeUrl: result.code_url,
      createdAt: new Date().toISOString()
    });
    writePayments(payments);

    res.json({
      orderId,
      plan,
      amount: planInfo.price,
      name: planInfo.name,
      codeUrl: result.code_url
    });
  } catch (e) {
    console.error('[WECHAT] 下单失败:', e);
    res.status(500).json({ error: e.message || '微信支付下单失败' });
  }
});

// 微信支付回调通知（无需 auth，由签名验证）
app.post('/api/payment/wechat/callback', express.json({
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}), (req, res) => {
  try {
    const verification = wechat.verifyNotification(req.headers, req.rawBody);
    if (!verification.valid) {
      console.error('[WECHAT] 回调签名验证失败:', verification.error);
      return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
    }

    const { resource } = req.body;
    if (!resource) {
      return res.status(400).json({ code: 'FAIL', message: '缺少 resource' });
    }

    // 解密回调数据
    const decrypted = wechat.decryptResource(
      resource.ciphertext,
      resource.associated_data,
      resource.nonce
    );
    if (!decrypted) {
      return res.status(500).json({ code: 'FAIL', message: '解密失败' });
    }

    console.log('[WECHAT] 支付回调:', JSON.stringify(decrypted));

    const { out_trade_no, trade_state, transaction_id } = decrypted;
    if (trade_state !== 'SUCCESS') {
      console.log('[WECHAT] 交易未成功:', trade_state);
      return res.status(200).json({ code: 'SUCCESS', message: '已接收' });
    }

    // 更新订单状态
    const payments = readPayments();
    const payment = payments.find(p => p.orderId === out_trade_no);
    if (!payment) {
      console.error('[WECHAT] 订单不存在:', out_trade_no);
      return res.status(404).json({ code: 'FAIL', message: '订单不存在' });
    }
    if (payment.status === 'paid') {
      return res.status(200).json({ code: 'SUCCESS', message: '已支付' });
    }

    payment.status = 'paid';
    payment.paidAt = new Date().toISOString();
    payment.transactionId = transaction_id;
    writePayments(payments);

    // 升级用户会员
    const planInfo = PLANS[payment.plan];
    const users = readUsers();
    const user = users.find(u => u._id === payment.userId);
    if (user) {
      user.membership = payment.plan;
      user.membershipExpireAt = new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000).toISOString();
      user.dailyQuestionsLeft = 999999;
      writeUsers(users);
    }

    console.log('[WECHAT] 支付成功，用户已升级:', payment.userId, payment.plan);
    res.status(200).json({ code: 'SUCCESS', message: 'OK' });
  } catch (e) {
    console.error('[WECHAT] 回调处理异常:', e);
    res.status(500).json({ code: 'FAIL', message: e.message });
  }
});

// 查询微信支付订单状态
app.get('/api/payment/wechat/status/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const payments = readPayments();
    const payment = payments.find(p => p.orderId === orderId && p.userId === req.userId);
    if (!payment) return res.status(404).json({ error: '订单不存在' });

    // 如果本地已支付，直接返回
    if (payment.status === 'paid') {
      return res.json({ status: 'paid', orderId, plan: payment.plan });
    }

    // 如果未配置微信支付，返回本地状态
    if (!wechat.WECHAT_CONFIG.mchId || !wechat.WECHAT_CONFIG.privateKey) {
      return res.json({ status: payment.status, orderId, plan: payment.plan });
    }

    // 查询微信支付订单状态
    try {
      const wxOrder = await wechat.queryOrder(orderId);
      if (wxOrder.trade_state === 'SUCCESS') {
        payment.status = 'paid';
        payment.paidAt = new Date().toISOString();
        payment.transactionId = wxOrder.transaction_id;
        writePayments(payments);

        const planInfo = PLANS[payment.plan];
        const users = readUsers();
        const user = users.find(u => u._id === payment.userId);
        if (user) {
          user.membership = payment.plan;
          user.membershipExpireAt = new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000).toISOString();
          user.dailyQuestionsLeft = 999999;
          writeUsers(users);
        }
        return res.json({ status: 'paid', orderId, plan: payment.plan });
      }
      return res.json({ status: wxOrder.trade_state || 'pending', orderId, plan: payment.plan });
    } catch (wxErr) {
      console.error('[WECHAT] 查询订单失败:', wxErr);
      return res.json({ status: payment.status, orderId, plan: payment.plan });
    }
  } catch (e) {
    res.status(500).json({ error: '查询订单失败' });
  }
});

// ─── Progress Routes ───────────────────────────────
app.get('/api/progress', auth, (req, res) => {
  try {
    const all = readProgress();
    const progress = all.find(p => p.userId === req.userId);
    if (!progress) return res.json({ correctAnswers: {}, wrongAnswers: {}, userAnswers: {}, answeredQuestions: {}, currentCategory: '全部' });
    res.json(progress);
  } catch (e) {
    res.status(500).json({ error: '获取进度失败' });
  }
});

app.post('/api/progress', auth, (req, res) => {
  try {
    const all = readProgress();
    const idx = all.findIndex(p => p.userId === req.userId);
    const data = { userId: req.userId, ...req.body, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...data };
    } else {
      data._id = uuidv4();
      all.push(data);
    }
    writeProgress(all);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: '保存进度失败' });
  }
});

// ─── Question Usage ────────────────────────────────
app.post('/api/questions/use', auth, (req, res) => {
  try {
    const users = readUsers();
    const user = users.find(u => u._id === req.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (user.membership === 'free') {
      if (user.dailyQuestionsLeft <= 0) {
        return res.status(403).json({ error: '今日免费额度已用完，请升级会员', dailyQuestionsLeft: 0 });
      }
      user.dailyQuestionsLeft -= 1;
      writeUsers(users);
    }
    res.json({ dailyQuestionsLeft: user.dailyQuestionsLeft, membership: user.membership });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// ─── Export ─────────────────────────────────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('API server on port ' + PORT));
}