<template>
  <div class="card" style="text-align:center;padding:60px 20px">
    <div v-if="status === 'loading'">
      <div class="spinner"></div>
      <p style="color:#888;margin-top:16px">正在处理支付结果...</p>
    </div>
    <div v-else-if="status === 'success'">
      <div style="font-size:3em;margin-bottom:16px">🎉</div>
      <h2 style="color:#2ecc71;margin-bottom:8px">支付成功！</h2>
      <p style="color:#888">您已升级为会员，现在可以无限刷题了</p>
      <router-link to="/quiz" class="btn btn-primary" style="margin-top:20px">开始刷题</router-link>
    </div>
    <div v-else>
      <div style="font-size:3em;margin-bottom:16px">😞</div>
      <h2 style="color:#e74c3c;margin-bottom:8px">支付失败</h2>
      <p style="color:#888">{{ error }}</p>
      <router-link to="/pricing" class="btn btn-outline" style="margin-top:20px">返回重试</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const route = useRoute()
const auth = useAuthStore()
const status = ref('loading')
const error = ref('')

onMounted(async () => {
  const orderId = route.query.orderId
  if (!orderId) {
    status.value = 'error'
    error.value = '缺少订单号'
    return
  }
  try {
    const { data } = await api.post('/payment/callback', { orderId })
    auth.updateUser({ membership: data.membership, membershipExpireAt: data.membershipExpireAt })
    status.value = 'success'
  } catch (e) {
    status.value = 'error'
    error.value = e.response?.data?.error || '支付回调处理失败'
  }
})
</script>

<style scoped>
.spinner {
  width: 40px; height: 40px;
  border: 3px solid #e8e2d5;
  border-top-color: #a18cd1;
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>