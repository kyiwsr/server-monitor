<template>
  <el-card shadow="never" class="alert-panel">
    <div class="panel-header">
      <div class="panel-header-left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span class="panel-title">Recent Alerts</span>
        <el-tag size="small" :type="alertCount > 0 ? 'danger' : 'success'" effect="plain">
          {{ alertCount }}
        </el-tag>
      </div>
      <el-tooltip content="Alerts are servers with Warning or Critical status" placement="top">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="info-icon">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </el-tooltip>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="alert-loading">
      <div v-for="n in 3" :key="n" class="alert-skeleton-row">
        <el-skeleton-item variant="text" style="width: 60%; height: 14px;" />
        <el-skeleton-item variant="text" style="width: 30%; height: 12px; margin-top: 6px;" />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="alerts.length === 0" class="alert-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <div class="alert-empty-text">All systems operational</div>
      <div class="alert-empty-sub">No warnings or critical alerts</div>
    </div>

    <!-- Alert List -->
    <div v-else class="alert-list">
      <div
        v-for="alert in alerts"
        :key="alert.serverId"
        class="alert-item"
        :class="`alert-${alert.severity.toLowerCase()}`"
      >
        <div class="alert-severity-bar"></div>
        <div class="alert-content">
          <div class="alert-top">
            <span class="alert-server-name">{{ alert.serverName }}</span>
            <el-tag :type="alert.severity === 'Critical' ? 'danger' : 'warning'" size="small" effect="dark">
              {{ alert.severity }}
            </el-tag>
          </div>
          <div class="alert-metrics">
            <span class="alert-metric" v-for="m in alert.breachedMetrics" :key="m.key">
              <span class="alert-metric-label">{{ m.label }}</span>
              <span class="alert-metric-value" :style="{ color: m.color }">{{ m.value }}%</span>
            </span>
          </div>
          <div class="alert-footer">
            <span class="alert-host">{{ alert.host }}</span>
            <span class="alert-sep">·</span>
            <span class="alert-time">{{ alert.timeAgo }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  servers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const THRESHOLDS_DEFAULT = {
  cpuWarn: 70, cpuCrit: 90,
  ramWarn: 70, ramCrit: 90,
  diskWarn: 75, diskCrit: 90,
}

const alerts = computed(() => {
  return props.servers
    .filter(s => s.status === 'Warning' || s.status === 'Critical')
    .map(s => {
      const metrics = s.currentMetrics || {}
      const thresholds = s.thresholds || THRESHOLDS_DEFAULT
      const breachedMetrics = []

      // Check thresholds
      const checks = [
        { key: 'cpu', label: 'CPU', value: metrics.cpuPercent, warn: thresholds.cpuWarn, crit: thresholds.cpuCrit },
        { key: 'ram', label: 'RAM', value: metrics.ramPercent, warn: thresholds.ramWarn, crit: thresholds.ramCrit },
        { key: 'disk', label: 'Disk', value: metrics.diskPercent, warn: thresholds.diskWarn, crit: thresholds.diskCrit },
      ]

      for (const check of checks) {
        if (check.value == null) continue
        if (check.value >= check.crit) {
          breachedMetrics.push({
            key: check.key,
            label: check.label,
            value: check.value,
            color: '#F56C6C',
          })
        } else if (check.value >= check.warn) {
          breachedMetrics.push({
            key: check.key,
            label: check.label,
            value: check.value,
            color: '#E6A23C',
          })
        }
      }

      return {
        serverId: s._id,
        serverName: s.name,
        host: s.host,
        severity: s.status,
        breachedMetrics: breachedMetrics.length > 0 ? breachedMetrics : [{ key: 'status', label: 'Status', value: s.status === 'Critical' ? 100 : 80, color: s.status === 'Critical' ? '#F56C6C' : '#E6A23C' }],
        timeAgo: timeAgo(s.lastDataSent),
      }
    })
    .sort((a, b) => {
      const severityOrder = { Critical: 0, Warning: 1 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
})

const alertCount = computed(() => alerts.value.length)

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ago`
}
</script>

<style scoped>
.alert-panel {
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-extra-light);
}

.panel-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-regular);
}

.panel-header-left svg {
  color: var(--color-critical);
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.info-icon {
  color: var(--text-placeholder);
  cursor: help;
  flex-shrink: 0;
}

/* Loading */
.alert-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alert-skeleton-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Empty */
.alert-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  color: var(--text-secondary);
}

.alert-empty svg {
  color: var(--color-ok);
  margin-bottom: 12px;
  opacity: 0.6;
}

.alert-empty-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-regular);
  margin-bottom: 4px;
}

.alert-empty-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Alert List */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-page);
  transition: var(--transition-fast);
}

.alert-item:hover {
  background: var(--border-extra-light);
}

.alert-severity-bar {
  width: 3px;
  flex-shrink: 0;
}

.alert-critical .alert-severity-bar {
  background: var(--color-critical);
}

.alert-warning .alert-severity-bar {
  background: var(--color-warning);
}

.alert-content {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.alert-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.alert-server-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-metrics {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.alert-metric {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.alert-metric-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.alert-metric-value {
  font-weight: 700;
}

.alert-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-placeholder);
}

.alert-host {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

.alert-sep {
  color: var(--border-base);
}

.alert-time {
  color: var(--text-placeholder);
}
</style>
