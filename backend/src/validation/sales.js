import { HttpError } from '../middleware/errors.js'
import { parsePagination, validateId } from './inputs.js'
import { decimalToCents } from '../services/money.js'

const paymentMethods = new Set(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER'])

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message)
}

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalid('The request body must be a JSON object.')
  }
  return body
}

export function validateSaleCreate(input) {
  const body = objectBody(input)
  const allowedFields = ['items', 'discount', 'amountPaid', 'paymentMethod', 'customerId']
  const unexpected = Object.keys(body).find((key) => !allowedFields.includes(key))
  if (unexpected) {
    invalid(`The field "${unexpected}" is not supported.`)
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    invalid('Add at least one product to the sale.')
  }
  if (body.items.length > 100) {
    invalid('A sale can contain at most 100 product lines.')
  }

  const seenProductIds = new Set()
  const items = body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalid('Each sale item must be an object.')
    }
    const itemField = Object.keys(item).find((key) => !['productId', 'quantity'].includes(key))
    if (itemField) {
      invalid(`The sale item field "${itemField}" is not supported.`)
    }
    const productId = validateId(item.productId)
    if (seenProductIds.has(productId)) {
      invalid('A product can appear only once in the sale cart.')
    }
    seenProductIds.add(productId)

    if (
      typeof item.quantity !== 'number' ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 2147483647
    ) {
      invalid('Each product quantity must be a positive whole number.')
    }

    return { productId, quantity: item.quantity }
  })

  const discountCents = decimalToCents(body.discount ?? '0', 'Discount')
  if (body.amountPaid === undefined) {
    invalid('Amount paid is required.')
  }
  const amountTenderedCents = decimalToCents(body.amountPaid, 'Amount paid')

  const paymentMethod = body.paymentMethod ?? 'CASH'
  if (typeof paymentMethod !== 'string' || !paymentMethods.has(paymentMethod)) {
    invalid('Choose a supported payment method.')
  }

  let customerId = null
  if (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') {
    customerId = validateId(body.customerId)
  }

  return { items, discountCents, amountTenderedCents, paymentMethod, customerId }
}

export function validateSaleQuery(query) {
  const pagination = parsePagination(query, { defaultPageSize: 20 })
  for (const field of ['search', 'paymentMethod', 'paymentStatus', 'from', 'to']) {
    if (query[field] !== undefined && typeof query[field] !== 'string') {
      invalid(`${field} must be a string.`)
    }
  }

  const search = query.search?.trim() ?? ''
  if (search.length > 64) {
    invalid('Sale reference search must be at most 64 characters.')
  }

  const paymentMethod = query.paymentMethod || undefined
  if (paymentMethod && !paymentMethods.has(paymentMethod)) {
    invalid('Payment method filter is invalid.')
  }

  const paymentStatus = query.paymentStatus || undefined
  if (paymentStatus && !['UNPAID', 'PARTIALLY_PAID', 'PAID'].includes(paymentStatus)) {
    invalid('Payment status filter is invalid.')
  }

  const parseDate = (value, field, endOfDay = false) => {
    if (!value) {
      return undefined
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) {
      invalid(`${field} must be a valid calendar date in YYYY-MM-DD format.`)
    }
    const [, yearText, monthText, dayText] = match
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      invalid(`${field} must be a valid calendar date in YYYY-MM-DD format.`)
    }
    if (endOfDay) {
      date.setDate(date.getDate() + 1)
    }
    return date
  }

  const from = parseDate(query.from, 'Start date')
  const to = parseDate(query.to, 'End date', true)
  if (from && to && from >= to) {
    invalid('The end date must be on or after the start date.')
  }

  return {
    ...pagination,
    search,
    paymentMethod,
    paymentStatus,
    from,
    to,
  }
}

export function validateSaleCustomerQuery(query) {
  const search = query.search ?? ''
  if (typeof search !== 'string' || search.length > 160) {
    invalid('Customer search must be a string of at most 160 characters.')
  }
  return search.trim()
}
