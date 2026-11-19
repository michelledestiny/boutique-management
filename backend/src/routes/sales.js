import { Router } from 'express'
import {
  createSaleController,
  dailySalesSummaryController,
  getSaleController,
  listSalesController,
  saleCustomerOptionsController,
} from '../controllers/salesController.js'

const router = Router()

router.get('/summary', dailySalesSummaryController)
router.get('/customers', saleCustomerOptionsController)
router.get('/', listSalesController)
router.post('/', createSaleController)
router.get('/:id', getSaleController)

export default router
