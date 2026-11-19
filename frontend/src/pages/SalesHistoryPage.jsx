import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Eye, LoaderCircle, Search } from 'lucide-react'
import { api, formatDate, formatXaf, getErrorMessage } from '../api.js'
import SaleDetailsDialog from '../components/SaleDetailsDialog.jsx'

const PAGE_SIZE = 10
const statusLabels = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
}
const methodLabels = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 0 })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [requestStatus, setRequestStatus] = useState({ key: '', error: '' })
  const [reload, setReload] = useState(0)
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const requestKey = `${page}:${search}:${from}:${to}:${paymentMethod}:${paymentStatus}:${reload}`
  const loading = requestStatus.key !== requestKey
  const error = requestStatus.key === requestKey ? requestStatus.error : ''

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    api.get('/sales', {
      params: {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        paymentMethod: paymentMethod || undefined,
        paymentStatus: paymentStatus || undefined,
      },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setSales(data.data)
        setPagination(data.pagination)
        setRequestStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setRequestStatus({ key: requestKey, error: getErrorMessage(requestError, 'Could not load sales history.') })
        }
      })
    return () => controller.abort()
  }, [page, search, from, to, paymentMethod, paymentStatus, reload, requestKey])

  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> TRANSACTION RECORDS</span>
          <h1>Sales history</h1>
          <p>Search receipts, review payments, and open complete sale details.</p>
        </div>
      </header>

      {error && (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <section className="panel data-panel">
        <div className="toolbar sales-history-toolbar">
          <label className="search-field sales-reference-search">
            <Search size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search sale reference"
              aria-label="Search sales by reference"
            />
          </label>
          <label className="filter-field sales-date-filter">
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1) }} />
            <CalendarDays size={14} />
          </label>
          <label className="filter-field sales-date-filter">
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1) }} />
            <CalendarDays size={14} />
          </label>
          <label className="filter-field">
            <span>Payment</span>
            <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1) }}>
              <option value="">All methods</option>
              {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table sales-history-table">
            <thead>
              <tr>
                <th>Sale reference</th>
                <th>Date & time</th>
                <th>Items</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Final total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Payment</th>
                <th>Status</th>
                <th><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="table-state" colSpan="11"><LoaderCircle className="spin" size={19} /> Loading sales…</td></tr>
              ) : error ? (
                <tr><td className="table-state" colSpan="11">Sales history is unavailable. Use the retry action above.</td></tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="11">
                    <div className="empty-table-state">
                      <span className="empty-icon"><Search size={20} /></span>
                      <strong>{search || from || to || paymentMethod || paymentStatus ? 'No matching sales' : 'No sales recorded yet'}</strong>
                      <span>{search || from || to || paymentMethod || paymentStatus ? 'Change or clear the filters to see other sales.' : 'Completed POS transactions will appear here.'}</span>
                    </div>
                  </td>
                </tr>
              ) : sales.map((sale) => (
                <tr key={sale.id}>
                  <td><span className="table-primary sale-reference">{sale.reference}</span>{sale.customer && <small className="table-secondary">{[sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(' ')}</small>}</td>
                  <td>{formatDate(sale.soldAt, { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{sale.itemCount}</td>
                  <td>{formatXaf(sale.subtotal)}</td>
                  <td>{formatXaf(sale.discount)}</td>
                  <td><strong>{formatXaf(sale.totalAmount)}</strong></td>
                  <td>{formatXaf(sale.amountPaid)}</td>
                  <td>{formatXaf(sale.remainingBalance)}</td>
                  <td>{methodLabels[sale.paymentMethod] ?? sale.paymentMethod}</td>
                  <td><span className={`status-badge status-badge--${sale.paymentStatus.toLowerCase()}`}>{statusLabels[sale.paymentStatus]}</span></td>
                  <td><button className="icon-button" type="button" aria-label={`View sale ${sale.reference}`} title="View sale details" onClick={() => setSelectedSaleId(sale.id)}><Eye size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="table-footer">
          <span>{loading || error ? '— sales' : `${pagination.totalItems} ${pagination.totalItems === 1 ? 'sale' : 'sales'}`}</span>
          <div className="pagination">
            <span>Page {page} of {Math.max(pagination.totalPages, 1)}</span>
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      {selectedSaleId && <SaleDetailsDialog saleId={selectedSaleId} onClose={() => setSelectedSaleId('')} />}
    </section>
  )
}
