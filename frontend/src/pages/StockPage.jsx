import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRight,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Package,
} from 'lucide-react'
import { api, formatDate, getErrorMessage, localDateTimeInputValue } from '../api.js'
import Modal from '../components/Modal.jsx'
import ProductPicker from '../components/ProductPicker.jsx'

function StockOperationDialog({ mode, initialProduct, onClose, onSaved }) {
  const receiving = mode === 'in'
  const [product, setProduct] = useState(initialProduct ?? null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(localDateTimeInputValue())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!product) {
      setError('Choose a product before recording a stock movement.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.post(`/stock/${mode}`, {
        productId: product.id,
        quantity: Number(quantity),
        note: note || null,
        date: new Date(date).toISOString(),
      })
      onSaved(receiving ? 'Stock received and recorded in history.' : 'Stock removed and recorded in history.')
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not record this stock movement.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={receiving ? 'Receive stock' : 'Record stock out'}
      description={receiving ? 'Add a delivery to the selected product’s available quantity.' : 'Record a manual stock removal. The quantity cannot exceed available stock.'}
      onClose={onClose}
      size="medium"
    >
      <form className="form-layout form-layout--single" onSubmit={submit}>
        {error && <p className="notice notice--error form-field--wide" role="alert">{error}</p>}
        <div className="form-field form-field--wide">
          <span>Product <b aria-hidden="true">*</b></span>
          <ProductPicker key={initialProduct?.id ?? 'select-product'} value={product} onChange={setProduct} />
        </div>
        <label className="form-field">
          <span>Quantity <b aria-hidden="true">*</b></span>
          <input
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Date and time <b aria-hidden="true">*</b></span>
          <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="form-field form-field--wide">
          <span>{receiving ? 'Supplier or delivery note' : 'Reason or note'}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="500" rows="3" />
        </label>
        <footer className="modal-actions form-field--wide">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving || !product}>
            {saving && <LoaderCircle className="spin" size={16} />}
            {saving ? 'Recording…' : receiving ? 'Receive stock' : 'Record stock out'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

function SummaryCard({ label, value, icon: Icon, tone = '' }) {
  return (
    <article className="summary-card">
      <span className={`summary-icon${tone ? ` summary-icon--${tone}` : ''}`}><Icon size={18} /></span>
      <div><span className="summary-label">{label}</span><strong>{value}</strong></div>
    </article>
  )
}

export default function StockPage({ stockRequest, onNavigate }) {
  const [overview, setOverview] = useState(null)
  const [requestStatus, setRequestStatus] = useState({ key: '', error: '' })
  const [reload, setReload] = useState(0)
  const [dialog, setDialog] = useState(() => (
    stockRequest?.requestId
      ? { mode: stockRequest.mode ?? 'in', product: stockRequest.product }
      : null
  ))
  const [notice, setNotice] = useState('')
  const requestKey = `stock-overview:${reload}`
  const loading = requestStatus.key !== requestKey
  const error = requestStatus.key === requestKey ? requestStatus.error : ''

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      api.get('/products', { params: { page: 1, pageSize: 1 }, signal: controller.signal }),
      api.get('/stock/low-stock', { params: { page: 1, pageSize: 5 }, signal: controller.signal }),
      api.get('/stock/movements', { params: { page: 1, pageSize: 5 }, signal: controller.signal }),
    ])
      .then(([productsResponse, lowStockResponse, movementsResponse]) => {
        setOverview({
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
            error: getErrorMessage(requestError, 'Could not load the stock overview.'),
          })
        }
      })
    return () => controller.abort()
  }, [reload, requestKey])

  function saved(message) {
    setDialog(null)
    setNotice(message)
    setReload((value) => value + 1)
  }

  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> INVENTORY CONTROL</span>
          <h1>Stock management</h1>
          <p>Receive deliveries and record manual stock removals with a complete audit trail.</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary-button" type="button" onClick={() => setDialog({ mode: 'out', product: null })}>
            <ArrowUpFromLine size={16} /> Record stock out
          </button>
          <button className="primary-button" type="button" onClick={() => setDialog({ mode: 'in', product: null })}>
            <ArrowDownToLine size={16} /> Receive stock
          </button>
        </div>
      </header>

      {notice && <p className="notice notice--success" role="status">{notice}</p>}
      {error && (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <div className="summary-grid">
        <SummaryCard label="ACTIVE PRODUCTS" value={loading || error ? '—' : overview?.products ?? 0} icon={Package} />
        <SummaryCard label="LOW-STOCK ALERTS" value={loading || error ? '—' : overview?.lowStock ?? 0} icon={CircleAlert} tone="warning" />
        <SummaryCard label="OUT OF STOCK" value={loading || error ? '—' : overview?.outOfStock ?? 0} icon={Package} tone="danger" />
      </div>

      <section className="panel data-panel stock-overview-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">LATEST INVENTORY CHANGES</span>
            <h2>Recent stock movements</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate('Stock history')}>
            Full history <ArrowRight size={14} />
          </button>
        </div>
        {loading ? (
          <div className="state-box"><LoaderCircle className="spin" size={19} /> Loading stock activity…</div>
        ) : error ? (
          <div className="state-box">Stock activity is unavailable. Use the retry action above.</div>
        ) : overview?.movements.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Product</th><th>Movement</th><th>Quantity</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                {overview.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td><span className="table-primary">{movement.product.name}</span><small className="table-secondary">{movement.product.sku || 'No SKU'}</small></td>
                    <td><span className={`movement-badge movement-badge--${movement.type.toLowerCase()}`}>{movement.type.replace('_', ' ')}</span></td>
                    <td><strong className={movement.quantity < 0 ? 'quantity-negative' : 'quantity-positive'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</strong></td>
                    <td>{movement.note || '—'}</td>
                    <td><span className="date-with-icon"><Clock3 size={14} />{formatDate(movement.occurredAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-table-state">
            <span className="empty-icon"><Clock3 size={20} /></span>
            <strong>No stock activity yet</strong>
            <span>Your incoming and outgoing stock will appear here.</span>
            <button className="text-button" type="button" onClick={() => setDialog({ mode: 'in', product: null })}>Record your first delivery <ArrowRight size={14} /></button>
          </div>
        )}
      </section>

      <section className="panel stock-note">
        <div className="stock-note-icon"><CircleAlert size={18} /></div>
        <div>
          <strong>Stock is protected</strong>
          <p>Stock-out requests are checked against the latest quantity in a database transaction, so inventory cannot go below zero.</p>
        </div>
        <button className="text-button" type="button" onClick={() => onNavigate('Low-stock alerts')}>
          View low-stock alerts <ArrowRight size={14} />
        </button>
      </section>

      {dialog && (
        <StockOperationDialog
          key={`${dialog.mode}-${dialog.product?.id ?? 'new'}-${stockRequest?.requestId ?? 0}`}
          mode={dialog.mode}
          initialProduct={dialog.product}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </section>
  )
}
