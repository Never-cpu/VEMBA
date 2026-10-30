import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, RefreshCw } from 'lucide-react'
import { ProductCard } from './Commerce'
import { useStore } from '../state/StoreContext'
import { spotlightConfig } from '../data/homeSpotlight'

export default function HomeSpotlight({ navigate }) {
  const { spotlightItems: selection, spotlightEndsAt: endsAt } = useStore()
  const [now, setNow] = useState(Date.now)
  const remainingSeconds = Math.min(spotlightConfig.durationHours * 3600, Math.max(0, Math.ceil((endsAt - now) / 1000)))

  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  if (!selection.length) return null

  const units = [
    { label: 'Hours', value: Math.floor(remainingSeconds / 3600) },
    { label: 'Minutes', value: Math.floor(remainingSeconds / 60) % 60 },
    { label: 'Seconds', value: remainingSeconds % 60 },
  ]

  return (
    <section className="home-spotlight" aria-labelledby="spotlight-title">
      <div className="home-spotlight__inner">
        <div className="home-spotlight__head">
          <div className="home-spotlight__intro">
            <p className="eyebrow"><span className="home-spotlight__dot" /> In the spotlight</p>
            <h2 id="spotlight-title">The two-hour <em>edit.</em></h2>
            <p>A fresh mix of gaming and luxury favourites, now {selection[0].product.spotlightOffer.discountPercent}% off. {selection.length} random picks, refreshed every two hours.</p>
          </div>
          <div className="spotlight-countdown">
            <p className="spotlight-countdown__label"><Clock3 size={15} aria-hidden="true" /> Next selection in</p>
            <div className="spotlight-countdown__digits" role="timer" aria-live="off" aria-label={`${units[0].value} hours, ${units[1].value} minutes, ${units[2].value} seconds until the next selection`} data-ends-at={endsAt}>
              {units.map(({ label, value }) => (
                <div key={label} className="spotlight-countdown__unit" aria-hidden="true">
                  <strong>{String(value).padStart(2, '0')}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="spotlight-countdown__repeat"><RefreshCw size={11} aria-hidden="true" /> Refreshes automatically</p>
          </div>
        </div>
        <div className="product-grid product-grid--four home-spotlight__grid">
          {selection.map(({ id, label, product }, index) => (
            <div className="home-spotlight__item" key={id} data-product-id={product.id}>
              <p className="home-spotlight__category"><span>0{index + 1}</span>{label}</p>
              <ProductCard key={product.id} product={product} onNavigate={(item) => navigate(`/products/${item.slug}`)} />
            </div>
          ))}
        </div>
        <div className="home-spotlight__foot">
          <span>Spotlight prices apply until the selection refreshes.</span>
          <button className="arrow-link" onClick={() => navigate('/shop')}>Explore all products <ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  )
}
