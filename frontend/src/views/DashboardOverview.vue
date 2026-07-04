<template>
  <div class="dashboard">
    <!-- Error State -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="true"
      @close="error = ''"
      class="dashboard-alert"
    />

    <!-- Summary Stats Row -->
    <section class="stats-section">
      <div class="section-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Summary</span>
      </div>
      <div class="stats-grid">
        <el-card
          shadow="never"
          class="stat-card stat-card-all"
          :class="{ 'is-active': !activeFilter }"
          @click="activeFilter = null"
        >
          <div class="stat-body">
            <div class="stat-icon stat-icon-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ servers.length }}</div>
              <div class="stat-label">Total Servers</div>
            </div>
          </div>
        </el-card>

        <el-card
          shadow="never"
          class="stat-card stat-card-ok"
          :class="{ 'is-active': activeFilter === 'Normal' }"
          @click="toggleFilter('Normal')"
        >
          <div class="stat-body">
            <div class="stat-icon stat-icon-ok">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-ok)">{{ okCount }}</div>
              <div class="stat-label">Healthy</div>
            </div>
          </div>
        </el-card>

        <el-card
          shadow="never"
          class="stat-card stat-card-warning"
          :class="{ 'is-active': activeFilter === 'Warning' }"
          @click="toggleFilter('Warning')"
        >
          <div class="stat-body">
            <div class="stat-icon stat-icon-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-warning)">{{ warningCount }}</div>
              <div class="stat-label">Warning</div>
            </div>
          </div>
        </el-card>

        <el-card
          shadow="never"
          class="stat-card stat-card-critical"
          :class="{ 'is-active': activeFilter === 'Critical' }"
          @click="toggleFilter('Critical')"
        >
          <div class="stat-body">
            <div class="stat-icon stat-icon-critical">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-critical)">{{ criticalCount }}</div>
              <div class="stat-label">Critical</div>
            </div>
          </div>
        </el-card>

        <el-card
          shadow="never"
          class="stat-card stat-card-down"
          :class="{ 'is-active': activeFilter === 'Down' }"
          @click="toggleFilter('Down')"
        >
          <div class="stat-body">
            <div class="stat-icon stat-icon-down">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="8 12 12 16 16 12"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-down)">{{ downCount }}</div>
              <div class="stat-label">Offline</div>
            </div>
          </div>
        </el-card>
      </div>
    </section>

    <!-- Loading State -->
    <section v-if="loading" class="loading-section">
      <el-skeleton :rows="2" animated />
      <div class="skeleton-content">
        <div class="skeleton-left">
          <el-skeleton-item variant="card" class="skeleton-card" v-for="n in 4" :key="n" />
        </div>
        <div class="skeleton-right">
          <el-skeleton-item variant="card" class="skeleton-alert" />
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <template v-else-if="servers.length > 0">
      <!-- Two-Column Layout: Servers + Alerts -->
      <section class="main-grid">
        <!-- Left: Server List -->
        <div class="main-left">
          <div class="section-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <span>Servers</span>
            <el-tag size="small" effect="plain" type="info">{{ filteredServers.length }}</el-tag>
          </div>

          <!-- No-match State (filter active, nothing matches) -->
          <div v-if="filteredServers.length === 0" class="filter-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p class="filter-empty-text">No servers match this filter</p>
            <el-button size="small" @click="activeFilter = null">Clear filter</el-button>
          </div>

          <!-- Critical Section -->
          <section v-if="criticalServers.length > 0" class="server-group">
            <div class="group-header">
              <span class="group-badge group-badge-critical"></span>
              <span class="group-title">Critical</span>
              <el-tag size="small" type="danger">{{ criticalServers.length }}</el-tag>
            </div>
            <div class="server-grid">
              <ServerCard
                v-for="server in criticalServers"
                :key="server._id"
                :server="server"
                @click="goToServerDetail"
              />
            </div>
          </section>

          <!-- Warning Section -->
          <section v-if="warningServers.length > 0" class="server-group">
            <div class="group-header">
              <span class="group-badge group-badge-warning"></span>
              <span class="group-title">Warning</span>
              <el-tag size="small" type="warning">{{ warningServers.length }}</el-tag>
            </div>
            <div class="server-grid">
              <ServerCard
                v-for="server in warningServers"
                :key="server._id"
                :server="server"
                @click="goToServerDetail"
              />
            </div>
          </section>

          <!-- Healthy Section -->
          <section v-if="okServers.length > 0" class="server-group">
            <div class="group-header">
              <span class="group-badge group-badge-ok"></span>
              <span class="group-title">Healthy</span>
              <el-tag size="small" type="success">{{ okServers.length }}</el-tag>
            </div>
            <div class="server-grid">
              <ServerCard
                v-for="server in okServers"
                :key="server._id"
                :server="server"
                @click="goToServerDetail"
              />
            </div>
          </section>

          <!-- Offline Section -->
          <section v-if="downServers.length > 0" class="server-group">
            <div class="group-header">
              <span class="group-badge group-badge-down"></span>
              <span class="group-title">Offline</span>
              <el-tag size="small" type="info">{{ downServers.length }}</el-tag>
            </div>
            <div class="server-grid">
              <ServerCard
                v-for="server in downServers"
                :key="server._id"
                :server="server"
                @click="goToServerDetail"
              />
            </div>
          </section>
        </div>

        <!-- Right: Alerts Panel -->
        <div class="main-right">
          <AlertPanel :servers="servers" :loading="loading" />
        </div>
      </section>

      <!-- Bottom: Activity Chart -->
      <section class="bottom-section">
        <ActivityChart :servers="servers" :loading="loading" />
      </section>
    </template>

    <!-- Empty State -->
    <section v-else class="empty-section">
      <el-empty :image-size="160" description=" ">
        <template #image>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-placeholder); opacity: 0.4;">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </template>
        <template #default>
          <div class="empty-content">
            <h3 class="empty-title">No servers registered yet</h3>
            <p class="empty-desc">Add your first server to start monitoring CPU, memory and disk in real time.</p>
            <el-button type="primary" @click="$router.push('/servers')" class="empty-cta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add your first server
            </el-button>
          </div>
        </template>
      </el-empty>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useServersStore } from '../stores/servers'
import ServerCard from '../components/ServerCard.vue'
import AlertPanel from '../components/AlertPanel.vue'
import ActivityChart from '../components/ActivityChart.vue'

const router = useRouter()
const serversStore = useServersStore()
const { servers, loaded, hasError } = storeToRefs(serversStore)
const activeFilter = ref(null)

// Loading shows until the shared store has completed its first fetch
const loading = computed(() => !loaded.value)

// Local, dismissable mirror of the store's connection error
const error = ref('')
watch(hasError, (failed) => {
  if (failed) error.value = 'Unable to connect to the server. Please check if the backend is running.'
  else error.value = ''
}, { immediate: true })

const okCount = computed(() => servers.value.filter(s => s.status === 'Normal').length)
const warningCount = computed(() => servers.value.filter(s => s.status === 'Warning').length)
const criticalCount = computed(() => servers.value.filter(s => s.status === 'Critical').length)
const downCount = computed(() => servers.value.filter(s => s.status === 'Down').length)

const filteredServers = computed(() => {
  if (!activeFilter.value) return servers.value
  return servers.value.filter(s => s.status === activeFilter.value)
})

const criticalServers = computed(() =>
  filteredServers.value.filter(s => s.status === 'Critical')
)
const warningServers = computed(() =>
  filteredServers.value.filter(s => s.status === 'Warning')
)
const okServers = computed(() =>
  filteredServers.value.filter(s => s.status === 'Normal')
)
const downServers = computed(() =>
  filteredServers.value.filter(s => s.status === 'Down')
)

const toggleFilter = (status) => {
  activeFilter.value = activeFilter.value === status ? null : status
}

const goToServerDetail = (serverId) => {
  router.push(`/server/${serverId}`)
}
</script>

<style scoped>
.dashboard {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.dashboard-alert {
  margin-bottom: var(--space-md);
}

/* ===== Section Label ===== */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-md);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-label svg {
  color: var(--color-accent);
  flex-shrink: 0;
}

/* ===== Stats Section ===== */
.stats-section {
  margin-bottom: var(--space-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.stat-card {
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1.5px solid transparent !important;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg) !important;
}

/* Active outline matches each card's status colour */
.stat-card-all.is-active {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 3px var(--color-accent-glow) !important;
}

.stat-card-ok.is-active {
  border-color: var(--color-ok) !important;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.18) !important;
}

.stat-card-warning.is-active {
  border-color: var(--color-warning) !important;
  box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.18) !important;
}

.stat-card-critical.is-active {
  border-color: var(--color-critical) !important;
  box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.18) !important;
}

.stat-card-down.is-active {
  border-color: var(--color-down) !important;
  box-shadow: 0 0 0 3px rgba(144, 147, 153, 0.18) !important;
}

.stat-body {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  z-index: 1;
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-all { background: var(--color-accent-light); color: var(--color-accent); }
.stat-icon-ok { background: var(--color-ok-light); color: var(--color-ok); }
.stat-icon-warning { background: var(--color-warning-light); color: var(--color-warning); }
.stat-icon-critical { background: var(--color-critical-light); color: var(--color-critical); }
.stat-icon-down { background: var(--color-down-light); color: var(--color-down); }

.stat-info { min-width: 0; }

.stat-value {
  font-size: 34px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -1px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* ===== Loading ===== */
.loading-section {
  margin-top: var(--space-lg);
}

.skeleton-content {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  margin-top: var(--space-md);
}

.skeleton-left {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.skeleton-card {
  height: 200px;
  border-radius: var(--radius-md);
}

.skeleton-alert {
  height: 400px;
  border-radius: var(--radius-md);
  display: block;
}

/* ===== Main Grid ===== */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  margin-bottom: var(--space-md);
}

.main-left {
  min-width: 0;
}

.main-right {
  min-width: 0;
}

/* ===== Filter Empty State ===== */
.filter-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: var(--space-2xl) 0;
  text-align: center;
}

.filter-empty svg {
  color: var(--text-placeholder);
  opacity: 0.5;
}

.filter-empty-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== Server Groups ===== */
.server-group {
  margin-bottom: var(--space-md);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-sm);
  padding-left: 2px;
}

.group-badge {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-badge-critical { background: var(--color-critical); box-shadow: 0 0 6px rgba(245, 108, 108, 0.4); }
.group-badge-warning { background: var(--color-warning); box-shadow: 0 0 6px rgba(230, 162, 60, 0.4); }
.group-badge-ok { background: var(--color-ok); box-shadow: 0 0 6px rgba(103, 194, 58, 0.4); }
.group-badge-down { background: var(--color-down); }

.group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.server-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* ===== Empty State ===== */
.empty-section {
  padding: var(--space-3xl) 0;
}

.empty-content {
  text-align: center;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-regular);
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 360px;
  margin: 0 auto;
}

.empty-cta {
  margin-top: var(--space-md);
}

/* ===== Responsive ===== */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .main-grid {
    grid-template-columns: 1fr;
  }

  .main-right {
    order: -1;
  }

  .skeleton-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .stat-value {
    font-size: 22px;
  }
  .stat-icon {
    width: 36px;
    height: 36px;
  }
  .stat-icon svg {
    width: 16px;
    height: 16px;
  }
  .server-grid {
    grid-template-columns: 1fr;
  }
  .skeleton-left {
    grid-template-columns: 1fr;
  }
}
</style>
