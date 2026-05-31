import { useAuthStore } from '../stores/auth'

export default function authGuard(to, from, next) {
  const authStore = useAuthStore()

  // Allow access to login and register pages without authentication
  if (to.path === '/login' || to.path === '/register') {
    // If already logged in, redirect to dashboard
    if (authStore.isLoggedIn) {
      next('/')
    } else {
      next()
    }
    return
  }

  // For all other routes, require authentication
  if (!authStore.isLoggedIn) {
    next('/login')
  } else {
    next()
  }
}
