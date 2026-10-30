import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Gift,
  Heart,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { ProductCard, ProductMedia, QuantityControl, RatingStars, SectionHeading } from './components/Commerce'
import ProductReviews from './components/ProductReviews'
import HomeSpotlight from './components/HomeSpotlight'
import { faqs, journalStories } from './data/catalog'
import { showcaseProducts } from './data/showcaseCatalog'
import { useStore } from './state/StoreContext'

const formatMoney = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
}).format(value || 0)
const formatSpotlightEnd = (endsAt) => `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }).format(endsAt)} WAT`
const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const categoryLabel = (value) => ({
  new: 'New arrivals',
  luxury: 'Luxury collection',
  computers: 'Computers & laptops',
  appliances: 'Home appliances',
  'kitchen-electronics': 'Kitchen electronics',
}[value] || value.replace(/-/g, ' '))
const productBrandLabel = (product) => {
  const label = product.eyebrow?.trim()
  const supplierName = (product.sourceName || product.retailer || '').trim()
  return label && label.toLowerCase() !== supplierName.toLowerCase() ? label : categoryLabel(product.category)
}
const cleanProductDescription = (description = '', product = {}) => {
  const supplierName = (product.sourceName || product.retailer || '').trim()
  const preserveManufacturer = supplierName.toLowerCase() === 'keychron'
  const displayDescription = supplierName && !preserveManufacturer
    && description.toLowerCase().startsWith(`${supplierName.toLowerCase()} `)
    ? description.slice(supplierName.length).trim()
    : description
  return displayDescription
    .replace(/\s*listed by (?:independent )?[^.]+\.?/gi, '')
    .replace(/reference price is for:/gi, 'Selected option:')
}
const PAGE_SIZE = 24
const editorialProduct = (id) => {
  const product = showcaseProducts.find((item) => item.id === id) || showcaseProducts[0]
  const supplierName = (product.sourceName || product.retailer || '').trim()
  const preserveManufacturer = supplierName.toLowerCase() === 'keychron'
  const name = supplierName && !preserveManufacturer
    && product.name.toLowerCase().startsWith(`${supplierName.toLowerCase()} `)
    ? product.name.slice(supplierName.length).trim()
    : product.name
  return name === product.name ? product : { ...product, name }
}

function useRoute() {
  const getLocation = () => `${window.location.pathname}${window.location.search}${window.location.hash}`
  const [location, setLocation] = useState(getLocation)

  useEffect(() => {
    const onPopState = () => setLocation(getLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to, options = {}) => {
    if (!to) return
    if (options.replace) window.history.replaceState({}, '', to)
    else window.history.pushState({}, '', to)
    setLocation(getLocation())
    const hash = new URL(to, window.location.origin).hash
    if (hash) {
      window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: options.instant ? 'auto' : 'smooth' }), 0)
    } else {
      window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' })
    }
  }, [])

  const url = new URL(location, window.location.origin)
  return { pathname: url.pathname, searchParams: url.searchParams, navigate }
}

function Link({ to, navigate, children, className = '', ariaLabel, onClick }) {
  return (
    <a
      href={to}
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('is-visible')
        observer.unobserve(element)
      }
    }, { threshold: 0.08 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} className={`reveal ${className}`} style={{ '--delay': `${delay}ms` }}>{children}</div>
}

function Logo({ navigate, light = false }) {
  const { closeOverlays } = useStore()
  return (
    <Link to="/" navigate={navigate} onClick={closeOverlays} className={`logo ${light ? 'logo--light' : ''}`} ariaLabel="Vemba home">
      <span className="logo__mark" aria-hidden="true"><img className="logo__image" src="/images/vemba-logo.jpeg" alt="" width="1254" height="1254" /></span>
      <span className="logo__name" aria-hidden="true">Vemba</span>
    </Link>
  )
}

function Header({ navigate }) {
  const {
    cartCount, wishlist, cartOpen, setCartOpen, searchOpen, setSearchOpen,
    mobileMenuOpen, setMobileMenuOpen,
  } = useStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const anyOpen = cartOpen || searchOpen || mobileMenuOpen
    document.body.classList.toggle('overlay-open', anyOpen)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCartOpen(false)
        setSearchOpen(false)
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('overlay-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [cartOpen, searchOpen, mobileMenuOpen, setCartOpen, setSearchOpen, setMobileMenuOpen])

  const submitSearch = (event) => {
    event.preventDefault()
    const trimmed = query.trim()
    setSearchOpen(false)
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
  }

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="announcement">
        <p>Shop shoes, furniture, mobility & more.</p>
        <Link to="/shop" navigate={navigate}>Shop now <ArrowUpRight size={12} /></Link>
      </div>
      <header className="site-header">
        <button className="icon-button mobile-only" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <Menu size={21} />
        </button>
        <Logo navigate={navigate} />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link to="/collections/new" navigate={navigate}>New in</Link>
          <Link to="/shop" navigate={navigate}>Shop all</Link>
          <Link to="/collections/luxury" navigate={navigate}>Luxury</Link>
          <Link to="/collections/gaming" navigate={navigate}>Gaming</Link>
          <Link to="/collections/audio" navigate={navigate}>Audio</Link>
          <Link to="/collections/jewellery" navigate={navigate}>Jewellery</Link>
          <Link to="/journal" navigate={navigate}>Guides</Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search size={20} />
          </button>
          <Link to="/account" navigate={navigate} className="icon-button desktop-action" ariaLabel="Account">
            <UserRound size={20} />
          </Link>
          <Link to="/wishlist" navigate={navigate} className="icon-button desktop-action icon-with-count" ariaLabel={`Wishlist with ${wishlist.length} items`}>
            <Heart size={20} />
            {wishlist.length > 0 && <span>{wishlist.length}</span>}
          </Link>
          <button className="icon-button icon-with-count" onClick={() => setCartOpen(true)} aria-label={`Open bag with ${cartCount} items`}>
            <ShoppingBag size={20} />
            {cartCount > 0 && <span>{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className={`overlay-shell ${mobileMenuOpen ? 'is-open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <button className="overlay-backdrop" onClick={closeMenu} tabIndex={mobileMenuOpen ? 0 : -1} aria-label="Close menu" />
        <aside className="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="drawer-header">
            <Logo navigate={navigate} />
            <button className="icon-button" onClick={closeMenu} aria-label="Close menu"><X /></button>
          </div>
          <nav className="mobile-nav">
            {[
              ['/collections/new', 'New in', '01'], ['/shop', 'Shop all', '02'], ['/collections/shoes', 'Shoes', '03'],
              ['/collections/furniture', 'Furniture', '04'], ['/collections/mobility', 'Mobility', '05'],
              ['/collections/audio', 'Audio', '06'], ['/collections/luxury', 'Luxury', '07'], ['/collections/gaming', 'Gaming', '08'],
              ['/collections/jewellery', 'Jewellery', '09'], ['/journal', 'Buying guides', '10'], ['/about', 'About Vemba', '11'],
            ].map(([to, label, number]) => (
              <Link key={to} to={to} navigate={navigate} onClick={closeMenu}>
                <span>{number}</span>{label}<ArrowUpRight size={18} />
              </Link>
            ))}
          </nav>
          <div className="mobile-menu__foot">
            <Link to="/account" navigate={navigate} onClick={closeMenu}><UserRound size={18} /> Account</Link>
            <Link to="/wishlist" navigate={navigate} onClick={closeMenu}><Heart size={18} /> Wishlist ({wishlist.length})</Link>
          </div>
        </aside>
      </div>

      <div className={`search-overlay ${searchOpen ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Search store" aria-hidden={!searchOpen}>
        <div className="search-overlay__head">
          <Logo navigate={navigate} />
          <button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X /></button>
        </div>
        <div className="search-overlay__body">
          <p className="eyebrow">Search products and brands</p>
          <form onSubmit={submitSearch} className="search-form search-form--large">
            <Search size={34} />
            <input autoFocus={searchOpen} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Vemba" aria-label="Search products" />
            {query && <button type="button" className="icon-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={18} /></button>}
          </form>
          <div className="search-suggestions">
            <span>Popular now</span>
            {['PS5', 'PS4', 'Diamond', 'Watches'].map((term) => (
              <button key={term} onClick={() => { setQuery(term); navigate(`/search?q=${encodeURIComponent(term)}`); setSearchOpen(false) }}>{term}</button>
            ))}
          </div>
        </div>
      </div>
      <CartDrawer navigate={navigate} />
    </>
  )
}

function CartLine({ item, compact = false, navigate }) {
  const { updateQuantity, removeFromCart, setCartOpen, getProduct } = useStore()
  const product = item.product || getProduct(item.productId)
  if (!product) return null
  const goToProduct = () => {
    setCartOpen(false)
    navigate(`/products/${product.slug}`)
  }

  return (
    <div className={`cart-line ${compact ? 'cart-line--compact' : ''}`}>
      <button className="cart-line__media" onClick={goToProduct} aria-label={`View ${product.name}`}>
        <ProductMedia product={product} />
      </button>
      <div className="cart-line__info">
        <div>
          <p className="eyebrow">{productBrandLabel(product)}</p>
          <button className="text-button cart-line__title" onClick={goToProduct}>{product.name}</button>
          <p className="muted small">{[item.color, item.size].filter(Boolean).join(' / ')}</p>
          {product.spotlightOffer && <p className="cart-line__offer">{product.spotlightOffer.discountPercent}% off · Ends {formatSpotlightEnd(product.spotlightOffer.endsAt)}</p>}
        </div>
        <div className="cart-line__bottom">
          {!compact && <QuantityControl value={item.quantity} disabled={product.stock === 0} onChange={(quantity) => updateQuantity(item.productId, quantity, item.color, item.size)} />}
          <span className="cart-line__prices">{product.spotlightOffer && <del>{formatMoney(product.spotlightOffer.originalPrice * item.quantity)}</del>}<span>{formatMoney(product.price * item.quantity)}</span></span>
        </div>
        {!compact && <button className="remove-link" onClick={() => removeFromCart(item.productId, item.color, item.size)}>Remove</button>}
      </div>
    </div>
  )
}

function CartDrawer({ navigate }) {
  const { cartOpen, setCartOpen, cart, cartItems, cartSubtotal } = useStore()
  const pendingItems = cart.length > cartItems.length || cartItems.some((item) => item.product.stock === 0)

  return (
    <div className={`overlay-shell ${cartOpen ? 'is-open' : ''}`} aria-hidden={!cartOpen}>
      <button className="overlay-backdrop" onClick={() => setCartOpen(false)} tabIndex={cartOpen ? 0 : -1} aria-label="Close bag" />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag">
        <div className="drawer-header">
          <div><p className="eyebrow">Your selection</p><h2>Bag <span>({cartItems.length})</span></h2></div>
          <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X /></button>
        </div>
        {pendingItems && <PendingCartItems />}
        {cartItems.length === 0 && !pendingItems ? (
          <EmptyState icon={<ShoppingBag />} title="Your bag is empty" copy="Add products to your bag to get started." action="Shop all products" onAction={() => { setCartOpen(false); navigate('/shop') }} />
        ) : (
          <>
            <div className="shipping-meter"><p>Delivery details will be available when checkout opens.</p></div>
            <div className="cart-drawer__items">
              {cartItems.map((item) => <CartLine key={`${item.productId}-${item.color}-${item.size}`} item={item} navigate={navigate} />)}
            </div>
            <div className="cart-drawer__foot">
              <div className="subtotal-row"><span>Subtotal</span><strong>{formatMoney(cartSubtotal)}</strong></div>
              <p className="muted small">Review the delivery estimate at checkout.</p>
              <button className="button button--dark button--full" disabled={pendingItems} onClick={() => { setCartOpen(false); navigate('/checkout') }}>Secure checkout <ArrowRight size={18} /></button>
              <button className="text-link" onClick={() => { setCartOpen(false); navigate('/cart') }}>View bag</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function Footer({ navigate }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const submit = (event) => {
    event.preventDefault()
    if (!email.trim()) return
    setSent(true)
    setEmail('')
  }
  const links = {
    Shop: [['All products', '/shop'], ['Shoes', '/collections/shoes'], ['Furniture', '/collections/furniture'], ['Mobility', '/collections/mobility'], ['New arrivals', '/collections/new'], ['Audio', '/collections/audio'], ['Jewellery', '/collections/jewellery'], ['Wishlist', '/wishlist']],
    Company: [['About Vemba', '/about'], ['Buying guides', '/journal'], ['How to shop', '/about#materials'], ['Account', '/account']],
    'Need help?': [['Contact', '/help#contact'], ['Shipping', '/help#shipping'], ['Returns', '/help#returns'], ['FAQs', '/help']],
  }

  return (
    <footer className="site-footer">
      <div className="footer-newsletter">
        <div><p className="eyebrow">Stay updated</p><h2>New arrivals.<br /><em>Product updates.</em></h2></div>
        <form onSubmit={submit}>
          {sent ? <p className="newsletter-success"><Check /> Thank you for your interest in Vemba.</p> : <>
            <label htmlFor="footer-email">Email address</label>
            <div><input id="footer-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /><button aria-label="Join newsletter"><ArrowRight /></button></div>
            <p>New arrivals, product highlights and shopping guides.</p>
          </>}
        </form>
      </div>
      <div className="footer-main">
        <div className="footer-brand"><Logo navigate={navigate} light /><p>Watches, jewellery,<br />gaming and audio.</p><span>Discover leading brands</span></div>
        <div className="footer-links">
          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}><h3>{heading}</h3>{items.map(([label, to]) => <Link key={label} to={to} navigate={navigate}>{label}</Link>)}</div>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Vemba. All rights reserved.</span>
        <div><button aria-label="Instagram" className="social-monogram">IG</button><Link to="/help" navigate={navigate}>Privacy</Link><Link to="/help" navigate={navigate}>Terms</Link></div>
        <span>Find it at Vemba</span>
      </div>
    </footer>
  )
}

function HomePage({ navigate }) {
  const { products } = useStore()
  const featured = products.filter((product) => product.isNew).slice(0, 4)
  const latest = products.filter((product) => product.isNew && product.category === 'gaming').slice(0, 4)
  const spotlight = products.find((product) => product.isNew && product.category === 'watches') || products[0]
  const categoryTiles = [
    { title: 'Jewellery', copy: 'Rings, necklaces & more', to: '/collections/jewellery', product: products.find((product) => product.category === 'jewellery'), tone: 'cream' },
    { title: 'Watches', copy: 'Rolex, Cartier & more', to: '/collections/watches', product: spotlight, tone: 'stone' },
    { title: 'Gaming', copy: 'Consoles, games & accessories', to: '/collections/gaming', product: products.find((product) => product.category === 'gaming'), tone: 'sage' },
    { title: 'Shoes', copy: 'Everyday footwear & more', to: '/collections/shoes', product: products.find((product) => product.category === 'shoes'), tone: 'stone' },
    { title: 'Furniture', copy: 'Chairs, tables & more', to: '/collections/furniture', product: products.find((product) => ['chairs', 'tables', 'furniture'].includes(product.category)), tone: 'cream' },
    { title: 'Mobility', copy: 'Wheelchairs & mobility aids', to: '/collections/mobility', product: products.find((product) => product.category === 'wheelchairs'), tone: 'sage' },
  ]

  return (
    <main id="main-content">
      <section className="hero">
        <button className="hero__image" onClick={() => navigate(`/products/${spotlight.slug}`)} aria-label={`Discover ${spotlight.name}`}>
          <ProductMedia product={spotlight} priority />
          <span className="hero__product-caption"><span>Featured watch</span><strong>{spotlight.name}</strong><ArrowUpRight size={20} /></span>
        </button>
        <div className="hero__content">
          <p className="eyebrow hero__eyebrow">Shop Vemba</p>
          <h1>Top brands.<br /><em>More choice.</em></h1>
          <p>Discover footwear, furniture, wheelchairs, luxury watches, jewellery, gaming and audio, all in one place.</p>
          <div className="button-row">
            <button className="button button--light" onClick={() => navigate('/shop')}>Shop all products <ArrowRight size={17} /></button>
            <button className="button button--glass" onClick={() => navigate('/collections/new')}>Shop new arrivals</button>
          </div>
        </div>
        <button className="hero__scroll" onClick={() => document.getElementById('home-categories')?.scrollIntoView({ behavior: 'smooth' })}>
          <span>Browse categories</span><span className="hero__scroll-line" />
        </button>
        <div className="hero__index"><span>04</span><span>/</span><span>26</span></div>
      </section>

      <section className="service-strip" aria-label="Shop with Vemba">
        <div><PackageCheck size={19} /><span><strong>Leading brands</strong>Watches, jewellery & tech</span></div>
        <div><Search size={19} /><span><strong>Compare products</strong>Find the right model</span></div>
        <div><Clock3 size={19} /><span><strong>New arrivals</strong>Explore the latest additions</span></div>
        <div><ShoppingBag size={19} /><span><strong>Save favourites</strong>Build your wishlist</span></div>
      </section>

      <HomeSpotlight navigate={navigate} />

      <section className="section categories-section" id="home-categories">
        <Reveal><SectionHeading eyebrow="Browse our range" title={<>Shop by <em>category.</em></>} action="Shop all products" onAction={() => navigate('/shop')} /></Reveal>
        <div className="category-grid">
          {categoryTiles.map((tile, index) => (
            <Reveal key={tile.title} delay={index * 100} className={`category-tile category-tile--${tile.tone}`}>
              <button onClick={() => navigate(tile.to)} aria-label={`Shop ${tile.title}`}>
                <ProductMedia product={tile.product} />
                <span className="category-tile__number">0{index + 1}</span>
                <span className="category-tile__content"><small>{tile.copy}</small><strong>{tile.title}</strong><span>Shop now <ArrowUpRight size={16} /></span></span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section product-section">
        <Reveal><SectionHeading eyebrow="Just added" title={<>New <em>arrivals.</em></>} action="View new arrivals" onAction={() => navigate('/collections/new')} /></Reveal>
        <div className="product-grid product-grid--four">
          {featured.map((product, index) => <Reveal key={product.id} delay={index * 70}><ProductCard product={product} onNavigate={(item) => navigate(`/products/${item.slug}`)} /></Reveal>)}
        </div>
      </section>

      <section className="editorial-split">
        <Reveal className="editorial-split__image"><ProductMedia product={editorialProduct('luxury-rc-classic-diamond-tennis-necklace')} /></Reveal>
        <Reveal className="editorial-split__copy" delay={120}>
          <p className="eyebrow">Fine jewellery</p>
          <h2>Shop diamond <em>jewellery.</em></h2>
          <p>Explore diamond necklaces, bracelets, rings and earrings in Vemba's fine jewellery collection.</p>
          <div className="editorial-facts">
            <div><span>01</span><p><strong>Necklaces</strong>Diamond tennis necklaces and pendants.</p></div>
            <div><span>02</span><p><strong>Bracelets</strong>Tennis bracelets, chains and diamond styles.</p></div>
            <div><span>03</span><p><strong>Earrings</strong>Diamond studs, hoops and statement pairs.</p></div>
          </div>
          <button className="arrow-link" onClick={() => navigate('/collections/jewellery')}>Shop jewellery <ArrowRight size={18} /></button>
        </Reveal>
      </section>

      <div className="marquee" aria-hidden="true"><div><span>Luxury watches</span><i>✦</i><span>Jewellery, gaming & audio</span><i>✦</i><span>Luxury watches</span><i>✦</i><span>Jewellery, gaming & audio</span><i>✦</i></div></div>

      <section className="section new-drop">
        <Reveal><SectionHeading eyebrow="Featured products" title={<>Watches &amp;<br /><em>gaming essentials.</em></>} action="Shop gaming" onAction={() => navigate('/collections/gaming')} /></Reveal>
        <div className="new-drop__grid">
          <Reveal className="new-drop__feature">
            <button onClick={() => navigate(`/products/${spotlight.slug}`)}>
              <ProductMedia product={spotlight} />
              <span>Featured watch</span>
              <div><small>{productBrandLabel(spotlight)}</small><h3>{spotlight.name}</h3><p>{formatMoney(spotlight.price)}</p></div>
            </button>
          </Reveal>
          <div className="new-drop__products">
            {latest.map((product, index) => <Reveal key={product.id} delay={index * 60}><ProductCard product={product} onNavigate={(item) => navigate(`/products/${item.slug}`)} /></Reveal>)}
          </div>
        </div>
      </section>

      <section className="quote-section">
        <Reveal>
          <p className="eyebrow">Shop the full range</p>
          <blockquote>Watches, jewellery &amp; tech.<br /><em>Find yours at Vemba.</em></blockquote>
          <button className="arrow-link" onClick={() => navigate('/shop')}>Shop all products <ArrowRight size={18} /></button>
        </Reveal>
      </section>

      <JournalPreview navigate={navigate} />
    </main>
  )
}

function JournalPreview({ navigate }) {
  return (
    <section className="section journal-preview">
      <Reveal><SectionHeading eyebrow="Buying guides" title={<>Find the right<br /><em>product for you.</em></>} action="View buying guides" onAction={() => navigate('/journal')} /></Reveal>
      <div className="story-grid">
        {journalStories.slice(0, 3).map((story, index) => (
          <Reveal key={story.slug || story.title} delay={index * 80}>
            <article className={`story-card story-card--${index + 1}`}>
              <button className="story-card__image" onClick={() => navigate(`/journal/${story.slug}`)} aria-label={`Read ${story.title}`}>
                <ProductMedia product={editorialProduct(story.productId)} />
                <span>{story.issue || `0${index + 1}`}</span>
              </button>
              <p className="eyebrow">{story.category || 'Buying guides'} · {story.readTime || '5 min read'}</p>
              <h3><button onClick={() => navigate(`/journal/${story.slug}`)}>{story.title}</button></h3>
              <p>{story.excerpt}</p>
              <button className="arrow-link" onClick={() => navigate(`/journal/${story.slug}`)}>Read guide <ArrowRight size={16} /></button>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function PageHero({ eyebrow, title, copy, compact = false }) {
  return <section className={`page-hero ${compact ? 'page-hero--compact' : ''}`}><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{copy && <p>{copy}</p>}</section>
}

function CatalogStatus() {
  const { productsLoading, productsError, reloadProducts } = useStore()
  if (!productsLoading && !productsError) return null
  return <div className="catalog-status" role="status" aria-live="polite">
    <span>{productsLoading ? 'Loading products…' : productsError}</span>
    {!productsLoading && <button className="text-link" onClick={reloadProducts}>Try again</button>}
  </div>
}

function CatalogPagination({ shown, total, onLoadMore }) {
  if (!total) return null
  return <div className="catalog-pagination">
    <p>Showing {Math.min(shown, total)} of {total} products</p>
    {shown < total && <button className="button button--dark" onClick={onLoadMore}>Load more <Plus size={16} /></button>}
  </div>
}

function PendingCartItems() {
  const { cart, getProduct, productsLoading, removeFromCart } = useStore()
  const pending = cart.filter((item) => {
    const product = getProduct(item.productId)
    return !product || product.stock === 0
  })
  if (!pending.length) return null
  return <div className="pending-cart-items">
    <CatalogStatus />
    {!productsLoading && <><p>Some items in your bag are unavailable. Refresh the product list or remove them to continue.</p>{pending.map((item) => <button key={`${item.productId}-${item.color}-${item.size}`} className="text-link" onClick={() => removeFromCart(item)}>Remove {getProduct(item.productId)?.name || 'unavailable item'}</button>)}</>}
  </div>
}

function ShopPage({ navigate, initialCategory = 'all', title = 'All products', eyebrow = 'Shop Vemba', copy = 'Browse shoes, furniture, wheelchairs, watches, jewellery, gaming and audio. Filter by category or sort by price to find what you need.' }) {
  const { products, productsLoading, productsError } = useStore()
  const [category, setCategory] = useState(initialCategory)
  const [sort, setSort] = useState('featured')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [minimumPrice, setMinimumPrice] = useState('')
  const [maximumPrice, setMaximumPrice] = useState('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [availability, setAvailability] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const categoryNames = ['all', 'new', 'luxury', ...new Set(products.map((p) => normalize(p.category)))]
  const brandNames = [...new Set(products.map(productBrandLabel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))

  useEffect(() => setCategory(initialCategory), [initialCategory])
  useEffect(() => setVisibleCount(PAGE_SIZE), [category, sort, minimumPrice, maximumPrice, brand, size, availability])
  const filtered = useMemo(() => {
    const collectionGroups = {
      wear: ['jewellery', 'watches'],
      live: ['audio'],
      carry: ['accessories'],
      furniture: ['furniture', 'chairs', 'tables'],
      mobility: ['mobility', 'wheelchairs'],
    }
    const result = category === 'all'
      ? [...products]
      : category === 'new' ? products.filter((product) => product.isNew)
      : products.filter((p) => normalize(p.category) === category || normalize(p.collection) === category || collectionGroups[category]?.includes(normalize(p.category)))
    const priceFiltered = result.filter((product) => {
      if (minimumPrice !== '' && product.price < Number(minimumPrice)) return false
      if (maximumPrice !== '' && product.price > Number(maximumPrice)) return false
      if (brand && productBrandLabel(product) !== brand) return false
      if (size && !product.sizes?.some((productSize) => productSize.toLowerCase().includes(size.trim().toLowerCase()))) return false
      if (availability === 'available' && !(product.inStock === true || product.stock > 0)) return false
      if (availability === 'unavailable' && !(product.inStock === false || product.stock === 0)) return false
      return true
    })
    if (sort === 'price-low') priceFiltered.sort((a, b) => a.price - b.price)
    if (sort === 'price-high') priceFiltered.sort((a, b) => b.price - a.price)
    if (sort === 'rating') priceFiltered.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
    if (sort === 'newest') priceFiltered.sort((a, b) => {
      const dateA = Date.parse(a.createdAt || a.publishedAt || '') || 0
      const dateB = Date.parse(b.createdAt || b.publishedAt || '') || 0
      return dateB - dateA || Number(Boolean(b.isNew)) - Number(Boolean(a.isNew))
    })
    return priceFiltered
  }, [products, category, sort, minimumPrice, maximumPrice, brand, size, availability])

  const clearFilters = () => {
    setMinimumPrice('')
    setMaximumPrice('')
    setBrand('')
    setSize('')
    setAvailability('all')
  }

  return (
    <main id="main-content">
      <PageHero eyebrow={eyebrow} title={title} copy={copy} />
      <section className="catalog section">
        <CatalogStatus />
        <div className="catalog-toolbar">
          <div className="filter-chips desktop-filter">
            {categoryNames.map((name) => <button key={name} className={category === name ? 'is-active' : ''} aria-pressed={category === name} onClick={() => setCategory(name)}>{name === 'all' ? 'All' : categoryLabel(name)}</button>)}
          </div>
          <button className="filter-mobile-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} /> Filters</button>
          <div className="catalog-sort"><span>{filtered.length} products</span><label>Sort <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Top rated</option></select></label></div>
        </div>
        {filtersOpen && <div className="mobile-filters">{categoryNames.map((name) => <button key={name} className={category === name ? 'is-active' : ''} aria-pressed={category === name} onClick={() => { setCategory(name); setFiltersOpen(false) }}>{name === 'all' ? 'All products' : categoryLabel(name)}</button>)}</div>}
        <div className="catalog-filters" aria-label="Filter products">
          <label>Min price<input type="number" min="0" step="1" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="$0" /></label>
          <label>Max price<input type="number" min="0" step="1" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder="No limit" /></label>
          <label>Brand<select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brandNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Size<input type="search" value={size} onChange={(event) => setSize(event.target.value)} placeholder="Type a size" /></label>
          <label>Availability<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">Any availability</option><option value="available">Available</option><option value="unavailable">Sold out</option></select></label>
          <button type="button" className="catalog-filters__reset" onClick={clearFilters}>Clear filters</button>
        </div>
        <div className="product-grid product-grid--three" aria-busy={productsLoading}>
          {filtered.slice(0, visibleCount).map((product, index) => <Reveal key={product.id} delay={(index % 3) * 60}><ProductCard product={product} onNavigate={(item) => navigate(`/products/${item.slug}`)} /></Reveal>)}
        </div>
        <CatalogPagination shown={visibleCount} total={filtered.length} onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)} />
        {filtered.length === 0 && !productsLoading && !productsError && <EmptyState icon={<Search />} title="No products found" copy="Try another category or view all products." action="View all products" onAction={() => setCategory('all')} />}
      </section>
      <CollectionPromise />
    </main>
  )
}

function CollectionPromise() {
  return <section className="collection-promise"><p className="eyebrow">The collection</p><h2>Find your favourite. <em>Make it yours.</em></h2><div><p>Explore Vemba's collection, review product specifications and save favourites for later.</p><span>Product details</span><span>Curated collections</span><span>Saved favourites</span></div></section>
}

function ProductPage({ slug, navigate }) {
  const { products, getProduct, productsLoading, productsError, addToCart, toggleWishlist, isWishlisted } = useStore()
  const product = getProduct(slug)
  const galleryImages = product?.images?.length ? product.images : product?.image ? [product.image] : []
  const [color, setColor] = useState(product?.colors?.[0]?.name || '')
  const [size, setSize] = useState(product?.sizes?.[0] || '')
  const [openDetail, setOpenDetail] = useState('Details')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  useEffect(() => {
    setActiveImageIndex(0)
    setZoomOpen(false)
    setSizeGuideOpen(false)
    setColor(product?.colors?.[0]?.name || '')
    setSize(product?.sizes?.[0] || '')
  }, [product?.id])
  useEffect(() => {
    if (!zoomOpen && !sizeGuideOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setZoomOpen(false)
      if (event.key === 'Escape') setSizeGuideOpen(false)
      if (event.key === 'ArrowLeft' && galleryImages.length > 1) {
        setActiveImageIndex((index) => (index + galleryImages.length - 1) % galleryImages.length)
      }
      if (event.key === 'ArrowRight' && galleryImages.length > 1) {
        setActiveImageIndex((index) => (index + 1) % galleryImages.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [zoomOpen, sizeGuideOpen, galleryImages.length])

  if (!product && (productsLoading || productsError)) return <main id="main-content"><section className="section product-pending"><CatalogStatus /><button className="arrow-link" onClick={() => navigate('/shop')}>Browse products <ArrowRight size={17} /></button></section></main>
  if (!product) return <NotFoundPage navigate={navigate} />
  const wishlisted = isWishlisted(product.id)
  const related = products.filter((item) => item.id !== product.id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 4)
  const soldOut = product.inStock === false || (product.stock != null && product.stock <= 0)
  const activeImage = galleryImages[activeImageIndex] || product.image
  const imageProduct = { ...product, image: activeImage, images: galleryImages }
  const specifications = (product.details?.length ? product.details : ['Product specifications are being updated.']).map((detail, index) => {
    const separator = detail.indexOf(':')
    return separator > 0
      ? { label: detail.slice(0, separator).trim(), value: detail.slice(separator + 1).trim() }
      : { label: `Specification ${index + 1}`, value: detail }
  })
  const detailSections = [
    ['Details', product.editorialDetail || cleanProductDescription(product.description, product)],
    ...(product.materials?.length ? [['Materials & care', product.materials.join(' · ')]] : []),
      ['Delivery & returns', 'Vemba delivery and return details will be published before checkout opens.'],
  ]
  const add = () => {
    addToCart({ productId: product.id, quantity: 1, color, size })
  }

  return (
    <main id="main-content" className="pdp">
      <div className="breadcrumbs"><Link to="/shop" navigate={navigate}>Shop</Link><ChevronRight size={13} /><span>{categoryLabel(product.category)}</span><ChevronRight size={13} /><span>{product.name}</span></div>
      <div className="pdp-layout">
        <div className="pdp-gallery">
          <div role="button" tabIndex={0} className="pdp-gallery__main" onClick={() => setZoomOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setZoomOpen(true) } }} aria-label={`Enlarge photo of ${product.name}`}>
            <ProductMedia product={imageProduct} priority imageAlt={product.imageAlts?.[activeImageIndex] || product.name} />
            <span className="pdp-gallery__zoom-hint">Click to zoom</span>
          </div>
          {galleryImages.length > 1 && <div className="pdp-gallery__thumbs" role="group" aria-label="Product photos">
            {galleryImages.map((src, index) => <div key={`${src}-${index}`} role="button" tabIndex={0} className={`pdp-gallery__thumb ${index === activeImageIndex ? 'is-active' : ''}`} onClick={() => setActiveImageIndex(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveImageIndex(index) } }} aria-label={`Show photo ${index + 1}`} aria-pressed={index === activeImageIndex}>
              <ProductMedia product={product} imageIndex={index} imageAlt={product.imageAlts?.[index] || `${product.name}, photo ${index + 1}`} />
            </div>)}
          </div>}
          <span className="pdp-gallery__count">{galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'}</span>
        </div>
        <section className="pdp-info">
          <p className="eyebrow">{[productBrandLabel(product), product.badge].filter(Boolean).join(' · ')}</p>
          <h1>{product.name}</h1>
          <div className="pdp-price"><span>{formatMoney(product.price)}</span>{product.compareAt && <del>{formatMoney(product.compareAt)}</del>}{product.rating != null && <RatingStars rating={product.rating} reviewCount={product.reviewCount} />}</div>
          {product.spotlightOffer && <p className="spotlight-price-note">Vemba spotlight · {product.spotlightOffer.discountPercent}% off until {formatSpotlightEnd(product.spotlightOffer.endsAt)}.</p>}
          <p className="pdp-description">{cleanProductDescription(product.description, product)}</p>
          {!!product.colors?.length && <div className="option-group"><div><strong>Colour</strong><span>{color}</span></div><div className="swatches">{product.colors.map((option) => <button key={option.name} className={color === option.name ? 'is-active' : ''} style={{ '--swatch': option.hex }} onClick={() => setColor(option.name)} aria-label={`Select ${option.name}`} title={option.name} />)}</div></div>}
          {!!product.sizes?.length && <div className="option-group"><div><strong>Size</strong><button type="button" className="text-link" onClick={() => setSizeGuideOpen(true)}>Size guide</button></div><div className="size-options">{product.sizes.map((option) => <button key={option} className={size === option ? 'is-active' : ''} onClick={() => setSize(option)}>{option}</button>)}</div></div>}
          <div className="pdp-actions"><button className="button button--dark" disabled={soldOut} onClick={add}>{soldOut ? 'Sold out' : <>Add to bag · {formatMoney(product.price)}</>}</button><button className={`wishlist-button ${wishlisted ? 'is-active' : ''}`} onClick={() => toggleWishlist(product.id)} aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}><Heart fill={wishlisted ? 'currentColor' : 'none'} /></button></div>
          <div className="delivery-note"><Truck size={19} /><div><strong>{soldOut ? 'Sold out' : product.stock === 0 ? 'Currently unavailable' : 'Availability to be confirmed'}</strong><span>Vemba delivery details will be available when checkout opens.</span></div></div>
          <div className="pdp-accordions">
            {detailSections.map(([label, content]) => <div key={label} className={openDetail === label ? 'is-open' : ''}><button onClick={() => setOpenDetail(openDetail === label ? '' : label)}><span>{label}</span><Plus size={17} /></button><p>{content}</p></div>)}
          </div>
        </section>
      </div>
      <section className="pdp-story"><p className="eyebrow">Specifications</p><h2>Product <em>details.</em></h2><dl className="pdp-spec-grid">{specifications.map(({ label, value }, index) => <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      {zoomOpen && createPortal(<div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`${product.name} photo viewer`} onClick={() => setZoomOpen(false)}>
        <button type="button" className="image-lightbox__close" onClick={() => setZoomOpen(false)} aria-label="Close photo viewer"><X /></button>
        <div className="image-lightbox__stage" onClick={(event) => event.stopPropagation()}>
          {galleryImages.length > 1 && <button type="button" className="image-lightbox__nav image-lightbox__nav--previous" onClick={() => setActiveImageIndex((index) => (index + galleryImages.length - 1) % galleryImages.length)} aria-label="Previous photo"><ArrowLeft /></button>}
          <ProductMedia product={imageProduct} priority imageAlt={product.imageAlts?.[activeImageIndex] || product.name} />
          {galleryImages.length > 1 && <button type="button" className="image-lightbox__nav image-lightbox__nav--next" onClick={() => setActiveImageIndex((index) => (index + 1) % galleryImages.length)} aria-label="Next photo"><ArrowRight /></button>}
          <span className="image-lightbox__count">{activeImageIndex + 1} / {galleryImages.length}</span>
        </div>
      </div>, document.body)}
      {sizeGuideOpen && createPortal(<div className="size-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="size-guide-title" onClick={() => setSizeGuideOpen(false)}>
        <section className="size-guide-card" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="size-guide-card__close" onClick={() => setSizeGuideOpen(false)} aria-label="Close size guide"><X /></button>
          <p className="eyebrow">Vemba size guide</p>
          <h2 id="size-guide-title">Available sizes</h2>
          <p>Choose one of the size options listed for {product.name}.</p>
          <div className="size-guide-card__options">{product.sizes.map((option) => <button key={option} type="button" className={size === option ? 'is-active' : ''} onClick={() => { setSize(option); setSizeGuideOpen(false) }}>{option}</button>)}</div>
          <p className="size-guide-card__note">Fit can vary between products. Contact Vemba support if you need help choosing.</p>
        </section>
      </div>, document.body)}
      <ProductReviews key={product.id} product={product} products={products} />
      <section className="section"><SectionHeading eyebrow="Related products" title={<>You may <em>also like.</em></>} /><div className="product-grid product-grid--four">{related.map((item) => <ProductCard key={item.id} product={item} onNavigate={(p) => navigate(`/products/${p.slug}`)} />)}</div></section>
    </main>
  )
}

function SearchPage({ navigate, initialQuery = '' }) {
  const { products, productsLoading, productsError } = useStore()
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => { setQuery(initialQuery); setSubmitted(initialQuery) }, [initialQuery])
  useEffect(() => setVisibleCount(PAGE_SIZE), [submitted])
  const results = products.filter((product) => {
    const haystack = `${product.name} ${categoryLabel(product.category)} ${product.collection} ${product.description} ${product.eyebrow}`.toLowerCase()
    return !submitted || haystack.includes(submitted.toLowerCase())
  })
  const submit = (event) => {
    event.preventDefault()
    setSubmitted(query.trim())
    window.history.replaceState({}, '', query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search')
  }
  return (
    <main id="main-content">
      <section className="search-page-head"><p className="eyebrow">Search products</p><form className="search-form search-form--page" onSubmit={submit}><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What are you looking for?" aria-label="Search products" /><button aria-label="Submit search"><Search /></button></form></section>
      <section className="section search-results">
        <CatalogStatus />
        <div className="results-head"><h2>{submitted ? <>Results for “{submitted}”</> : 'All products'}</h2><span>{results.length} {results.length === 1 ? 'product' : 'products'}</span></div>
        {results.length ? <div className="product-grid product-grid--three" aria-busy={productsLoading}>{results.slice(0, visibleCount).map((product) => <ProductCard key={product.id} product={product} onNavigate={(p) => navigate(`/products/${p.slug}`)} />)}</div> : !productsLoading && !productsError && <EmptyState icon={<Search />} title="No products found" copy="Try another product name, brand or category." action="Browse all products" onAction={() => navigate('/shop')} />}
        <CatalogPagination shown={visibleCount} total={results.length} onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)} />
      </section>
    </main>
  )
}

function WishlistPage({ navigate }) {
  const { wishlistItems: saved, wishlist, productsLoading, productsError } = useStore()
  return (
    <main id="main-content"><PageHero eyebrow="Saved for later" title="Your wishlist" copy="Keep your favourite products in one place and add them to your bag when you are ready." compact /><section className="section">
      {saved.length < wishlist.length && <CatalogStatus />}
      {saved.length ? <div className="product-grid product-grid--three">{saved.map((product) => <ProductCard key={product.id} product={product} onNavigate={(p) => navigate(`/products/${p.slug}`)} />)}</div> : !(wishlist.length && (productsLoading || productsError)) && <EmptyState icon={<Heart />} title="Your wishlist is empty" copy="Tap the heart on a product to save it for later." action="Browse products" onAction={() => navigate('/shop')} />}
    </section></main>
  )
}

function CartPage({ navigate }) {
  const { cart, cartItems, cartSubtotal } = useStore()
  const pendingItems = cart.length > cartItems.length || cartItems.some((item) => item.product.stock === 0)
  const shipping = cartSubtotal >= 150 || cartSubtotal === 0 ? 0 : 12
  return (
    <main id="main-content"><PageHero eyebrow="Your selection" title="Shopping bag" compact /><section className="cart-page section">
      <PendingCartItems />
      {cartItems.length === 0 && !pendingItems ? <EmptyState icon={<ShoppingBag />} title="Your bag is empty" copy="Browse our products and add your favourites to your bag." action="Shop all products" onAction={() => navigate('/shop')} /> : <div className="cart-layout"><div className="cart-page__items">{cartItems.map((item) => <CartLine key={`${item.productId}-${item.color}-${item.size}`} item={item} navigate={navigate} />)}<div className="cart-assurance"><div><RotateCcw /><p><strong>Returns information</strong><span>Vemba return details are coming soon.</span></p></div><div><PackageCheck /><p><strong>Product details</strong><span>Review models and specifications</span></p></div></div></div><OrderSummary subtotal={cartSubtotal} shipping={shipping} onCheckout={pendingItems ? undefined : () => navigate('/checkout')} /></div>}
    </section></main>
  )
}

function OrderSummary({ subtotal, shipping = 0, onCheckout, buttonLabel = 'Continue to checkout' }) {
  const [promo, setPromo] = useState('')
  const [promoStatus, setPromoStatus] = useState('')
  const apply = () => setPromoStatus(promo.trim().toUpperCase() === 'VEMBA10' ? 'Code applied at payment' : 'That code is not available')
  return <aside className="order-summary"><p className="eyebrow">Order summary</p><h2>{formatMoney(subtotal + shipping)}</h2><div className="summary-lines"><p><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></p><p><span>Delivery</span><strong>{shipping ? formatMoney(shipping) : 'Free'}</strong></p><p className="summary-total"><span>Total</span><strong>{formatMoney(subtotal + shipping)}</strong></p></div><div className="promo"><div><input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo code" aria-label="Promo code" /><button onClick={apply}>Apply</button></div>{promoStatus && <span className={promoStatus.startsWith('Code') ? 'success' : ''}>{promoStatus}</span>}</div>{onCheckout && <button className="button button--dark button--full" onClick={onCheckout}>{buttonLabel}<ArrowRight size={18} /></button>}<div className="secure-note"><ShieldCheck size={17} /> Review your order before checkout</div></aside>
}

function CheckoutPage({ navigate }) {
  const { cart, cartItems, cartSubtotal } = useStore()
  const [form, setForm] = useState({ email: '', first: '', last: '', address: '', city: '', region: '', postal: '', country: 'United States' })
  const [cardDetails, setCardDetails] = useState({ name: '', number: '', expiry: '', securityCode: '' })
  const [paymentMethod, setPaymentMethod] = useState('card')
  const shipping = cartSubtotal >= 150 ? 0 : 12
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const updateCard = (key, value) => setCardDetails((current) => ({ ...current, [key]: value }))
  const formatCardNumber = (digits) => digits.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const formatExpiry = (digits) => digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
  const displayedCardNumber = Array.from({ length: 4 }, (_, index) => cardDetails.number.slice(index * 4, index * 4 + 4).padEnd(4, '•')).join('  ')
  const displayedName = cardDetails.name.trim() ? cardDetails.name.trim().toUpperCase().slice(0, 26) : 'YOUR NAME'
  const displayedExpiry = cardDetails.expiry ? formatExpiry(cardDetails.expiry) : 'MM / YY'
  if (cart.length > cartItems.length || cartItems.some((item) => item.product.stock === 0)) return <main id="main-content"><section className="section checkout-empty"><PendingCartItems /><button className="arrow-link" onClick={() => navigate('/cart')}><ArrowLeft size={16} /> Back to bag</button></section></main>
  if (!cartItems.length) return <main id="main-content"><section className="section checkout-empty"><EmptyState icon={<ShoppingBag />} title="Your bag is empty" copy="Add a product to your bag before checking out." action="Browse products" onAction={() => navigate('/shop')} /></section></main>

  const field = (key, label, options = {}) => <label className="field"><span>{label}</span><input type={options.type || 'text'} autoComplete={options.autoComplete} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={options.placeholder || ''} /></label>

  return (
    <main id="main-content" className="checkout-page">
      <div className="checkout-head"><Logo navigate={navigate} /><span><ShieldCheck size={16} /> Secure checkout</span></div>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={(event) => event.preventDefault()}>
          <button type="button" className="back-link" onClick={() => navigate('/cart')}><ArrowLeft size={16} /> Back to bag</button>
          <div className="checkout-title"><p className="eyebrow">Checkout</p><h1>Checkout</h1><p>Review your details and order summary below.</p></div>
          <section className="form-section"><div className="form-section__number">01</div><div><h2>Contact</h2>{field('email', 'Email address', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}<label className="check-label"><input type="checkbox" defaultChecked /><span>Email me about new arrivals and product updates</span></label></div></section>
          <section className="form-section"><div className="form-section__number">02</div><div><h2>Delivery</h2><div className="field-grid">{field('first', 'First name', { autoComplete: 'given-name' })}{field('last', 'Last name', { autoComplete: 'family-name' })}</div>{field('address', 'Address', { autoComplete: 'street-address', placeholder: 'Street and number' })}<div className="field-grid field-grid--three">{field('city', 'City', { autoComplete: 'address-level2' })}{field('region', 'State / Region', { autoComplete: 'address-level1' })}{field('postal', 'Postal code', { autoComplete: 'postal-code' })}</div><label className="field"><span>Country</span><select value={form.country} onChange={(e) => set('country', e.target.value)}><option>United States</option><option>United Kingdom</option><option>Nigeria</option><option>Canada</option><option>France</option></select></label><div className="delivery-option is-selected"><span><Truck size={19} /></span><p><strong>Delivery estimate</strong><small>Delivery details will be available when checkout opens</small></p><strong>{shipping ? formatMoney(shipping) : 'Free'}</strong><Check size={18} /></div></div></section>
          <section className="form-section">
            <div className="form-section__number">03</div>
            <div>
              <h2 id="payment-heading">Payment</h2>
              <div className="payment-methods" role="radiogroup" aria-labelledby="payment-heading" aria-describedby="payment-status">
                {[
                  { value: 'card', label: 'Debit or credit card', description: 'Card payment demo', icon: <CreditCard size={19} /> },
                  { value: 'gift-card', label: 'Gift card', description: 'Capture a gift card code and details', icon: <Gift size={19} /> },
                ].map((method) => (
                  <label key={method.value} className={`payment-method ${paymentMethod === method.value ? 'is-selected' : ''}`}>
                    <input type="radio" name="payment-method" value={method.value} checked={paymentMethod === method.value} onChange={() => {
                      setPaymentMethod(method.value)
                      if (method.value === 'gift-card') window.open('/gift-card', '_blank', 'noopener,noreferrer')
                    }} aria-label={method.label} />
                    <span className="payment-method__icon" aria-hidden="true">{method.icon}</span>
                    <span className="payment-method__copy"><strong>{method.label}</strong><small>{method.description}</small></span>
                  </label>
                ))}
              </div>
              {paymentMethod === 'card' && <section className="demo-card-entry" aria-label="Debit or credit card details demo">
                <div className="demo-card-note"><ShieldCheck size={16} /><span>Demo only. Card details are not stored or sent.</span></div>
                <div className="card-preview" aria-hidden="true">
                  <div className="card-preview__top"><span>VEMBA</span><CreditCard size={22} /></div>
                  <div className="card-preview__chip"><i /><i /><i /><i /></div>
                  <div className="card-preview__number">{displayedCardNumber}</div>
                  <div className="card-preview__bottom"><span><small>Cardholder</small>{displayedName}</span><span><small>Expires</small>{displayedExpiry}</span></div>
                </div>
                <div className="card-entry-fields">
                  <label className="field"><span>Name on card</span><input type="text" autoComplete="off" maxLength={26} value={cardDetails.name} onChange={(event) => updateCard('name', event.target.value)} placeholder="Name as shown on card" /></label>
                  <label className="field"><span>Card number</span><input type="text" inputMode="numeric" autoComplete="off" maxLength={19} value={formatCardNumber(cardDetails.number)} onChange={(event) => updateCard('number', event.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="0000 0000 0000 0000" /></label>
                  <div className="card-entry-fields__split">
                    <label className="field"><span>Expiry date</span><input type="text" inputMode="numeric" autoComplete="off" maxLength={7} value={formatExpiry(cardDetails.expiry)} onChange={(event) => updateCard('expiry', event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="MM / YY" /></label>
                    <label className="field"><span>Security code</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={cardDetails.securityCode} onChange={(event) => updateCard('securityCode', event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="•••" /></label>
                  </div>
                </div>
              </section>}
              <button type="submit" className="button button--dark button--full checkout-submit" disabled aria-describedby="payment-status">Continue with {paymentMethod === 'card' ? 'card' : 'gift card'} · {formatMoney(cartSubtotal + shipping)}</button>
              <p id="payment-status" className="payment-disclaimer"><ShieldCheck size={16} /> Demo checkout. No payment is collected.</p>
            </div>
          </section>
        </form>
        <aside className="checkout-aside"><div><p className="eyebrow">In your bag · {cartItems.length}</p>{cartItems.map((item) => <CartLine key={`${item.productId}-${item.color}-${item.size}`} item={item} compact navigate={navigate} />)}<OrderSummary subtotal={cartSubtotal} shipping={shipping} /></div></aside>
      </div>
    </main>
  )
}

function GiftCardPage({ navigate }) {
  const [captureStatus, setCaptureStatus] = useState('')

  return (
    <main id="main-content" className="gift-card-page">
      <div className="gift-card-page__head"><Logo navigate={navigate} /><span><Gift size={16} /> Gift card capture</span></div>
      <section className="gift-card-panel">
        <p className="eyebrow">Vemba gift cards</p>
        <h1>Capture a gift card.</h1>
        <p className="gift-card-panel__intro">Enter the gift card code and any additional details.</p>
        <form className="gift-card-capture" onSubmit={(event) => { event.preventDefault(); setCaptureStatus('Demo only — these gift card details were not sent or saved.') }}>
          <label className="field"><span>Gift card code</span><input type="text" autoComplete="off" placeholder="Enter gift card code" /></label>
          <label className="field"><span>PIN or security code <small>if shown on the card</small></span><input type="password" autoComplete="off" placeholder="Enter PIN" /></label>
          <label className="field"><span>Additional details</span><textarea rows="3" placeholder="Add any other details needed to identify the gift card." /></label>
          <button className="button button--dark button--full" type="submit">Capture gift card details</button>
          {captureStatus && <p className="gift-card-capture__status" role="status">{captureStatus}</p>}
          <p className="gift-card-demo-note">Demo form. Details are not stored or sent to Vemba.</p>
        </form>
      </section>
    </main>
  )
}

function ConfirmationPage({ navigate }) {
  let order
  try { order = JSON.parse(sessionStorage.getItem('aurel-last-order')) } catch { order = null }
  const fallback = { order: 'VE-000000', total: 0, first: 'there', email: 'your inbox', items: [] }
  const data = order || fallback
  return (
    <main id="main-content" className="confirmation-page">
      <div className="confirmation-card">
        <div className="confirmation-mark"><Check /></div>
        <p className="eyebrow">Order summary {data.order}</p>
        <h1>Thank you, {data.first}.<br /><em>Your summary is ready.</em></h1>
        <p>Your order summary is saved for this session. No payment has been collected, and checkout is not active yet.</p>
        <div className="confirmation-timeline">
          <div className="is-active"><span><Check /></span><p><strong>Summary saved</strong><small>Ready to review</small></p></div>
          <div><span><CreditCard /></span><p><strong>Payment</strong><small>Not collected</small></p></div>
          <div><span><Truck /></span><p><strong>Delivery</strong><small>Details coming soon</small></p></div>
        </div>
        {data.total > 0 && <div className="confirmation-total"><span>Estimated total</span><strong>{formatMoney(data.total)}</strong></div>}
        <div className="button-row"><button className="button button--dark" onClick={() => navigate('/shop')}>Continue shopping <ArrowRight size={17} /></button><button className="button button--outline" onClick={() => navigate('/account')}>View account</button></div>
      </div>
    </main>
  )
}

function AccountPage({ navigate }) {
  const [mode, setMode] = useState('signin')
  const [complete, setComplete] = useState(false)
  if (complete) return <main id="main-content" className="account-page"><section className="account-card account-card--success"><div className="confirmation-mark"><Check /></div><p className="eyebrow">Welcome to Vemba</p><h1>Welcome back.</h1><p>Browse products, manage your bag and keep your favourites on your wishlist.</p><button className="button button--dark" onClick={() => navigate('/shop')}>Continue shopping <ArrowRight size={17} /></button></section></main>
  return (
    <main id="main-content" className="account-page"><section className="account-intro"><p className="eyebrow">Vemba account</p><h1>Your Vemba <em>account.</em></h1><ul><li><Check /> Save your favourite products</li><li><Check /> Manage your shopping bag</li><li><Check /> Explore new arrivals</li></ul></section><section className="account-card"><div className="auth-tabs"><button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'register' ? 'is-active' : ''} onClick={() => setMode('register')}>Create account</button></div><form onSubmit={(event) => { event.preventDefault(); setComplete(true) }}>{mode === 'register' && <label className="field"><span>Full name</span><input required autoComplete="name" /></label>}<label className="field"><span>Email address</span><input type="email" required autoComplete="email" /></label><label className="field"><span>Password</span><input type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>{mode === 'signin' && <div className="auth-options"><label className="check-label"><input type="checkbox" /> Remember me</label><button type="button" className="text-link">Forgot password?</button></div>}<button className="button button--dark button--full">{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button></form></section></main>
  )
}

function AboutPage({ navigate }) {
  return (
    <main id="main-content">
      <section className="about-hero">
        <div className="about-hero__image"><ProductMedia product={editorialProduct('luxury-cartier-santos-wssa0063')} priority /></div>
        <div><p className="eyebrow">About Vemba</p><h1>More brands.<br /><em>More choice.</em></h1><p>Discover shoes, furniture, wheelchairs, watches, jewellery, gaming and audio selected for the Vemba collection.</p></div>
      </section>
      <section className="manifesto"><p className="eyebrow">Your next purchase starts here</p><blockquote>Browse your favourite brands, compare product details and choose what works for you.</blockquote><span>Watches / Jewellery / Gaming / Audio</span></section>
      <section className="values section" id="materials">
        <SectionHeading eyebrow="Shopping with Vemba" title={<>Find it. Compare it.<br /><em>Make it yours.</em></>} />
        <div>{[
          ['01', 'Browse by category', 'Explore shoes, furniture, wheelchairs, watches, jewellery, gaming, headphones and more.'],
          ['02', 'Compare product details', 'Check model numbers, features, sizes and listed variants to find the right product.'],
          ['03', 'Save your favourites', 'Use your wishlist to keep products together and add them to your bag when you are ready.'],
          ['04', 'Checkout is coming soon', 'Explore the collection, save your favourites and review your bag while Vemba checkout is being prepared.'],
        ].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section className="about-cta"><p className="eyebrow">Ready to shop?</p><h2>Browse our<br /><em>full range.</em></h2><button className="button button--light" onClick={() => navigate('/shop')}>Shop all products <ArrowRight size={17} /></button></section>
    </main>
  )
}

function JournalPage({ navigate }) {
  const featured = journalStories[0]
  return (
    <main id="main-content">
      <PageHero eyebrow="Shopping advice" title="Buying guides" copy="Practical guides to choosing watches, jewellery, consoles and accessories." />
      <section className="section journal-page">
        <div className="journal-feature">
          <div className="journal-feature__image"><ProductMedia product={editorialProduct(featured.productId)} /></div>
          <div><p className="eyebrow">{featured.category} / {featured.readTime}</p><h2>{featured.title}</h2><p>{featured.excerpt}</p><button className="arrow-link" onClick={() => navigate(`/journal/${featured.slug}`)}>Read guide <ArrowRight size={17} /></button></div>
        </div>
        <div className="story-grid">{journalStories.slice(1).map((story) => <article className="story-card" key={story.slug}><button className="story-card__image" onClick={() => navigate(`/journal/${story.slug}`)} aria-label={`Read ${story.title}`}><ProductMedia product={editorialProduct(story.productId)} /></button><p className="eyebrow">{story.category} / {story.readTime}</p><h3><button onClick={() => navigate(`/journal/${story.slug}`)}>{story.title}</button></h3><p>{story.excerpt}</p></article>)}</div>
      </section>
    </main>
  )
}

function ArticlePage({ slug, navigate }) {
  const story = journalStories.find((item) => item.slug === slug)
  if (!story) return <NotFoundPage navigate={navigate} />
  const product = editorialProduct(story.productId)
  return (
    <main id="main-content" className="article-page">
      <div className="article-head"><button className="back-link" onClick={() => navigate('/journal')}><ArrowLeft size={16} /> Buying guides</button><p className="eyebrow">{story.category} / {story.readTime}</p><h1>{story.title}</h1><p>{story.excerpt}</p></div>
      <div className="article-image"><ProductMedia product={product} priority /></div>
      <article className="article-body">{story.body.map((paragraph, index) => <p key={index} className={index === 0 ? 'drop-cap' : undefined}>{paragraph}</p>)}<button className="arrow-link" onClick={() => navigate(`/products/${product.slug}`)}>View product <ArrowRight size={17} /></button></article>
      <div className="article-next"><p className="eyebrow">Continue reading</p><button onClick={() => navigate('/journal')}>More buying guides <ArrowRight /></button></div>
    </main>
  )
}

function HelpPage() {
  const [open, setOpen] = useState(0)
  const [sent, setSent] = useState(false)
  return (
    <main id="main-content">
      <PageHero eyebrow="Customer service" title="How can we help?" copy="Find answers about products, prices, delivery and returns." />
      <section className="help-shortcuts">
        <a href="#shipping"><Truck /><span><strong>Delivery</strong>Shipping options and costs</span><ArrowRight /></a>
        <a href="#returns"><RotateCcw /><span><strong>Returns</strong>Policies and eligibility</span><ArrowRight /></a>
        <a href="#contact"><CircleHelp /><span><strong>Contact us</strong>Product and order questions</span><ArrowRight /></a>
      </section>
      <section className="faq-layout section"><div><p className="eyebrow">Help centre</p><h2>Frequently asked<br /><em>questions.</em></h2></div><div className="faq-list">{faqs.map((faq, index) => <article key={faq.question} className={open === index ? 'is-open' : ''}><button onClick={() => setOpen(open === index ? -1 : index)}><span>{faq.question}</span><Plus /></button><p>{faq.answer}</p></article>)}</div></section>
      <section className="help-details" id="shipping">
        <div><p className="eyebrow">Delivery</p><h3>Shipping information</h3><p>Vemba delivery options and costs will be shown here before checkout is enabled.</p></div>
        <div id="returns"><p className="eyebrow">Returns</p><h3>Returns and refunds</h3><p>Vemba's return and refund information will be published before purchases are enabled.</p></div>
      </section>
      <section className="contact-section" id="contact">
        <div><p className="eyebrow">Contact us</p><h2>Need more <em>help?</em></h2><p>Send Vemba a message about a product or your shopping experience.</p></div>
        {sent ? <div className="contact-success"><Check /><h3>Thank you.</h3><p>Your message has been recorded for this session.</p></div> : <form onSubmit={(e) => { e.preventDefault(); setSent(true) }}><div className="field-grid"><label className="field"><span>Name</span><input required /></label><label className="field"><span>Email</span><input type="email" required /></label></div><label className="field"><span>Topic</span><select><option>Product question</option><option>Order question</option><option>Returns</option><option>Something else</option></select></label><label className="field"><span>Message</span><textarea required rows="5" /></label><button className="button button--dark">Send message <ArrowRight size={17} /></button></form>}
      </section>
    </main>
  )
}

function EmptyState({ icon, title, copy, action, onAction }) {
  return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{copy}</p>{action && <button className="button button--dark" onClick={onAction}>{action} <ArrowRight size={17} /></button>}</div>
}

function NotFoundPage({ navigate }) {
  return <main id="main-content" className="not-found"><span>404</span><p className="eyebrow">Page not found</p><h1>We can’t find <em>this page.</em></h1><p>This page may have moved or is no longer available.</p><button className="button button--dark" onClick={() => navigate('/')}>Return home <ArrowRight size={17} /></button></main>
}

function Toast() {
  const { toast } = useStore()
  return <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite"><Check size={16} />{toast || 'Updated'}</div>
}

function App() {
  const { pathname, searchParams, navigate } = useRoute()
  let page
  if (pathname === '/') page = <HomePage navigate={navigate} />
  else if (pathname === '/shop') page = <ShopPage navigate={navigate} />
  else if (pathname.startsWith('/collections/')) {
    const collection = pathname.split('/')[2] || 'all'
    const map = {
      new: ['New arrivals', 'Just added', 'Shop the latest additions across footwear, furniture, mobility and more.'],
      luxury: ['Luxury watches & jewellery', 'Shop luxury', 'Explore watches and fine jewellery selected for Vemba.'],
      jewellery: ['Fine jewellery', 'Shop jewellery', 'Browse diamond rings, necklaces, bracelets and earrings. Compare metals, sizes and carat weights.'],
      watches: ['Watches', 'Shop watches', 'Discover Rolex, Cartier, Patek Philippe and more. Compare models, dial colours and case materials.'],
      gaming: ['Gaming', 'Consoles, games & accessories', 'Shop PlayStation consoles, controllers, games, keyboards and mice for your gaming setup.'],
      audio: ['Headphones & audio', 'Shop audio', 'Compare wireless headphones, in-ear headphones, speakers and amplifiers from leading audio brands.'],
      shoes: ['Shoes & footwear', 'Shop shoes', 'Browse footwear from leading shoe brands and compare styles and prices.'],
      furniture: ['Furniture', 'Shop furniture', 'Browse chairs, tables and home furnishings in the Vemba collection.'],
      chairs: ['Chairs', 'Shop chairs', 'Browse chairs, seating and mobility seating options.'],
      tables: ['Tables', 'Shop tables', 'Browse tables, desks and overbed tables.'],
      mobility: ['Mobility', 'Shop mobility', 'Browse wheelchairs and mobility products selected for Vemba.'],
      wheelchairs: ['Wheelchairs', 'Shop mobility', 'Explore manual and powered wheelchairs in the Vemba collection.'],
      accessories: ['Accessories', 'Shop accessories', 'Find accessories to complete your setup.'],
      wear: ['Jewellery & watches', 'Shop luxury', 'Explore diamond jewellery and watches from leading brands.'],
      live: ['Headphones & audio', 'Shop audio', 'Compare headphones, speakers and audio equipment.'],
      carry: ['Accessories', 'Shop accessories', 'Find accessories to complete your setup.'],
    }
    const meta = map[collection] || [collection.replace('-', ' '), 'Shop Vemba', 'Browse products and compare prices across our range.']
    const initialCategory = collection
    page = <ShopPage navigate={navigate} initialCategory={initialCategory} title={meta[0]} eyebrow={meta[1]} copy={meta[2]} />
  }
  else if (pathname.startsWith('/products/')) page = <ProductPage slug={pathname.split('/')[2]} navigate={navigate} />
  else if (pathname === '/search') page = <SearchPage navigate={navigate} initialQuery={searchParams.get('q') || ''} />
  else if (pathname === '/wishlist') page = <WishlistPage navigate={navigate} />
  else if (pathname === '/cart') page = <CartPage navigate={navigate} />
  else if (pathname === '/checkout') page = <CheckoutPage navigate={navigate} />
  else if (pathname === '/gift-card') page = <GiftCardPage navigate={navigate} />
  else if (pathname === '/order-confirmation') page = <ConfirmationPage navigate={navigate} />
  else if (pathname === '/account') page = <AccountPage navigate={navigate} />
  else if (pathname === '/about') page = <AboutPage navigate={navigate} />
  else if (pathname === '/journal') page = <JournalPage navigate={navigate} />
  else if (pathname.startsWith('/journal/')) page = <ArticlePage slug={pathname.split('/')[2]} navigate={navigate} />
  else if (pathname === '/help') page = <HelpPage />
  else page = <NotFoundPage navigate={navigate} />

  const minimalShell = pathname === '/checkout' || pathname === '/gift-card' || pathname === '/order-confirmation'
  useEffect(() => {
    const title = pathname === '/' ? 'Vemba | Watches, Jewellery, Gaming & Audio' : `${pathname.split('/').filter(Boolean).map((part) => part.replace(/-/g, ' ')).join(' · ') || 'Home'} — VEMBA`
    document.title = title.replace(/\b\w/g, (letter) => letter.toUpperCase())
  }, [pathname])

  return (
    <div className="app">
      {!minimalShell && <Header navigate={navigate} />}
      <div className="page-transition" key={pathname}>{page}</div>
      {!minimalShell && <Footer navigate={navigate} />}
      <Toast />
    </div>
  )
}

export default App
