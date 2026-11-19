import { HttpError } from '../middleware/errors.js'

const PRICE_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message)
}

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalid('The request body must be a JSON object.')
  }

  return body
}

function allowedFields(body, allowed) {
  const unexpected = Object.keys(body).find((key) => !allowed.includes(key))
  if (unexpected) {
    invalid(`The field "${unexpected}" is not supported.`)
  }
}

function text(value, field, maxLength, { nullable = true } = {}) {
  if (value === undefined) {
    return undefined
  }
  if (value === null && nullable) {
    return null
  }
  if (typeof value !== 'string') {
    invalid(`${field} must be a string.`)
  }

  const normalized = value.trim()
  if (!normalized && nullable) {
    return null
  }
  if (!normalized) {
    invalid(`${field} is required.`)
  }
  if (normalized.length > maxLength) {
    invalid(`${field} must be at most ${maxLength} characters.`)
  }
  return normalized
}

function integer(value, field, { min = 0, max = 2147483647 } = {}) {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'string' && !/^(?:0|[1-9]\d*)$/.test(value))
  ) {
    invalid(`${field} must be a whole number.`)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    invalid(`${field} must be a whole number between ${min} and ${max}.`)
  }
  return parsed
}

function price(value, field) {
  if (typeof value !== 'string' || !PRICE_PATTERN.test(value)) {
    invalid(`${field} must be a non-negative amount with up to two decimal places.`)
  }
  return value
}

function productFields(body, { creating = false } = {}) {
  const fields = {
    name: text(body.name, 'Product name', 160, { nullable: false }),
    sku:
      body.sku === undefined
        ? undefined
        : text(body.sku, 'SKU', 80)?.toUpperCase() ?? null,
    description: text(body.description, 'Description', 5000),
    purchasePrice:
      body.purchasePrice === undefined
        ? undefined
        : body.purchasePrice === null || body.purchasePrice === ''
          ? null
          : price(body.purchasePrice, 'Purchase price'),
    sellingPrice:
      body.sellingPrice === undefined
        ? undefined
        : price(body.sellingPrice, 'Selling price'),
    lowStockAlertAt:
      body.lowStockAlertAt === undefined
        ? undefined
        : integer(body.lowStockAlertAt, 'Low-stock threshold'),
  }

  if (creating) {
    if (fields.name === undefined) {
      invalid('Product name is required.')
    }
    if (fields.purchasePrice === undefined || fields.purchasePrice === null) {
      invalid('Purchase price is required.')
    }
    if (fields.sellingPrice === undefined) {
      invalid('Selling price is required.')
    }
    fields.lowStockAlertAt ??= 5
    fields.openingStock =
      body.openingStock === undefined
        ? 0
        : integer(body.openingStock, 'Opening stock quantity')
  }

  return fields
}

export function validateProductCreate(input) {
  const body = objectBody(input)
  allowedFields(body, [
    'name',
    'sku',
    'description',
    'purchasePrice',
    'sellingPrice',
    'openingStock',
    'lowStockAlertAt',
  ])
  return productFields(body, { creating: true })
}

export function validateProductUpdate(input) {
  const body = objectBody(input)
  allowedFields(body, [
    'name',
    'sku',
    'description',
    'purchasePrice',
    'sellingPrice',
    'lowStockAlertAt',
  ])
  if (Object.keys(body).length === 0) {
    invalid('Provide at least one product field to update.')
  }
  return productFields(body)
}

export function validateStockMovement(input) {
  const body = objectBody(input)
  allowedFields(body, ['productId', 'quantity', 'note', 'date'])
  if (body.productId === undefined) {
    invalid('Product is required.')
  }
  const productId = text(body.productId, 'Product', 30, { nullable: false })
  const quantity = integer(body.quantity, 'Quantity', { min: 1 })
  const note = text(body.note, 'Note', 500)
  let occurredAt

  if (body.date !== undefined && body.date !== '') {
    if (typeof body.date !== 'string' || !DATE_PATTERN.test(body.date)) {
      invalid('Date must be a valid ISO date or date and time.')
    }
    occurredAt = new Date(body.date)
    if (Number.isNaN(occurredAt.getTime())) {
      invalid('Date must be a valid ISO date or date and time.')
    }
    const [year, month, day] = body.date.slice(0, 10).split('-').map(Number)
    const calendarDate = new Date(Date.UTC(year, month - 1, day))
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() + 1 !== month ||
      calendarDate.getUTCDate() !== day
    ) {
      invalid('Date must be a valid calendar date.')
    }
  }

  return { productId, quantity, note, occurredAt }
}

export function parsePagination(query, { defaultPageSize = 10, maxPageSize = 100 } = {}) {
  const page = query.page === undefined ? 1 : integer(query.page, 'Page', { min: 1 })
  const pageSize =
    query.pageSize === undefined
      ? defaultPageSize
      : integer(query.pageSize, 'Page size', { min: 1, max: maxPageSize })

  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function validateId(id) {
  if (typeof id !== 'string' || id.length < 1 || id.length > 30) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A valid record ID is required.')
  }
  return id
}
