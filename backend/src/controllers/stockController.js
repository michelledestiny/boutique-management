import { HttpError } from '../middleware/errors.js'
import {
  listLowStock,
  listMovements,
  recordStockIn,
  recordStockOut,
} from '../services/stockService.js'
import { parsePagination, validateId, validateStockMovement } from '../validation/inputs.js'

const movementTypes = new Set(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT'])

function parseMovementQuery(query) {
  const pagination = parsePagination(query)
  const productId = query.productId
  if (productId !== undefined) {
    validateId(productId)
  }

  const type = query.type
  if (type !== undefined && !movementTypes.has(type)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Movement type filter is invalid.')
  }

  return { ...pagination, productId, type }
}

export async function listMovementsController(request, response) {
  return response.json(await listMovements(parseMovementQuery(request.query)))
}

export async function stockInController(request, response) {
  const result = await recordStockIn(validateStockMovement(request.body))
  return response.status(201).json({ data: result })
}

export async function stockOutController(request, response) {
  const result = await recordStockOut(validateStockMovement(request.body))
  return response.status(201).json({ data: result })
}

export async function lowStockController(request, response) {
  return response.json(await listLowStock(parsePagination(request.query, { defaultPageSize: 10 })))
}
