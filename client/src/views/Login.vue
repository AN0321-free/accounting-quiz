<template>
  <div class="card auth-card">
    <h2>登录</h2>
    <form @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="邮箱" required />
      <input v-model="password" type="password" placeholder="密码" required />
      <p class="error" v-if="error">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="auth.loading" style="width:100%">
        {{ auth.loading ? '登录中...' : '登录' }}
      </button>
    </form>
    <p class="switch">还没有账号？<router-link to="/register">立即注册</router-link></p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  error.value = ''
  const result = await auth.login(email.value, password.value)
  if (result.success) {
    router.push('/quiz')
  } else {
    error.value = result.error
  }
}
</script>

<style scoped>
.auth-card { max-width: 420px; margin: 60px auto; }
.auth-card h2 { text-align: center; margin-bottom: 24px; font-size: 1.5em; color: #444; }
.auth-card input { width: 100%; margin-bottom: 14px; }
.auth-card .error { color: #e74c3c; font-size: 0.9em; margin-bottom: 12px; text-align: center; }
.switch { text-align: center; margin-top: 16px; color: #888; font-size: 0.9em; }
.switch a { color: #6c5ce7; text-decoration: none; }
</style>