import { Router } from 'express'
import express from 'express'
import {
  archiveProductController,
  clearProductImageController,
  createProductController,
  getProductController,
  getProductImageController,
  listProductsController,
  saveProductImageController,
  updateProductController,
} from '../controllers/productsController.js'

const router = Router()
const parseProductImage = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp'],
  limit: '5mb',
})

router.get('/', listProductsController)
router.get('/:id/image/:filename', getProductImageController)
router.put('/:id/image', parseProductImage, saveProductImageController)
router.delete('/:id/image', clearProductImageController)
router.get('/:id', getProductController)
router.post('/', createProductController)
router.patch('/:id', updateProductController)
router.delete('/:id', archiveProductController)

export default router
