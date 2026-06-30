import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

/**
 * Single source of truth for the server list + connection status.
 *
 * Previously App, Sidebar and the Dashboard each polled /api/servers on their
 * own intervals — and because the views are kept alive, those timers never
 * stopped. This store runs ONE poll loop (started by App, which lives for the
 * whole session) and every component reads the same reactive state.
 */
export const useServersStore = defineStore('servers', () => {
  const servers = ref([])
  const connectionStatus = ref('checking') // 'checking' | 'connected' | 'disconnected'
  const loaded = ref(false) // first fetch attempt has completed
  const hasError = ref(false)
  let pollTimer = null

  const connectionLabel = computed(() => {
    const map = { connected: 'Connected', disconnected: 'Disconnected', checking: 'Connecting...' }
    return map[connectionStatus.value] || 'Connecting...'
  })

  const serverCount = computed(() => servers.value.length)
  const activeAlertCount = computed(
    () => servers.value.filter((s) => s.status === 'Warning' || s.status === 'Critical').length,
  )

  async function refresh() {
    try {
      const res = await api.getServers()
      servers.value = res.data
      connectionStatus.value = 'connected'
      hasError.value = false
    } catch {
      connectionStatus.value = 'disconnected'
      hasError.value = true
    } finally {
      loaded.value = true
    }
  }

  function startPolling(interval = 10000) {
    if (pollTimer) return
    refresh()
    pollTimer = setInterval(refresh, interval)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    servers,
    connectionStatus,
    connectionLabel,
    serverCount,
    activeAlertCount,
    loaded,
    hasError,
    refresh,
    startPolling,
    stopPolling,
  }
})
