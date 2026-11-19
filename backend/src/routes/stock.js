import { Router } from 'express'
import {
  listMovementsController,
  lowStockController,
  stockInController,
  stockOutController,
} from '../controllers/stockController.js'

const router = Router()

router.get('/movements', listMovementsController)
router.get('/low-stock', lowStockController)
router.post('/in', stockInController)
router.post('/out', stockOutController)

export default router
