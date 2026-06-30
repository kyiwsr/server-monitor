<template>
  <div class="detail">
    <!-- Error State -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="true"
      @close="error = ''"
      class="detail-alert"
    />

    <!-- Back Navigation -->
    <button class="back-btn" @click="goBack">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      <span>Back to Dashboard</span>
    </button>

    <!-- Loading State -->
    <template v-if="loading">
      <div class="detail-skeleton">
        <el-skeleton-item variant="card" class="skeleton-header" />
        <div class="skeleton-metrics">
          <el-skeleton-item variant="card" class="skeleton-metric" v-for="n in 4" :key="n" />
        </div>
        <el-skeleton-item variant="card" class="skeleton-chart" />
      </div>
    </template>

    <!-- Server Content -->
    <template v-else-if="server">
      <!-- Server Header -->
      <el-card shadow="never" class="server-header">
        <div class="header-body">
          <div class="header-avatar" :class="'avatar-' + server.status.toLowerCase()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="header-info">
            <div class="header-name-row">
              <h1 class="header-name">{{ server.name }}</h1>
              <el-tag :type="tagType" size="small" effect="dark">
                {{ server.status }}
              </el-tag>
            </div>
            <div class="header-meta">
              <span class="header-host">{{ server.host }}</span>
              <span class="header-sep">·</span>
              <span class="header-time">Last seen {{ timeAgo(server.lastDataSent) }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- Metrics Cards - Enhanced -->
      <div class="metrics-grid">
        <el-card shadow="never" class="metric-card" v-for="m in metricCards" :key="m.key">
          <div class="metric-body">
            <div class="metric-top">
              <div class="metric-top-left">
                <div class="metric-icon-wrapper" :style="{ background: m.bgColor, color: m.color }">
                  <span class="metric-icon" v-html="m.icon"></span>
                </div>
                <span class="metric-label">{{ m.label }}</span>
              </div>
              <span class="metric-status-pill" :style="{ background: m.bgColor, color: m.color }">{{ m.statusLabel }}</span>
            </div>
            <div class="metric-value" :style="{ color: m.color }">
              {{ m.value }}<span class="metric-unit">{{ m.unit }}</span>
            </div>
            <el-progress
              :percentage="m.percent"
              :color="m.color"
              :show-text="false"
              :stroke-width="5"
            />
            <!-- Trend indicator -->
            <div class="metric-trend" v-if="m.trend !== 0">
              <span :class="m.trend > 0 ? 'trend-up' : 'trend-down'">
                {{ m.trend > 0 ? '↑' : '↓' }} {{ Math.abs(m.trend) }}%
              </span>
              <span class="trend-label">vs previous</span>
            </div>
          </div>
          <div class="metric-glow" :style="{ background: `linear-gradient(135deg, transparent 0%, ${m.color}15 100%)` }"></div>
        </el-card>

        <!-- Uptime Card -->
        <el-card shadow="never" class="metric-card">
          <div class="metric-body">
            <div class="metric-top">
              <div class="metric-icon-wrapper uptime-icon-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <span class="metric-label">Uptime</span>
            </div>
            <div class="metric-value uptime-value">
              {{ formatUptime(currentMetrics?.uptime || 0) }}
            </div>
            <div class="metric-sub-label">Since last restart</div>
          </div>
        </el-card>
      </div>

      <!-- Server Info -->
      <ServerInfo :server="server" />

      <!-- Combined Chart -->
      <el-card shadow="never" class="chart-card">
        <div class="chart-header">
          <div class="chart-header-left">
            <h2 class="chart-title">Metrics Overview</h2>
            <div class="chart-legend">
              <span class="legend-item">
                <span class="legend-dot" style="background: #0ea5e9"></span> CPU
              </span>
              <span class="legend-item">
                <span class="legend-dot" style="background: #10b981"></span> RAM
              </span>
              <span class="legend-item">
                <span class="legend-dot" style="background: #f59e0b"></span> Disk
              </span>
            </div>
          </div>
          <div class="chart-controls">
            <el-radio-group v-model="timeRange" @change="fetchMetrics" size="small">
              <el-radio-button label="1h">1H</el-radio-button>
              <el-radio-button label="6h">6H</el-radio-button>
              <el-radio-button label="24h">24H</el-radio-button>
              <el-radio-button label="48h">48H</el-radio-button>
              <el-radio-button label="7d">7D</el-radio-button>
              <el-radio-button label="30d">30D</el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="exportCsv" :disabled="metricsHistory.length === 0" class="export-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </el-button>
          </div>
        </div>
        <div class="chart-wrapper" v-if="metricsHistory.length > 0">
          <Line :key="'combined-' + chartKey" :data="combinedChartData" :options="combinedChartOptions" :plugins="combinedThresholdPlugins" />
        </div>
        <div class="chart-empty" v-else>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span>No historical data for this time range</span>
        </div>
      </el-card>

      <!-- Individual Mini Charts -->
      <div class="mini-charts">
        <el-card shadow="never" class="mini-chart-card">
          <div class="mini-chart-header">
            <span class="mini-chart-dot" style="background: #0ea5e9"></span>
            <span class="mini-chart-title">CPU Usage</span>
          </div>
          <div class="mini-chart-body" v-if="metricsHistory.length > 0">
            <Line :key="'cpu-' + chartKey" :data="cpuChartData" :options="miniChartOptions" :plugins="[thresholdPlugin(thresholds.cpuWarn, thresholds.cpuCrit)]" />
          </div>
          <div class="mini-chart-empty" v-else>
            <span>No data</span>
          </div>
        </el-card>
        <el-card shadow="never" class="mini-chart-card">
          <div class="mini-chart-header">
            <span class="mini-chart-dot" style="background: #10b981"></span>
            <span class="mini-chart-title">RAM Usage</span>
          </div>
          <div class="mini-chart-body" v-if="metricsHistory.length > 0">
            <Line :key="'ram-' + chartKey" :data="ramChartData" :options="miniChartOptions" :plugins="[thresholdPlugin(thresholds.ramWarn, thresholds.ramCrit)]" />
          </div>
          <div class="mini-chart-empty" v-else>
            <span>No data</span>
          </div>
        </el-card>
        <el-card shadow="never" class="mini-chart-card">
          <div class="mini-chart-header">
            <span class="mini-chart-dot" style="background: #f59e0b"></span>
            <span class="mini-chart-title">Disk Usage</span>
          </div>
          <div class="mini-chart-body" v-if="metricsHistory.length > 0">
            <Line :key="'disk-' + chartKey" :data="diskChartData" :options="miniChartOptions" :plugins="[thresholdPlugin(thresholds.diskWarn, thresholds.diskCrit)]" />
          </div>
          <div class="mini-chart-empty" v-else>
            <span>No data</span>
          </div>
        </el-card>
      </div>

      <!-- Alert History Section -->
      <el-card shadow="never" class="alert-history-card" v-if="alertHistory.length > 0">
        <div class="alert-history-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h2 class="alert-history-title">Alert History</h2>
          <el-tag size="small" type="danger" effect="plain">{{ alertHistory.length }}</el-tag>
        </div>
        <el-table :data="alertHistory" style="width: 100%" size="small" stripe>
          <el-table-column label="Time" min-width="100">
            <template #default="{ row }">
              <span class="alert-time-cell">{{ row.time }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Metric" min-width="80">
            <template #default="{ row }">
              <span class="alert-metric-cell">{{ row.metric }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Value" min-width="70" align="right">
            <template #default="{ row }">
              <span class="alert-value-cell" :style="{ color: row.color }">{{ row.value }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="Threshold" min-width="80" align="right">
            <template #default="{ row }">
              <span class="alert-threshold-cell">{{ row.threshold }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="Severity" min-width="80">
            <template #default="{ row }">
              <el-tag :type="row.severity === 'Critical' ? 'danger' : 'warning'" size="small" effect="dark">
                {{ row.severity }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import api from '../services/api'
import ServerInfo from '../components/ServerInfo.vue'
import { timeAgo } from '../utils/time'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const route = useRoute()
const router = useRouter()
const serverId = route.params.id

const server = ref(null)
const currentMetrics = ref(null)
const metricsHistory = ref([])
const timeRange = ref('1h')
const chartKey = ref(0)
const loading = ref(true)
const error = ref('')
let refreshInterval = null

const THRESHOLDS = {
  cpuWarn: 70, cpuCrit: 90,
  ramWarn: 70, ramCrit: 90,
  diskWarn: 75, diskCrit: 90,
}

// Use the server's own configured thresholds when available, fall back to defaults
const thresholds = computed(() => {
  const t = server.value?.thresholds || {}
  return {
    cpuWarn: t.cpuWarn ?? THRESHOLDS.cpuWarn,
    cpuCrit: t.cpuCrit ?? THRESHOLDS.cpuCrit,
    ramWarn: t.ramWarn ?? THRESHOLDS.ramWarn,
    ramCrit: t.ramCrit ?? THRESHOLDS.ramCrit,
    diskWarn: t.diskWarn ?? THRESHOLDS.diskWarn,
    diskCrit: t.diskCrit ?? THRESHOLDS.diskCrit,
  }
})

// Draws horizontal dashed warning/critical reference lines on a chart
function thresholdPlugin(warn, crit) {
  return {
    id: `thr-${warn}-${crit}`,
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart
      const yScale = scales.y
      if (!yScale || !chartArea) return
      const lines = [
        { value: warn, color: '#E6A23C', label: `Warning ${warn}%` },
        { value: crit, color: '#F56C6C', label: `Critical ${crit}%` },
      ]
      lines.forEach(({ value, color, label }) => {
        const y = yScale.getPixelForValue(value)
        if (y < chartArea.top || y > chartArea.bottom) return
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([5, 4])
        ctx.lineWidth = 1.25
        ctx.strokeStyle = color
        ctx.moveTo(chartArea.left, y)
        ctx.lineTo(chartArea.right, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = '600 9px "Plus Jakarta Sans", sans-serif'
        ctx.fillStyle = color
        ctx.textBaseline = 'bottom'
        ctx.fillText(label, chartArea.left + 4, y - 2)
        ctx.restore()
      })
    },
  }
}

const combinedThresholdPlugins = computed(() => [
  thresholdPlugin(thresholds.value.cpuWarn, thresholds.value.cpuCrit),
])

// Line-SVG icons for the metric cards (kept consistent with the rest of the app)
const ICONS = {
  cpu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
  ram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/><line x1="7" y1="10" x2="7" y2="14"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="17" y1="10" x2="17" y2="14"/></svg>',
  disk: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>',
}

// Track previous metrics for trend
const prevMetrics = ref(null)

const tagType = computed(() => {
  const map = { Ok: 'success', Warning: 'warning', Critical: 'danger', Down: 'info' }
  return map[server.value?.status] || 'info'
})

const metricCards = computed(() => {
  const m = currentMetrics.value
  if (!m) return []
  const prev = prevMetrics.value || {}
  return [
    {
      key: 'cpu', icon: ICONS.cpu, label: 'CPU Usage',
      value: m.cpuPercent ?? '--', unit: '%',
      percent: m.cpuPercent ?? 0,
      color: getThresholdColor(m.cpuPercent, 'cpu'),
      bgColor: getThresholdBg(m.cpuPercent, 'cpu'),
      statusLabel: getStatusLabel(m.cpuPercent, 'cpu'),
      trend: getTrend(m.cpuPercent, prev.cpuPercent),
    },
    {
      key: 'ram', icon: ICONS.ram, label: 'RAM Usage',
      value: m.ramPercent ?? '--', unit: '%',
      percent: m.ramPercent ?? 0,
      color: getThresholdColor(m.ramPercent, 'ram'),
      bgColor: getThresholdBg(m.ramPercent, 'ram'),
      statusLabel: getStatusLabel(m.ramPercent, 'ram'),
      trend: getTrend(m.ramPercent, prev.ramPercent),
    },
    {
      key: 'disk', icon: ICONS.disk, label: 'Disk Usage',
      value: m.diskPercent ?? '--', unit: '%',
      percent: m.diskPercent ?? 0,
      color: getThresholdColor(m.diskPercent, 'disk'),
      bgColor: getThresholdBg(m.diskPercent, 'disk'),
      statusLabel: getStatusLabel(m.diskPercent, 'disk'),
      trend: getTrend(m.diskPercent, prev.diskPercent),
    },
  ]
})

function getTrend(current, previous) {
  if (current == null || previous == null) return 0
  return Math.round((current - previous) * 10) / 10
}

function getThresholdColor(value, type) {
  if (value == null) return '#909399'
  const warn = thresholds.value[`${type}Warn`]
  const crit = thresholds.value[`${type}Crit`]
  if (value >= crit) return '#F56C6C'
  if (value >= warn) return '#E6A23C'
  return '#67C23A'
}

function getThresholdBg(value, type) {
  if (value == null) return '#f4f4f5'
  const warn = thresholds.value[`${type}Warn`]
  const crit = thresholds.value[`${type}Crit`]
  if (value >= crit) return '#fef0f0'
  if (value >= warn) return '#fdf6ec'
  return '#f0f9eb'
}

function getStatusLabel(value, type) {
  if (value == null) return 'No data'
  const warn = thresholds.value[`${type}Warn`]
  const crit = thresholds.value[`${type}Crit`]
  if (value >= crit) return 'Critical'
  if (value >= warn) return 'Warning'
  return 'Normal'
}

// Alert History derived from metrics
const alertHistory = computed(() => {
  const history = metricsHistory.value
  if (!history || history.length === 0) return []

  const alerts = []
  const t = thresholds.value

  for (const point of history) {
    const checks = [
      { metric: 'CPU', value: point.cpuPercent, warn: t.cpuWarn, crit: t.cpuCrit },
      { metric: 'RAM', value: point.ramPercent, warn: t.ramWarn, crit: t.ramCrit },
      { metric: 'Disk', value: point.diskPercent, warn: t.diskWarn, crit: t.diskCrit },
    ]

    for (const check of checks) {
      if (check.value == null) continue
      let severity = null
      if (check.value >= check.crit) severity = 'Critical'
      else if (check.value >= check.warn) severity = 'Warning'

      if (severity) {
        const time = new Date(point.timestamp).toLocaleString()
        alerts.push({
          time,
          metric: check.metric,
          value: check.value,
          threshold: severity === 'Critical' ? check.crit : check.warn,
          severity,
          color: severity === 'Critical' ? '#F56C6C' : '#E6A23C',
        })
      }
    }
  }

  // Return last 50 alerts, sorted by time descending
  return alerts
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 50)
})

// Chart Options
const combinedChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#303133',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 12,
      cornerRadius: 8,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 10, color: '#909399', font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      max: 100,
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { color: '#909399', font: { size: 11 }, callback: (v) => v + '%' },
    },
  },
}

const miniChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#303133',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 8,
      cornerRadius: 6,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 5, color: '#909399', font: { size: 10 } },
    },
    y: {
      beginAtZero: true,
      max: 100,
      grid: { color: 'rgba(0,0,0,0.03)' },
      ticks: { color: '#909399', font: { size: 10 }, callback: (v) => v + '%' },
    },
  },
}

// Format an x-axis label appropriately for the selected range:
// multi-day ranges show the date so points aren't ambiguous across days.
function formatChartLabel(ts) {
  const d = new Date(ts)
  if (timeRange.value === '30d') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  if (timeRange.value === '7d') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit' })
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Chart Data
const combinedChartData = computed(() => ({
  labels: metricsHistory.value.map((m) => formatChartLabel(m.timestamp)),
  datasets: [
    {
      label: 'CPU %',
      data: metricsHistory.value.map((m) => m.cpuPercent),
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14, 165, 233, 0.08)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: true,
    },
    {
      label: 'RAM %',
      data: metricsHistory.value.map((m) => m.ramPercent),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: true,
    },
    {
      label: 'Disk %',
      data: metricsHistory.value.map((m) => m.diskPercent),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: true,
    },
  ],
}))

const cpuChartData = computed(() => ({
  labels: metricsHistory.value.map((m) => formatChartLabel(m.timestamp)),
  datasets: [{
    label: 'CPU %',
    data: metricsHistory.value.map((m) => m.cpuPercent),
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
    fill: true,
  }],
}))

const ramChartData = computed(() => ({
  labels: metricsHistory.value.map((m) => formatChartLabel(m.timestamp)),
  datasets: [{
    label: 'RAM %',
    data: metricsHistory.value.map((m) => m.ramPercent),
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
    fill: true,
  }],
}))

const diskChartData = computed(() => ({
  labels: metricsHistory.value.map((m) => formatChartLabel(m.timestamp)),
  datasets: [{
    label: 'Disk %',
    data: metricsHistory.value.map((m) => m.diskPercent),
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
    fill: true,
  }],
}))

watch(metricsHistory, (newData) => {
  if (newData.length > 0) chartKey.value++
}, { deep: true })

const fetchServerInfo = async () => {
  try {
    const response = await api.getServer(serverId)
    // Store previous metrics before updating
    prevMetrics.value = currentMetrics.value
    server.value = response.data
    currentMetrics.value = response.data.currentMetrics
  } catch (err) {
    if (err.response?.status === 404) {
      error.value = 'Server not found. It may have been removed.'
    } else {
      error.value = 'Unable to fetch server information. Please check the connection.'
    }
    console.error('Error fetching server info:', err)
  }
}

const fetchMetrics = async () => {
  try {
    const response = await api.getServerMetrics(serverId, timeRange.value)
    metricsHistory.value = response.data
  } catch (err) {
    console.error('Error fetching metrics:', err)
  } finally {
    loading.value = false
  }
}

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// Export the currently loaded metrics history as a CSV report (client-side)
function exportCsv() {
  const rows = metricsHistory.value
  if (!rows.length) return

  const header = ['timestamp', 'cpuPercent', 'ramPercent', 'diskPercent', 'uptimeSeconds']
  const lines = [header.join(',')]
  for (const m of rows) {
    lines.push([
      new Date(m.timestamp).toISOString(),
      m.cpuPercent ?? '',
      m.ramPercent ?? '',
      m.diskPercent ?? '',
      m.uptime ?? '',
    ].join(','))
  }

  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = (server.value?.name || 'server').replace(/[^a-z0-9-_]+/gi, '_')
  a.download = `${safeName}_metrics_${timeRange.value}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const goBack = () => {
  router.push('/')
}

onMounted(async () => {
  await Promise.all([fetchServerInfo(), fetchMetrics()])
  refreshInterval = setInterval(() => {
    fetchServerInfo()
    // Long ranges (7d/30d) are aggregated server-side and barely change between
    // ticks — only auto-refresh history for the short, raw ranges. Switching
    // range still fetches once via the radio-group @change handler.
    if (!['7d', '30d'].includes(timeRange.value)) {
      fetchMetrics()
    }
  }, 10000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.detail {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.detail-alert {
  margin-bottom: var(--space-md);
}

/* ===== Back Button ===== */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  color: var(--text-regular);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-fast);
  margin-bottom: var(--space-md);
}

.back-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: var(--color-accent-light);
}

/* ===== Loading ===== */
.detail-skeleton {
  margin-bottom: var(--space-lg);
}

.skeleton-header {
  height: 80px;
  border-radius: var(--radius-md);
  display: block;
  margin-bottom: var(--space-md);
}

.skeleton-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: var(--space-md);
}

.skeleton-metric {
  height: 130px;
  border-radius: var(--radius-md);
}

.skeleton-chart {
  height: 320px;
  border-radius: var(--radius-md);
  display: block;
}

/* ===== Server Header ===== */
.server-header {
  margin-bottom: var(--space-md);
}

.header-body {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.header-avatar {
  width: 48px;
  height: 48px;
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

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.header-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.header-host {
  font-family: var(--font-mono);
}

.header-sep {
  color: var(--border-base);
}

/* ===== Enhanced Metrics Grid ===== */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: var(--space-md);
}

.metric-card {
  transition: var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg) !important;
}

.metric-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.metric-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 120px;
  height: 100%;
  pointer-events: none;
  opacity: 0.5;
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metric-top-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.metric-status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.2px;
  flex-shrink: 0;
  white-space: nowrap;
}

.metric-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.uptime-icon-wrapper {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.metric-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.metric-icon svg {
  display: block;
}

.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-regular);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.metric-value {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.metric-unit {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.6;
  margin-left: 2px;
}

.uptime-value {
  color: var(--color-accent) !important;
  font-size: 18px;
}

.metric-sub-label {
  font-size: 10px;
  color: var(--text-placeholder);
  font-weight: 500;
}

.metric-trend {
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.trend-up {
  color: var(--color-critical);
}

.trend-down {
  color: var(--color-ok);
}

.trend-label {
  font-size: 10px;
  color: var(--text-placeholder);
  font-weight: 400;
}

/* ===== Chart Card ===== */
.chart-card {
  margin-bottom: var(--space-md);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.chart-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.chart-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chart-legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-regular);
  font-weight: 500;
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chart-wrapper {
  height: 300px;
  position: relative;
}

.chart-wrapper :deep(canvas) {
  max-width: 100% !important;
}

.chart-empty {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;
}

.chart-empty svg {
  opacity: 0.3;
}

/* ===== Mini Charts ===== */
.mini-charts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: var(--space-md);
}

.mini-chart-card {
  transition: var(--transition-normal);
}

.mini-chart-card:hover {
  box-shadow: var(--shadow-md) !important;
}

.mini-chart-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.mini-chart-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mini-chart-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.mini-chart-body {
  height: 160px;
  position: relative;
}

.mini-chart-body :deep(canvas) {
  max-width: 100% !important;
  height: 160px !important;
}

.mini-chart-empty {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-placeholder);
  font-size: 12px;
}

/* ===== Alert History ===== */
.alert-history-card {
  margin-bottom: var(--space-lg);
}

.alert-history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-extra-light);
}

.alert-history-header svg {
  color: var(--color-critical);
  flex-shrink: 0;
}

.alert-history-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.alert-time-cell {
  font-size: 12px;
  color: var(--text-regular);
}

.alert-metric-cell {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.alert-value-cell {
  font-size: 12px;
  font-weight: 700;
}

.alert-threshold-cell {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .mini-charts {
    grid-template-columns: 1fr;
  }
  .skeleton-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  .skeleton-metrics {
    grid-template-columns: 1fr;
  }
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .chart-header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .chart-wrapper {
    height: 220px;
  }
  .header-body {
    flex-direction: column;
    align-items: flex-start;
  }
  .header-name-row {
    flex-wrap: wrap;
  }
}
</style>
