<template>
  <div class="settings-page">
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

    <!-- Success Message -->
    <el-alert
      v-if="successMessage"
      :title="successMessage"
      type="success"
      show-icon
      :closable="true"
      @close="successMessage = ''"
      class="page-alert"
    />

    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">System configuration</p>
      </div>
    </div>

    <!-- Loading State -->
    <template v-if="loading">
      <div class="skeleton-section">
        <el-skeleton :rows="1" animated />
        <div class="skeleton-card">
          <el-skeleton-item variant="card" class="skeleton-block" />
        </div>
        <div class="skeleton-card" style="margin-top: 16px;">
          <el-skeleton-item variant="card" class="skeleton-block" />
        </div>
      </div>
    </template>

    <template v-else>
      <!-- ===== Section 1: Server Management ===== -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <div class="section-header-text">
              <h2 class="section-title">Server Management</h2>
              <p class="section-desc">Edit server names, descriptions, and threshold values</p>
            </div>
          </div>
        </div>

        <el-card shadow="never" class="table-card">
          <el-table
            v-if="servers.length > 0"
            :data="servers"
            style="width: 100%"
            size="small"
            stripe
          >
            <el-table-column label="Server Name" min-width="160">
              <template #default="{ row }">
                <span class="cell-name-text">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Host" min-width="130">
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
            <el-table-column label="Actions" width="100" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="openEditDialog(row)">
                  Edit
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-section-inline">
            <span>No servers registered</span>
          </div>
        </el-card>
      </section>

      <!-- ===== Section 2: Agent Token Management ===== -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div class="section-header-text">
              <h2 class="section-title">Agent Token Management</h2>
              <p class="section-desc">Manage agent authentication tokens for server monitoring</p>
            </div>
          </div>
        </div>

        <el-card shadow="never" class="table-card">
          <el-table
            v-if="servers.length > 0"
            :data="servers"
            style="width: 100%"
            size="small"
            stripe
          >
            <el-table-column label="Server Name" min-width="160">
              <template #default="{ row }">
                <span class="cell-name-text">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Host" min-width="130">
              <template #default="{ row }">
                <code class="cell-host">{{ row.host }}</code>
              </template>
            </el-table-column>
            <el-table-column label="Token" min-width="160">
              <template #default="{ row }">
                <div class="token-display">
                  <code class="token-masked">{{ maskedToken(row) }}</code>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="180" align="center" fixed="right">
              <template #default="{ row }">
                <div class="token-actions">
                  <el-button
                    type="warning"
                    size="small"
                    link
                    @click="regenerateToken(row)"
                  >
                    Regenerate
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-section-inline">
            <span>No servers registered</span>
          </div>
        </el-card>
      </section>
    </template>

    <!-- ===== Edit Server Dialog ===== -->
    <el-dialog
      v-model="editDialogVisible"
      :title="'Edit Server: ' + (editForm.name || '')"
      width="550px"
      :close-on-click-modal="false"
      class="edit-dialog"
    >
      <el-form
        v-if="editForm"
        :model="editForm"
        label-position="top"
        size="small"
        class="edit-form"
      >
        <el-form-item label="Server Name">
          <el-input v-model="editForm.name" placeholder="Enter server name" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="2"
            placeholder="Enter server description"
          />
        </el-form-item>

        <div class="thresholds-title">Threshold Settings</div>
        <div class="thresholds-grid">
          <el-form-item label="CPU Warning %">
            <el-input-number
              v-model="editForm.thresholds.cpuWarn"
              :min="0"
              :max="100"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
          <el-form-item label="CPU Critical %">
            <el-input-number
              v-model="editForm.thresholds.cpuCrit"
              :min="0"
              :max="100"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
          <el-form-item label="RAM Warning %">
            <el-input-number
              v-model="editForm.thresholds.ramWarn"
              :min="0"
              :max="100"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
          <el-form-item label="RAM Critical %">
            <el-input-number
              v-model="editForm.thresholds.ramCrit"
              :min="0"
              :max="100"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
          <el-form-item label="Disk Warning %">
            <el-input-number
              v-model="editForm.thresholds.diskWarn"
              :min="0"
              :max="100"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
          <el-form-item label="Disk Critical %">
            <el-input-number
              v-model="editForm.thresholds.diskCrit"
              :min="0"
              :max="100"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
          <el-form-item label="Down After (seconds)">
            <el-input-number
              v-model="editForm.thresholds.downAfterSeconds"
              :min="10"
              :max="3600"
              controls-position="right"
              class="threshold-input"
            />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editDialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="saveServer" :loading="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- ===== Token Regenerated Dialog ===== -->
    <el-dialog
      v-model="tokenDialogVisible"
      title="Token Regenerated"
      width="480px"
      :close-on-click-modal="false"
      class="token-dialog"
    >
      <div class="token-dialog-body">
        <div class="token-dialog-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p class="token-dialog-desc">
          A new agent token has been generated for <strong>{{ regeneratedServerName }}</strong>.
          Save this token now — it will not be shown again.
        </p>
        <div class="token-display-box">
          <code class="token-value">{{ newToken }}</code>
          <el-button
            size="small"
            type="primary"
            @click="copyToken"
            class="copy-btn"
          >
            {{ tokenCopied ? 'Copied!' : 'Copy' }}
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="tokenDialogVisible = false">
          I've Saved the Token
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { ElMessage } from 'element-plus'

const servers = ref([])
const loading = ref(true)
const error = ref('')
const successMessage = ref('')
const saving = ref(false)

// Edit Dialog
const editDialogVisible = ref(false)
const editForm = ref(null)
const editServerId = ref(null)

// Token Dialog
const tokenDialogVisible = ref(false)
const newToken = ref('')
const regeneratedServerName = ref('')
const tokenCopied = ref(false)

function statusTagType(status) {
  const map = { Ok: 'success', Warning: 'warning', Critical: 'danger', Down: 'info' }
  return map[status] || 'info'
}

function maskedToken(server) {
  // Show last 4 chars of a hypothetical token representation
  // Since we don't store plain text tokens, show a masked placeholder
  if (!server._id) return '...'
  const suffix = server._id.slice(-4)
  return `••••••••••••${suffix}`
}

function openEditDialog(server) {
  editServerId.value = server._id
  editForm.value = {
    name: server.name,
    description: server.description || '',
    thresholds: {
      cpuWarn: server.thresholds?.cpuWarn || 70,
      cpuCrit: server.thresholds?.cpuCrit || 90,
      ramWarn: server.thresholds?.ramWarn || 70,
      ramCrit: server.thresholds?.ramCrit || 90,
      diskWarn: server.thresholds?.diskWarn || 75,
      diskCrit: server.thresholds?.diskCrit || 90,
      downAfterSeconds: server.thresholds?.downAfterSeconds || 60,
    },
  }
  editDialogVisible.value = true
}

async function saveServer() {
  if (!editForm.value || !editServerId.value) return

  saving.value = true
  try {
    await api.updateServer(editServerId.value, editForm.value)
    editDialogVisible.value = false
    successMessage.value = 'Server settings updated successfully'
    // Refresh server list
    await fetchServers()
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (err) {
    error.value = 'Failed to update server settings'
    console.error('Error updating server:', err)
    setTimeout(() => { error.value = '' }, 3000)
  } finally {
    saving.value = false
  }
}

async function regenerateToken(server) {
  try {
    const response = await api.regenerateToken(server._id)
    newToken.value = response.data.token
    regeneratedServerName.value = response.data.serverName || server.name
    tokenCopied.value = false
    tokenDialogVisible.value = true
    successMessage.value = 'Token regenerated successfully'
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (err) {
    error.value = 'Failed to regenerate token'
    console.error('Error regenerating token:', err)
    setTimeout(() => { error.value = '' }, 3000)
  }
}

function copyToken() {
  navigator.clipboard.writeText(newToken.value).then(() => {
    tokenCopied.value = true
    setTimeout(() => { tokenCopied.value = false }, 2000)
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = newToken.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    tokenCopied.value = true
    setTimeout(() => { tokenCopied.value = false }, 2000)
  })
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
})
</script>

<style scoped>
.settings-page {
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

.skeleton-card {
  margin-top: var(--space-md);
}

.skeleton-block {
  height: 200px;
  border-radius: var(--radius-md);
  display: block;
}

/* ===== Settings Section ===== */
.settings-section {
  margin-bottom: var(--space-xl);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-header-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.section-header-left svg {
  color: var(--color-accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.section-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.section-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== Table Card ===== */
.table-card {
  overflow: hidden;
}

.table-card :deep(.el-card__body) {
  padding: 0 !important;
}

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

.empty-section-inline {
  padding: var(--space-lg);
  text-align: center;
  color: var(--text-placeholder);
  font-size: 13px;
}

/* ===== Token Display ===== */
.token-display {
  display: flex;
  align-items: center;
}

.token-masked {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--border-extra-light);
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 1px;
}

.token-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* ===== Edit Dialog ===== */
.edit-dialog :deep(.el-dialog__body) {
  padding-top: var(--space-md);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.thresholds-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin: var(--space-md) 0 var(--space-sm) 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-extra-light);
}

.thresholds-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.threshold-input {
  width: 100%;
}

.threshold-input :deep(.el-input-number__increase),
.threshold-input :deep(.el-input-number__decrease) {
  width: 24px;
}

/* ===== Token Dialog ===== */
.token-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) 0;
}

.token-dialog-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-warning-light);
  color: var(--color-warning);
  display: flex;
  align-items: center;
  justify-content: center;
}

.token-dialog-desc {
  font-size: 13px;
  color: var(--text-regular);
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.token-dialog-desc strong {
  color: var(--text-primary);
}

.token-display-box {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-page);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.token-value {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-primary);
  word-break: break-all;
  line-height: 1.4;
}

.copy-btn {
  flex-shrink: 0;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .thresholds-grid {
    grid-template-columns: 1fr;
  }
}
</style>
