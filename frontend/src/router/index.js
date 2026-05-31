import { createRouter, createWebHistory } from 'vue-router'
import DashboardOverview from '../views/DashboardOverview.vue'
import ServerDetail from '../views/ServerDetail.vue'
import ServersPage from '../views/ServersPage.vue'
import AlertsPage from '../views/AlertsPage.vue'
import SettingsPage from '../views/SettingsPage.vue'
import LoginPage from '../views/LoginPage.vue'
import RegisterPage from '../views/RegisterPage.vue'
import authGuard from '../middleware/authGuard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
    },
    {
      path: '/',
      name: 'dashboard',
      component: DashboardOverview,
      meta: { requiresAuth: true },
    },
    {
      path: '/server/:id',
      name: 'server-detail',
      component: ServerDetail,
      meta: { requiresAuth: true },
    },
    {
      path: '/servers',
      name: 'servers',
      component: ServersPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: AlertsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
      meta: { requiresAuth: true },
    },
  ],
})

// Add auth guard
router.beforeEach(authGuard)

export default router
