import axios from 'axios'

// In Docker, the build sets VITE_API_URL=/api and nginx reverse-proxies /api
// to the backend container. In local dev (no env var) we hit the backend directly.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const apiClient = axios.create({
  baseURL: API_URL,
})

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token invalid or expired - clear auth and redirect
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default {
  // Auth
  register(name, email, password) {
    return apiClient.post('/auth/register', { name, email, password })
  },
  login(email, password) {
    return apiClient.post('/auth/login', { email, password })
  },
  logout() {
    return apiClient.post('/auth/logout')
  },
  getMe() {
    return apiClient.get('/auth/me')
  },
  updateProfile(data) {
    return apiClient.put('/auth/me', data)
  },

  // Servers
  getServers() {
    return apiClient.get('/servers')
  },
  getServer(id) {
    return apiClient.get(`/servers/${id}`)
  },
  createServer(data) {
    return apiClient.post('/servers', data)
  },
  updateServer(id, data) {
    return apiClient.put(`/servers/${id}`, data)
  },
  deleteServer(id) {
    return apiClient.delete(`/servers/${id}`)
  },
  regenerateToken(id) {
    return apiClient.put(`/servers/${id}/regenerate-token`)
  },
  getServerMetrics(id, timeRange = '24h') {
    return apiClient.get(`/servers/${id}/metrics`, { params: { timeRange } })
  },

  // Alerts
  getAlerts(params = {}) {
    return apiClient.get('/alerts', { params })
  },
  getAlert(id) {
    return apiClient.get(`/alerts/${id}`)
  },
  resolveAlert(id) {
    return apiClient.put(`/alerts/${id}/resolve`)
  },

  // Admin
  getUsers() {
    return apiClient.get('/auth/users')
  },
  toggleUserStatus(userId) {
    return apiClient.patch(`/auth/users/${userId}/toggle-status`)
  },
  createViewer(data) {
    return apiClient.post('/auth/register-viewer', data)
  },
}
