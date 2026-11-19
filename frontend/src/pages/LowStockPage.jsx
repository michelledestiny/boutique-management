import { useEffect, useState } from 'react'
import { ArrowDownToLine, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle } from 'lucide-react'
import { api, getErrorMessage } from '../api.js'

const PAGE_SIZE = 10

export default function LowStockPage({ onRestock }) {
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 0 })
  const [summary, setSummary] = useState({ totalItems: 0, outOfStock: 0 })
  const [page, setPage] = useState(1)
  const [requestStatus, setRequestStatus] = useState({ key: '', error: '' })
  const [reload, setReload] = useState(0)
  const requestKey = `${page}:${reload}`
  const loading = requestStatus.key !== requestKey
  const error = requestStatus.key === requestKey ? requestStatus.error : ''

  useEffect(() => {
    const controller = new AbortController()
    api.get('/stock/low-stock', {
      params: { page, pageSize: PAGE_SIZE },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setProducts(data.data)
        setPagination(data.pagination)
        setSummary(data.summary)
        setRequestStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setRequestStatus({
            key: requestKey,
            error: getErrorMessage(requestError, 'Could not load low-stock alerts.'),
          })
        }
      })
    return () => controller.abort()
  }, [page, reload, requestKey])

  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> ATTENTION NEEDED</span>
          <h1>Low-stock alerts</h1>
          <p>Active products at or below their configured stock threshold.</p>
        </div>
      </header>

      {error && (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <div className="alert-summary">
        <span className="alert-summary-icon"><CircleAlert size={19} /></span>
        <div>
          <strong>{loading || error ? '—' : `${summary.totalItems} ${summary.totalItems === 1 ? 'product needs' : 'products need'} attention`}</strong>
          <span>{loading || error ? 'Alert summary unavailable' : `${summary.outOfStock} currently out of stock`}</span>
        </div>
      </div>

      <section className="panel data-panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Current quantity</th><th>Threshold</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td className="table-state" colSpan="6"><LoaderCircle className="spin" size={19} /> Checking inventory…</td></tr>
              ) : error ? (
                <tr><td className="table-state" colSpan="6">Low-stock alerts could not be loaded. Use the retry action above.</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="6"><div className="empty-table-state"><span className="empty-icon empty-icon--success"><CircleAlert size={20} /></span><strong>All stocked up</strong><span>No active products are at or below their low-stock threshold.</span></div></td></tr>
              ) : products.map((product) => (
                <tr key={product.id}>
                  <td><span className="table-primary">{product.name}</span></td>
                  <td>{product.sku || <span className="muted-copy">—</span>}</td>
                  <td><strong className={product.stockQuantity === 0 ? 'quantity-negative' : 'quantity-warning'}>{product.stockQuantity}</strong></td>
                  <td>{product.lowStockAlertAt}</td>
                  <td><span className={`status-badge ${product.status === 'OUT_OF_STOCK' ? 'status-badge--danger' : 'status-badge--warning'}`}>{product.status === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock'}</span></td>
                  <td><button className="secondary-button secondary-button--small" type="button" onClick={() => onRestock(product)}><ArrowDownToLine size={15} /> Receive stock</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>{loading || error ? '— alerts' : `${pagination.totalItems} alerts`}</span>
          <div className="pagination">
            <span>Page {page} of {Math.max(pagination.totalPages, 1)}</span>
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>
    </section>
  )
}
