/**
 * Relative "time ago" formatter shared across the app.
 *
 * Options:
 *   emptyText   - returned when dateStr is falsy (default '')
 *   justNow     - show "Just now" for < 10s (default true)
 *   includeDays - roll hours into days past 24h (default false)
 */
export function timeAgo(dateStr, { emptyText = '', justNow = true, includeDays = false } = {}) {
  if (!dateStr) return emptyText
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (justNow && seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (!includeDays || hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
