<template>
  <div id="app">
    <!-- Login/Register pages - full screen without sidebar -->
    <template v-if="isAuthPage">
      <router-view />
    </template>

    <!-- Main app layout with sidebar -->
    <template v-else>
      <div class="app-layout">
        <!-- Sidebar Navigation -->
        <Sidebar :connectionStatus="connectionStatus" />

        <!-- Main Area (Top Bar + Content) -->
        <div class="main-area">
          <!-- Top Bar -->
          <header class="topbar">
            <div class="topbar-left">
              <div class="topbar-breadcrumb">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span class="breadcrumb-text" v-if="isServerDetail">{{ serverBreadcrumb }}</span>
                <span class="breadcrumb-text" v-else>{{ pageTitle }}</span>
              </div>
            </div>

            <div class="topbar-right">
              <div class="connection-indicator" :class="connectionStatus" :title="connectionLabel">
                <span class="indicator-dot"></span>
                <span class="indicator-label">{{ connectionLabel }}</span>
              </div>
              <div class="topbar-time">{{ currentTime }}</div>

              <!-- User dropdown -->
              <el-dropdown trigger="click" @command="handleCommand">
                <div class="topbar-avatar" :title="authStore.userName">
                  {{ authStore.userInitials }}
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="settings">
                      <span style="display: flex; align-items: center; gap: 8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        Settings
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item divided command="logout">
                      <span style="display: flex; align-items: center; gap: 8px; color: var(--color-critical);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Logout
                      </span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </header>

          <!-- Page Content -->
          <main class="page-content">
            <router-view v-slot="{ Component }">
              <transition name="page" mode="out-in">
                <keep-alive>
                  <component :is="Component" />
                </keep-alive>
              </transition>
            </router-view>
          </main>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from './services/api'
import { useAuthStore } from './stores/auth'
import Sidebar from './components/Sidebar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const connectionStatus = ref('checking')
const connectionLabel = ref('Connecting...')
const currentTime = ref('')
const serverBreadcrumb = ref('Server Details')
let healthInterval = null
let timeInterval = null

const isAuthPage = computed(() =>
  ['login', 'register'].includes(route.name)
)

const isServerDetail = computed(() => route.path.startsWith('/server/'))

const pageTitle = computed(() => {
  if (route.path.startsWith('/server/')) return 'Server Details'
  if (route.path === '/servers') return 'Servers'
  if (route.path === '/alerts') return 'Alerts'
  if (route.path === '/settings') return 'Settings'
  return 'Dashboard'
})

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const checkConnection = async () => {
  try {
    const response = await api.getServers()
    if (response.status === 200) {
      connectionStatus.value = 'connected'
      connectionLabel.value = 'Connected'
    }
  } catch {
    connectionStatus.value = 'disconnected'
    connectionLabel.value = 'Disconnected'
  }
}

const handleCommand = (command) => {
  if (command === 'settings') {
    router.push('/settings')
  } else if (command === 'logout') {
    authStore.clearAuth()
  }
}

// Watch route for breadcrumb
watch(() => route.params.id, (id) => {
  if (id) {
    api.getServers().then(res => {
      const server = res.data.find(s => s._id === id)
      if (server) serverBreadcrumb.value = server.name
    }).catch(() => {})
  }
})

onMounted(() => {
  checkConnection()
  updateTime()
  healthInterval = setInterval(checkConnection, 15000)
  timeInterval = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (healthInterval) clearInterval(healthInterval)
  if (timeInterval) clearInterval(timeInterval)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

/* ===== Main Area ===== */
.main-area {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ===== Top Bar ===== */
.topbar {
  height: var(--navbar-height);
  background: var(--bg-navbar);
  border-bottom: 1px solid var(--border-light);
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-xl);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.topbar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.topbar-breadcrumb svg {
  color: var(--color-accent);
  flex-shrink: 0;
}

.breadcrumb-text {
  color: var(--text-primary);
  font-weight: 600;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

/* ===== Connection Indicator ===== */
.connection-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  transition: var(--transition-fast);
}

.indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.connection-indicator.connected {
  background: var(--color-ok-light);
  color: var(--color-ok);
}

.connection-indicator.connected .indicator-dot {
  background: var(--color-ok);
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.connection-indicator.disconnected {
  background: var(--color-critical-light);
  color: var(--color-critical);
}

.connection-indicator.disconnected .indicator-dot {
  background: var(--color-critical);
  box-shadow: 0 0 6px rgba(245, 108, 108, 0.5);
}

.connection-indicator.checking {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.connection-indicator.checking .indicator-dot {
  background: var(--color-warning);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ===== Top Bar Right Items ===== */
.topbar-time {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.topbar-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.3px;
  flex-shrink: 0;
  cursor: pointer;
  transition: var(--transition-fast);
}

.topbar-avatar:hover {
  opacity: 0.85;
  transform: scale(1.05);
}

/* ===== Page Content ===== */
.page-content {
  flex: 1;
  padding: var(--space-lg) var(--space-xl);
  overflow-y: auto;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .topbar {
    padding: 0 var(--space-md);
  }
  .indicator-label,
  .topbar-time {
    display: none;
  }
  .page-content {
    padding: var(--space-md);
  }
}
</style>
