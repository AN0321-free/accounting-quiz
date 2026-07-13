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
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const auth = useAuthStore()
const loading = ref(null)
const paying = ref(false)
const showPayment = ref(false)
const currentOrder = ref(null)

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
    const { data } = await api.post('/payment/create', { plan })
    currentOrder.value = data
    showPayment.value = true
  } catch (e) {
    alert(e.response?.data?.error || '创建订单失败')
  } finally {
    loading.value = null
  }
}

async function confirmPayment() {
  paying.value = true
  try {
    const { data } = await api.post('/payment/callback', { orderId: currentOrder.value.orderId })
    auth.updateUser({ membership: data.membership, membershipExpireAt: data.membershipExpireAt })
    showPayment.value = false
    alert('支付成功！已升级为 ' + (plans.find(p => p.key === data.membership)?.name || '会员'))
  } catch (e) {
    alert(e.response?.data?.error || '支付失败')
  } finally {
    paying.value = false
  }
}
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
@media (max-width: 600px) {
  .plan-card.featured { transform: none; }
}
</style>