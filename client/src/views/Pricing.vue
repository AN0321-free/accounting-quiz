<template>
  <div>
    <div class="card" style="text-align:center">
      <h2 style="color:#444;margin-bottom:8px">💎 会员套餐</h2>
      <p style="color:#888">解锁全部题目，无限刷题，云端同步</p>
    </div>

    <div class="plans">
      <div class="plan-card" v-for="plan in plans" :key="plan.key" :class="{ featured: plan.key === 'weekly' }">
        <div class="plan-badge" v-if="plan.key === 'weekly'">推荐</div>
        <h3>{{ plan.name }}</h3>
        <div class="price">¥{{ plan.price }}<span v-if="plan.key !== 'lifetime'">/{{ plan.key === 'daily' ? '天' : '周' }}</span></div>
        <ul>
          <li v-for="f in plan.features" :key="f">✓ {{ f }}</li>
        </ul>
        <button class="btn" :class="plan.key === 'weekly' ? 'btn-primary' : 'btn-outline'"
          @click="buyPlan(plan.key)" :disabled="loading === plan.key" style="width:100%">
          {{ loading === plan.key ? '处理中...' : (auth.isPremium && auth.user?.membership === plan.key ? '当前套餐' : '立即购买') }}
        </button>
      </div>
    </div>

    <!-- 微信支付二维码弹窗 -->
    <div v-if="showQrcode" class="qrcode-overlay" @click.self="closePayment">
      <div class="qrcode-card">
        <h3 style="color:#444;margin-bottom:8px">🟢 微信扫码支付</h3>
        <p style="color:#888;margin-bottom:16px">
          {{ currentOrder?.name }} · ¥{{ currentOrder?.amount }}
        </p>
        <div class="qrcode-box" ref="qrcodeBox">
          <div v-if="loadingQrcode" class="qrcode-loading">正在生成二维码...</div>
          <canvas v-else id="wechat-qrcode" @load="onQrcodeLoad"></canvas>
        </div>
        <div class="payment-status" v-if="pollingStatus !== 'idle'">
          <div class="spinner" v-if="pollingStatus === 'checking'"></div>
          <span>{{ pollingStatusText }}</span>
        </div>
        <div style="display:flex;gap:12px;margin-top:20px">
          <button class="btn btn-outline" @click="closePayment">取消</button>
          <router-link v-if="pollingStatus === 'paid'" :to="{ path: '/payment-callback', query: { orderId: currentOrder?.orderId } }" class="btn btn-success">支付完成</router-link>
        </div>
        <div class="wechat-tip" v-if="currentOrder?.mockMode">
          ⚠️ 微信支付未配置，当前为模拟模式
        </div>
      </div>
    </div>

    <!-- 旧版模拟支付（仅用于不使用微信时） -->
    <div class="card" v-if="showPayment" style="text-align:center">
      <h3 style="color:#444;margin-bottom:12px">模拟支付（开发环境）</h3>
      <p style="color:#888;margin-bottom:16px">订单号：{{ currentOrder?.orderId }} | 金额：¥{{ currentOrder?.amount }}</p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-success" @click="confirmPayment" :disabled="paying">
          {{ paying ? '确认中...' : '确认支付' }}
        </button>
        <button class="btn btn-outline" @click="showPayment = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'
import QRCode from 'qrcode'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(null)
const loadingQrcode = ref(false)
const paying = ref(false)
const showPayment = ref(false)
const showQrcode = ref(false)
const currentOrder = ref(null)
const pollingStatus = ref('idle')
let pollingTimer = null

const plans = [
  { key: 'daily', name: '日度会员', price: 0.99, features: ['全部 466 道题目', '24 小时无限刷题', '云端进度同步', '错题回顾功能'] },
  { key: 'weekly', name: '周度会员', price: 1.99, features: ['日度会员全部权益', '7 天无限刷题', '日均仅需 ¥0.28', '优先体验新功能'] },
  { key: 'lifetime', name: '永久会员', price: 2.99, features: ['周度会员全部权益', '永久有效', '终身免费更新', '专属 VIP 标识'] }
]

async function buyPlan(plan) {
  if (!auth.isLoggedIn) {
    alert('请先登录')
    return
  }
  if (auth.user?.membership === plan) {
    alert('您已是该套餐会员')
    return
  }
  loading.value = plan
  try {
    const { data } = await api.post('/payment/wechat/create', { plan })
    currentOrder.value = data
    if (data.mockMode) {
      showPayment.value = true
    } else if (data.codeUrl) {
      showQrcode.value = true
      loadingQrcode.value = true
      await drawQrcode(data.codeUrl)
      loadingQrcode.value = false
      startPolling(data.orderId)
    } else {
      showPayment.value = true
    }
  } catch (e) {
    alert(e.response?.data?.error || '创建订单失败')
  } finally {
    loading.value = null
  }
}

async function drawQrcode(url) {
  const canvas = document.getElementById('wechat-qrcode')
  if (!canvas) return
  try {
    await QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 1,
      color: { dark: '#2d2d2d', light: '#ffffff' }
    })
  } catch (e) {
    console.error('生成二维码失败:', e)
    alert('生成二维码失败')
  }
}

function onQrcodeLoad() {
  loadingQrcode.value = false
}

function closePayment() {
  showQrcode.value = false
  showPayment.value = false
  currentOrder.value = null
  stopPolling()
  pollingStatus.value = 'idle'
}

function startPolling(orderId) {
  stopPolling()
  pollingStatus.value = 'checking'
  pollingTimer = setInterval(async () => {
    try {
      const { data } = await api.get(`/payment/wechat/status/${orderId}`)
      if (data.status === 'paid') {
        pollingStatus.value = 'paid'
        stopPolling()
        auth.fetchUser()
      }
    } catch (e) {
      console.error('轮询状态失败:', e)
    }
  }, 3000)
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

const pollingStatusText = computed(() => ({
  idle: '',
  checking: '等待支付...',
  paid: '✅ 支付成功'
}[pollingStatus.value]))

async function confirmPayment() {
  paying.value = true
  try {
    const { data } = await api.post('/payment/callback', { orderId: currentOrder.value.orderId })
    auth.updateUser({ membership: data.membership, membershipExpireAt: data.membershipExpireAt })
    showPayment.value = false
    closePayment()
    alert('支付成功！已升级为 ' + (plans.find(p => p.key === data.membership)?.name || '会员'))
    router.push('/')
  } catch (e) {
    alert(e.response?.data?.error || '支付失败')
  } finally {
    paying.value = false
  }
}

onMounted(() => {
  //
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}
.plan-card {
  background: #fff;
  border: 1px solid #e8e2d5;
  border-radius: 20px;
  padding: 30px 24px;
  text-align: center;
  position: relative;
  transition: all 0.3s;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.plan-card.featured {
  border-color: #a18cd1;
  background: #faf8ff;
  transform: scale(1.03);
}
.plan-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #a18cd1, #6c5ce7);
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: 600;
  color: #fff;
}
.plan-card h3 { color: #444; margin-bottom: 12px; font-size: 1.2em; }
.price { font-size: 2.2em; font-weight: 700; color: #6c5ce7; margin-bottom: 16px; }
.price span { font-size: 0.4em; color: #888; }
.plan-card ul { list-style: none; text-align: left; margin-bottom: 20px; }
.plan-card li { color: #777; padding: 6px 0; font-size: 0.9em; }

/* 微信二维码弹窗 */
.qrcode-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.qrcode-card {
  background: #fff;
  border-radius: 16px;
  padding: 30px;
  text-align: center;
  max-width: 320px;
  width: 100%;
}
.qrcode-box {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  display: inline-block;
  border: 1px solid #eee;
}
.qrcode-loading {
  width: 220px;
  height: 220px;
  line-height: 220px;
  color: #888;
  font-size: 14px;
}
.payment-status {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  font-size: 0.9em;
}
.spinner {
  width: 16px; height: 16px;
  border: 2px solid #e8e2d5;
  border-top-color: #a18cd1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.wechat-tip {
  margin-top: 16px;
  padding: 8px 12px;
  background: #fff8e1;
  border-radius: 6px;
  color: #f57c00;
  font-size: 0.85em;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .plan-card.featured { transform: none; }
}
</style>