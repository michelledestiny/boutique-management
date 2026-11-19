import { useEffect, useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { api, getErrorMessage } from '../api.js'

export default function ProductPicker({ value, onChange, includeArchived = false, allowClear = false }) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [products, setProducts] = useState([])
  const [requestStatus, setRequestStatus] = useState({ id: 0, error: '' })
  const [requestId, setRequestId] = useState(0)
  const [open, setOpen] = useState(false)
  const loading = open && requestStatus.id !== requestId
  const error = requestStatus.id === requestId ? requestStatus.error : ''

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const controller = new AbortController()
    api.get('/products', {
      params: {
        page: 1,
        pageSize: 10,
        search: query.trim() || undefined,
        includeArchived: includeArchived ? true : undefined,
      },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setProducts(data.data)
        setRequestStatus({ id: requestId, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setRequestStatus({
            id: requestId,
            error: getErrorMessage(requestError, 'Could not search products.'),
          })
        }
      })
    return () => controller.abort()
  }, [open, query, includeArchived, requestId])

  function choose(product) {
    onChange(product)
    setQuery(product.name)
    setOpen(false)
  }

  return (
    <div className="product-picker">
      <label className="search-field">
        <Search size={16} />
        <input
          type="search"
          value={query}
          onFocus={() => {
            setRequestId((current) => current + 1)
            setOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            onChange(null)
            setRequestId((current) => current + 1)
            setOpen(true)
          }}
          placeholder="Search product name or SKU"
          autoComplete="off"
          aria-label="Search for a product"
          aria-expanded={open}
          aria-controls="product-picker-options"
        />
      </label>
      {open && (
        <div className="product-picker-results" id="product-picker-options" role="listbox" aria-label="Products">
          {loading ? (
            <p className="picker-state"><LoaderCircle className="spin" size={16} /> Searching…</p>
          ) : error ? (
            <p className="picker-state picker-state--error">{error}</p>
          ) : products.length === 0 ? (
            <p className="picker-state">No active products match this search.</p>
          ) : products.map((product) => (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={value?.id === product.id}
              onClick={() => choose(product)}
            >
              <span><strong>{product.name}</strong><small>{product.sku || 'No SKU'}</small></span>
              <span className={`picker-stock${product.stockQuantity <= product.lowStockAlertAt ? ' picker-stock--warning' : ''}`}>
                {product.stockQuantity} in stock
              </span>
            </button>
          ))}
        </div>
      )}
      {value && !open && (
        <div className="selected-product">
          <span>{allowClear ? 'Selected product' : 'Current stock'} <strong>{allowClear ? value.name : value.stockQuantity}</strong></span>
          <button type="button" className="text-button" onClick={() => { setRequestId((current) => current + 1); setOpen(true) }}>Change</button>
          {allowClear && (
            <button type="button" className="text-button" onClick={() => { onChange(null); setQuery('') }}>Clear filter</button>
          )}
        </div>
      )}
    </div>
  )
}
