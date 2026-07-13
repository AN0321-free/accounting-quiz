import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Quiz from '../views/Quiz.vue'
import Pricing from '../views/Pricing.vue'
import Profile from '../views/Profile.vue'
import PaymentCallback from '../views/PaymentCallback.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/quiz', name: 'Quiz', component: Quiz, meta: { requiresAuth: true } },
  { path: '/pricing', name: 'Pricing', component: Pricing },
  { path: '/profile', name: 'Profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/payment/callback', name: 'PaymentCallback', component: PaymentCallback, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router