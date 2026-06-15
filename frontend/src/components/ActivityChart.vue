<template>
  <el-card shadow="never" class="activity-chart-card">
    <div class="chart-header">
      <div class="chart-header-left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span class="chart-title">Activity Overview</span>
      </div>
      <span class="chart-subtitle">Servers reporting each hour over the last 24 hours, grouped by status</span>
    </div>

    <div v-if="loading" class="chart-loading">
      <el-skeleton-item variant="text" style="width: 100%; height: 200px; display: block;" />
    </div>

    <div v-else-if="hasData" class="chart-wrapper">
      <Bar :data="chartData" :options="chartOptions" />
    </div>

    <div v-else class="chart-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <span>No activity data available yet</span>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps({
  servers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const hasData = computed(() => props.servers.length > 0)

// Build hourly activity buckets based on server status
const hourlyActivity = computed(() => {
  const hours = []
  const now = new Date()

  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    const label = hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Count servers that likely had issues in this hour
    // We use the lastDataSent to estimate recent activity
    const activeCount = props.servers.filter(s => {
      if (!s.lastDataSent) return false
      const diff = Math.abs(new Date(s.lastDataSent).getTime() - hour.getTime())
      return diff < 60 * 60 * 1000 // Within the hour window
    }).length

    const warningCount = props.servers.filter(s => {
      if (!s.lastDataSent || s.status !== 'Warning') return false
      const diff = Math.abs(new Date(s.lastDataSent).getTime() - hour.getTime())
      return diff < 60 * 60 * 1000
    }).length

    const criticalCount = props.servers.filter(s => {
      if (!s.lastDataSent || s.status !== 'Critical') return false
      const diff = Math.abs(new Date(s.lastDataSent).getTime() - hour.getTime())
      return diff < 60 * 60 * 1000
    }).length

    hours.push({
      label,
      active: activeCount,
      warnings: warningCount,
      criticals: criticalCount,
    })
  }

  return hours
})

const chartData = computed(() => ({
  labels: hourlyActivity.value.map(h => h.label),
  datasets: [
    {
      label: 'Reporting',
      data: hourlyActivity.value.map(h => h.active),
      backgroundColor: 'rgba(14, 165, 233, 0.55)',
      borderColor: 'rgba(14, 165, 233, 1)',
      borderWidth: 1,
      borderRadius: 3,
      barPercentage: 0.7,
    },
    {
      label: 'Warning',
      data: hourlyActivity.value.map(h => h.warnings),
      backgroundColor: 'rgba(230, 162, 60, 0.6)',
      borderColor: 'rgba(230, 162, 60, 1)',
      borderWidth: 1,
      borderRadius: 3,
      barPercentage: 0.7,
    },
    {
      label: 'Critical',
      data: hourlyActivity.value.map(h => h.criticals),
      backgroundColor: 'rgba(245, 108, 108, 0.6)',
      borderColor: 'rgba(245, 108, 108, 1)',
      borderWidth: 1,
      borderRadius: 3,
      barPercentage: 0.7,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'end',
      labels: {
        usePointStyle: true,
        boxWidth: 8,
        padding: 16,
        font: { size: 11, weight: '500' },
        color: '#606266',
      },
    },
    tooltip: {
      backgroundColor: '#303133',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 12,
      cornerRadius: 8,
      titleFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif" },
      bodyFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif" },
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} server${ctx.parsed.y === 1 ? '' : 's'}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      title: {
        display: true,
        text: 'Time (last 24 hours)',
        color: '#909399',
        font: { size: 10, weight: '600' },
        padding: { top: 6 },
      },
      ticks: {
        maxTicksLimit: 12,
        color: '#909399',
        font: { size: 10 },
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.04)' },
      title: {
        display: true,
        text: 'Servers',
        color: '#909399',
        font: { size: 10, weight: '600' },
      },
      ticks: {
        color: '#909399',
        font: { size: 10 },
        precision: 0,
        stepSize: 1,
      },
    },
  },
}
</script>

<style scoped>
.activity-chart-card {
  margin-top: var(--space-md);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-extra-light);
  flex-wrap: wrap;
  gap: 8px;
}

.chart-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-header-left svg {
  color: var(--color-accent);
  flex-shrink: 0;
}

.chart-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.chart-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

.chart-wrapper {
  height: 200px;
  position: relative;
}

.chart-wrapper :deep(canvas) {
  max-width: 100% !important;
}

.chart-loading {
  height: 200px;
  display: flex;
  align-items: center;
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
</style>
