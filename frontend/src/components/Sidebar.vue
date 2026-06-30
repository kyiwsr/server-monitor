<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-logo">
      <router-link to="/" class="logo-link">
        <div class="logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
      </router-link>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <el-tooltip
        v-for="item in navItems"
        :key="item.route"
        :content="item.label"
        placement="right"
        :show-after="300"
        :hide-after="0"
      >
        <router-link
          :to="item.route"
          class="nav-item"
          :class="{ 'is-active': isActive(item.route) }"
        >
          <span class="nav-icon" v-html="item.icon"></span>
          <span
            v-if="badgeFor(item.route)"
            class="nav-badge"
            :class="{ 'nav-badge-alert': item.route === '/alerts' }"
          >
            {{ badgeFor(item.route) > 99 ? '99+' : badgeFor(item.route) }}
          </span>
        </router-link>
      </el-tooltip>
    </nav>

    <!-- Bottom Section -->
    <div class="sidebar-bottom">
      <el-tooltip
        :content="connectionLabel"
        placement="right"
        :show-after="300"
        :hide-after="0"
      >
        <div class="sidebar-indicator" :class="`indicator-${connectionStatus}`">
          <span class="indicator-dot"></span>
        </div>
      </el-tooltip>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useServersStore } from '../stores/servers'

const props = defineProps({
  connectionStatus: { type: String, default: 'checking' },
})

const route = useRoute()

// Nav badge counts come from the shared servers store (single poll loop)
const serversStore = useServersStore()
const { serverCount, activeAlertCount } = storeToRefs(serversStore)

const connectionLabel = computed(() => {
  const map = { connected: 'Connected', disconnected: 'Disconnected', checking: 'Connecting...' }
  return map[props.connectionStatus] || 'Connecting...'
})

function badgeFor(itemRoute) {
  if (itemRoute === '/servers') return serverCount.value || null
  if (itemRoute === '/alerts') return activeAlertCount.value || null
  return null
}

const navItems = [
  {
    route: '/',
    label: 'Dashboard',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>`,
  },
  {
    route: '/servers',
    label: 'Servers',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>`,
  },
  {
    route: '/alerts',
    label: 'Alerts',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
  },
  {
    route: '/settings',
    label: 'Settings',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
  },
]

const isActive = (itemRoute) => {
  // For routes that are just '/', match exactly
  if (itemRoute === '/') return route.path === '/'
  // For other routes, match if the path starts with the route
  return route.path.startsWith(itemRoute)
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: linear-gradient(180deg, #232740 0%, #15182a 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 300;
  box-shadow: var(--shadow-sidebar);
  overflow: hidden;
  user-select: none;
}

/* ===== Logo ===== */
.sidebar-logo {
  padding: 16px 0;
  flex-shrink: 0;
  border-bottom: 1px solid var(--sidebar-divider);
  width: 100%;
  display: flex;
  justify-content: center;
}

.logo-link {
  text-decoration: none;
  color: var(--sidebar-text-active);
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--gradient-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.35);
  transition: var(--transition-fast);
}

.logo-icon:hover {
  transform: scale(1.05);
  filter: brightness(1.06);
}

/* ===== Navigation ===== */
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 0;
  width: 100%;
}

.nav-item {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--sidebar-text);
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item:hover {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-active);
}

.nav-item.is-active {
  background: var(--sidebar-active);
  color: var(--color-accent);
}

.nav-item.is-active::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 26px;
  background: var(--gradient-accent);
  border-radius: 0 4px 4px 0;
  box-shadow: 0 0 10px var(--color-accent);
}

/* Nav count badges */
.nav-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--color-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 2px var(--sidebar-bg);
}

.nav-badge-alert {
  background: var(--color-critical);
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.nav-icon svg {
  display: block;
}

/* ===== Bottom Section ===== */
.sidebar-bottom {
  padding: 16px 0;
  border-top: 1px solid var(--sidebar-divider);
  width: 100%;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-fast);
}

.indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: var(--transition-fast);
}

.indicator-connected {
  background: rgba(103, 194, 58, 0.15);
}

.indicator-connected .indicator-dot {
  background: var(--color-ok);
  box-shadow: 0 0 8px rgba(103, 194, 58, 0.4);
}

.indicator-disconnected {
  background: rgba(245, 108, 108, 0.15);
}

.indicator-disconnected .indicator-dot {
  background: var(--color-critical);
  box-shadow: 0 0 8px rgba(245, 108, 108, 0.4);
}

.indicator-checking {
  background: rgba(230, 162, 60, 0.15);
}

.indicator-checking .indicator-dot {
  background: var(--color-warning);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
