import 'dotenv/config'
import app from './app.js'
import { prisma } from './lib/prisma.js'

const port = Number(process.env.PORT ?? 3000)

const server = app.listen(port, () => {
  console.log(`Boutique Management API listening on http://localhost:${port}`)
})

function shutdown(signal) {
  console.log(`${signal} received; closing the server.`)
  server.close((error) => {
    if (error) {
      console.error('Could not close the HTTP server cleanly:', error)
      process.exitCode = 1
    }

    prisma.$disconnect().catch((disconnectError) => {
      console.error('Could not disconnect from MySQL cleanly:', disconnectError)
      process.exitCode = 1
    })
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
