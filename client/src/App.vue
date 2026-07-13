<template>
  <div id="app-root">
    <Navbar />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import Navbar from './components/Navbar.vue'
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f2eb;
  min-height: 100vh;
  color: #333;
}

.main-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: #fff;
  border: 1px solid #e8e2d5;
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  border: none;
  border-radius: 12px;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #fff;
  font-family: inherit;
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, #a18cd1, #6c5ce7);
  color: #fff;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(108,92,231,0.3);
}
.btn-outline {
  background: #fff;
  border: 1.5px solid #d5cce6;
  color: #6c5ce7;
}
.btn-outline:hover {
  background: #f8f5fc;
  border-color: #a18cd1;
}
.btn-sm { padding: 8px 16px; font-size: 0.85em; }
.btn-danger { background: linear-gradient(135deg, #e74c3c, #c0392b); color: #fff; }
.btn-success { background: linear-gradient(135deg, #2ecc71, #27ae60); color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

input, select {
  padding: 14px 18px;
  border-radius: 12px;
  border: 1.5px solid #e0dcd0;
  background: #fafaf7;
  color: #333;
  font-size: 1em;
  outline: none;
  font-family: inherit;
  transition: all 0.3s ease;
}
input:focus, select:focus {
  border-color: #a18cd1;
  box-shadow: 0 0 0 3px rgba(161,140,209,0.12);
  background: #fff;
}
select option {
  background: #fff;
  color: #333;
}

input::placeholder {
  color: #bbb;
}

.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 600;
  z-index: 1000;
  animation: slideDown 0.4s ease;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.toast.info { background: #a18cd1; color: #fff; }
.toast.success { background: #2ecc71; color: #fff; }
.toast.error { background: #e74c3c; color: #fff; }

@keyframes slideDown {
  from { opacity: 0; transform: translateX(-50%) translateY(-30px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .main-content { padding: 10px; }
  .card { padding: 20px 15px; }
}
</style>