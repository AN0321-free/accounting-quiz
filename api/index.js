require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Payment = require('./models/Payment');
const Progress = require('./models/Progress');
const auth = require('./middleware/auth');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const DAILY_FREE_LIMIT = 50;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── MongoDB ───────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accounting-quiz';
let dbConnected = false;

async function connectDB() {
  if (dbConnected) return;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    console.log('MongoDB connected');
  } catch (e) {
    console.error('MongoDB connection error:', e.message);
  }
}

// ─── Auth Routes ───────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    await connectDB();
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有字段' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    const exist = await User.findOne({ $or: [{ email }, { username }] });
    if (exist) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }
    const user = await User.create({ username, email, password });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, membership: user.membership, membershipExpireAt: user.membershipExpireAt, dailyQuestionsLeft: user.dailyQuestionsLeft } });
  } catch (e) {
    res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    // Reset daily count if needed
    const now = new Date();
    const resetAt = new Date(user.dailyResetAt);
    if (now.toDateString() !== resetAt.toDateString()) {
      user.dailyQuestionsLeft = DAILY_FREE_LIMIT;
      user.dailyResetAt = now;
      await user.save();
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, membership: user.membership, membershipExpireAt: user.membershipExpireAt, dailyQuestionsLeft: user.dailyQuestionsLeft } });
  } catch (e) {
    res.status(500).json({ error: '登录失败' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: '用户不存在' });
    // Check membership expiry
    if (user.membership !== 'free' && user.membershipExpireAt && new Date() > user.membershipExpireAt) {
      user.membership = 'free';
      user.membershipExpireAt = null;
      await user.save();
    }
    // Reset daily
    const now = new Date();
    if (now.toDateString() !== new Date(user.dailyResetAt).toDateString()) {
      user.dailyQuestionsLeft = DAILY_FREE_LIMIT;
      user.dailyResetAt = now;
      await user.save();
    }
    res.json({ id: user._id, username: user.username, email: user.email, membership: user.membership, membershipExpireAt: user.membershipExpireAt, dailyQuestionsLeft: user.dailyQuestionsLeft, createdAt: user.createdAt });
  } catch (e) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ─── Payment Routes ────────────────────────────────
const PLANS = {
  daily: { name: '日度会员', price: 0.99, days: 1 },
  weekly: { name: '周度会员', price: 1.99, days: 7 },
  lifetime: { name: '永久会员', price: 2.99, days: 36500 }
};

app.get('/api/plans', (req, res) => {
  res.json(PLANS);
});

app.post('/api/payment/create', auth, async (req, res) => {
  try {
    await connectDB();
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: '无效的套餐' });
    const orderId = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 8);
    const payment = await Payment.create({
      userId: req.userId,
      orderId,
      plan,
      amount: PLANS[plan].price,
      status: 'pending'
    });
    res.json({ orderId: payment.orderId, plan, amount: PLANS[plan].price, name: PLANS[plan].name });
  } catch (e) {
    res.status(500).json({ error: '创建订单失败' });
  }
});

app.post('/api/payment/callback', auth, async (req, res) => {
  try {
    await connectDB();
    const { orderId } = req.body;
    const payment = await Payment.findOne({ orderId, userId: req.userId });
    if (!payment) return res.status(404).json({ error: '订单不存在' });
    if (payment.status === 'paid') return res.json({ success: true, message: '已支付' });

    payment.status = 'paid';
    payment.paidAt = new Date();
    await payment.save();

    const planInfo = PLANS[payment.plan];
    const user = await User.findById(req.userId);
    const expireAt = new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000);
    user.membership = payment.plan;
    user.membershipExpireAt = expireAt;
    user.dailyQuestionsLeft = 999999;
    await user.save();

    res.json({ success: true, membership: user.membership, membershipExpireAt: user.membershipExpireAt });
  } catch (e) {
    res.status(500).json({ error: '支付回调处理失败' });
  }
});

app.get('/api/payment/history', auth, async (req, res) => {
  try {
    await connectDB();
    const payments = await Payment.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: '获取支付记录失败' });
  }
});

// ─── Progress Routes ───────────────────────────────
app.get('/api/progress', auth, async (req, res) => {
  try {
    await connectDB();
    let progress = await Progress.findOne({ userId: req.userId });
    if (!progress) {
      progress = { correctAnswers: {}, wrongAnswers: {}, userAnswers: {}, answeredQuestions: {}, currentCategory: '全部' };
    }
    res.json(progress);
  } catch (e) {
    res.status(500).json({ error: '获取进度失败' });
  }
});

app.post('/api/progress', auth, async (req, res) => {
  try {
    await connectDB();
    const { correctAnswers, wrongAnswers, userAnswers, answeredQuestions, currentCategory } = req.body;
    const progress = await Progress.findOneAndUpdate(
      { userId: req.userId },
      { correctAnswers, wrongAnswers, userAnswers, answeredQuestions, currentCategory, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(progress);
  } catch (e) {
    res.status(500).json({ error: '保存进度失败' });
  }
});

// ─── Question Usage (deduct quota) ────────────────
app.post('/api/questions/use', auth, async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.userId);
    if (user.membership === 'free') {
      if (user.dailyQuestionsLeft <= 0) {
        return res.status(403).json({ error: '今日免费额度已用完，请升级会员', dailyQuestionsLeft: 0 });
      }
      user.dailyQuestionsLeft -= 1;
      await user.save();
    }
    res.json({ dailyQuestionsLeft: user.dailyQuestionsLeft, membership: user.membership });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// ─── Export for Vercel ─────────────────────────────
module.exports = app;

// Standalone mode
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`API server on port ${PORT}`));
  });
}