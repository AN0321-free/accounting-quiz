<template>
  <nav class="navbar">
    <div class="nav-inner">
      <router-link to="/" class="logo">📚 刷题Pro</router-link>
      <div class="nav-links">
        <router-link to="/quiz" v-if="auth.isLoggedIn">刷题</router-link>
        <router-link to="/pricing">会员</router-link>
        <router-link to="/profile" v-if="auth.isLoggedIn">个人中心</router-link>
        <router-link to="/login" v-if="!auth.isLoggedIn" class="btn btn-sm btn-outline">登录</router-link>
        <span v-else class="user-badge">{{ auth.user?.username }}</span>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<style scoped>
.navbar {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-bottom: 1px solid #e8e2d5;
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
}
.logo {
  font-size: 1.3em;
  font-weight: 700;
  background: linear-gradient(90deg, #a18cd1, #fbc2eb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-decoration: none;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
}
.nav-links a {
  color: #555;
  text-decoration: none;
  font-size: 0.95em;
  transition: color 0.3s;
}
.nav-links a:hover { color: #6c5ce7; }
.user-badge {
  color: #6c5ce7;
  font-weight: 600;
  font-size: 0.9em;
}
@media (max-width: 600px) {
  .nav-links { gap: 12px; }
  .nav-links a { font-size: 0.85em; }
}
</style>