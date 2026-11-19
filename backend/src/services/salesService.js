import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/errors.js'
import {
  centsToDecimal,
  decimalToCentsFromDatabase,
  MAX_MONEY_CENTS,
} from './money.js'

const saleInclude = {
  customer: {
    select: { id: true, firstName: true, lastName: true, phone: true },
  },
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      product: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
}

function saleResponse(sale) {
  const subtotalCents = decimalToCentsFromDatabase(sale.subtotal)
  const discountCents = decimalToCentsFromDatabase(sale.discount)
  const totalCents = decimalToCentsFromDatabase(sale.totalAmount)
  const paidCents = decimalToCentsFromDatabase(sale.amountPaid)
  const changeCents = decimalToCentsFromDatabase(sale.changeDue)
  const { _count, items, ...fields } = sale
  const itemCount = items?.reduce((total, item) => total + item.quantity, 0)
  const includesDetails = items?.some((item) => item.unitPrice !== undefined)

  return {
    ...fields,
    subtotal: centsToDecimal(subtotalCents),
    discount: centsToDecimal(discountCents),
    totalAmount: centsToDecimal(totalCents),
    amountPaid: centsToDecimal(paidCents),
    remainingBalance: centsToDecimal(totalCents > paidCents ? totalCents - paidCents : 0n),
    changeDue: centsToDecimal(changeCents),
    amountTendered: centsToDecimal(paidCents + changeCents),
    itemCount: itemCount ?? _count?.items ?? 0,
    lineCount: items?.length ?? _count?.items ?? 0,
    items: includesDetails ? items.map((item) => ({
      ...item,
      unitPrice: centsToDecimal(decimalToCentsFromDatabase(item.unitPrice)),
      lineTotal: centsToDecimal(decimalToCentsFromDatabase(item.lineTotal)),
    })) : undefined,
  }
}

function makeReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `SALE-${date}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

export async function createSale({
  items: requestedItems,
  discountCents,
  amountTenderedCents,
  paymentMethod,
  customerId,
}) {
  try {
    const sale = await prisma.$transaction(
      async (transaction) => {
        const productIds = requestedItems.map((item) => item.productId)
        const products = await transaction.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, name: true, sku: true, unitPrice: true, stockQuantity: true },
        })
        const productById = new Map(products.map((product) => [product.id, product]))
        const missingProduct = requestedItems.find((item) => !productById.has(item.productId))
        if (missingProduct) {
          throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'One or more selected products are unavailable.')
        }

        let subtotalCents = 0n
        const saleItems = requestedItems.map(({ productId, quantity }) => {
          const product = productById.get(productId)
          if (product.stockQuantity < quantity) {
            throw new HttpError(
              409,
              'INSUFFICIENT_STOCK',
              `${product.name} has only ${product.stockQuantity} available.`,
            )
          }

          const unitPriceCents = decimalToCentsFromDatabase(product.unitPrice)
          const lineTotalCents = unitPriceCents * BigInt(quantity)
          subtotalCents += lineTotalCents
          if (subtotalCents > MAX_MONEY_CENTS) {
            throw new HttpError(400, 'VALIDATION_ERROR', 'The sale subtotal exceeds the supported money limit.')
          }

          return {
            product,
            productId,
            quantity,
            unitPriceCents,
            lineTotalCents,
          }
        })

        if (discountCents > subtotalCents) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'Discount cannot exceed the sale subtotal.')
        }

        const totalCents = subtotalCents - discountCents
        const paidCents = amountTenderedCents < totalCents ? amountTenderedCents : totalCents
        const changeCents = amountTenderedCents - paidCents
        const paymentStatus =
          paidCents === 0n && totalCents > 0n
            ? 'UNPAID'
            : paidCents < totalCents
              ? 'PARTIALLY_PAID'
              : 'PAID'

        if (customerId) {
          const customer = await transaction.customer.findUnique({
            where: { id: customerId },
            select: { id: true },
          })
          if (!customer) {
            throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'The selected customer was not found.')
          }
        }

        const createdSale = await transaction.sale.create({
          data: {
            reference: makeReference(),
            customerId,
            subtotal: centsToDecimal(subtotalCents),
            discount: centsToDecimal(discountCents),
            totalAmount: centsToDecimal(totalCents),
            amountPaid: centsToDecimal(paidCents),
            changeDue: centsToDecimal(changeCents),
            paymentStatus,
            paymentMethod,
          },
        })

        for (const item of saleItems) {
          const updated = await transaction.product.updateMany({
            where: {
              id: item.productId,
              isActive: true,
              stockQuantity: { gte: item.quantity },
            },
            data: { stockQuantity: { decrement: item.quantity } },
          })
          if (updated.count !== 1) {
            throw new HttpError(
              409,
              'INSUFFICIENT_STOCK',
              `${item.product.name} no longer has enough stock to complete this sale.`,
            )
          }

          await transaction.saleItem.create({
            data: {
              saleId: createdSale.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: centsToDecimal(item.unitPriceCents),
              lineTotal: centsToDecimal(item.lineTotalCents),
            },
          })

          await transaction.stockMovement.create({
            data: {
              productId: item.productId,
              saleId: createdSale.id,
              type: 'SALE',
              quantity: -item.quantity,
              note: `POS sale ${createdSale.reference}`,
              occurredAt: createdSale.soldAt,
            },
          })
        }

        return transaction.sale.findUniqueOrThrow({
          where: { id: createdSale.id },
          include: saleInclude,
        })
      },
      { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 },
    )

    return saleResponse(sale)
  } catch (error) {
    if (error?.code === 'P2034') {
      throw new HttpError(
        409,
        'CONCURRENT_STOCK_CHANGE',
        'Inventory changed during checkout. Refresh the cart and try again.',
      )
    }
    throw error
  }
}

export async function listSales({ page, pageSize, skip, search, paymentMethod, paymentStatus, from, to }) {
  const where = {
    ...(search ? { reference: { contains: search } } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(from || to ? { soldAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  }
  const [sales, totalItems] = await prisma.$transaction([
    prisma.sale.findMany({
      where,
      select: {
        id: true,
        reference: true,
        subtotal: true,
        discount: true,
        totalAmount: true,
        amountPaid: true,
        changeDue: true,
        paymentStatus: true,
        paymentMethod: true,
        soldAt: true,
        customer: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { quantity: true } },
      },
      orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
  ])

  const data = sales.map((sale) => saleResponse(sale))
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

export async function getSale(key) {
  const sale = await prisma.sale.findFirst({
    where: { OR: [{ id: key }, { reference: key }] },
    include: saleInclude,
  })
  if (!sale) {
    throw new HttpError(404, 'NOT_FOUND', 'Sale was not found.')
  }
  return saleResponse(sale)
}

export async function listSaleCustomerOptions(search) {
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    select: { id: true, firstName: true, lastName: true, phone: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: 100,
  })
  return customers.map((customer) => ({
    ...customer,
    name: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
  }))
}

export async function getDailySalesSummary(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const [totals, outstandingRows] = await prisma.$transaction([
    prisma.sale.aggregate({
      where: { soldAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { totalAmount: true, amountPaid: true },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(GREATEST(totalAmount - amountPaid, 0)), 0) AS totalOutstanding
      FROM Sale
      WHERE soldAt >= ${start} AND soldAt < ${end}
    `,
  ])

  const totalSalesCents = decimalToCentsFromDatabase(totals._sum.totalAmount ?? '0')
  const collectedCents = decimalToCentsFromDatabase(totals._sum.amountPaid ?? '0')
  const outstandingCents = decimalToCentsFromDatabase(outstandingRows[0].totalOutstanding)
  const date = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-')

  return {
    date,
    numberOfSales: totals._count._all,
    totalSalesAmount: centsToDecimal(totalSalesCents),
    totalCollected: centsToDecimal(collectedCents),
    totalOutstandingBalance: centsToDecimal(outstandingCents),
  }
}
