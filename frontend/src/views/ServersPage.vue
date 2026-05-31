<template>
  <div class="servers-page">
    <!-- Error State -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="true"
      @close="error = ''"
      class="page-alert"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Servers</h1>
        <p class="page-subtitle">Manage your monitored servers</p>
      </div>
    </div>

    <!-- Loading State -->
    <template v-if="loading">
      <div class="skeleton-section">
        <el-skeleton :rows="1" animated />
        <div class="skeleton-table">
          <el-skeleton-item variant="card" class="skeleton-row" v-for="n in 5" :key="n" />
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Toolbar: Search + Filters + Toggle -->
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchQuery"
            placeholder="Search by name or host..."
            :prefix-icon="Search"
            clearable
            size="default"
            class="search-input"
          />
          <el-radio-group v-model="statusFilter" size="small">
            <el-radio-button label="">All</el-radio-button>
            <el-radio-button label="Ok">Healthy</el-radio-button>
            <el-radio-button label="Warning">Warning</el-radio-button>
            <el-radio-button label="Critical">Critical</el-radio-button>
            <el-radio-button label="Down">Offline</el-radio-button>
          </el-radio-group>
        </div>
        <div class="toolbar-right">
          <el-tooltip :content="viewMode === 'table' ? 'Switch to Card View' : 'Switch to Table View'" placement="top">
            <el-button
              size="small"
              circle
              @click="toggleView"
              class="view-toggle-btn"
            >
              <svg v-if="viewMode === 'table'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <!-- Table View -->
      <template v-if="viewMode === 'table'">
        <el-card shadow="never" class="table-card">
          <el-table
            v-if="filteredServers.length > 0"
            :data="filteredServers"
            style="width: 100%"
            size="small"
            stripe
            empty-text=" "
          >
            <el-table-column label="Server Name" min-width="160">
              <template #default="{ row }">
                <div class="cell-name">
                  <div class="cell-avatar" :class="'avatar-' + row.status.toLowerCase()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <span class="cell-name-text">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Host IP" min-width="130">
              <template #default="{ row }">
                <code class="cell-host">{{ row.host }}</code>
              </template>
            </el-table-column>
            <el-table-column label="Status" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="CPU %" width="150">
              <template #default="{ row }">
                <div class="cell-progress" v-if="row.currentMetrics">
                  <el-progress
                    :percentage="Math.round(row.currentMetrics.cpuPercent)"
                    :color="getMetricColor(row.currentMetrics.cpuPercent, 'cpu')"
                    :stroke-width="6"
                    :show-text="true"
                  />
                </div>
                <span v-else class="cell-na">N/A</span>
              </template>
            </el-table-column>
            <el-table-column label="RAM %" width="150">
              <template #default="{ row }">
                <div class="cell-progress" v-if="row.currentMetrics">
                  <el-progress
                    :percentage="Math.round(row.currentMetrics.ramPercent)"
                    :color="getMetricColor(row.currentMetrics.ramPercent, 'ram')"
                    :stroke-width="6"
                    :show-text="true"
                  />
                </div>
                <span v-else class="cell-na">N/A</span>
              </template>
            </el-table-column>
            <el-table-column label="Disk %" width="150">
              <template #default="{ row }">
                <div class="cell-progress" v-if="row.currentMetrics">
                  <el-progress
                    :percentage="Math.round(row.currentMetrics.diskPercent)"
                    :color="getMetricColor(row.currentMetrics.diskPercent, 'disk')"
                    :stroke-width="6"
                    :show-text="true"
                  />
                </div>
                <span v-else class="cell-na">N/A</span>
              </template>
            </el-table-column>
            <el-table-column label="Last Seen" min-width="130">
              <template #default="{ row }">
                <span class="cell-time">{{ formatTime(row.lastDataSent) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="90" align="center" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="goToServer(row._id)"
                >
                  View
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- Empty State for Table -->
          <div v-else class="empty-state">
            <el-empty :image-size="100" description=" ">
              <template #image>
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-placeholder); opacity: 0.4;">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </template>
              <template #default>
                <div class="empty-content">
                  <h3 class="empty-title">{{ searchQuery || statusFilter ? 'No matching servers' : 'No servers registered' }}</h3>
                  <p class="empty-desc">{{ searchQuery || statusFilter ? 'Try adjusting your search or filter criteria' : 'Add a server to start monitoring your infrastructure' }}</p>
                </div>
              </template>
            </el-empty>
          </div>
        </el-card>
      </template>

      <!-- Card View -->
      <template v-else>
        <div v-if="filteredServers.length > 0" class="card-grid">
          <div
            v-for="server in filteredServers"
            :key="server._id"
            class="server-card-item"
            @click="goToServer(server._id)"
          >
            <el-card shadow="never" class="server-card-el">
              <div class="card-body">
                <div class="card-top">
                  <div class="card-avatar" :class="'avatar-' + server.status.toLowerCase()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <div class="card-info">
                    <div class="card-name">{{ server.name }}</div>
                    <div class="card-host">{{ server.host }}</div>
                  </div>
                  <el-tag :type="statusTagType(server.status)" size="small" effect="dark" class="card-status-tag">
                    {{ server.status }}
                  </el-tag>
                </div>

                <div class="card-metrics" v-if="server.currentMetrics">
                  <div class="card-metric-row">
                    <span class="metric-label">CPU</span>
                    <el-progress
                      :percentage="Math.round(server.currentMetrics.cpuPercent)"
                      :color="getMetricColor(server.currentMetrics.cpuPercent, 'cpu')"
                      :stroke-width="5"
                      :show-text="true"
                    />
                  </div>
                  <div class="card-metric-row">
                    <span class="metric-label">RAM</span>
                    <el-progress
                      :percentage="Math.round(server.currentMetrics.ramPercent)"
                      :color="getMetricColor(server.currentMetrics.ramPercent, 'ram')"
                      :stroke-width="5"
                      :show-text="true"
                    />
                  </div>
                  <div class="card-metric-row">
                    <span class="metric-label">Disk</span>
                    <el-progress
                      :percentage="Math.round(server.currentMetrics.diskPercent)"
                      :color="getMetricColor(server.currentMetrics.diskPercent, 'disk')"
                      :stroke-width="5"
                      :show-text="true"
                    />
                  </div>
                </div>
                <div v-else class="card-metrics-na">
                  <span>No metrics available</span>
                </div>

                <div class="card-footer">
                  <span class="card-time">{{ formatTime(server.lastDataSent) }}</span>
                </div>
              </div>
            </el-card>
          </div>
        </div>

        <!-- Empty State for Cards -->
        <div v-else class="empty-state">
          <el-empty :image-size="100" description=" ">
            <template #image>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-placeholder); opacity: 0.4;">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </template>
            <template #default>
              <div class="empty-content">
                <h3 class="empty-title">{{ searchQuery || statusFilter ? 'No matching servers' : 'No servers registered' }}</h3>
                <p class="empty-desc">{{ searchQuery || statusFilter ? 'Try adjusting your search or filter criteria' : 'Add a server to start monitoring your infrastructure' }}</p>
              </div>
            </template>
          </el-empty>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import api from '../services/api'

const router = useRouter()
const servers = ref([])
const searchQuery = ref('')
const statusFilter = ref('')
const viewMode = ref('table') // 'table' | 'cards'
const loading = ref(true)
const error = ref('')
let refreshInterval = null

const filteredServers = computed(() => {
  let result = servers.value

  // Apply status filter
  if (statusFilter.value) {
    result = result.filter(s => s.status === statusFilter.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.host && s.host.toLowerCase().includes(q))
    )
  }

  return result
})

function statusTagType(status) {
  const map = { Ok: 'success', Warning: 'warning', Critical: 'danger', Down: 'info' }
  return map[status] || 'info'
}

function getMetricColor(value, type) {
  if (value == null) return '#909399'
  const thresholds = { cpu: { warn: 70, crit: 90 }, ram: { warn: 70, crit: 90 }, disk: { warn: 75, crit: 90 } }
  const t = thresholds[type]
  if (value >= t.crit) return '#F56C6C'
  if (value >= t.warn) return '#E6A23C'
  return '#67C23A'
}

function formatTime(dateStr) {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function toggleView() {
  viewMode.value = viewMode.value === 'table' ? 'cards' : 'table'
}

function goToServer(id) {
  router.push(`/server/${id}`)
}

const fetchServers = async () => {
  try {
    const response = await api.getServers()
    servers.value = response.data
    error.value = ''
  } catch (err) {
    error.value = 'Unable to connect to the server. Please check if the backend is running.'
    console.error('Error fetching servers:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchServers()
  refreshInterval = setInterval(fetchServers, 10000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.servers-page {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.page-alert {
  margin-bottom: var(--space-md);
}

/* ===== Page Header ===== */
.page-header {
  margin-bottom: var(--space-lg);
}

.page-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.3px;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 400;
}

/* ===== Loading ===== */
.skeleton-section {
  margin-top: var(--space-md);
}

.skeleton-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: var(--space-md);
}

.skeleton-row {
  height: 48px;
  border-radius: var(--radius-md);
}

/* ===== Toolbar ===== */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
}

.toolbar-right {
  flex-shrink: 0;
}

.search-input {
  width: 280px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  box-shadow: none !important;
}

.search-input :deep(.el-input__wrapper:hover) {
  border-color: var(--color-accent);
}

.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-glow) !important;
}

.view-toggle-btn {
  border: 1px solid var(--border-base) !important;
  color: var(--text-regular) !important;
  background: var(--bg-card) !important;
}

.view-toggle-btn:hover {
  border-color: var(--color-accent) !important;
  color: var(--color-accent) !important;
}

/* ===== Table Card ===== */
.table-card {
  overflow: hidden;
}

.table-card :deep(.el-card__body) {
  padding: 0 !important;
}

.cell-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-ok { background: var(--color-ok-light); color: var(--color-ok); }
.avatar-warning { background: var(--color-warning-light); color: var(--color-warning); }
.avatar-critical { background: var(--color-critical-light); color: var(--color-critical); }
.avatar-down { background: var(--color-down-light); color: var(--color-down); }

.cell-name-text {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.cell-host {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-regular);
  background: var(--border-extra-light);
  padding: 2px 6px;
  border-radius: 3px;
}

.cell-progress {
  min-width: 80px;
}

.cell-na {
  color: var(--text-placeholder);
  font-size: 12px;
  font-weight: 500;
}

.cell-time {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ===== Card View ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.server-card-item {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.server-card-item:hover {
  transform: translateY(-2px);
}

.server-card-el {
  transition: var(--transition-normal);
}

.server-card-el:hover {
  box-shadow: var(--shadow-lg) !important;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-host {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  margin-top: 1px;
}

.card-status-tag {
  flex-shrink: 0;
}

.card-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-metric-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-metric-row .metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  width: 36px;
  flex-shrink: 0;
}

.card-metric-row :deep(.el-progress) {
  flex: 1;
}

.card-metrics-na {
  padding: 12px 0;
  text-align: center;
  color: var(--text-placeholder);
  font-size: 12px;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--border-extra-light);
  padding-top: 8px;
}

.card-time {
  font-size: 11px;
  color: var(--text-placeholder);
}

/* ===== Empty State ===== */
.empty-state {
  padding: var(--space-2xl) 0;
}

.empty-content {
  text-align: center;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-regular);
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-left {
    flex-direction: column;
  }
  .search-input {
    width: 100%;
  }
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
