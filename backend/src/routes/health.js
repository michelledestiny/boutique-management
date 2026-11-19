import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (_request, response) => {
  let database = 'connected'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    database = 'unavailable'
    console.error('Health check could not reach MySQL:', error.message)
  }

  const isHealthy = database === 'connected'

  return response.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database,
    timestamp: new Date().toISOString(),
  })
})

export default router
