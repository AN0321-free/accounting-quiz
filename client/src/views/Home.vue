<template>
  <div class="home">
    <div class="hero">
      <h1>📚 会计刷题Pro</h1>
      <p class="subtitle">会计基础 · 金融资产 · 负债 · 货币资金 · 固投存 · 费用 · 长投 · 利润 · 权益 · 收入 · 无形资产</p>
      <p class="desc">470 道精选题目，智能错题回顾，章节分类刷题，助你高效通过考试</p>
      <div class="hero-btns">
        <router-link to="/quiz" class="btn btn-primary" v-if="auth.isLoggedIn">开始刷题</router-link>
        <router-link to="/login" class="btn btn-primary" v-else>登录刷题</router-link>
        <router-link to="/pricing" class="btn btn-outline">查看会员</router-link>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="icon">📂</div>
        <h3>章节分类</h3>
        <p>14 个章节独立筛选，针对性突破薄弱环节</p>
      </div>
      <div class="feature-card">
        <div class="icon">📋</div>
        <h3>错题回顾</h3>
        <p>自动记录错题，一键进入错题模式反复练习</p>
      </div>
      <div class="feature-card">
        <div class="icon">💾</div>
        <h3>云同步</h3>
        <p>答题进度云端同步，换设备不丢失</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<style scoped>
.home { text-align: center; }
.hero { padding: 60px 20px 40px; }
.hero h1 {
  font-size: 2.8em;
  background: linear-gradient(90deg, #a18cd1, #6c5ce7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 12px;
}
.subtitle { color: #888; font-size: 0.95em; margin-bottom: 8px; }
.desc { color: #999; font-size: 1.05em; margin-bottom: 30px; }
.hero-btns { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px 0; }
.feature-card {
  background: #fff;
  border: 1px solid #e8e2d5;
  border-radius: 16px;
  padding: 30px 20px;
  text-align: center;
  transition: all 0.3s;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.feature-card:hover { border-color: #a18cd1; transform: translateY(-4px); }
.feature-card .icon { font-size: 2.5em; margin-bottom: 12px; }
.feature-card h3 { color: #444; margin-bottom: 8px; }
.feature-card p { color: #999; font-size: 0.9em; line-height: 1.6; }
@media (max-width: 600px) {
  .hero h1 { font-size: 1.8em; }
  .hero { padding: 40px 10px 30px; }
}
</style>