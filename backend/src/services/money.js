import { HttpError } from '../middleware/errors.js'

export const MAX_MONEY_CENTS = 999999999999n

export function decimalToCents(value, field = 'Amount') {
  if (typeof value !== 'string') {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `${field} must be a non-negative amount with up to two decimal places.`,
    )
  }

  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `${field} must be a non-negative amount with up to two decimal places.`,
    )
  }

  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
  if (cents > MAX_MONEY_CENTS) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} exceeds the supported money limit.`)
  }
  return cents
}

export function centsToDecimal(cents) {
  const whole = cents / 100n
  const fraction = (cents % 100n).toString().padStart(2, '0')
  return `${whole}.${fraction}`
}

export function decimalToCentsFromDatabase(value) {
  const normalized = value.toString()
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!match) {
    throw new Error('The database returned an invalid decimal monetary value.')
  }
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}
