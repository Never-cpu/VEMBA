import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

const STORAGE_KEY = 'vemba:product-reviews:v1'
let legacyMigrationPromise
const FIRST_NAMES = ['Avery', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Jamie', 'Drew', 'Quinn', 'Alex', 'Sam', 'Harper', 'Cameron', 'Skyler', 'Rowan', 'Emerson', 'Parker', 'Reese', 'Hayden', 'Finley', 'Dakota', 'Elliot', 'Sage', 'Logan', 'Robin', 'Kendall', 'Phoenix', 'Blair', 'Devon', 'Ellis', 'Micah', 'Remy']
const NAME_SYLLABLES = 'bcdfghjklmnprstvz'.split('').flatMap((consonant) => 'aeiou'.split('').map((vowel) => consonant + vowel))

function makeExampleNames(product, products, count) {
  const orderedIds = [...new Set([...(products || []).map((item) => String(item.id)), String(product.id)])].sort()
  const productIndex = Math.max(0, orderedIds.indexOf(String(product.id)))

  return Array.from({ length: count }, (_, reviewIndex) => {
    const uniqueIndex = productIndex * 1_000_000 + reviewIndex
    const first = FIRST_NAMES[uniqueIndex % FIRST_NAMES.length]
    let nameIndex = Math.floor(uniqueIndex / FIRST_NAMES.length)
    if (nameIndex === 0) return first

    const nameParts = []
    while (nameIndex > 0) {
      nameParts.push(NAME_SYLLABLES[nameIndex % NAME_SYLLABLES.length])
      nameIndex = Math.floor(nameIndex / NAME_SYLLABLES.length)
    }
    return `${first}${nameParts.reverse().join('')}`
  })
}

function makeUniqueExampleNames(product, products, count, existingNames = []) {
  const reserved = new Set((existingNames || []).map((name) => String(name).trim().toLowerCase()).filter(Boolean))
  const generated = []
  const candidates = makeExampleNames(product, products, count + reserved.size)

  for (const name of candidates) {
    const normalized = name.trim().toLowerCase()
    if (reserved.has(normalized) || generated.some((existing) => existing.trim().toLowerCase() === normalized)) {
      continue
    }
    generated.push(name)
    if (generated.length >= count) break
  }

  return generated
}

const EXAMPLE_REVIEW_COPY = {
  jewellery: {
    openings: [
      'I was unsure what to expect from the photos, so I checked the details first.',
      'I compared a few pieces before deciding this was the style I wanted.',
      'I chose this after looking closely at the available metal and size options.',
      'I wanted something special but still easy to wear, and this caught my eye.',
      'I took a chance on this design after going back and forth between a few options.',
      'I picked this as a gift and checked the product details carefully.',
      'I had been looking for a polished look, and this one stood out.',
      'I was hesitant to choose jewellery online, but the photos helped me decide.',
      'I looked at the different versions before settling on this one.',
      'I wanted a piece I could wear often, not just save for special occasions.',
    ],
    details: [
      'The finish looks even better in person than it did on screen.',
      'The design feels polished without looking too flashy.',
      'The piece looks balanced and well finished up close.',
      'The style is easy to pair with other things I already wear.',
      'The details stand out more in person than they do in the listing.',
      'The overall look is close to what I had pictured.',
      'It feels special while still being comfortable to wear.',
      'The shape and finish are what I liked most about it.',
      'The photos gave me a good sense of the design before I chose it.',
      'I like the clean look and the attention to detail.',
    ],
    endings: [
      'I am glad I took the time to choose this one.',
      'It has become one of my favourite pieces.',
      'I would check the size and option details before ordering.',
      'It is just the kind of understated piece I wanted.',
    ],
  },
  gaming: {
    openings: [
      'I was comparing a few options for my setup before I chose this one.',
      'I checked the model details carefully because I wanted the right version.',
      'I picked this while looking for an upgrade to my gaming setup.',
      'I was unsure at first, but the specifications helped me decide.',
      'I chose this after checking which features mattered most to me.',
      'I spent time comparing models and this one had the setup I wanted.',
      'I wanted something that would work well with the rest of my gear.',
      'I bought this as a gift and checked the version details first.',
      'I had been looking at a few gaming products and this stood out.',
      'I chose this one after reading through the product details.',
    ],
    details: [
      'The setup was straightforward and it fits into my space well.',
      'The features match what I was looking for.',
      'The controls feel comfortable during longer sessions.',
      'The product details helped me understand which version to choose.',
      'It works well with the rest of my setup.',
      'The design feels solid and is easy to use.',
      'The size and layout are a good fit for my desk.',
      'I like how simple it was to get started with it.',
      'The model has the options I wanted without extra clutter.',
      'It feels like a useful upgrade for my setup.',
    ],
    endings: [
      'I am happy with the choice so far.',
      'I would double-check the model and included accessories before ordering.',
      'It has been a good fit for what I needed.',
      'I am glad I compared the versions first.',
    ],
  },
  general: {
    openings: [
      'I was not sure what to expect from the photos, but I took a chance on this one.',
      'I spent a while comparing options before settling on this.',
      'I chose this after checking the specifications and thinking through what I needed.',
      'I was hesitant to order online, so I read the product details carefully.',
      'This caught my eye while I was looking for something practical and well made.',
      'I went back and forth between a couple of versions before choosing this one.',
      'I had been looking at similar products and finally decided to try this.',
      'I bought this as a gift and spent extra time checking the model details.',
      'My first impression from the listing was good, and it looks even better in person.',
      'I was looking for an upgrade and this matched what I had in mind.',
    ],
    details: [
      'The finish looks better in real life than it did on screen.',
      'The size and overall feel suit what I needed.',
      'The details are close to what I expected from the listing.',
      'It feels well made and works for the way I plan to use it.',
      'The design is simple and fits in with what I already have.',
      'The product photos gave me a useful sense of the style.',
      'I like the way it looks and feels in person.',
      'The main features are easy to understand and use.',
      'It feels like a thoughtful choice for the price.',
      'The product details helped me pick the version that suited me.',
    ],
    endings: [
      'I am happy with how it fits into what I needed.',
      'I would check the size and options before ordering.',
      'I am glad I compared the details before picking this one.',
      'It has been a good fit for me so far.',
    ],
  },
}

function getExampleReviewCount(product) {
  const category = product.category?.toLowerCase() || ''
  const price = Number(String(product.price || '').replace(/[^0-9.]/g, '')) || 0
  const highVolume = category.includes('gaming') || category.includes('jewel') || category.includes('watch') || price >= 1000
  const hash = [...String(product.id)].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  return highVolume ? 151 + (hash % 15) : 101 + (hash % 19)
}

function makeGeneratedExamples(product, count) {
  const category = product.category?.toLowerCase() || ''
  const copy = category.includes('jewel')
    ? EXAMPLE_REVIEW_COPY.jewellery
    : category.includes('gaming')
      ? EXAMPLE_REVIEW_COPY.gaming
      : EXAMPLE_REVIEW_COPY.general
  const hash = [...String(product.id)].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)

  return Array.from({ length: count }, (_, index) => {
    const opening = copy.openings[index % copy.openings.length]
    const detail = copy.details[Math.floor(index / copy.openings.length) % copy.details.length]
    const ending = copy.endings[Math.floor(index / (copy.openings.length * copy.details.length)) % copy.endings.length]
    return {
      rating: 3 + ((index + hash) % 3),
      text: `${opening} ${detail} ${ending}`,
    }
  })
}

async function postReview(review) {
  const response = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  })
  const result = await response.json().catch(() => ({}))
  return { response, result }
}

function migrateLegacyReviews() {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = (async () => {
      let saved
      try {
        saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
      } catch {
        return
      }
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return

      for (const [productId, productReviews] of Object.entries(saved)) {
        if (!Array.isArray(productReviews)) continue
        for (const review of productReviews) {
          if (!review || typeof review.name !== 'string' || typeof review.text !== 'string') continue
          const { response, result } = await postReview({
            productId,
            name: review.name,
            rating: review.rating,
            text: review.text,
          })
          if (!response.ok && response.status !== 409) {
            throw new Error(result.error || 'Could not share previously saved reviews.')
          }
        }
      }
      window.localStorage.removeItem(STORAGE_KEY)
    })().catch((error) => {
      legacyMigrationPromise = undefined
      throw error
    })
  }
  return legacyMigrationPromise
}

function Stars({ rating, interactive = false, onChange }) {
  if (interactive) {
    return (
      <div className="review-form__rating" role="radiogroup" aria-label="Your rating">
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
              onClick={() => onChange(value)}
            >
              <Star size={19} fill={value <= rating ? 'currentColor' : 'none'} />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <span className="review-card__stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < rating ? 'currentColor' : 'none'} />)}
    </span>
  )
}

function ReviewCard({ review }) {
  return (
    <article className="review-card">
      <div className="review-card__top">
        <div>
          <strong>{review.name}</strong>
        </div>
        <Stars rating={review.rating} />
      </div>
      <p>{review.text}</p>
    </article>
  )
}

export default function ProductReviews({ product, products }) {
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [visibleExampleCount, setVisibleExampleCount] = useState(5)
  const exampleReviewCount = getExampleReviewCount(product)
  const sampleReviews = makeGeneratedExamples(product, exampleReviewCount)
  const exampleNames = makeUniqueExampleNames(product, products, sampleReviews.length, reviews.map((review) => review.name))

  useEffect(() => setVisibleExampleCount(5), [product.id])

  useEffect(() => {
    const controller = new AbortController()
    const loadReviews = async () => {
      setLoadingReviews(true)
      setMessage('')
      try {
        await migrateLegacyReviews()
        const response = await fetch('/api/reviews?productId=' + encodeURIComponent(product.id), {
          signal: controller.signal,
          cache: 'no-store',
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Could not load shared reviews.')
        setReviews(Array.isArray(result.reviews) ? result.reviews : [])
      } catch {
        if (!controller.signal.aborted) setMessage('Shopper reviews could not load. Please refresh and try again.')
      } finally {
        if (!controller.signal.aborted) setLoadingReviews(false)
      }
    }
    loadReviews()
    return () => controller.abort()
  }, [product.id])

  const submit = async (event) => {
    event.preventDefault()
    if (submitting || !name.trim() || !text.trim()) return

    setSubmitting(true)
    setMessage('')
    try {
      const { response, result } = await postReview({
        productId: product.id,
        name: name.trim(),
        rating,
        text: text.trim(),
      })
      if (!response.ok) {
        setMessage(result.error || 'Your review could not be shared. Please try again.')
        return
      }
      setReviews((current) => [result.review, ...current])
      setName('')
      setText('')
      setRating(5)
      setMessage('Thanks, your review is now shared with other shoppers.')
    } catch {
      setMessage('Shopper reviews are unavailable right now. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="product-reviews" id="product-reviews" aria-labelledby="product-reviews-title">
      <div className="product-reviews__intro">
        <p className="eyebrow">Share your experience</p>
        <h2 id="product-reviews-title">Shopper <em>reviews.</em></h2>
        <p>Tell other shoppers what you think about {product.name}.</p>
      </div>

      <div className="product-reviews__content">
        <form className="review-form" onSubmit={submit}>
          <h3>Write a review</h3>
          <p>Reviews you post here are shared with other shoppers.</p>
          <label>
            <span>Your name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" required placeholder="Name to display" />
          </label>
          <fieldset>
            <legend>Your rating</legend>
            <Stars rating={rating} interactive onChange={setRating} />
          </fieldset>
          <label>
            <span>Your review</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} required rows={5} placeholder="What should other shoppers know?" />
          </label>
          {message && <p className="review-form__message" role="status">{message}</p>}
          <button type="submit" className="button button--dark" disabled={submitting}>{submitting ? 'Sharing...' : 'Post review'}</button>
        </form>

        <div className="product-reviews__list">
          <div className="review-list__heading">
            <h3>Shopper reviews</h3>
            <span>{loadingReviews ? 'Loading shopper reviews...' : `${reviews.length + sampleReviews.length} reviews`}</span>
          </div>
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          {sampleReviews.slice(0, visibleExampleCount).map((sample, index) => (
            <ReviewCard
              key={`example-${exampleNames[index]}`}
              review={{ name: exampleNames[index], rating: sample.rating, text: sample.text }}
            />
          ))}
          {visibleExampleCount < sampleReviews.length && (
            <button className="review-list__more" type="button" onClick={() => setVisibleExampleCount((current) => Math.min(current + 10, sampleReviews.length))}>
              Load more reviews
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
