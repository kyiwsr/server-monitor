<template>
  <el-card
    shadow="never"
    class="server-card"
    :class="[statusClass, { 'is-clickable': clickable }]"
    @click="handleClick"
    v-loading="loading"
  >
    <div class="card-body">
      <!-- Top Row -->
      <div class="card-top">
        <div class="card-info">
          <div class="card-name-row">
            <span class="card-name">{{ server.name }}</span>
            <el-tag :type="tagType" size="small" effect="dark">
              {{ server.status }}
            </el-tag>
          </div>
          <div class="card-host">{{ server.host }}</div>
        </div>
      </div>

      <!-- Business Function Tags -->
      <div class="card-functions" v-if="hasFunctions">
        <span
          v-for="(fn, idx) in visibleFunctions"
          :key="idx"
          class="function-tag"
          :style="{ background: functionColors[idx % functionColors.length].bg, color: functionColors[idx % functionColors.length].text }"
        >
          {{ fn }}
        </span>
        <el-tooltip
          v-if="extraFunctions.length"
          :content="extraFunctions.join(', ')"
          placement="top"
        >
          <span class="function-tag function-tag-more">+{{ extraFunctions.length }}</span>
        </el-tooltip>
      </div>

      <!-- Metrics -->
      <div class="card-metrics" v-if="hasMetrics">
        <div class="metric-row" v-for="m in metrics" :key="m.key">
          <div class="metric-header">
            <div class="metric-header-left">
              <span class="metric-label">{{ m.label }}</span>
              <span class="metric-trend" :class="m.trendClass" v-if="m.trend !== 0">
                {{ m.trend > 0 ? '↑' : '↓' }}
              </span>
            </div>
            <span class="metric-value" :style="{ color: m.color }">{{ m.value }}%</span>
          </div>
          <el-progress
            :percentage="m.value"
            :color="m.color"
            :show-text="false"
            :stroke-width="5"
          />
        </div>
      </div>

      <!-- No Data State -->
      <div class="card-no-data" v-else>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="8 12 12 16 16 12"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
        </svg>
        <span>No data received</span>
      </div>

      <!-- Footer -->
      <div class="card-footer">
        <span class="card-uptime" v-if="uptimeDisplay">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Up {{ uptimeDisplay }}</span>
        </span>
        <span class="card-uptime card-uptime-muted" v-else>—</span>
        <span class="card-time">{{ timeAgo }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { timeAgo as formatTimeAgo } from '../utils/time'

const props = defineProps({
  server: { type: Object, required: true },
  clickable: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

// For trend tracking – store the *previous* reading so we can compare against
// the latest one. Capture the watcher's old value (not the new value, which
// would always equal the current reading and yield a flat trend of 0).
const prevMetrics = ref({ cpu: null, ram: null, disk: null })

watch(() => props.server.currentMetrics, (newMetrics, oldMetrics) => {
  if (oldMetrics) {
    prevMetrics.value = {
      cpu: oldMetrics.cpuPercent ?? null,
      ram: oldMetrics.ramPercent ?? null,
      disk: oldMetrics.diskPercent ?? null,
    }
  }
})

const THRESHOLDS = {
  cpuWarn: 70, cpuCrit: 90,
  ramWarn: 70, ramCrit: 90,
  diskWarn: 75, diskCrit: 90,
}

const functionColors = [
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#f3e8ff', text: '#7c3aed' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#d1fae5', text: '#059669' },
  { bg: '#fce7f3', text: '#be185d' },
]

const visibleFunctions = computed(() => (props.server.businessFunctions || []).slice(0, 3))
const extraFunctions = computed(() => (props.server.businessFunctions || []).slice(3))

const statusClass = computed(() => {
  const status = props.server.status?.toLowerCase() || 'down'
  return `card-${status}`
})

const tagType = computed(() => {
  const map = { Ok: 'success', Warning: 'warning', Critical: 'danger', Down: 'info' }
  return map[props.server.status] || 'info'
})

const hasFunctions = computed(() => {
  return props.server.businessFunctions && props.server.businessFunctions.length > 0
})

const hasMetrics = computed(() => {
  const m = props.server.currentMetrics
  return m && (m.cpuPercent != null || m.ramPercent != null || m.diskPercent != null)
})

const getTrend = (current, previous) => {
  if (current == null || previous == null) return 0
  if (current > previous) return 1
  if (current < previous) return -1
  return 0
}

const metrics = computed(() => {
  const m = props.server.currentMetrics
  if (!m) return []
  return [
    {
      key: 'cpu', label: 'CPU', value: m.cpuPercent ?? 0,
      color: getColor(m.cpuPercent, 'cpu'),
      trend: getTrend(m.cpuPercent, prevMetrics.value.cpu),
      trendClass: getTrend(m.cpuPercent, prevMetrics.value.cpu) > 0 ? 'trend-up' : 'trend-down',
    },
    {
      key: 'ram', label: 'RAM', value: m.ramPercent ?? 0,
      color: getColor(m.ramPercent, 'ram'),
      trend: getTrend(m.ramPercent, prevMetrics.value.ram),
      trendClass: getTrend(m.ramPercent, prevMetrics.value.ram) > 0 ? 'trend-up' : 'trend-down',
    },
    {
      key: 'disk', label: 'Disk', value: m.diskPercent ?? 0,
      color: getColor(m.diskPercent, 'disk'),
      trend: getTrend(m.diskPercent, prevMetrics.value.disk),
      trendClass: getTrend(m.diskPercent, prevMetrics.value.disk) > 0 ? 'trend-up' : 'trend-down',
    },
  ]
})

function getColor(value, type) {
  if (value == null) return '#909399'
  const key = type
  const warn = THRESHOLDS[`${key}Warn`]
  const crit = THRESHOLDS[`${key}Crit`]
  if (value >= crit) return '#F56C6C'
  if (value >= warn) return '#E6A23C'
  return '#67C23A'
}

const timeAgo = computed(() => formatTimeAgo(props.server.lastDataSent, { emptyText: 'Never' }))

const uptimeDisplay = computed(() => {
  const seconds = props.server.currentMetrics?.uptime
  if (seconds == null) return ''
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
})

const handleClick = () => {
  if (props.clickable) {
    emit('click', props.server._id)
  }
}
</script>

<style scoped>
.server-card {
  cursor: default;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.server-card.is-clickable {
  cursor: pointer;
}

.server-card.is-clickable:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg) !important;
}

/* Status border accents */
.server-card.card-ok { border-left: 4px solid var(--color-ok) !important; }
.server-card.card-warning { border-left: 4px solid var(--color-warning) !important; }
.server-card.card-critical { border-left: 4px solid var(--color-critical) !important; }
.server-card.card-down { border-left: 4px solid var(--color-down) !important; }

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Top Row */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-family: var(--font-mono);
}

/* Business function tags */
.card-functions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: -2px;
}

.function-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 5px;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.function-tag-more {
  background: var(--border-extra-light);
  color: var(--text-secondary);
  cursor: default;
}

/* Metrics */
.card-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-header-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-regular);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.metric-trend {
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.metric-trend.trend-up {
  color: var(--color-critical);
}

.metric-trend.trend-down {
  color: var(--color-ok);
}

.metric-value {
  font-size: 12px;
  font-weight: 700;
}

/* No Data */
.card-no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.card-no-data svg {
  opacity: 0.3;
}

/* Footer */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-extra-light);
}

.card-uptime {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.card-uptime svg {
  color: var(--color-ok);
  flex-shrink: 0;
}

.card-uptime-muted {
  color: var(--text-placeholder);
}

.card-time {
  font-size: 11px;
  color: var(--text-placeholder);
}
</style>
