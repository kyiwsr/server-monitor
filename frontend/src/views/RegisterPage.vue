<template>
  <div class="register-page">
    <div class="register-card">
      <div class="register-header">
        <div class="register-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <h1>Create Account</h1>
        <p class="register-subtitle">Register for Server Monitor</p>
      </div>

      <div v-if="error" class="register-error">
        <el-alert :title="error" type="error" show-icon :closable="true" @close="error = ''" />
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleRegister"
        class="register-form"
      >
        <el-form-item label="Name" prop="name">
          <el-input
            v-model="form.name"
            placeholder="Enter your name"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>

        <el-form-item label="Email" prop="email">
          <el-input
            v-model="form.email"
            placeholder="Enter your email"
            :prefix-icon="Message"
            size="large"
          />
        </el-form-item>

        <el-form-item label="Password" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="At least 6 characters"
            :prefix-icon="Lock"
            show-password
            size="large"
          />
        </el-form-item>

        <el-form-item label="Confirm Password" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="Confirm your password"
            :prefix-icon="Lock"
            show-password
            size="large"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="register-btn"
            :loading="loading"
            @click="handleRegister"
          >
            Create Account
          </el-button>
        </el-form-item>
      </el-form>

      <div class="register-footer">
        <span>Already have an account?</span>
        <router-link to="/login" class="login-link">Sign in</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { User, Message, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref(null)
const loading = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('Passwords do not match'))
  } else {
    callback()
  }
}

const rules = {
  name: [
    { required: true, message: 'Please enter your name', trigger: 'blur' },
  ],
  email: [
    { required: true, message: 'Please enter your email', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Please enter a password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: 'Please confirm your password', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

const handleRegister = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    const response = await api.register(form.name, form.email, form.password)
    authStore.setAuth(response.data.token, response.data.user)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 22%, rgba(14, 165, 233, 0.12), transparent 42%),
    radial-gradient(circle at 84% 80%, rgba(14, 165, 233, 0.10), transparent 40%),
    var(--bg-page);
}

.register-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border-lighter) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-lighter) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(circle at center, black, transparent 72%);
  mask-image: radial-gradient(circle at center, black, transparent 72%);
  opacity: 0.6;
  pointer-events: none;
}

.register-card {
  position: relative;
  z-index: 1;
  width: 420px;
  max-width: 90vw;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 40px 32px;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

.register-header {
  text-align: center;
  margin-bottom: 28px;
}

.register-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: var(--gradient-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
  color: #fff;
  box-shadow: 0 10px 28px rgba(14, 165, 233, 0.35), 0 0 0 6px var(--color-accent-glow);
}

.register-header h1 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.register-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.register-form {
  margin-bottom: 16px;
}

.register-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.register-form :deep(.el-form-item__label) {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  padding-bottom: 4px;
}

.register-btn {
  width: 100%;
  margin-top: 4px;
}

.register-footer {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.login-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.login-link:hover {
  text-decoration: underline;
}

.register-error {
  margin-bottom: 16px;
}
</style>
