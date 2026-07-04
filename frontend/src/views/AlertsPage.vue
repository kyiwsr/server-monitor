<template>
  <div class="alerts-page">
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="true"
      @close="error = ''"
      class="page-alert"
    />

    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Alerts</h1>
        <p class="page-subtitle">System alert history</p>
      </div>
    </div>

    <template v-if="loading">
      <div class="skeleton-section">
        <el-skeleton :rows="1" animated />
        <div class="skeleton-stats">
          <el-skeleton-item variant="card" class="skeleton-stat" v-for="n in 4" :key="n" />
        </div>
        <div class="skeleton-table">
          <el-skeleton-item variant="card" class="skeleton-row" v-for="n in 6" :key="n" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="stats-grid">
        <el-card shadow="never" class="stat-card">
          <div class="stat-body">
            <div class="stat-icon stat-icon-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ summary.total }}</div>
              <div class="stat-label">Total Alerts</div>
            </div>
          </div>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <div class="stat-body">
            <div class="stat-icon stat-icon-critical">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-critical)">{{ summary.criticalCount }}</div>
              <div class="stat-label">Critical</div>
            </div>
          </div>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <div class="stat-body">
            <div class="stat-icon stat-icon-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-warning)">{{ summary.warningCount }}</div>
              <div class="stat-label">Warning</div>
            </div>
          </div>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <div class="stat-body">
            <div class="stat-icon stat-icon-resolved">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: var(--color-ok)">{{ summary.resolvedCount }}</div>
              <div class="stat-label">Resolved</div>
            </div>
          </div>
        </el-card>
      </div>

      <div class="filters-row">
        <div class="filters-left">
          <el-radio-group v-model="severityFilter" size="small" @change="fetchAlerts">
            <el-radio-button label="">All</el-radio-button>
            <el-radio-button label="critical">Critical</el-radio-button>
            <el-radio-button label="warning">Warning</el-radio-button>
          </el-radio-group>
          <el-radio-group v-model="statusFilter" size="small" @change="fetchAlerts" style="margin-left: 8px;">
            <el-radio-button label="">All</el-radio-button>
            <el-radio-button label="active">Active</el-radio-button>
            <el-radio-button label="resolved">Resolved</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filters-right">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="to"
            start-placeholder="Start date"
            end-placeholder="End date"
            size="small"
            class="date-picker"
            @change="fetchAlerts"
          />
        </div>
      </div>

      <el-card shadow="never" class="table-card">
        <el-table
          v-if="alerts.length > 0"
          :data="paginatedAlerts"
          style="width: 100%"
          size="small"
          stripe
          :row-class-name="rowClassName"
        >
          <el-table-column label="Time" min-width="150">
            <template #default="{ row }">
              <el-tooltip :content="formatTimestamp(row.triggerAt)" placement="top" :show-after="300">
                <span class="cell-time">{{ timeAgo(row.triggerAt) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="Server" min-width="140">
            <template #default="{ row }">
              <span class="cell-server-name">{{ row.serverName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Type" width="80" align="center">
            <template #default="{ row }">
              <span class="cell-metric">{{ row.type?.toUpperCase() }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Summary" min-width="220">
            <template #default="{ row }">
              <span class="cell-summary">{{ row.summary }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Severity" width="100" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.severity === 'Critical' ? 'danger' : 'warning'"
                size="small"
                effect="dark"
              >
                {{ row.severity }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Status" width="90" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.status === 'resolved' ? 'success' : 'danger'"
                size="small"
                effect="plain"
              >
                {{ row.status === 'resolved' ? 'Resolved' : 'Active' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="90" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'active' && authStore.isAdmin"
                type="success"
                size="small"
                link
                @click="handleResolve(row._id)"
              >
                Resolve
              </el-button>
              <span v-else-if="row.status !== 'active'" class="cell-resolved-time">{{ timeAgo(row.resolvedAt) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="empty-state">
          <el-empty :image-size="100" description=" ">
            <template #image>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-placeholder); opacity: 0.4;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </template>
            <template #default>
              <div class="empty-content">
                <h3 class="empty-title">No alerts found</h3>
                <p class="empty-desc">All systems are operating within normal thresholds</p>
              </div>
            </template>
          </el-empty>
        </div>

        <div class="pagination-wrap" v-if="alerts.length > 0">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :total="alerts.length"
            layout="total, sizes, prev, pager, next"
            background
            small
          />
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { timeAgo as formatTimeAgo } from '../utils/time'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const alerts = ref([])
const loading = ref(true)
const error = ref('')
const severityFilter = ref('')
const statusFilter = ref('')
const dateRange = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)

// Derive the summary cards from the alerts currently loaded/filtered so the
// numbers always agree with what the table shows (rather than mixing all-time
// backend totals with a client-filtered table).
const summary = computed(() => {
  const list = alerts.value
  return {
    total: list.length,
    criticalCount: list.filter(a => a.severity === 'Critical').length,
    warningCount: list.filter(a => a.severity === 'Warning').length,
    resolvedCount: list.filter(a => a.status === 'resolved').length,
  }
})

const paginatedAlerts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return alerts.value.slice(start, end)
})

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function timeAgo(dateStr) {
  return formatTimeAgo(dateStr, { justNow: false, includeDays: true })
}

function rowClassName({ row }) {
  if (row.status === 'resolved') return 'alert-row alert-row-resolved'
  return row.severity === 'Critical'
    ? 'alert-row alert-row-critical'
    : 'alert-row alert-row-warning'
}

async function handleResolve(alertId) {
  try {
    await api.resolveAlert(alertId)
    await fetchAlerts()
  } catch (err) {
    error.value = 'Failed to resolve alert'
    console.error('Error resolving alert:', err)
    setTimeout(() => { error.value = '' }, 3000)
  }
}

const fetchAlerts = async () => {
  try {
    loading.value = true
    const params = { limit: 500 }
    if (severityFilter.value) params.severity = severityFilter.value
    if (statusFilter.value) params.status = statusFilter.value

    const response = await api.getAlerts(params)
    const data = response.data

    let filtered = data.alerts || []

    if (dateRange.value && dateRange.value.length === 2) {
      const start = new Date(dateRange.value[0]).getTime()
      const end = new Date(dateRange.value[1]).getTime()
      filtered = filtered.filter(a => {
        const t = new Date(a.triggerAt).getTime()
        return t >= start && t <= end
      })
    }

    alerts.value = filtered
    currentPage.value = 1
    error.value = ''
  } catch (err) {
    error.value = 'Unable to fetch alerts. Please check if the backend is running.'
    console.error('Error fetching alerts:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAlerts()
})
</script>

<style scoped>
.alerts-page {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.page-alert {
  margin-bottom: var(--space-md);
}

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

.skeleton-section {
  margin-top: var(--space-md);
}

.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: var(--space-md);
}

.skeleton-stat {
  height: 80px;
  border-radius: var(--radius-md);
}

.skeleton-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: var(--space-md);
}

.skeleton-row {
  height: 44px;
  border-radius: var(--radius-md);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: var(--space-md);
}

.stat-card {
  transition: var(--transition-fast);
}

.stat-card:hover {
  box-shadow: var(--shadow-md) !important;
  transform: translateY(-1px);
}

.stat-body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-all { background: var(--color-accent-light); color: var(--color-accent); }
.stat-icon-critical { background: var(--color-critical-light); color: var(--color-critical); }
.stat-icon-warning { background: var(--color-warning-light); color: var(--color-warning); }
.stat-icon-resolved { background: var(--color-ok-light); color: var(--color-ok); }

.stat-info { min-width: 0; }

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.filters-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.filters-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-picker {
  width: 320px;
}

.table-card {
  overflow: hidden;
}

.table-card :deep(.el-card__body) {
  padding: 0 !important;
}

/* Severity left-border on each alert row */
.table-card :deep(.alert-row td.el-table__cell:first-child) {
  border-left: 3px solid transparent;
}
.table-card :deep(.alert-row-critical td.el-table__cell:first-child) {
  border-left-color: var(--color-critical);
}
.table-card :deep(.alert-row-warning td.el-table__cell:first-child) {
  border-left-color: var(--color-warning);
}
.table-card :deep(.alert-row-resolved td.el-table__cell:first-child) {
  border-left-color: var(--color-down);
}
/* Resolved alerts are muted */
.table-card :deep(.alert-row-resolved) {
  opacity: 0.55;
}
.table-card :deep(.alert-row-resolved:hover) {
  opacity: 0.8;
}

.cell-time {
  font-size: 12px;
  color: var(--text-regular);
  white-space: nowrap;
  cursor: default;
}

.cell-server-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.cell-metric {
  font-weight: 600;
  font-size: 11px;
  color: var(--text-primary);
  background: var(--border-extra-light);
  padding: 2px 8px;
  border-radius: 4px;
}

.cell-summary {
  font-size: 12px;
  color: var(--text-regular);
  line-height: 1.4;
}

.cell-resolved-time {
  font-size: 11px;
  color: var(--text-placeholder);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-md);
  border-top: 1px solid var(--border-extra-light);
}

.empty-state {
  padding: var(--space-3xl) 0;
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

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .date-picker {
    width: 100%;
  }
  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .stat-value {
    font-size: 20px;
  }
}
</style>
