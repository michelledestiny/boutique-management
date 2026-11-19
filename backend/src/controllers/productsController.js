import {
  archiveProduct,
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../services/productsService.js'
import {
  clearProductImage,
  readProductImage,
  saveProductImage,
} from '../services/productImagesService.js'
import { HttpError } from '../middleware/errors.js'
import {
  parsePagination,
  validateId,
  validateProductCreate,
  validateProductUpdate,
} from '../validation/inputs.js'

function productResponse(product) {
  const { unitPrice, ...fields } = product
  return {
    ...fields,
    purchasePrice: product.purchasePrice?.toString() ?? null,
    sellingPrice: unitPrice.toString(),
  }
}

function parseProductQuery(query) {
  const pagination = parsePagination(query)
  if (query.search !== undefined && typeof query.search !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Search must be a string.')
  }
  const search = query.search?.trim() ?? ''
  if (search.length > 160) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Search must be at most 160 characters.')
  }

  const stockStatus = query.stockStatus ?? 'all'
  if (!['all', 'low-stock', 'out-of-stock'].includes(stockStatus)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Stock status filter is invalid.')
  }
  if (query.includeArchived !== undefined && !['true', 'false'].includes(query.includeArchived)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'includeArchived must be true or false.')
  }

  const includeArchived = query.includeArchived === 'true'
  return { ...pagination, search, stockStatus, includeArchived }
}

export async function listProductsController(request, response) {
  const result = await listProducts(parseProductQuery(request.query))
  return response.json({
    ...result,
    data: result.data.map(productResponse),
  })
}

export async function getProductController(request, response) {
  const product = await getProduct(validateId(request.params.id))
  return response.json({ data: productResponse(product) })
}

export async function createProductController(request, response) {
  const product = await createProduct(validateProductCreate(request.body))
  return response.status(201).json({ data: productResponse(product) })
}

export async function getProductImageController(request, response) {
  const { image, contentType } = await readProductImage(
    validateId(request.params.id),
    request.params.filename,
  )
  return response
    .set('Content-Type', contentType)
    .set('X-Content-Type-Options', 'nosniff')
    .set('Cache-Control', 'public, max-age=31536000, immutable')
    .send(image)
}

export async function saveProductImageController(request, response) {
  if (!Buffer.isBuffer(request.body)) {
    throw new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Upload a PNG, JPEG, or WebP image.')
  }
  const product = await saveProductImage(
    validateId(request.params.id),
    request.get('content-type'),
    request.body,
  )
  return response.json({ data: productResponse(product) })
}

export async function clearProductImageController(request, response) {
  const product = await clearProductImage(validateId(request.params.id))
  return response.json({ data: productResponse(product) })
}

export async function updateProductController(request, response) {
  const product = await updateProduct(
    validateId(request.params.id),
    validateProductUpdate(request.body),
  )
  return response.json({ data: productResponse(product) })
}

export async function archiveProductController(request, response) {
  const product = await archiveProduct(validateId(request.params.id))
  return response.json({ data: productResponse(product) })
}
