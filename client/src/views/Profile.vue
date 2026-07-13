<template>
  <div class="card">
    <h2 style="color:#444;margin-bottom:20px">👤 个人中心</h2>
    <div class="profile-grid">
      <div class="info-item"><span class="label">用户名</span><span class="value">{{ auth.user?.username }}</span></div>
      <div class="info-item"><span class="label">邮箱</span><span class="value">{{ auth.user?.email }}</span></div>
      <div class="info-item">
        <span class="label">会员状态</span>
        <span class="value membership">{{ auth.membershipLabel }}</span>
      </div>
      <div class="info-item">
        <span class="label">会员到期</span>
        <span class="value">{{ auth.user?.membershipExpireAt ? new Date(auth.user.membershipExpireAt).toLocaleDateString('zh-CN') : '—' }}</span>
      </div>
      <div class="info-item">
        <span class="label">今日剩余</span>
        <span class="value">{{ auth.user?.dailyQuestionsLeft === 999999 ? '无限' : auth.user?.dailyQuestionsLeft + ' 题' }}</span>
      </div>
      <div class="info-item"><span class="label">注册时间</span><span class="value">{{ auth.user?.createdAt ? new Date(auth.user.createdAt).toLocaleDateString('zh-CN') : '—' }}</span></div>
    </div>

    <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">
      <router-link to="/pricing" class="btn btn-primary btn-sm" v-if="!auth.isPremium">升级会员</router-link>
      <button class="btn btn-outline btn-sm" @click="handleLogout">退出登录</button>
    </div>
  </div>

  <div class="card" v-if="payments.length > 0">
    <h3 style="color:#444;margin-bottom:16px">📋 支付记录</h3>
    <div class="payment-list">
      <div class="payment-item" v-for="p in payments" :key="p._id">
        <div>
          <span class="order-id">{{ p.orderId }}</span>
          <span class="plan-tag">{{ planNames[p.plan] }}</span>
        </div>
        <div class="payment-right">
          <span class="amount">¥{{ p.amount }}</span>
          <span class="status" :class="p.status">{{ statusMap[p.status] }}</span>
          <span class="date">{{ new Date(p.createdAt).toLocaleDateString('zh-CN') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const router = useRouter()
const auth = useAuthStore()
const payments = ref([])
const planNames = { daily: '日度', weekly: '周度', lifetime: '永久' }
const statusMap = { pending: '待支付', paid: '已支付', cancelled: '已取消', expired: '已过期' }

onMounted(async () => {
  try {
    const { data } = await api.get('/payment/history')
    payments.value = data
  } catch (e) {}
})

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<style scoped>
.profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.info-item {
  background: #fafaf7;
  border: 1px solid #e8e2d5;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label { color: #888; font-size: 0.85em; }
.value { color: #333; font-weight: 600; font-size: 1.05em; }
.membership { background: linear-gradient(90deg, #a18cd1, #6c5ce7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.payment-list { display: flex; flex-direction: column; gap: 10px; }
.payment-item {
  display: flex; justify-content: space-between; align-items: center;
  background: #fafaf7; border-radius: 10px; padding: 14px 16px;
  flex-wrap: wrap; gap: 8px;
}
.order-id { font-family: monospace; color: #888; font-size: 0.85em; }
.plan-tag { background: rgba(161,140,209,0.1); color: #6c5ce7; padding: 2px 8px; border-radius: 6px; font-size: 0.8em; margin-left: 8px; }
.amount { font-weight: 700; color: #6c5ce7; }
.status { font-size: 0.8em; padding: 2px 8px; border-radius: 6px; }
.status.paid { background: rgba(46,204,113,0.08); color: #27ae60; }
.status.pending { background: rgba(241,196,15,0.08); color: #b8860b; }
.date { color: #999; font-size: 0.8em; }
</style>