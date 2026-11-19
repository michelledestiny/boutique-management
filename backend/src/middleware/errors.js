export class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function notFoundHandler(_request, response) {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    },
  })
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    return next(error)
  }

  if (error instanceof HttpError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    })
  }

  if (error?.code === 'P2002') {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(' ')
      : String(error.meta?.target ?? '')
    const isDuplicateSku = /sku/i.test(target)
    return response.status(409).json({
      error: {
        code: isDuplicateSku ? 'DUPLICATE_SKU' : 'DUPLICATE_RECORD',
        message: isDuplicateSku
          ? 'A product with this SKU already exists.'
          : 'A record with the same unique value already exists.',
      },
    })
  }

  if (error?.code === 'P2034') {
    return response.status(409).json({
      error: {
        code: 'CONCURRENT_WRITE',
        message: 'The record changed during this request. Refresh and try again.',
      },
    })
  }

  if (error?.code === 'P2025') {
    return response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'The requested record was not found.' },
    })
  }

  if (error?.code === 'P2003') {
    return response.status(409).json({
      error: {
        code: 'RECORD_IN_USE',
        message: 'This record is referenced by other records and cannot be changed.',
      },
    })
  }

  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.' },
    })
  }

  if (error?.type === 'entity.too.large') {
    return response.status(413).json({
      error: { code: 'IMAGE_TOO_LARGE', message: 'Product images must be 5 MB or smaller.' },
    })
  }

  console.error('Unhandled API error:', error)
  return response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
  })
}
