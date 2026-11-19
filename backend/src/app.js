import cors from 'cors'
import express from 'express'
import healthRouter from './routes/health.js'
import productsRouter from './routes/products.js'
import salesRouter from './routes/sales.js'
import stockRouter from './routes/stock.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/products', productsRouter)
app.use('/api/v1/sales', salesRouter)
app.use('/api/v1/stock', stockRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
