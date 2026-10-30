import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { createReviewApiMiddleware } from './server/reviewApi.js'

const certificatePath = new URL('./.local/https/localhost.pfx', import.meta.url)
const reviewApiMiddleware = createReviewApiMiddleware()

const sharedReviewApi = {
  name: 'vemba-shared-review-api',
  configureServer(server) {
    server.middlewares.use(reviewApiMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use(reviewApiMiddleware)
  },
}

export default defineConfig(({ command }) => {
  if (command === 'serve' && !existsSync(certificatePath)) {
    throw new Error('Local HTTPS certificate missing. Run npm run setup:https, then npm run dev.')
  }

  const https = existsSync(certificatePath) ? { pfx: readFileSync(certificatePath) } : undefined
  return {
    plugins: [react(), sharedReviewApi],
    server: { https, strictPort: true },
    preview: { https, strictPort: true },
  }
})
