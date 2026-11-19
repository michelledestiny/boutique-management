import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import {
  validateProductCreate,
  validateProductUpdate,
  validateStockMovement,
} from '../src/validation/inputs.js'

test('product and stock inputs reject invalid monetary values and quantities', () => {
  assert.throws(
    () => validateProductCreate({ name: 'Dress', purchasePrice: 12.5, sellingPrice: '20' }),
    { code: 'VALIDATION_ERROR' },
  )
  assert.throws(
    () => validateProductCreate({ name: 'Dress', purchasePrice: '12.555', sellingPrice: '20' }),
    { code: 'VALIDATION_ERROR' },
  )
  assert.throws(() => validateProductUpdate({ stockQuantity: 100 }), { code: 'VALIDATION_ERROR' })
  assert.throws(() => validateStockMovement({ productId: 'product_1', quantity: 0 }), {
    code: 'VALIDATION_ERROR',
  })
  assert.throws(() => validateStockMovement({ quantity: 2 }), { code: 'VALIDATION_ERROR' })
  assert.throws(
    () => validateStockMovement({ productId: 'product_1', quantity: 1, date: '2026-02-31' }),
    { code: 'VALIDATION_ERROR' },
  )
})

test(
  'product and stock API operations preserve transactional inventory history',
  { skip: process.env.TEST_DATABASE_URL ? false : 'Set TEST_DATABASE_URL to a dedicated *_test database.' },
  async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL
    const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''))
    assert.match(databaseName, /_test$/i, 'Integration tests must use a database ending in _test.')
    process.env.DATABASE_URL = testDatabaseUrl

    const [{ default: app }, { prisma }] = await Promise.all([
      import('../src/app.js'),
      import('../src/lib/prisma.js'),
    ])
    let server
    let productId

    try {
      await prisma.$connect()
      server = app.listen(0)
      await new Promise((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
      })
      const { port } = server.address()
      const baseUrl = `http://127.0.0.1:${port}/api/v1`
      const sku = `PH2-${randomUUID().slice(0, 8).toUpperCase()}`

      async function request(path, options = {}) {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: { 'content-type': 'application/json', ...options.headers },
          body: options.body === undefined
            ? undefined
            : Buffer.isBuffer(options.body)
              ? options.body
              : JSON.stringify(options.body),
        })
        return { response, data: await response.json() }
      }

      const created = await request('/products', {
        method: 'POST',
        body: {
          name: 'Phase Two Test Dress',
          sku,
          description: 'Integration test product',
          purchasePrice: '1250.00',
          sellingPrice: '2000.00',
          openingStock: 5,
          lowStockAlertAt: 4,
        },
      })
      assert.equal(created.response.status, 201)
      productId = created.data.data.id
      assert.equal(created.data.data.stockQuantity, 5)
      assert.equal(created.data.data.purchasePrice, '1250')
      assert.equal(created.data.data.sellingPrice, '2000')
      assert.equal(created.data.data.imageUrl, null)

      const invalidImage = await request(`/products/${productId}/image`, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: Buffer.from('not an image'),
      })
      assert.equal(invalidImage.response.status, 400)
      assert.equal(invalidImage.data.error.code, 'INVALID_IMAGE')

      const imageBytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII=',
        'base64',
      )
      const uploadedImage = await request(`/products/${productId}/image`, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: imageBytes,
      })
      assert.equal(uploadedImage.response.status, 200)
      assert.match(uploadedImage.data.data.imageUrl, new RegExp(`/products/${productId}/image/[0-9a-f-]{36}\\.png$`))
      const imageResponse = await fetch(new URL(uploadedImage.data.data.imageUrl, baseUrl))
      assert.equal(imageResponse.status, 200)
      assert.equal(imageResponse.headers.get('content-type'), 'image/png')
      assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), imageBytes)

      const detail = await request(`/products/${productId}`)
      assert.equal(detail.response.status, 200)
      assert.equal(detail.data.data.movements[0].quantity, 5)
      assert.equal(detail.data.data.imageUrl, uploadedImage.data.data.imageUrl)

      const duplicate = await request('/products', {
        method: 'POST',
        body: {
          name: 'Duplicate SKU',
          sku: sku.toLowerCase(),
          purchasePrice: '10',
          sellingPrice: '20',
        },
      })
      assert.equal(duplicate.response.status, 409)
      assert.equal(duplicate.data.error.code, 'DUPLICATE_SKU')

      const search = await request(`/products?search=${encodeURIComponent(sku)}`)
      assert.equal(search.response.status, 200)
      assert.equal(search.data.pagination.totalItems, 1)

      const edited = await request(`/products/${productId}`, {
        method: 'PATCH',
        body: { name: 'Phase Two Test Dress Updated', sellingPrice: '2100.50' },
      })
      assert.equal(edited.response.status, 200)
      assert.equal(edited.data.data.name, 'Phase Two Test Dress Updated')
      assert.equal(edited.data.data.purchasePrice, '1250')
      assert.equal(edited.data.data.sellingPrice, '2100.5')

      const stockIn = await request('/stock/in', {
        method: 'POST',
        body: {
          productId,
          quantity: 2,
          note: 'Integration test delivery',
          date: '2026-01-15T10:00:00.000Z',
        },
      })
      assert.equal(stockIn.response.status, 201)
      assert.equal(stockIn.data.data.product.stockQuantity, 7)
      assert.equal(stockIn.data.data.movement.quantity, 2)

      const stockOut = await request('/stock/out', {
        method: 'POST',
        body: { productId, quantity: 3, note: 'Integration test adjustment' },
      })
      assert.equal(stockOut.response.status, 201)
      assert.equal(stockOut.data.data.product.stockQuantity, 4)
      assert.equal(stockOut.data.data.movement.quantity, -3)

      const insufficient = await request('/stock/out', {
        method: 'POST',
        body: { productId, quantity: 5 },
      })
      assert.equal(insufficient.response.status, 409)
      assert.equal(insufficient.data.error.code, 'INSUFFICIENT_STOCK')
      assert.equal((await prisma.product.findUnique({ where: { id: productId } })).stockQuantity, 4)

      const concurrent = await Promise.all([
        request('/stock/out', { method: 'POST', body: { productId, quantity: 3 } }),
        request('/stock/out', { method: 'POST', body: { productId, quantity: 3 } }),
      ])
      assert.deepEqual(concurrent.map(({ response }) => response.status).sort(), [201, 409])
      assert.equal((await prisma.product.findUnique({ where: { id: productId } })).stockQuantity, 1)

      const lowStock = await request('/stock/low-stock')
      const lowStockProduct = lowStock.data.data.find((product) => product.id === productId)
      assert.equal(lowStock.response.status, 200)
      assert.equal(lowStockProduct.stockQuantity, 1)
      assert.equal(lowStockProduct.lowStockAlertAt, 4)
      assert.equal(lowStockProduct.status, 'LOW_STOCK')

      const history = await request(`/stock/movements?productId=${productId}&type=ADJUSTMENT`)
      assert.equal(history.response.status, 200)
      assert.equal(history.data.pagination.totalItems, 2)
      assert.deepEqual(history.data.data.map((movement) => movement.quantity).sort(), [-3, -3])

      const invalid = await request('/stock/out', {
        method: 'POST',
        body: { productId, quantity: 0 },
      })
      assert.equal(invalid.response.status, 400)
      assert.equal((await prisma.product.findUnique({ where: { id: productId } })).stockQuantity, 1)

      const removedImage = await request(`/products/${productId}/image`, { method: 'DELETE' })
      assert.equal(removedImage.response.status, 200)
      assert.equal(removedImage.data.data.imageUrl, null)
      const oldImage = await fetch(new URL(uploadedImage.data.data.imageUrl, baseUrl))
      assert.equal(oldImage.status, 404)

      const archived = await request(`/products/${productId}`, { method: 'DELETE' })
      assert.equal(archived.response.status, 200)
      assert.equal(archived.data.data.isActive, false)
      const stillAvailableInHistory = await request(`/stock/movements?productId=${productId}`)
      assert.equal(stillAvailableInHistory.data.pagination.totalItems, 4)
    } finally {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        })
      }
      if (productId) {
        await prisma.stockMovement.deleteMany({ where: { productId } })
        await prisma.product.deleteMany({ where: { id: productId } })
      }
      await prisma.$disconnect()
    }
  },
)
