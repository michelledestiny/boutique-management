import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decimalToCents, centsToDecimal } from '../src/services/money.js'
import { validateSaleCreate, validateSaleQuery } from '../src/validation/sales.js'

test('sale amounts are parsed exactly to cents without floating-point rounding', () => {
  assert.equal(decimalToCents('1250.05'), 125005n)
  assert.equal(centsToDecimal(125005n), '1250.05')
  assert.throws(() => decimalToCents('-1'), { code: 'VALIDATION_ERROR' })
  assert.throws(() => decimalToCents('1.001'), { code: 'VALIDATION_ERROR' })
  assert.throws(() => decimalToCents(1.25), { code: 'VALIDATION_ERROR' })
})

test('sale validation rejects empty, duplicate, invalid quantity, and payment inputs', () => {
  assert.throws(() => validateSaleCreate({ items: [], amountPaid: '0' }), {
    code: 'VALIDATION_ERROR',
  })
  assert.throws(
    () => validateSaleCreate({ items: [{ productId: 'product_1', quantity: 0 }], amountPaid: '0' }),
    { code: 'VALIDATION_ERROR' },
  )
  assert.throws(
    () =>
      validateSaleCreate({
        items: [
          { productId: 'product_1', quantity: 1 },
          { productId: 'product_1', quantity: 2 },
        ],
        amountPaid: '0',
      }),
    { code: 'VALIDATION_ERROR' },
  )
  assert.throws(
    () =>
      validateSaleCreate({
        items: [{ productId: 'product_1', quantity: 1 }],
        amountPaid: '-1',
      }),
    { code: 'VALIDATION_ERROR' },
  )
  assert.throws(
    () =>
      validateSaleCreate({
        items: [{ productId: 'product_1', quantity: 1 }],
        amountPaid: '0',
        paymentMethod: 'CRYPTO',
      }),
    { code: 'VALIDATION_ERROR' },
  )
})

test('sales history validates payment filters and calendar date ranges', () => {
  assert.throws(() => validateSaleQuery({ paymentStatus: 'OWED' }), {
    code: 'VALIDATION_ERROR',
  })
  assert.throws(() => validateSaleQuery({ from: '2026-02-31' }), {
    code: 'VALIDATION_ERROR',
  })
  assert.throws(() => validateSaleQuery({ from: '2026-11-20', to: '2026-11-19' }), {
    code: 'VALIDATION_ERROR',
  })
})
