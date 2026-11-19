import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/errors.js'

const imageDirectory = fileURLToPath(new URL('../../uploads/product-images/', import.meta.url))
const maxImageBytes = 5 * 1024 * 1024
const signatures = [
  {
    mimeType: 'image/png',
    extension: 'png',
    matches: (image) => image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    matches: (image) => image.length >= 3 && image[0] === 255 && image[1] === 216 && image[2] === 255,
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    matches: (image) =>
      image.length >= 12 &&
      image.toString('ascii', 0, 4) === 'RIFF' &&
      image.toString('ascii', 8, 12) === 'WEBP',
  },
]

function storedFilename(imageUrl) {
  const match = /^\/api\/v1\/products\/[^/]{1,90}\/image\/([0-9a-f-]{36}\.(?:png|jpg|webp))$/.exec(
    imageUrl ?? '',
  )
  return match?.[1] ?? null
}

async function removeStoredImage(filename) {
  if (!filename) {
    return
  }
  try {
    await unlink(path.join(imageDirectory, filename))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

function imageFormat(contentType, image) {
  if (!Buffer.isBuffer(image) || image.length === 0) {
    throw new HttpError(400, 'INVALID_IMAGE', 'Choose an image file to upload.')
  }
  if (image.length > maxImageBytes) {
    throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Product images must be 5 MB or smaller.')
  }
  const normalizedType = contentType?.split(';')[0].trim().toLowerCase()
  const format = signatures.find(({ matches }) => matches(image))
  if (!format || normalizedType !== format.mimeType) {
    throw new HttpError(400, 'INVALID_IMAGE', 'Upload a valid PNG, JPEG, or WebP image.')
  }
  return format
}

function imageUrlFor(productId, filename) {
  return `/api/v1/products/${encodeURIComponent(productId)}/image/${filename}`
}

async function findActiveProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, isActive: true, imageUrl: true },
  })
  if (!product || !product.isActive) {
    throw new HttpError(404, 'NOT_FOUND', 'Active product was not found.')
  }
  return product
}

export async function saveProductImage(id, contentType, image) {
  const format = imageFormat(contentType, image)
  const product = await findActiveProduct(id)
  const filename = `${randomUUID()}.${format.extension}`
  const destination = path.join(imageDirectory, filename)
  const imageUrl = imageUrlFor(product.id, filename)

  await mkdir(imageDirectory, { recursive: true })
  await writeFile(destination, image, { flag: 'wx' })

  try {
    const updated = await prisma.product.updateMany({
      where: { id, isActive: true },
      data: { imageUrl },
    })
    if (updated.count !== 1) {
      throw new HttpError(404, 'NOT_FOUND', 'Active product was not found.')
    }
  } catch (error) {
    try {
      await removeStoredImage(filename)
    } catch (cleanupError) {
      console.error('Could not remove an unreferenced product image:', cleanupError)
    }
    throw error
  }

  const previousFilename = storedFilename(product.imageUrl)
  if (previousFilename && previousFilename !== filename) {
    await removeStoredImage(previousFilename)
  }

  return prisma.product.findUnique({ where: { id } })
}

export async function clearProductImage(id) {
  const product = await findActiveProduct(id)
  if (!product.imageUrl) {
    return prisma.product.findUnique({ where: { id } })
  }

  const updated = await prisma.product.updateMany({
    where: { id, isActive: true, imageUrl: product.imageUrl },
    data: { imageUrl: null },
  })
  if (updated.count !== 1) {
    throw new HttpError(409, 'IMAGE_CHANGED', 'The product image changed. Refresh and try again.')
  }

  await removeStoredImage(storedFilename(product.imageUrl))
  return prisma.product.findUnique({ where: { id } })
}

export async function readProductImage(id, filename) {
  if (!/^[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(filename)) {
    throw new HttpError(404, 'NOT_FOUND', 'Product image was not found.')
  }
  const product = await prisma.product.findUnique({
    where: { id },
    select: { imageUrl: true },
  })
  if (!product || product.imageUrl !== imageUrlFor(product.id, filename)) {
    throw new HttpError(404, 'NOT_FOUND', 'Product image was not found.')
  }

  try {
    const image = await readFile(path.join(imageDirectory, filename))
    const format = signatures.find(({ matches }) => matches(image))
    if (!format) {
      throw new HttpError(500, 'INVALID_STORED_IMAGE', 'The stored product image is invalid.')
    }
    return { image, contentType: format.mimeType }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new HttpError(404, 'NOT_FOUND', 'Product image was not found.')
    }
    throw error
  }
}
