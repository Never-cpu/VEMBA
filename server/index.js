import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleReviewApi } from './reviewApi.js'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDirectory = resolve(projectRoot, 'dist')
const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendError(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(message)
}

async function serveSite(request, response) {
  if (await handleReviewApi(request, response)) return
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    sendError(response, 405, 'Method not allowed.')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  } catch {
    sendError(response, 400, 'Invalid URL.')
    return
  }

  let filePath = resolve(distDirectory, `.${pathname}`)
  if (filePath !== distDirectory && !filePath.startsWith(`${distDirectory}${sep}`)) {
    sendError(response, 403, 'Forbidden.')
    return
  }

  let fileInfo
  try {
    fileInfo = await stat(filePath)
    if (fileInfo.isDirectory()) {
      filePath = resolve(filePath, 'index.html')
      fileInfo = await stat(filePath)
    }
  } catch {
    if (extname(pathname)) {
      sendError(response, 404, 'Not found.')
      return
    }
    filePath = resolve(distDirectory, 'index.html')
    try {
      fileInfo = await stat(filePath)
    } catch {
      sendError(response, 503, 'Build the storefront before starting the production server.')
      return
    }
  }

  if (!fileInfo.isFile()) {
    sendError(response, 404, 'Not found.')
    return
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': fileInfo.size,
    'X-Content-Type-Options': 'nosniff',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).pipe(response)
}

const port = Number(process.env.PORT) || 3000
const host = process.env.HOST || '0.0.0.0'
createServer((request, response) => {
  serveSite(request, response).catch(() => {
    if (!response.headersSent) sendError(response, 500, 'The server could not complete this request.')
    else response.destroy()
  })
}).listen(port, host, () => {
  console.log(`Vemba is listening on http://${host}:${port}`)
})
