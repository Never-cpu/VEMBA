import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const reviewFile = resolve(projectRoot, 'data', 'reviews.jsonl')
const MAX_BODY_BYTES = 8192
let writeQueue = Promise.resolve()

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function isReviewEndpoint(request) {
  try {
    return new URL(request.url || '/', 'http://localhost').pathname === '/api/reviews'
  } catch {
    return false
  }
}

async function readReviews() {
  let content
  try {
    content = await readFile(reviewFile, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  return content.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try {
      const review = JSON.parse(line)
      return review && typeof review === 'object' ? [review] : []
    } catch {
      return []
    }
  })
}

function normalizeName(name) {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US')
}

async function readRequestBody(request) {
  const chunks = []
  let totalBytes = 0
  for await (const chunk of request) {
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error('The review is too long to submit.')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('The review request was not valid JSON.')
    error.statusCode = 400
    throw error
  }
}

async function saveReview(review) {
  const operation = writeQueue.then(async () => {
    const existing = await readReviews()
    const nameExists = existing.some((entry) => typeof entry?.name === 'string'
      && normalizeName(entry.name) === normalizeName(review.name))
    if (nameExists) return { duplicate: true }

    await mkdir(dirname(reviewFile), { recursive: true })
    await appendFile(reviewFile, `${JSON.stringify(review)}\n`, 'utf8')
    return { review }
  })
  writeQueue = operation.then(() => undefined, () => undefined)
  return operation
}

export async function handleReviewApi(request, response) {
  if (!isReviewEndpoint(request)) return false

  try {
    const url = new URL(request.url || '/', 'http://localhost')
    if (request.method === 'GET') {
      const productId = url.searchParams.get('productId')?.trim()
      if (!productId || productId.length > 160) {
        sendJson(response, 400, { error: 'A valid product is required.' })
        return true
      }
      const reviews = (await readReviews())
        .filter((review) => review.productId === productId)
        .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
      sendJson(response, 200, { reviews })
      return true
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST')
      sendJson(response, 405, { error: 'Use GET or POST for reviews.' })
      return true
    }

    const input = await readRequestBody(request)
    const productId = typeof input?.productId === 'string' ? input.productId.trim() : ''
    const name = typeof input?.name === 'string' ? input.name.replace(/\s+/g, ' ').trim() : ''
    const text = typeof input?.text === 'string' ? input.text.trim() : ''
    const rating = Number(input?.rating)
    if (!productId || productId.length > 160 || !name || name.length > 60 || !text || text.length > 1000
      || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendJson(response, 400, { error: 'Enter your name, a review up to 1,000 characters, and a rating from 1 to 5.' })
      return true
    }

    const review = {
      id: randomUUID(),
      productId,
      name,
      rating,
      text,
      createdAt: new Date().toISOString(),
    }
    const result = await saveReview(review)
    if (result.duplicate) {
      sendJson(response, 409, { error: 'That name has already posted a review on this site.' })
      return true
    }

    sendJson(response, 201, { review: result.review })
    return true
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'The shared reviews service is unavailable. Please try again.',
    })
    return true
  }
}

export function createReviewApiMiddleware() {
  return (request, response, next) => {
    if (!isReviewEndpoint(request)) return next()
    handleReviewApi(request, response)
  }
}
