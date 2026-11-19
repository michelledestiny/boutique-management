import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/errors.js'

const productSelect = {
  id: true,
  name: true,
  sku: true,
  description: true,
  purchasePrice: true,
  unitPrice: true,
  imageUrl: true,
  stockQuantity: true,
  lowStockAlertAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
}

function toDatabaseFields(fields) {
  const { sellingPrice, ...productFields } = fields
  if (sellingPrice !== undefined) {
    productFields.unitPrice = sellingPrice
  }
  return productFields
}

export async function listProducts({ page, pageSize, skip, search, stockStatus, includeArchived }) {
  const where = {
    ...(includeArchived ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
          ],
        }
      : {}),
  }

  if (stockStatus === 'out-of-stock') {
    where.stockQuantity = 0
  } else if (stockStatus === 'low-stock') {
    const lowStock = await prisma.$queryRaw`
      SELECT id FROM Product
      WHERE isActive = TRUE AND stockQuantity <= lowStockAlertAt
    `
    where.id = { in: lowStock.map((product) => product.id) }
  }

  const [data, totalItems] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.product.count({ where }),
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

export async function getProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      ...productSelect,
      movements: {
        select: {
          id: true,
          type: true,
          quantity: true,
          note: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!product) {
    throw new HttpError(404, 'NOT_FOUND', 'Product was not found.')
  }
  return product
}

export async function createProduct(fields) {
  const { openingStock, ...productFields } = fields
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.product.create({
      data: {
        ...toDatabaseFields(productFields),
        stockQuantity: openingStock,
      },
      select: productSelect,
    })

    if (openingStock > 0) {
      await transaction.stockMovement.create({
        data: {
          productId: product.id,
          type: 'PURCHASE',
          quantity: openingStock,
          note: 'Opening stock',
        },
      })
    }

    return product
  })
}

export async function updateProduct(id, fields) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { isActive: true } })
  if (!existing || !existing.isActive) {
    throw new HttpError(404, 'NOT_FOUND', 'Product was not found.')
  }

  return prisma.product.update({
    where: { id },
    data: toDatabaseFields(fields),
    select: productSelect,
  })
}

export async function archiveProduct(id) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { isActive: true } })
  if (!existing || !existing.isActive) {
    throw new HttpError(404, 'NOT_FOUND', 'Product was not found.')
  }

  return prisma.product.update({
    where: { id },
    data: { isActive: false },
    select: productSelect,
  })
}
