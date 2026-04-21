import axios from 'axios'

const API_URL = 'hhtp://localhost:3000/api'

export default {
  getServers() {
    return axios.get(`${API_URL}/servers`)
  },

  getServerMetrics(serverId, timeRange = '24h') {
    return axios.get(`${API_URL}/servers/${serverId}/metrics`, { params: { timeRange } })
  },
}
