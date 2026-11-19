import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Package,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { api, formatDate, getErrorMessage } from '../api.js'

function MetricCard({ label, value, caption, icon: Icon, tone }) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon metric-icon--${tone}`}><Icon size={17} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-footer"><span className="metric-neutral">{caption}</span></div>
    </article>
  )
}

export default function DashboardPage({ apiStatus, apiMessage, onNavigate, onCreateProduct, onRestock }) {
  const [snapshot, setSnapshot] = useState(null)
  const [requestStatus, setRequestStatus] = useState({ key: '', error: '' })
  const [reload, setReload] = useState(0)
  const [today] = useState(() => new Date())
  const requestKey = `dashboard:${reload}`
  const loading = requestStatus.key !== requestKey
  const error = requestStatus.key === requestKey ? requestStatus.error : ''
  const weekdayDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today).toUpperCase()
  const greeting = today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      api.get('/products', { params: { page: 1, pageSize: 1 }, signal: controller.signal }),
      api.get('/stock/low-stock', { params: { page: 1, pageSize: 5 }, signal: controller.signal }),
      api.get('/stock/movements', { params: { page: 1, pageSize: 5 }, signal: controller.signal }),
    ])
      .then(([productsResponse, lowStockResponse, movementsResponse]) => {
        setSnapshot({
          products: productsResponse.data.pagination.totalItems,
          lowStock: lowStockResponse.data.summary.totalItems,
          outOfStock: lowStockResponse.data.summary.outOfStock,
          lowStockItems: lowStockResponse.data.data,
          movements: movementsResponse.data.data,
        })
        setRequestStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setRequestStatus({
            key: requestKey,
            error: getErrorMessage(requestError, 'Could not load the inventory overview.'),
          })
        }
      })
    return () => controller.abort()
  }, [reload, requestKey])

  return (
    <section className="dashboard-content">
      <div className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> {weekdayDate}</div>
          <h1>Good {greeting}, welcome back<span className="greeting-dot">.</span></h1>
          <p className="welcome-subtitle">A considered overview of your boutique, all in one place.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreateProduct}>
          <Plus size={17} /> Add product
        </button>
      </div>

      <div className={`connection-banner connection-banner--${apiStatus}`}>
        <span className="connection-indicator">
          {apiStatus === 'offline' ? <ShieldAlert size={16} /> : <Sparkles size={16} />}
        </span>
        <span>{apiStatus === 'loading' ? 'Connecting your workspace…' : apiMessage}</span>
        {apiStatus !== 'loading' && (
          <span className="connection-label">
            <span className="status-dot" /> {apiStatus === 'connected' ? 'CONNECTED' : 'SETUP IN PROGRESS'}
          </span>
        )}
      </div>

      {error && (
        <div className="notice notice--error dashboard-error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <div className="section-heading">
        <div>
          <h2>Inventory overview</h2>
          <p>Current product and stock status from your database.</p>
        </div>
        <span className="snapshot-label"><Clock3 size={14} /> Live inventory</span>
      </div>

      <section className="metric-grid" aria-label="Inventory metrics">
        <MetricCard label="ACTIVE PRODUCTS" value={loading || error ? '—' : snapshot?.products ?? 0} caption="In your current collection" icon={Package} tone="violet" />
        <MetricCard label="LOW-STOCK ALERTS" value={loading || error ? '—' : snapshot?.lowStock ?? 0} caption="At or below their threshold" icon={CircleAlert} tone="lavender" />
        <MetricCard label="OUT OF STOCK" value={loading || error ? '—' : snapshot?.outOfStock ?? 0} caption="Products needing replenishment" icon={Package} tone="plum" />
        <MetricCard label="RECENT MOVEMENTS" value={loading || error ? '—' : snapshot?.movements.length ?? 0} caption="Latest stock records shown" icon={ArrowDownToLine} tone="lilac" />
      </section>

      <section className="workspace-grid">
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">INVENTORY AUDIT</span>
              <h3>Recent stock movements</h3>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('Stock history')}>
              See all <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="state-box"><LoaderCircle className="spin" size={19} /> Loading stock activity…</div>
          ) : error ? (
            <div className="state-box">Stock activity is unavailable.</div>
          ) : snapshot?.movements.length ? (
            <ul className="activity-list">
              {snapshot.movements.map((movement) => (
                <li key={movement.id}>
                  <span className={`activity-icon${movement.quantity < 0 ? ' activity-icon--out' : ''}`}>
                    {movement.quantity < 0 ? <ArrowUpFromLine size={16} /> : <ArrowDownToLine size={16} />}
                  </span>
                  <span className="activity-copy">
                    <strong>{movement.product.name}</strong>
                    <small>{movement.type === 'PURCHASE' ? 'Stock received' : movement.type === 'ADJUSTMENT' ? 'Manual stock out' : movement.type.replace('_', ' ')}</small>
                  </span>
                  <strong className={movement.quantity < 0 ? 'quantity-negative' : 'quantity-positive'}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </strong>
                  <time>{formatDate(movement.occurredAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-panel-state">
              <span className="empty-icon"><Clock3 size={20} /></span>
              <strong>No stock activity yet</strong>
              <span>Receive or remove stock to start your inventory history.</span>
              <button className="text-button" type="button" onClick={() => onNavigate('Stock management')}>Manage stock <ArrowRight size={14} /></button>
            </div>
          )}
        </article>

        <article className="panel stock-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">KEEP AN EYE ON</span>
              <h3>Stock watch</h3>
            </div>
            <span className="stock-heading-icon"><CircleAlert size={17} /></span>
          </div>
          {loading ? (
            <div className="state-box"><LoaderCircle className="spin" size={18} /> Checking inventory…</div>
          ) : error ? (
            <div className="state-box">Stock alerts are unavailable.</div>
          ) : snapshot?.lowStockItems.length ? (
            <ul className="stock-watch-list">
              {snapshot.lowStockItems.slice(0, 4).map((product) => (
                <li key={product.id}>
                  <span className="stock-watch-copy"><strong>{product.name}</strong><small>{product.stockQuantity} available · alert at {product.lowStockAlertAt}</small></span>
                  <button className="icon-button" type="button" aria-label={`Receive stock for ${product.name}`} title="Receive stock" onClick={() => onRestock(product)}><ArrowDownToLine size={16} /></button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-panel-state empty-panel-state--compact">
              <span className="empty-icon empty-icon--success"><Package size={19} /></span>
              <strong>Everything is in good shape</strong>
              <span>No products are below their stock threshold.</span>
            </div>
          )}
          <button className="stock-action" type="button" onClick={() => onNavigate('Low-stock alerts')}>
            View all alerts <ArrowRight size={14} />
          </button>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel bottom-panel">
          <div className="bottom-panel-icon bottom-panel-icon--violet"><Package size={17} /></div>
          <div className="bottom-panel-copy">
            <span className="panel-kicker">YOUR COLLECTION</span>
            <h3>Product catalogue</h3>
            <p>Review product details, pricing and stock thresholds.</p>
          </div>
          <button className="subtle-link" type="button" onClick={() => onNavigate('Products')}>View products <ArrowRight size={14} /></button>
        </article>
        <article className="panel bottom-panel daily-panel">
          <div className="bottom-panel-icon bottom-panel-icon--lavender"><ArrowDownToLine size={17} /></div>
          <div className="bottom-panel-copy">
            <span className="panel-kicker">DELIVERIES & ADJUSTMENTS</span>
            <h3>Update your stock</h3>
            <p>Record incoming stock or a manual stock removal.</p>
          </div>
          <button className="subtle-link" type="button" onClick={() => onNavigate('Stock management')}>Manage stock <ArrowRight size={14} /></button>
        </article>
      </section>

      <footer className="dashboard-footer">
        <span><Sparkles size={13} /> A little more lovely, every day.</span>
        <span>MADE FOR THE WAY YOU DO BUSINESS <span className="footer-divider">·</span> FCFA (XAF)</span>
      </footer>
    </section>
  )
}
