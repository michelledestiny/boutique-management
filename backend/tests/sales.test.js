import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

test(
  'sales API checks out atomically, records payments, and reports sales history',
  { skip: process.env.TEST_DATABASE_URL ? false : 'Set TEST_DATABASE_URL to a dedicated *_test database.' },
  async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL
    const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''))
    assert.match(databaseName, /_test$/i, 'Sales tests require a database ending in _test.')
    process.env.DATABASE_URL = testDatabaseUrl

    const [{ default: app }, { prisma }] = await Promise.all([
      import('../src/app.js'),
      import('../src/lib/prisma.js'),
    ])
    let server
    const productIds = []
    const saleIds = []
    const customerIds = []

    try {
      await prisma.$connect()
      server = app.listen(0)
      await new Promise((resolve, reject) => {
        server.once('listening', resolve)
        server.once('error', reject)
      })
      const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`
      const token = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()

      async function request(path, options = {}) {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: { 'content-type': 'application/json', ...options.headers },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        })
        return { response, data: await response.json() }
      }

      async function createProduct(name, sku, sellingPrice, openingStock) {
        const result = await request('/products', {
          method: 'POST',
          body: {
            name,
            sku,
            purchasePrice: '500.00',
            sellingPrice,
            openingStock,
            lowStockAlertAt: 2,
          },
        })
        assert.equal(result.response.status, 201)
        productIds.push(result.data.data.id)
        return result.data.data
      }

      const dress = await createProduct(`Phase Three Dress ${token}`, `S3-D-${token}`, '1500.25', 10)
      const shoes = await createProduct(`Phase Three Shoes ${token}`, `S3-S-${token}`, '800.00', 2)
      const customer = await prisma.customer.create({
        data: { firstName: 'Phase Three', lastName: `Test ${token}` },
        select: { id: true },
      })
      customerIds.push(customer.id)

      const options = await request(`/sales/customers?search=${token}`)
      assert.equal(options.response.status, 200)
      assert.ok(options.data.data.some((option) => option.id === customer.id))

      const before = await prisma.sale.count()
      const emptyCart = await request('/sales', {
        method: 'POST',
        body: { items: [], amountPaid: '0' },
      })
      assert.equal(emptyCart.response.status, 400)

      const missingProduct = await request('/sales', {
        method: 'POST',
        body: { items: [{ productId: 'missing_product', quantity: 1 }], amountPaid: '0' },
      })
      assert.equal(missingProduct.response.status, 404)

      const invalidPayment = await request('/sales', {
        method: 'POST',
        body: {
          items: [{ productId: dress.id, quantity: 1 }],
          amountPaid: '-1',
        },
      })
      assert.equal(invalidPayment.response.status, 400)

      const invalidDiscount = await request('/sales', {
        method: 'POST',
        body: {
          items: [{ productId: dress.id, quantity: 1 }],
          discount: '1500.26',
          amountPaid: '0',
        },
      })
      assert.equal(invalidDiscount.response.status, 400)
      assert.equal(await prisma.sale.count(), before)
      assert.equal((await prisma.product.findUnique({ where: { id: dress.id } })).stockQuantity, 10)

      const partial = await request('/sales', {
        method: 'POST',
        body: {
          items: [
            { productId: dress.id, quantity: 2 },
            { productId: shoes.id, quantity: 1 },
          ],
          discount: '100.00',
          amountPaid: '1000.00',
          paymentMethod: 'MOBILE_MONEY',
          customerId: customer.id,
        },
      })
      assert.equal(partial.response.status, 201)
      saleIds.push(partial.data.data.id)
      assert.match(partial.data.data.reference, /^SALE-\d{8}-[A-F0-9]{8}$/)
      assert.equal(partial.data.data.subtotal, '3800.50')
      assert.equal(partial.data.data.discount, '100.00')
      assert.equal(partial.data.data.totalAmount, '3700.50')
      assert.equal(partial.data.data.amountPaid, '1000.00')
      assert.equal(partial.data.data.remainingBalance, '2700.50')
      assert.equal(partial.data.data.changeDue, '0.00')
      assert.equal(partial.data.data.paymentStatus, 'PARTIALLY_PAID')
      assert.equal(partial.data.data.paymentMethod, 'MOBILE_MONEY')
      assert.equal(partial.data.data.itemCount, 3)
      assert.equal((await prisma.product.findUnique({ where: { id: dress.id } })).stockQuantity, 8)
      assert.equal((await prisma.product.findUnique({ where: { id: shoes.id } })).stockQuantity, 1)

      const movements = await prisma.stockMovement.findMany({
        where: { saleId: partial.data.data.id },
        orderBy: { quantity: 'asc' },
      })
      assert.deepEqual(movements.map((movement) => movement.quantity), [-2, -1])
      assert.ok(movements.every((movement) => movement.type === 'SALE'))

      await prisma.product.update({ where: { id: dress.id }, data: { unitPrice: '2000.00' } })
      const details = await request(`/sales/${partial.data.data.reference}`)
      assert.equal(details.response.status, 200)
      assert.equal(details.data.data.customer.id, customer.id)
      assert.equal(details.data.data.items.find((item) => item.productId === dress.id).unitPrice, '1500.25')
      assert.equal(details.data.data.items[0].lineTotal, '3000.50')

      const full = await request('/sales', {
        method: 'POST',
        body: {
          items: [{ productId: dress.id, quantity: 1 }],
          discount: '0',
          amountPaid: '2000',
          paymentMethod: 'CASH',
        },
      })
      assert.equal(full.response.status, 201)
      saleIds.push(full.data.data.id)
      assert.equal(full.data.data.paymentStatus, 'PAID')
      assert.equal(full.data.data.remainingBalance, '0.00')

      const overpaid = await request('/sales', {
        method: 'POST',
        body: {
          items: [{ productId: shoes.id, quantity: 1 }],
          amountPaid: '1000',
          paymentMethod: 'BANK_TRANSFER',
        },
      })
      assert.equal(overpaid.response.status, 201)
      saleIds.push(overpaid.data.data.id)
      assert.equal(overpaid.data.data.amountPaid, '800.00')
      assert.equal(overpaid.data.data.amountTendered, '1000.00')
      assert.equal(overpaid.data.data.changeDue, '200.00')
      assert.equal(overpaid.data.data.paymentStatus, 'PAID')

      const insufficient = await request('/sales', {
        method: 'POST',
        body: { items: [{ productId: shoes.id, quantity: 1 }], amountPaid: '0' },
      })
      assert.equal(insufficient.response.status, 409)
      assert.equal(insufficient.data.error.code, 'INSUFFICIENT_STOCK')
      assert.equal((await prisma.product.findUnique({ where: { id: shoes.id } })).stockQuantity, 0)
      assert.equal(await prisma.sale.count(), before + 3)

      const sales = await request('/sales?page=1&pageSize=10')
      assert.equal(sales.response.status, 200)
      assert.equal(sales.data.pagination.totalItems, before + 3)
      const searched = await request(`/sales?search=${partial.data.data.reference}`)
      assert.equal(searched.response.status, 200)
      assert.equal(searched.data.pagination.totalItems, 1)
      const filtered = await request('/sales?paymentMethod=MOBILE_MONEY&paymentStatus=PARTIALLY_PAID')
      assert.equal(filtered.response.status, 200)
      assert.equal(filtered.data.pagination.totalItems, 1)

      const currentDate = new Date()
      const today = [
        currentDate.getFullYear(),
        String(currentDate.getMonth() + 1).padStart(2, '0'),
        String(currentDate.getDate()).padStart(2, '0'),
      ].join('-')
      const dateFiltered = await request(`/sales?from=${today}&to=${today}`)
      assert.ok(dateFiltered.data.pagination.totalItems >= 3)

      const summary = await request('/sales/summary')
      assert.equal(summary.response.status, 200)
      assert.ok(summary.data.data.numberOfSales >= 3)
      assert.equal(summary.data.data.totalSalesAmount, '6500.50')
      assert.equal(summary.data.data.totalCollected, '3800.00')
      assert.equal(summary.data.data.totalOutstandingBalance, '2700.50')

      const concurrentProduct = await createProduct(
        `Phase Three Concurrent ${token}`,
        `S3-C-${token}`,
        '300.00',
        3,
      )
      const concurrentResults = await Promise.all([
        request('/sales', {
          method: 'POST',
          body: { items: [{ productId: concurrentProduct.id, quantity: 2 }], amountPaid: '600' },
        }),
        request('/sales', {
          method: 'POST',
          body: { items: [{ productId: concurrentProduct.id, quantity: 2 }], amountPaid: '600' },
        }),
      ])
      const successfulConcurrent = concurrentResults.filter(({ response }) => response.status === 201)
      assert.equal(successfulConcurrent.length, 1)
      assert.ok(concurrentResults.some(({ response }) => response.status === 409))
      saleIds.push(successfulConcurrent[0].data.data.id)
      assert.equal((await prisma.product.findUnique({ where: { id: concurrentProduct.id } })).stockQuantity, 1)
      assert.equal(
        await prisma.stockMovement.count({ where: { productId: concurrentProduct.id, type: 'SALE' } }),
        1,
      )
    } finally {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        })
      }
      if (saleIds.length) {
        await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } })
      }
      if (productIds.length) {
        await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } })
      }
      if (saleIds.length) {
        await prisma.sale.deleteMany({ where: { id: { in: saleIds } } })
      }
      if (productIds.length) {
        await prisma.product.deleteMany({ where: { id: { in: productIds } } })
      }
      if (customerIds.length) {
        await prisma.customer.deleteMany({ where: { id: { in: customerIds } } })
      }
      await prisma.$disconnect()
    }
  },
)
