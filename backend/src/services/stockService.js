import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/errors.js'

const movementSelect = {
  id: true,
  type: true,
  quantity: true,
  note: true,
  occurredAt: true,
  product: { select: { id: true, name: true, sku: true } },
}

export async function recordStockIn({ productId, quantity, note, occurredAt }) {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    })
    if (!product || !product.isActive) {
      throw new HttpError(404, 'NOT_FOUND', 'Active product was not found.')
    }

    const updated = await transaction.product.updateMany({
      where: {
        id: productId,
        isActive: true,
        stockQuantity: { lte: 2147483647 - quantity },
      },
      data: { stockQuantity: { increment: quantity } },
    })
    if (updated.count !== 1) {
      throw new HttpError(
        409,
        'STOCK_LIMIT',
        'The resulting stock quantity would exceed the supported limit.',
      )
    }
    const updatedProduct = await transaction.product.findUniqueOrThrow({ where: { id: productId } })
    const movement = await transaction.stockMovement.create({
      data: {
        productId,
        type: 'PURCHASE',
        quantity,
        note,
        ...(occurredAt ? { occurredAt } : {}),
      },
      select: movementSelect,
    })

    return { product: updatedProduct, movement }
  })
}

export async function recordStockOut({ productId, quantity, note, occurredAt }) {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    })
    if (!product || !product.isActive) {
      throw new HttpError(404, 'NOT_FOUND', 'Active product was not found.')
    }

    const updated = await transaction.product.updateMany({
      where: { id: productId, isActive: true, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    })
    if (updated.count !== 1) {
      throw new HttpError(
        409,
        'INSUFFICIENT_STOCK',
        'The requested quantity exceeds available stock or the product is no longer active.',
      )
    }

    const updatedProduct = await transaction.product.findUniqueOrThrow({
      where: { id: productId },
    })
    const movement = await transaction.stockMovement.create({
      data: {
        productId,
        type: 'ADJUSTMENT',
        quantity: -quantity,
        note,
        ...(occurredAt ? { occurredAt } : {}),
      },
      select: movementSelect,
    })

    return { product: updatedProduct, movement }
  })
}

export async function listMovements({ page, pageSize, skip, productId, type }) {
  const where = {
    ...(productId ? { productId } : {}),
    ...(type ? { type } : {}),
  }
  const [data, totalItems] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      select: movementSelect,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ])

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  }
}

export async function listLowStock({ page, pageSize, skip }) {
  const [data, countRows, outOfStockRows] = await prisma.$transaction([
    prisma.$queryRaw`
      SELECT id, name, sku, stockQuantity, lowStockAlertAt
      FROM Product
      WHERE isActive = TRUE AND stockQuantity <= lowStockAlertAt
      ORDER BY stockQuantity ASC, name ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*) AS totalItems
      FROM Product
      WHERE isActive = TRUE AND stockQuantity <= lowStockAlertAt
    `,
    prisma.$queryRaw`
      SELECT COUNT(*) AS totalItems
      FROM Product
      WHERE isActive = TRUE AND stockQuantity = 0
    `,
  ])

  const totalItems = Number(countRows[0].totalItems)
  const outOfStock = Number(outOfStockRows[0].totalItems)
  return {
    data: data.map((product) => ({
      ...product,
      status: product.stockQuantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    })),
    summary: { totalItems, outOfStock },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  }
}
