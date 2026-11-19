import { useEffect, useState } from 'react'
import { Clock3, LoaderCircle, Package, ReceiptText } from 'lucide-react'
import { api, formatDate, formatXaf, getErrorMessage } from '../api.js'
import Modal from './Modal.jsx'

const paymentLabels = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
}

const statusLabels = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
}

export default function SaleDetailsDialog({ saleId, onClose }) {
  const [sale, setSale] = useState(null)
  const [status, setStatus] = useState({ key: '', error: '' })
  const loading = status.key !== saleId
  const error = status.key === saleId ? status.error : ''

  useEffect(() => {
    const controller = new AbortController()
    api.get(`/sales/${saleId}`, { signal: controller.signal })
      .then(({ data }) => {
        setSale(data.data)
        setStatus({ key: saleId, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setStatus({ key: saleId, error: getErrorMessage(requestError, 'Could not load sale details.') })
        }
      })
    return () => controller.abort()
  }, [saleId])

  return (
    <Modal title="Sale details" description="Receipt items, payment, and balance for this sale." onClose={onClose} size="large">
      {loading ? (
        <div className="state-box"><LoaderCircle className="spin" size={20} /> Loading sale details…</div>
      ) : error ? (
        <div className="detail-content"><p className="notice notice--error" role="alert">{error}</p></div>
      ) : sale ? (
        <div className="sale-detail-content">
          <div className="sale-detail-header">
            <span className="sale-detail-icon"><ReceiptText size={20} /></span>
            <div>
              <strong>{sale.reference}</strong>
              <span><Clock3 size={13} /> {formatDate(sale.soldAt, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <span className={`status-badge status-badge--${sale.paymentStatus.toLowerCase()}`}>
              {statusLabels[sale.paymentStatus]}
            </span>
          </div>

          {sale.customer && (
            <div className="sale-detail-customer">
              <span>Customer</span>
              <strong>{[sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(' ')}</strong>
            </div>
          )}

          <div className="table-wrap sale-detail-table-wrap">
            <table className="data-table sale-detail-table">
              <thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="table-primary">{item.product.name}</span>
                      <small className="table-secondary">{item.product.sku || 'No SKU'}</small>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatXaf(item.unitPrice)}</td>
                    <td><strong>{formatXaf(item.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!sale.items.length && (
            <div className="empty-table-state sale-detail-empty">
              <span className="empty-icon"><Package size={18} /></span>
              <strong>No items were attached to this sale.</strong>
            </div>
          )}

          <div className="sale-detail-bottom">
            <dl className="checkout-totals checkout-totals--confirmation">
              <div><dt>Subtotal</dt><dd>{formatXaf(sale.subtotal)}</dd></div>
              <div><dt>Discount</dt><dd>− {formatXaf(sale.discount)}</dd></div>
              <div className="checkout-total-final"><dt>Grand total</dt><dd>{formatXaf(sale.totalAmount)}</dd></div>
              <div><dt>Amount paid</dt><dd>{formatXaf(sale.amountPaid)}</dd></div>
              {Number(sale.remainingBalance) > 0 && <div><dt>Outstanding balance</dt><dd>{formatXaf(sale.remainingBalance)}</dd></div>}
              {Number(sale.changeDue) > 0 && <div><dt>Change due</dt><dd>{formatXaf(sale.changeDue)}</dd></div>}
              <div><dt>Payment method</dt><dd>{paymentLabels[sale.paymentMethod] ?? sale.paymentMethod}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
