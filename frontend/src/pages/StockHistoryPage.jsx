import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, LoaderCircle } from 'lucide-react'
import { api, formatDate, getErrorMessage } from '../api.js'
import ProductPicker from '../components/ProductPicker.jsx'

const PAGE_SIZE = 10

export default function StockHistoryPage() {
  const [movements, setMovements] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 0 })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [type, setType] = useState('')
  const [requestStatus, setRequestStatus] = useState({ key: '', error: '' })
  const [reload, setReload] = useState(0)
  const requestKey = `${page}:${selectedProduct?.id ?? ''}:${type}:${reload}`
  const loading = requestStatus.key !== requestKey
  const error = requestStatus.key === requestKey ? requestStatus.error : ''

  useEffect(() => {
    const controller = new AbortController()
    api.get('/stock/movements', {
      params: {
        page,
        pageSize: PAGE_SIZE,
        productId: selectedProduct?.id,
        type: type || undefined,
      },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setMovements(data.data)
        setPagination(data.pagination)
        setRequestStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setRequestStatus({
            key: requestKey,
            error: getErrorMessage(requestError, 'Could not load stock history.'),
          })
        }
      })
    return () => controller.abort()
  }, [page, selectedProduct?.id, type, reload, requestKey])

  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> INVENTORY AUDIT</span>
          <h1>Stock history</h1>
          <p>Review every recorded stock receipt and removal.</p>
        </div>
      </header>

      {error && (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <section className="panel data-panel">
        <div className="toolbar">
          <div className="filter-field filter-field--picker">
            <span>Product</span>
            <ProductPicker
              value={selectedProduct}
              onChange={(product) => { setSelectedProduct(product); setPage(1) }}
              includeArchived
              allowClear
            />
          </div>
          <label className="filter-field">
            <span>Movement type</span>
            <select value={type} onChange={(event) => { setType(event.target.value); setPage(1) }}>
              <option value="">All movements</option>
              <option value="PURCHASE">Stock received</option>
              <option value="ADJUSTMENT">Manual stock out</option>
              <option value="SALE">Sale</option>
              <option value="RETURN">Return</option>
            </select>
          </label>
          <span className="toolbar-count"><Clock3 size={15} /> {loading || error ? '— movements' : `${pagination.totalItems} movements`}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Movement type</th><th>Quantity</th><th>Note</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td className="table-state" colSpan="5"><LoaderCircle className="spin" size={19} /> Loading movement history…</td></tr>
              ) : error ? (
                <tr><td className="table-state" colSpan="5">Movement history is unavailable. Use the retry action above.</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan="5"><div className="empty-table-state"><span className="empty-icon"><Clock3 size={20} /></span><strong>No movements found</strong><span>Adjust the filters or record a stock movement to begin.</span></div></td></tr>
              ) : movements.map((movement) => (
                <tr key={movement.id}>
                  <td><span className="table-primary">{movement.product.name}</span><small className="table-secondary">{movement.product.sku || 'No SKU'}</small></td>
                  <td><span className={`movement-badge movement-badge--${movement.type.toLowerCase()}`}>{movement.type === 'PURCHASE' ? 'Stock received' : movement.type === 'ADJUSTMENT' ? 'Manual stock out' : movement.type.replace('_', ' ')}</span></td>
                  <td><strong className={movement.quantity < 0 ? 'quantity-negative' : 'quantity-positive'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</strong></td>
                  <td>{movement.note || '—'}</td>
                  <td><span className="date-with-icon"><Clock3 size={14} />{formatDate(movement.occurredAt, { hour: '2-digit', minute: '2-digit' })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>Page {page} of {Math.max(pagination.totalPages, 1)}</span>
          <div className="pagination">
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>
    </section>
  )
}
