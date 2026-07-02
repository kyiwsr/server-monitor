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
        <div class="page-title-row">
          <h1 class="page-title">Servers</h1>
          <span class="server-count-badge" v-if="!loading">{{ servers.length }}</span>
        </div>
        <p class="page-subtitle">
          {{ servers.length }} server{{ servers.length === 1 ? '' : 's' }} monitored<span v-if="statusFilter || searchQuery"> · {{ filteredServers.length }} shown</span>
        </p>
      </div>
      <el-button type="primary" size="default" @click="openAddServerDialog" class="add-server-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Server
      </el-button>
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
                    :color="getMetricColor(row.currentMetrics.cpuPercent, 'cpu', row.thresholds)"
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
                    :color="getMetricColor(row.currentMetrics.ramPercent, 'ram', row.thresholds)"
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
                    :color="getMetricColor(row.currentMetrics.diskPercent, 'disk', row.thresholds)"
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
            <el-table-column label="Actions" width="180" align="center" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button type="primary" size="small" link @click="goToServer(row._id)">View</el-button>
                  <el-button type="primary" size="small" link @click="openEditDialog(row)">Edit</el-button>
                  <el-button type="danger" size="small" link @click="confirmDelete(row)">Delete</el-button>
                </div>
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
                      :color="getMetricColor(server.currentMetrics.cpuPercent, 'cpu', server.thresholds)"
                      :stroke-width="5"
                      :show-text="true"
                    />
                  </div>
                  <div class="card-metric-row">
                    <span class="metric-label">RAM</span>
                    <el-progress
                      :percentage="Math.round(server.currentMetrics.ramPercent)"
                      :color="getMetricColor(server.currentMetrics.ramPercent, 'ram', server.thresholds)"
                      :stroke-width="5"
                      :show-text="true"
                    />
                  </div>
                  <div class="card-metric-row">
                    <span class="metric-label">Disk</span>
                    <el-progress
                      :percentage="Math.round(server.currentMetrics.diskPercent)"
                      :color="getMetricColor(server.currentMetrics.diskPercent, 'disk', server.thresholds)"
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

    <!-- Add Server Dialog -->
    <el-dialog v-model="addDialogVisible" title="Add New Server" width="500px" :close-on-click-modal="false">
      <el-form ref="addFormRef" :model="addForm" :rules="serverRules" label-position="top" size="small">
        <el-form-item label="Server Name" prop="name">
          <el-input v-model="addForm.name" placeholder="e.g. Production Web Server" />
        </el-form-item>
        <el-form-item label="Host/IP" prop="host">
          <el-input v-model="addForm.host" placeholder="e.g. 192.168.1.100 or server.example.com" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="addForm.description" type="textarea" :rows="2" placeholder="Optional description" />
        </el-form-item>
        <el-form-item label="Business Functions">
          <el-select v-model="addForm.businessFunctions" multiple filterable allow-create default-first-option placeholder="e.g. Website, API" style="width: 100%">
            <el-option v-for="fn in commonBusinessFunctions" :key="fn" :label="fn" :value="fn" />
          </el-select>
        </el-form-item>
        <el-form-item label="Tags">
          <el-select v-model="addForm.tags" multiple filterable allow-create default-first-option placeholder="e.g. production, critical" style="width: 100%">
            <el-option v-for="tag in commonTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <el-form-item label="Timezone">
          <el-select v-model="addForm.timezone" placeholder="Select timezone">
            <el-option label="UTC" value="UTC" />
            <el-option label="Asia/Kuala_Lumpur" value="Asia/Kuala_Lumpur" />
            <el-option label="Asia/Singapore" value="Asia/Singapore" />
            <el-option label="America/New_York" value="America/New_York" />
            <el-option label="America/Los_Angeles" value="America/Los_Angeles" />
            <el-option label="Europe/London" value="Europe/London" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="addSaving" @click="saveNewServer">{{ addSaving ? 'Creating...' : 'Create Server' }}</el-button>
      </template>
    </el-dialog>

    <!-- Token Display Dialog -->
    <el-dialog v-model="tokenDialogVisible" title="Server Token" width="480px" :close-on-click-modal="false" :close-on-press-escape="false">
      <div class="token-dialog-body">
        <div class="token-dialog-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p class="token-dialog-desc" v-if="newToken && isNewServer">
          Server <strong>{{ newServerName }}</strong> has been created. Copy this agent token now —
          <strong>it will not be shown again</strong>. Use it in your agent configuration.
        </p>
        <p class="token-dialog-desc" v-else-if="newToken">
          Token regenerated for <strong>{{ regeneratedServerName }}</strong>.
          Save this token now — it will not be shown again.
        </p>
        <div class="token-display-box">
          <code class="token-value">{{ newToken }}</code>
          <el-button size="small" type="primary" @click="copyToken" class="copy-btn">{{ tokenCopied ? 'Copied!' : 'Copy' }}</el-button>
        </div>

        <!-- One-line agent install command (token already baked in) -->
        <div class="install-section" v-if="newInstallCommand">
          <div class="install-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            <span class="install-title">Install the monitoring agent</span>
          </div>
          <p class="install-help">
            Run this on the server you want to monitor. It installs and starts the agent automatically — no config file editing needed.
          </p>
          <div class="install-command-box">
            <code class="install-command-value">{{ newInstallCommand }}</code>
            <el-button size="small" type="primary" @click="copyInstallCommand" class="copy-btn">{{ installCopied ? 'Copied!' : 'Copy' }}</el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="tokenDialogVisible = false">I've Saved the Token</el-button>
      </template>
    </el-dialog>

    <!-- Edit Server Dialog -->
    <el-dialog v-model="editDialogVisible" :title="'Edit Server: ' + (editForm?.name || '')" width="550px" :close-on-click-modal="false" class="edit-dialog">
      <el-form ref="editFormRef" v-if="editForm" :model="editForm" :rules="serverRules" label-position="top" size="small" class="edit-form">
        <el-form-item label="Server Name" prop="name">
          <el-input v-model="editForm.name" placeholder="Enter server name" />
        </el-form-item>
        <el-form-item label="Host" prop="host">
          <el-input v-model="editForm.host" placeholder="Enter host/IP" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="editForm.description" type="textarea" :rows="2" placeholder="Enter server description" />
        </el-form-item>
        <el-form-item label="Business Functions">
          <el-select v-model="editForm.businessFunctions" multiple filterable allow-create default-first-option placeholder="Select or type" style="width: 100%">
            <el-option v-for="fn in commonBusinessFunctions" :key="fn" :label="fn" :value="fn" />
          </el-select>
        </el-form-item>
        <el-form-item label="Tags">
          <el-select v-model="editForm.tags" multiple filterable allow-create default-first-option placeholder="Select or type" style="width: 100%">
            <el-option v-for="tag in commonTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <div class="thresholds-title">Threshold Settings</div>
        <div class="thresholds-grid">
          <el-form-item label="CPU Warning %">
            <el-input-number v-model="editForm.thresholds.cpuWarn" :min="0" :max="100" controls-position="right" class="threshold-input" />
          </el-form-item>
          <el-form-item label="CPU Critical %">
            <el-input-number v-model="editForm.thresholds.cpuCrit" :min="0" :max="100" controls-position="right" class="threshold-input" />
          </el-form-item>
          <el-form-item label="RAM Warning %">
            <el-input-number v-model="editForm.thresholds.ramWarn" :min="0" :max="100" controls-position="right" class="threshold-input" />
          </el-form-item>
          <el-form-item label="RAM Critical %">
            <el-input-number v-model="editForm.thresholds.ramCrit" :min="0" :max="100" controls-position="right" class="threshold-input" />
          </el-form-item>
          <el-form-item label="Disk Warning %">
            <el-input-number v-model="editForm.thresholds.diskWarn" :min="0" :max="100" controls-position="right" class="threshold-input" />
          </el-form-item>
          <el-form-item label="Disk Critical %">
            <el-input-number v-model="editForm.thresholds.diskCrit" :min="0" :max="100" controls-position="right" class="threshold-input" />
          </el-form-item>
          <el-form-item label="Down After (seconds)">
            <el-input-number v-model="editForm.thresholds.downAfterSeconds" :min="10" :max="3600" controls-position="right" class="threshold-input" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer dialog-footer-split">
          <el-button type="warning" plain :loading="regenerating" @click="handleRegenerateToken">
            {{ regenerating ? 'Regenerating...' : 'Regenerate Token' }}
          </el-button>
          <span>
            <el-button @click="editDialogVisible = false">Cancel</el-button>
            <el-button type="primary" @click="saveServer" :loading="saving">{{ saving ? 'Saving...' : 'Save' }}</el-button>
          </span>
        </div>
      </template>
    </el-dialog>

    <!-- Delete Confirmation Dialog -->
    <el-dialog v-model="deleteDialogVisible" title="Delete Server" width="400px">
      <div class="delete-dialog-body">
        <div class="delete-dialog-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </div>
        <p class="delete-dialog-text">
          Are you sure you want to delete <strong>{{ deleteServerName }}</strong>?
          This will permanently remove the server and all associated metrics and alerts.
        </p>
      </div>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">Cancel</el-button>
        <el-button type="danger" :loading="deleting" @click="handleDelete">{{ deleting ? 'Deleting...' : 'Delete Server' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import api from '../services/api'
import { useServersStore } from '../stores/servers'

const router = useRouter()
const serversStore = useServersStore()
const { servers, loaded } = storeToRefs(serversStore)
const searchQuery = ref('')
const statusFilter = ref('')
const viewMode = ref('table') // 'table' | 'cards'
const loading = computed(() => !loaded.value)
const error = ref('')
const successMessage = ref('')

// Shared validation rules for the add/edit server forms
const serverRules = {
  name: [{ required: true, message: 'Server name is required', trigger: 'blur' }],
  host: [{ required: true, message: 'Host/IP is required', trigger: 'blur' }],
}

// Server management dialogs
const addFormRef = ref(null)
const editFormRef = ref(null)
const addDialogVisible = ref(false)
const addSaving = ref(false)
const addForm = ref({
  name: '',
  host: '',
  description: '',
  businessFunctions: [],
  tags: [],
  timezone: 'UTC',
})

const tokenDialogVisible = ref(false)
const newToken = ref('')
const newInstallCommand = ref('')
const newServerName = ref('')
const regeneratedServerName = ref('')
const isNewServer = ref(false)
const tokenCopied = ref(false)
const installCopied = ref(false)

const editDialogVisible = ref(false)
const editForm = ref(null)
const editServerId = ref(null)
const saving = ref(false)
const regenerating = ref(false)

const deleteDialogVisible = ref(false)
const deleteServerId = ref(null)
const deleteServerName = ref('')
const deleting = ref(false)

const commonBusinessFunctions = ['Website', 'API', 'Database', 'Point of Sale', 'Email', 'File Storage', 'Monitoring', 'Backup']
const commonTags = ['production', 'staging', 'development', 'critical', 'high-priority', 'monitoring']

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

// Colour a metric against the server's OWN configured thresholds (falling back
// to sensible defaults), so the list matches the thresholds set per server
// rather than a hardcoded 70/90/75/90.
function getMetricColor(value, type, thresholds) {
  if (value == null) return '#909399'
  const defaults = { cpu: { warn: 70, crit: 90 }, ram: { warn: 70, crit: 90 }, disk: { warn: 75, crit: 90 } }
  const d = defaults[type]
  const warn = thresholds?.[`${type}Warn`] ?? d.warn
  const crit = thresholds?.[`${type}Crit`] ?? d.crit
  if (value >= crit) return '#F56C6C'
  if (value >= warn) return '#E6A23C'
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

// === Server CRUD ===
function openAddServerDialog() {
  addForm.value = { name: '', host: '', description: '', businessFunctions: [], tags: [], timezone: 'UTC' }
  addDialogVisible.value = true
  nextTick(() => addFormRef.value?.clearValidate())
}

async function saveNewServer() {
  if (!addFormRef.value) return
  const valid = await addFormRef.value.validate().catch(() => false)
  if (!valid) return
  addSaving.value = true
  try {
    const response = await api.createServer(addForm.value)
    newToken.value = response.data.token
    newInstallCommand.value = response.data.installCommand || ''
    newServerName.value = response.data.server.name
    isNewServer.value = true
    addDialogVisible.value = false
    tokenDialogVisible.value = true
    successMessage.value = 'Server created successfully'
    await serversStore.refresh()
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to create server'
    console.error('Error creating server:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    addSaving.value = false
  }
}

// Copy `text` to the clipboard, falling back to execCommand when the async
// Clipboard API is unavailable (e.g. non-secure contexts), then flag `flagRef`
// for a short "Copied!" confirmation.
function copyToClipboard(text, flagRef) {
  const flash = () => {
    flagRef.value = true
    setTimeout(() => { flagRef.value = false }, 2000)
  }
  navigator.clipboard.writeText(text).then(flash).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    flash()
  })
}

function copyToken() {
  copyToClipboard(newToken.value, tokenCopied)
}

function copyInstallCommand() {
  copyToClipboard(newInstallCommand.value, installCopied)
}

function openEditDialog(server) {
  editServerId.value = server._id
  editForm.value = {
    name: server.name,
    host: server.host,
    description: server.description || '',
    businessFunctions: server.businessFunctions || [],
    tags: server.tags || [],
    thresholds: {
      cpuWarn: server.thresholds?.cpuWarn ?? 70,
      cpuCrit: server.thresholds?.cpuCrit ?? 90,
      ramWarn: server.thresholds?.ramWarn ?? 70,
      ramCrit: server.thresholds?.ramCrit ?? 90,
      diskWarn: server.thresholds?.diskWarn ?? 75,
      diskCrit: server.thresholds?.diskCrit ?? 90,
      downAfterSeconds: server.thresholds?.downAfterSeconds ?? 60,
    },
  }
  editDialogVisible.value = true
  nextTick(() => editFormRef.value?.clearValidate())
}

async function saveServer() {
  if (!editForm.value || !editServerId.value) return
  if (!editFormRef.value) return
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await api.updateServer(editServerId.value, editForm.value)
    editDialogVisible.value = false
    successMessage.value = 'Server settings updated successfully'
    await serversStore.refresh()
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to update server settings'
    console.error('Error updating server:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    saving.value = false
  }
}

async function handleRegenerateToken() {
  if (!editServerId.value) return
  try {
    await ElMessageBox.confirm(
      'Regenerating the token immediately invalidates the current one. The agent on this server must be updated with the new token to keep reporting.',
      'Regenerate Token',
      { confirmButtonText: 'Regenerate', cancelButtonText: 'Cancel', type: 'warning' },
    )
  } catch {
    return // user cancelled
  }
  regenerating.value = true
  try {
    const response = await api.regenerateToken(editServerId.value)
    newToken.value = response.data.token
    newInstallCommand.value = response.data.installCommand || ''
    regeneratedServerName.value = editForm.value?.name || ''
    isNewServer.value = false
    editDialogVisible.value = false
    tokenDialogVisible.value = true
  } catch (err) {
    error.value = 'Failed to regenerate token'
    console.error('Error regenerating token:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    regenerating.value = false
  }
}

function confirmDelete(server) {
  deleteServerId.value = server._id
  deleteServerName.value = server.name
  deleteDialogVisible.value = true
}

async function handleDelete() {
  if (!deleteServerId.value) return
  deleting.value = true
  try {
    await api.deleteServer(deleteServerId.value)
    deleteDialogVisible.value = false
    successMessage.value = 'Server deleted successfully'
    await serversStore.refresh()
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to delete server'
    console.error('Error deleting server:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  // Reads come from the shared store (App drives the poll loop); refresh once
  // on entry so the list reflects the latest state immediately.
  serversStore.refresh()
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.server-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  background: var(--color-accent-light);
  color: var(--color-accent-dark);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.add-server-btn {
  flex-shrink: 0;
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

.table-card :deep(.el-table__body tr) {
  transition: background-color 0.15s ease;
}

.table-card :deep(.el-table__body tr:hover > td.el-table__cell) {
  background-color: var(--color-accent-light) !important;
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
  font-family: var(--font-mono);
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
  font-family: var(--font-mono);
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

.dialog-footer-split {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* ===== Install Command (token dialog) ===== */
.install-section {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-extra-light);
}

.install-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.install-header svg {
  color: var(--color-accent);
  flex-shrink: 0;
}

.install-title {
  font-size: 13px;
  font-weight: 700;
}

.install-help {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 8px;
  line-height: 1.5;
}

.install-command-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--bg-page);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.install-command-value {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.5;
}

.install-command-box .copy-btn {
  flex-shrink: 0;
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
