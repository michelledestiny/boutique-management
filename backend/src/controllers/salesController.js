import { HttpError } from '../middleware/errors.js'
import {
  createSale,
  getDailySalesSummary,
  getSale,
  listSaleCustomerOptions,
  listSales,
} from '../services/salesService.js'
import { validateSaleCreate, validateSaleCustomerQuery, validateSaleQuery } from '../validation/sales.js'

export async function createSaleController(request, response) {
  const sale = await createSale(validateSaleCreate(request.body))
  return response.status(201).json({ data: sale })
}

export async function listSalesController(request, response) {
  return response.json(await listSales(validateSaleQuery(request.query)))
}

export async function getSaleController(request, response) {
  const key = request.params.id
  if (typeof key !== 'string' || key.length < 1 || key.length > 64) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A valid sale ID or reference is required.')
  }
  return response.json({ data: await getSale(key) })
}

export async function dailySalesSummaryController(_request, response) {
  return response.json({ data: await getDailySalesSummary() })
}

export async function saleCustomerOptionsController(request, response) {
  const search = validateSaleCustomerQuery(request.query)
  return response.json({ data: await listSaleCustomerOptions(search) })
}
