import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const isPremium = computed(() => user.value && user.value.membership !== 'free')
  const membershipLabel = computed(() => {
    const map = { free: '免费用户', daily: '日度会员', weekly: '周度会员', lifetime: '永久会员' }
    return user.value ? map[user.value.membership] || '免费用户' : '免费用户'
  })

  async function login(email, password) {
    loading.value = true
    try {
      const { data } = await api.post('/auth/login', { email, password })
      token.value = data.token
      user.value = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return { success: true }
    } catch (e) {
      return { success: false, error: e.response?.data?.error || '登录失败' }
    } finally {
      loading.value = false
    }
  }

  async function register(username, email, password) {
    loading.value = true
    try {
      const { data } = await api.post('/auth/register', { username, email, password })
      token.value = data.token
      user.value = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return { success: true }
    } catch (e) {
      return { success: false, error: e.response?.data?.error || '注册失败' }
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const { data } = await api.get('/auth/me')
      user.value = data
      localStorage.setItem('user', JSON.stringify(data))
    } catch (e) {
      logout()
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  function updateUser(updates) {
    user.value = { ...user.value, ...updates }
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  return { user, token, loading, isLoggedIn, isPremium, membershipLabel, login, register, fetchUser, logout, updateUser }
})