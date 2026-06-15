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
          <div class="profile-identity">
            <div class="profile-avatar">{{ authStore.userInitials }}</div>
            <div class="profile-identity-text">
              <div class="profile-identity-name">{{ authStore.userName }}</div>
              <div class="profile-identity-email">{{ authStore.userEmail }}</div>
            </div>
            <el-tag :type="authStore.isAdmin ? 'danger' : 'primary'" size="small" effect="plain" class="profile-role-tag">
              {{ authStore.isAdmin ? 'Administrator' : 'Member' }}
            </el-tag>
          </div>
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
            <div class="pref-row">
              <div class="pref-text">
                <div class="pref-title">Email notifications</div>
                <div class="pref-desc">
                  Get an email whenever one of your servers crosses a warning or critical
                  limit, so you can react before it becomes a problem.
                </div>
              </div>
              <el-switch v-model="profileForm.emailNotifications" />
            </div>
            <el-button type="primary" :loading="profileSaving" @click="saveProfile" class="save-profile-btn">
              {{ profileSaving ? 'Saving...' : 'Save Profile' }}
            </el-button>
          </el-form>
        </el-card>
      </section>

      <!-- Section 2: Admin Section -->
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

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const users = ref([])
const loading = ref(true)
const error = ref('')
const successMessage = ref('')
const profileSaving = ref(false)

// Profile form
const profileForm = ref({
  name: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  emailNotifications: true,
})

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

// === Admin ===
async function toggleUserStatus(user) {
  try {
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

.profile-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 600px;
  padding-bottom: var(--space-md);
  margin-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-extra-light);
}
.profile-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}
.profile-identity-text { flex: 1; min-width: 0; }
.profile-identity-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.profile-identity-email { font-size: 13px; color: var(--text-secondary); }
.profile-role-tag { flex-shrink: 0; }

/* Preference row */
.pref-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 600px;
  padding: 14px 16px;
  background: var(--bg-page);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}
.pref-text { flex: 1; min-width: 0; }
.pref-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; }
.pref-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
.save-profile-btn { margin-top: 4px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.profile-divider { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin: var(--space-md) 0 var(--space-sm) 0; padding-bottom: 6px; border-bottom: 1px solid var(--border-extra-light); }

/* Table (Admin Panel) */
.table-card { overflow: hidden; }
.table-card :deep(.el-card__body) { padding: 0 !important; }
.cell-name-text { font-weight: 600; color: var(--text-primary); font-size: 13px; }
.cell-email { font-size: 12px; color: var(--text-regular); }
.cell-time { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.empty-section-inline { padding: var(--space-lg); text-align: center; color: var(--text-placeholder); font-size: 13px; }

@media (max-width: 768px) {
  .profile-grid { grid-template-columns: 1fr; }
}
</style>
