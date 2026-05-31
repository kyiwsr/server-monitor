<template>
  <div class="settings-page">
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

    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">System configuration</p>
      </div>
    </div>

    <template v-if="loading">
      <div class="skeleton-section">
        <el-skeleton :rows="1" animated />
        <div class="skeleton-card"><el-skeleton-item variant="card" class="skeleton-block" /></div>
        <div class="skeleton-card" style="margin-top: 16px;"><el-skeleton-item variant="card" class="skeleton-block" /></div>
      </div>
    </template>

    <template v-else>
      <!-- Section 1: Profile Settings -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <div class="section-header-text">
              <h2 class="section-title">Profile Settings</h2>
              <p class="section-desc">Update your account details and preferences</p>
            </div>
          </div>
        </div>
        <el-card shadow="never" class="profile-card">
          <el-form :model="profileForm" label-position="top" size="small" class="profile-form">
            <div class="profile-grid">
              <el-form-item label="Name">
                <el-input v-model="profileForm.name" placeholder="Enter your name" />
              </el-form-item>
              <el-form-item label="Email">
                <el-input v-model="profileForm.email" placeholder="Enter your email" />
              </el-form-item>
            </div>
            <div class="profile-divider">
              <span>Change Password</span>
            </div>
            <div class="profile-grid">
              <el-form-item label="Current Password">
                <el-input v-model="profileForm.currentPassword" type="password" show-password placeholder="Leave blank to keep current" />
              </el-form-item>
              <el-form-item label="New Password">
                <el-input v-model="profileForm.newPassword" type="password" show-password placeholder="Min 6 characters" />
              </el-form-item>
            </div>
            <div class="profile-divider">
              <span>Preferences</span>
            </div>
            <el-form-item>
              <el-switch
                v-model="profileForm.emailNotifications"
                active-text="Receive email alerts for threshold breaches"
                inactive-text="Email notifications disabled"
              />
            </el-form-item>
            <el-button type="primary" :loading="profileSaving" @click="saveProfile">
              {{ profileSaving ? 'Saving...' : 'Save Profile' }}
            </el-button>
          </el-form>
        </el-card>
      </section>

      <!-- Section 2: Server Management -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <div class="section-header-text">
              <h2 class="section-title">Server Management</h2>
              <p class="section-desc">Add, edit, or remove servers and their thresholds</p>
            </div>
          </div>
          <el-button type="primary" size="small" @click="openAddServerDialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Server
          </el-button>
        </div>
        <el-card shadow="never" class="table-card">
          <el-table v-if="servers.length > 0" :data="servers" style="width: 100%" size="small" stripe>
            <el-table-column label="Server Name" min-width="150">
              <template #default="{ row }"><span class="cell-name-text">{{ row.name }}</span></template>
            </el-table-column>
            <el-table-column label="Host" min-width="120">
              <template #default="{ row }"><code class="cell-host">{{ row.host }}</code></template>
            </el-table-column>
            <el-table-column label="Status" width="100" align="center">
              <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag></template>
            </el-table-column>
            <el-table-column label="Token" min-width="150">
              <template #default="{ row }">
                <div class="token-display"><code class="token-masked">{{ maskedToken(row) }}</code></div>
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="180" align="center" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button type="primary" size="small" link @click="openEditDialog(row)">Edit</el-button>
                  <el-button type="warning" size="small" link @click="regenerateToken(row)">Token</el-button>
                  <el-button type="danger" size="small" link @click="confirmDelete(row)">Delete</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-section-inline"><span>No servers registered. Click "Add Server" to get started.</span></div>
        </el-card>
      </section>

      <!-- Section 3: Admin Section -->
      <section v-if="authStore.isAdmin" class="settings-section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div class="section-header-text">
              <h2 class="section-title">Admin Panel</h2>
              <p class="section-desc">Manage users and view system statistics</p>
            </div>
          </div>
        </div>
        <el-card shadow="never" class="table-card">
          <el-table v-if="users.length > 0" :data="users" style="width: 100%" size="small" stripe>
            <el-table-column label="Name" min-width="140">
              <template #default="{ row }"><span class="cell-name-text">{{ row.name }}</span></template>
            </el-table-column>
            <el-table-column label="Email" min-width="180">
              <template #default="{ row }"><span class="cell-email">{{ row.email }}</span></template>
            </el-table-column>
            <el-table-column label="Role" width="80" align="center">
              <template #default="{ row }"><el-tag :type="row.role === 'admin' ? 'danger' : 'primary'" size="small" effect="plain">{{ row.role }}</el-tag></template>
            </el-table-column>
            <el-table-column label="Active" width="80" align="center">
              <template #default="{ row }">
                <el-switch :model-value="row.isActive" size="small" @change="toggleUserStatus(row)" />
              </template>
            </el-table-column>
            <el-table-column label="Last Login" min-width="140">
              <template #default="{ row }">
                <span class="cell-time">{{ row.lastLogin ? formatTimestamp(row.lastLogin) : 'Never' }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-section-inline"><span>No users found.</span></div>
        </el-card>
      </section>
    </template>

    <!-- Add Server Dialog -->
    <el-dialog v-model="addDialogVisible" title="Add New Server" width="500px" :close-on-click-modal="false">
      <el-form :model="addForm" label-position="top" size="small">
        <el-form-item label="Server Name" required>
          <el-input v-model="addForm.name" placeholder="e.g. Production Web Server" />
        </el-form-item>
        <el-form-item label="Host/IP" required>
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

    <!-- Token Display Dialog (shown once after server creation) -->
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
      </div>
      <template #footer>
        <el-button type="primary" @click="tokenDialogVisible = false">I've Saved the Token</el-button>
      </template>
    </el-dialog>

    <!-- Edit Server Dialog -->
    <el-dialog v-model="editDialogVisible" :title="'Edit Server: ' + (editForm?.name || '')" width="550px" :close-on-click-modal="false" class="edit-dialog">
      <el-form v-if="editForm" :model="editForm" label-position="top" size="small" class="edit-form">
        <el-form-item label="Server Name">
          <el-input v-model="editForm.name" placeholder="Enter server name" />
        </el-form-item>
        <el-form-item label="Host">
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
        <span class="dialog-footer">
          <el-button @click="editDialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="saveServer" :loading="saving">{{ saving ? 'Saving...' : 'Save' }}</el-button>
        </span>
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
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const servers = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')
const successMessage = ref('')
const saving = ref(false)
const profileSaving = ref(false)
const addSaving = ref(false)
const deleting = ref(false)

// Profile form
const profileForm = ref({
  name: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  emailNotifications: true,
})

// Server management
const editDialogVisible = ref(false)
const editForm = ref(null)
const editServerId = ref(null)

const addDialogVisible = ref(false)
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
const newServerName = ref('')
const regeneratedServerName = ref('')
const isNewServer = ref(false)
const tokenCopied = ref(false)

const deleteDialogVisible = ref(false)
const deleteServerId = ref(null)
const deleteServerName = ref('')

const commonBusinessFunctions = ['Website', 'API', 'Database', 'Point of Sale', 'Email', 'File Storage', 'Monitoring', 'Backup']
const commonTags = ['production', 'staging', 'development', 'critical', 'high-priority', 'monitoring']

function statusTagType(status) {
  const map = { Ok: 'success', Warning: 'warning', Critical: 'danger', Down: 'info' }
  return map[status] || 'info'
}

function maskedToken(server) {
  if (!server._id) return '...'
  const suffix = server._id.slice(-4)
  return `••••••••••••${suffix}`
}

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// === Profile ===
async function saveProfile() {
  profileSaving.value = true
  try {
    const data = {
      name: profileForm.value.name,
      email: profileForm.value.email,
      emailNotifications: profileForm.value.emailNotifications,
    }
    if (profileForm.value.currentPassword && profileForm.value.newPassword) {
      data.currentPassword = profileForm.value.currentPassword
      data.newPassword = profileForm.value.newPassword
    }
    const response = await api.updateProfile(data)
    authStore.updateUser(response.data.user)
    successMessage.value = 'Profile updated successfully'
    profileForm.value.currentPassword = ''
    profileForm.value.newPassword = ''
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to update profile'
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    profileSaving.value = false
  }
}

// === Server CRUD ===
function openAddServerDialog() {
  addForm.value = { name: '', host: '', description: '', businessFunctions: [], tags: [], timezone: 'UTC' }
  addDialogVisible.value = true
}

async function saveNewServer() {
  if (!addForm.value.name || !addForm.value.host) {
    error.value = 'Server name and host are required'
    setTimeout(() => { error.value = '' }, 3000)
    return
  }
  addSaving.value = true
  try {
    const response = await api.createServer(addForm.value)
    newToken.value = response.data.token
    newServerName.value = response.data.server.name
    isNewServer.value = true
    addDialogVisible.value = false
    tokenDialogVisible.value = true
    successMessage.value = 'Server created successfully'
    await fetchServers()
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to create server'
    console.error('Error creating server:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    addSaving.value = false
  }
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
}

async function saveServer() {
  if (!editForm.value || !editServerId.value) return
  saving.value = true
  try {
    await api.updateServer(editServerId.value, editForm.value)
    editDialogVisible.value = false
    successMessage.value = 'Server settings updated successfully'
    await fetchServers()
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to update server settings'
    console.error('Error updating server:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    saving.value = false
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
    await fetchServers()
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to delete server'
    console.error('Error deleting server:', err)
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    deleting.value = false
  }
}

async function regenerateToken(server) {
  try {
    const response = await api.regenerateToken(server._id)
    newToken.value = response.data.token
    regeneratedServerName.value = response.data.serverName || server.name
    isNewServer.value = false
    tokenCopied.value = false
    tokenDialogVisible.value = true
    successMessage.value = 'Token regenerated successfully'
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to regenerate token'
    console.error('Error regenerating token:', err)
    setTimeout(() => { error.value = '' }, 4000)
  }
}

function copyToken() {
  navigator.clipboard.writeText(newToken.value).then(() => {
    tokenCopied.value = true
    setTimeout(() => { tokenCopied.value = false }, 2000)
  }).catch(() => {
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

// === Admin ===
async function toggleUserStatus(user) {
  try {
    // Toggle via API - since we don't have a dedicated endpoint, we'll use a workaround
    // The actual endpoint would be PUT /api/auth/users/:id/toggle-status
    // For now, we'll just update locally and call a generic endpoint
    await api.toggleUserStatus(user._id)
    await fetchUsers()
    successMessage.value = `User ${user.isActive ? 'deactivated' : 'activated'} successfully`
    setTimeout(() => { successMessage.value = '' }, 4000)
  } catch (err) {
    error.value = 'Failed to update user status'
    console.error('Error toggling user status:', err)
    setTimeout(() => { error.value = '' }, 4000)
  }
}

// === Data Fetching ===
const fetchServers = async () => {
  try {
    const response = await api.getServers()
    servers.value = response.data
    error.value = ''
  } catch (err) {
    error.value = 'Unable to connect to the server. Please check if the backend is running.'
    console.error('Error fetching servers:', err)
  }
}

const fetchUsers = async () => {
  try {
    const response = await api.getUsers()
    users.value = response.data.users || []
  } catch (err) {
    console.error('Error fetching users:', err)
  }
}

onMounted(async () => {
  try {
    // Set profile form from auth store
    profileForm.value.name = authStore.userName
    profileForm.value.email = authStore.userEmail
    profileForm.value.emailNotifications = authStore.user?.emailNotifications !== false

    await fetchServers()
    if (authStore.isAdmin) {
      await fetchUsers()
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.settings-page {
  max-width: var(--content-max-width);
  margin: 0 auto;
}
.page-alert { margin-bottom: var(--space-md); }
.page-header { margin-bottom: var(--space-lg); }
.page-header-text { display: flex; flex-direction: column; gap: 4px; }
.page-title { font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.3px; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); margin: 0; font-weight: 400; }
.skeleton-section { margin-top: var(--space-md); }
.skeleton-card { margin-top: var(--space-md); }
.skeleton-block { height: 200px; border-radius: var(--radius-md); display: block; }

/* Sections */
.settings-section { margin-bottom: var(--space-xl); }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-md); }
.section-header-left { display: flex; align-items: flex-start; gap: 10px; }
.section-header-left svg { color: var(--color-accent); flex-shrink: 0; margin-top: 2px; }
.section-header-text { display: flex; flex-direction: column; gap: 2px; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }
.section-desc { font-size: 12px; color: var(--text-secondary); margin: 0; }

/* Profile */
.profile-card { padding: 0; }
.profile-form { max-width: 600px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.profile-divider { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin: var(--space-md) 0 var(--space-sm) 0; padding-bottom: 6px; border-bottom: 1px solid var(--border-extra-light); }

/* Tables */
.table-card { overflow: hidden; }
.table-card :deep(.el-card__body) { padding: 0 !important; }
.cell-name-text { font-weight: 600; color: var(--text-primary); font-size: 13px; }
.cell-host { font-family: 'SF Mono','Fira Code','Consolas',monospace; font-size: 12px; color: var(--text-regular); background: var(--border-extra-light); padding: 2px 6px; border-radius: 3px; }
.cell-email { font-size: 12px; color: var(--text-regular); }
.cell-time { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.table-actions { display: flex; gap: 4px; justify-content: center; }
.empty-section-inline { padding: var(--space-lg); text-align: center; color: var(--text-placeholder); font-size: 13px; }
.token-display { display: flex; align-items: center; }
.token-masked { font-family: 'SF Mono','Fira Code','Consolas',monospace; font-size: 12px; color: var(--text-secondary); background: var(--border-extra-light); padding: 2px 8px; border-radius: 4px; letter-spacing: 1px; }

/* Edit Dialog */
.edit-dialog :deep(.el-dialog__body) { padding-top: var(--space-md); }
.edit-form { display: flex; flex-direction: column; gap: 4px; }
.thresholds-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin: var(--space-md) 0 var(--space-sm) 0; padding-bottom: 6px; border-bottom: 1px solid var(--border-extra-light); }
.thresholds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.threshold-input { width: 100%; }
.threshold-input :deep(.el-input-number__increase), .threshold-input :deep(.el-input-number__decrease) { width: 24px; }

/* Token Dialog */
.token-dialog-body { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: var(--space-md) 0; }
.token-dialog-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--color-warning-light); color: var(--color-warning); display: flex; align-items: center; justify-content: center; }
.token-dialog-desc { font-size: 13px; color: var(--text-regular); text-align: center; line-height: 1.6; margin: 0; }
.token-dialog-desc strong { color: var(--text-primary); }
.token-display-box { width: 100%; display: flex; align-items: center; gap: 8px; background: var(--bg-page); border: 1px solid var(--border-base); border-radius: var(--radius-sm); padding: 10px 12px; }
.token-value { flex: 1; font-family: 'SF Mono','Fira Code','Consolas',monospace; font-size: 12px; color: var(--text-primary); word-break: break-all; line-height: 1.4; }
.copy-btn { flex-shrink: 0; }

/* Delete Dialog */
.delete-dialog-body { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: var(--space-md) 0; text-align: center; }
.delete-dialog-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--color-critical-light); color: var(--color-critical); display: flex; align-items: center; justify-content: center; }
.delete-dialog-text { font-size: 13px; color: var(--text-regular); line-height: 1.6; margin: 0; }

@media (max-width: 768px) {
  .thresholds-grid { grid-template-columns: 1fr; }
  .profile-grid { grid-template-columns: 1fr; }
}
</style>
