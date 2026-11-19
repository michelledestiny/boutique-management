import { useEffect, useState } from 'react'
import { ArrowRight, Banknote, CalendarDays, CircleDollarSign, LoaderCircle, ShoppingBag } from 'lucide-react'
import { api, formatDate, formatXaf, getErrorMessage } from '../api.js'

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <article className="summary-card daily-sales-card">
      <span className={`summary-icon summary-icon--${tone}`}><Icon size={19} /></span>
      <div>
        <span className="summary-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

export default function DailySalesPage({ onNavigate }) {
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState({ key: '', error: '' })
  const [reload, setReload] = useState(0)
  const requestKey = `daily-sales:${reload}`
  const loading = status.key !== requestKey
  const error = status.key === requestKey ? status.error : ''

  useEffect(() => {
    const controller = new AbortController()
    api.get('/sales/summary', { signal: controller.signal })
      .then(({ data }) => {
        setSummary(data.data)
        setStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setStatus({ key: requestKey, error: getErrorMessage(requestError, 'Could not load today’s sales summary.') })
        }
      })
    return () => controller.abort()
  }, [reload, requestKey])

  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> DAILY CLOSE</span>
          <h1>Today&apos;s sales</h1>
          <p>Sales totals and payments collected today, calculated from saved transactions.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => setReload((value) => value + 1)}>
          <CalendarDays size={15} /> Refresh summary
        </button>
      </header>

      {error && (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <div className="daily-sales-date">
        <CalendarDays size={16} />
        <span>{summary ? formatDate(`${summary.date}T12:00:00`) : 'Today'}</span>
        <span className="daily-sales-live">LIVE DATABASE SUMMARY</span>
      </div>

      <div className="summary-grid daily-summary-grid">
        <SummaryCard label="SALES TODAY" value={loading || error ? '—' : summary?.numberOfSales ?? 0} icon={ShoppingBag} tone="violet" />
        <SummaryCard label="TOTAL SALES AMOUNT" value={loading || error ? '—' : formatXaf(summary?.totalSalesAmount)} icon={CircleDollarSign} tone="plum" />
        <SummaryCard label="AMOUNT COLLECTED" value={loading || error ? '—' : formatXaf(summary?.totalCollected)} icon={Banknote} tone="warning" />
        <SummaryCard label="OUTSTANDING BALANCE" value={loading || error ? '—' : formatXaf(summary?.totalOutstandingBalance)} icon={CircleDollarSign} tone="danger" />
      </div>

      {loading ? (
        <div className="panel daily-summary-note"><LoaderCircle className="spin" size={18} /> Calculating today&apos;s summary…</div>
      ) : !error && summary?.numberOfSales === 0 ? (
        <div className="panel daily-summary-note">
          <span>No sales have been recorded today. Once you complete a POS checkout, the summary will update from the database.</span>
          <button className="text-button" type="button" onClick={() => onNavigate('Point of sale')}>Open point of sale <ArrowRight size={14} /></button>
        </div>
      ) : (
        !error && (
          <div className="panel daily-summary-note">
            <span>Sales totals include the final amount after discounts. Collected amounts exclude change returned to customers.</span>
            <button className="text-button" type="button" onClick={() => onNavigate('Sales history')}>Review transactions <ArrowRight size={14} /></button>
          </div>
        )
      )}
    </section>
  )
}
