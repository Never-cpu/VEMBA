import { useEffect, useRef, useState } from 'react'
import { Check, Heart, Minus, Plus, ShoppingBag, Star } from 'lucide-react'
import { useStore } from '../state/StoreContext'

const joinClasses = (...classes) => classes.filter(Boolean).join(' ')

const formatPrice = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value) || 0)

export function ProductMedia({ product, className = '', priority = false, imageIndex, imageAlt }) {
  const [failedSource, setFailedSource] = useState(null)
  const imageSource = imageIndex != null
    ? product?.images?.[imageIndex] || product?.image || product?.images?.[0]
    : product?.image || product?.images?.[0]
  const unavailable = !imageSource || failedSource === imageSource

    return (
      <div
        className={joinClasses(
          'product-media',
          'product-media--remote',
          unavailable && 'product-media--unavailable',
          priority && 'product-media--priority',
          className,
        )}
        role={unavailable ? 'img' : undefined}
        aria-label={unavailable ? `Image unavailable for ${product?.name || 'this product'}` : undefined}
        data-priority={priority ? 'true' : undefined}
      >
        {unavailable ? (
          <span className="product-media__placeholder" aria-hidden="true">
            <ShoppingBag size={28} strokeWidth={1.2} />
            <span>Image unavailable</span>
          </span>
        ) : (
          <img
            key={imageSource}
            className="product-media__image"
            src={imageSource}
            alt={imageAlt || product?.name || 'Product image'}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onError={() => setFailedSource(imageSource)}
          />
        )}
      </div>
    )
}

export function RatingStars({ rating = 0, count, reviewCount, className = '' }) {
  count = count ?? reviewCount
  const safeRating = Math.min(5, Math.max(0, Number(rating) || 0))

  return (
    <div
      className={joinClasses('product-rating', className)}
      aria-label={`${safeRating.toFixed(1)} out of 5 stars${
        count != null ? `, ${count} reviews` : ''
      }`}
    >
      <span className="product-rating__stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const fill = safeRating - index
          const state = fill >= 0.75 ? 'full' : fill >= 0.25 ? 'half' : 'empty'

          return (
            <span
              className={joinClasses(
                'product-rating__star',
                `product-rating__star--${state}`,
              )}
              key={index}
            >
              <Star size={14} strokeWidth={1.8} />
            </span>
          )
        })}
      </span>
      {count != null && (
        <span className="product-rating__count" aria-hidden="true">
          ({count})
        </span>
      )}
    </div>
  )
}

export function ProductCard({ product, onNavigate }) {
  const { addToCart, isWishlisted, toggleWishlist } = useStore()
  const [justAdded, setJustAdded] = useState(false)
  const feedbackTimer = useRef(null)
  const wishlisted = isWishlisted(product.id)
  const soldOut = product.inStock === false || (product.stock != null && Number(product.stock) <= 0)
  const reviewCount = product.reviewCount ?? (Array.isArray(product.reviews) ? product.reviews.length : product.reviews)

  useEffect(
    () => () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    },
    [],
  )

  const openProduct = () => onNavigate?.(product)

  const handleWishlist = () => {
    toggleWishlist(product.id)
  }

  const handleQuickAdd = () => {
    if (soldOut) return

    addToCart({
      productId: product.id,
      quantity: 1,
      color: product.colors?.[0]?.name,
      size: product.sizes?.[0],
    })

    setJustAdded(true)
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setJustAdded(false), 1600)
  }

  return (
    <article className="product-card">
      <div className="product-card__visual">
        <button
          className="product-card__media-button"
          type="button"
          onClick={openProduct}
          aria-label={`View ${product.name}`}
        >
          <ProductMedia product={product} className="product-card__media" />
        </button>

        {product.badge && (
          <span className="product-card__badge">{product.badge}</span>
        )}

        <button
          className={joinClasses(
            'product-card__wishlist',
            wishlisted && 'product-card__wishlist--active',
          )}
          type="button"
          onClick={handleWishlist}
          aria-label={
            wishlisted
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          aria-pressed={wishlisted}
        >
          <Heart size={18} fill={wishlisted ? 'currentColor' : 'none'} />
        </button>

        <button
          className={joinClasses(
            'product-card__quick-add',
            justAdded && 'product-card__quick-add--added',
          )}
          type="button"
          onClick={handleQuickAdd}
          disabled={soldOut}
          aria-label={
            soldOut
              ? `${product.name} is sold out`
              : `Quick add ${product.name} to bag`
          }
        >
          {soldOut ? (
            <span>Sold out</span>
          ) : justAdded ? (
            <>
              <Check size={17} aria-hidden="true" />
              <span>Added</span>
            </>
          ) : (
            <>
              <ShoppingBag size={17} aria-hidden="true" />
              <span>Quick add</span>
            </>
          )}
        </button>
      </div>

      <div className="product-card__body">
        {product.category && (
          <span className="product-card__category">{product.category.replace(/-/g, ' ')}</span>
        )}
        <button
          className="product-card__title-button"
          type="button"
          onClick={openProduct}
        >
          <h3 className="product-card__title">{product.name}</h3>
        </button>
        <div className="product-card__meta">
          <div className="product-card__prices">
            <span className="product-card__price">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.compareAt > product.price && (
              <span className="product-card__compare-price">
                {formatPrice(product.compareAt, product.currency)}
              </span>
            )}
          </div>
          {product.rating != null && (
            <RatingStars rating={product.rating} count={reviewCount} />
          )}
        </div>
      </div>
    </article>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  onAction,
  align = 'left',
  className = '',
  id,
}) {
  return (
    <div
      className={joinClasses(
        'section-heading',
        `section-heading--${align}`,
        className,
      )}
    >
      <div className="section-heading__copy">
        {eyebrow && <span className="section-heading__eyebrow">{eyebrow}</span>}
        <h2 className="section-heading__title" id={id}>
          {title}
        </h2>
        {description && (
          <p className="section-heading__description">{description}</p>
        )}
      </div>
      {action && (
        <div className="section-heading__action">
          {typeof action === 'string' && onAction ? (
            <button type="button" className="arrow-link" onClick={onAction}>
              {action}
              <span aria-hidden="true">→</span>
            </button>
          ) : action}
        </div>
      )}
    </div>
  )
}

export function QuantityControl({
  value = 1,
  onChange,
  min = 1,
  max = 99,
  label = 'Quantity',
  disabled = false,
  className = '',
}) {
  const safeValue = Math.min(max, Math.max(min, Number(value) || min))
  const decrease = () => onChange?.(Math.max(min, safeValue - 1))
  const increase = () => onChange?.(Math.min(max, safeValue + 1))

  return (
    <div
      className={joinClasses('qty-control', className)}
      role="group"
      aria-label={label}
    >
      <button
        className="qty-control__button qty-control__button--decrease"
        type="button"
        onClick={decrease}
        disabled={disabled || safeValue <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus size={15} aria-hidden="true" />
      </button>
      <output className="qty-control__value" aria-live="polite">
        {safeValue}
      </output>
      <button
        className="qty-control__button qty-control__button--increase"
        type="button"
        onClick={increase}
        disabled={disabled || safeValue >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  )
}
