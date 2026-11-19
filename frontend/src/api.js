import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

export function getErrorMessage(error, fallback = 'The request could not be completed.') {
  return error.response?.data?.error?.message || fallback
}

export function formatXaf(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return '—'
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} FCFA`
}

export function moneyToCents(value) {
  if (typeof value !== 'string') {
    return null
  }
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) {
    return null
  }
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}

export function centsToMoney(cents) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}

export function formatDate(value, options = {}) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date)
}

export function localDateTimeInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}
