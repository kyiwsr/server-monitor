<template>
  <el-card shadow="never" class="server-info-card">
    <div class="info-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span class="info-title">Server Information</span>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Host</span>
        <span class="info-value mono">{{ server.host }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Status</span>
        <el-tag :type="tagType" size="small" effect="dark">{{ server.status }}</el-tag>
      </div>
      <div class="info-item" v-if="server.description">
        <span class="info-label">Description</span>
        <span class="info-value">{{ server.description }}</span>
      </div>
      <div class="info-item" v-if="hasFunctions">
        <span class="info-label">Functions</span>
        <div class="info-functions">
          <el-tag
            v-for="(fn, idx) in server.businessFunctions"
            :key="idx"
            size="small"
            :style="{ background: functionBgColors[idx % functionBgColors.length], color: functionTextColors[idx % functionTextColors.length], border: 'none' }"
          >
            {{ fn }}
          </el-tag>
        </div>
      </div>
      <div class="info-item">
        <span class="info-label">Last Data</span>
        <span class="info-value">{{ timeAgo }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Server ID</span>
        <span class="info-value mono">{{ server._id }}</span>
      </div>
    </div>

    <!-- Thresholds -->
    <div class="thresholds-section">
      <div class="thresholds-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20V10"/>
          <path d="M18 20V4"/>
          <path d="M6 20v-4"/>
        </svg>
        <span>Alert Thresholds</span>
        <span class="thresholds-hint">Alerts trigger when usage crosses these limits</span>
      </div>
      <div class="thresholds-grid">
        <div class="threshold-item">
          <span class="threshold-label">CPU Warn</span>
          <span class="threshold-value" style="color: var(--color-warning)">{{ thresholds.cpuWarn }}%</span>
        </div>
        <div class="threshold-item">
          <span class="threshold-label">CPU Critical</span>
          <span class="threshold-value" style="color: var(--color-critical)">{{ thresholds.cpuCrit }}%</span>
        </div>
        <div class="threshold-item">
          <span class="threshold-label">RAM Warn</span>
          <span class="threshold-value" style="color: var(--color-warning)">{{ thresholds.ramWarn }}%</span>
        </div>
        <div class="threshold-item">
          <span class="threshold-label">RAM Critical</span>
          <span class="threshold-value" style="color: var(--color-critical)">{{ thresholds.ramCrit }}%</span>
        </div>
        <div class="threshold-item">
          <span class="threshold-label">Disk Warn</span>
          <span class="threshold-value" style="color: var(--color-warning)">{{ thresholds.diskWarn }}%</span>
        </div>
        <div class="threshold-item">
          <span class="threshold-label">Disk Critical</span>
          <span class="threshold-value" style="color: var(--color-critical)">{{ thresholds.diskCrit }}%</span>
        </div>
        <div class="threshold-item">
          <span class="threshold-label">Down After</span>
          <span class="threshold-value" style="color: var(--color-down)">{{ thresholds.downAfterSeconds }}s</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { timeAgo as formatTimeAgo } from '../utils/time'

const props = defineProps({
  server: { type: Object, required: true },
})

const thresholds = computed(() => {
  const t = props.server.thresholds || {}
  return {
    cpuWarn: t.cpuWarn ?? 70,
    cpuCrit: t.cpuCrit ?? 90,
    ramWarn: t.ramWarn ?? 70,
    ramCrit: t.ramCrit ?? 90,
    diskWarn: t.diskWarn ?? 75,
    diskCrit: t.diskCrit ?? 90,
    downAfterSeconds: t.downAfterSeconds ?? 60,
  }
})

const tagType = computed(() => {
  const map = { Ok: 'success', Warning: 'warning', Critical: 'danger', Down: 'info' }
  return map[props.server.status] || 'info'
})

const hasFunctions = computed(() => {
  return props.server.businessFunctions && props.server.businessFunctions.length > 0
})

const functionBgColors = ['#e0f2fe', '#f3e8ff', '#fef3c7', '#d1fae5', '#fce7f3']
const functionTextColors = ['#0369a1', '#7c3aed', '#b45309', '#059669', '#be185d']

const timeAgo = computed(() => formatTimeAgo(props.server.lastDataSent, { emptyText: 'Never' }))
</script>

<style scoped>
.server-info-card {
  margin-bottom: var(--space-md);
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-extra-light);
  color: var(--text-primary);
}

.info-header svg {
  color: var(--color-accent);
  flex-shrink: 0;
}

.info-title {
  font-size: 14px;
  font-weight: 700;
}

/* ===== Info Grid ===== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-all;
}

.info-value.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-regular);
}

.info-functions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

/* ===== Thresholds ===== */
.thresholds-section {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-extra-light);
}

.thresholds-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-regular);
  margin-bottom: var(--space-sm);
}

.thresholds-header svg {
  color: var(--color-accent);
  flex-shrink: 0;
}

.thresholds-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-placeholder);
  margin-left: 4px;
}

.thresholds-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.threshold-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--bg-page);
  border-radius: var(--radius-sm);
}

.threshold-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.threshold-value {
  font-size: 14px;
  font-weight: 700;
}
</style>
