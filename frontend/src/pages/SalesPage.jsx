import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  LoaderCircle,
  Package,
} from 'lucide-react'
import { api, centsToMoney, formatDate, formatXaf, getErrorMessage, moneyToCents } from '../api.js'
import Modal from '../components/Modal.jsx'

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'OTHER', label: 'Other' },
]

function ProductTile({ product, onAdd }) {
  return (
    <article className={`pos-product${product.stockQuantity === 0 ? ' pos-product--unavailable' : ''}`}>
      <div className="pos-product-top">
        <span className={`pos-product-icon${product.imageUrl ? ' pos-product-icon--photo' : ''}`}>
          {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Package size={18} />}
        </span>
        <span className={`pos-availability${product.stockQuantity <= product.lowStockAlertAt ? ' pos-availability--low' : ''}`}>
          {product.stockQuantity} available
        </span>
      </div>
      <div className="pos-product-copy">
        <strong>{product.name}</strong>
        <span>{product.sku || 'No SKU'}</span>
      </div>
      <div className="pos-product-bottom">
        <strong>{formatXaf(product.sellingPrice)}</strong>
        <button
          type="button"
          className="pos-add-button"
          aria-label={`Add ${product.name} to cart`}
          disabled={product.stockQuantity === 0}
          onClick={() => onAdd(product)}
        >
          <Plus size={16} />
        </button>
      </div>
    </article>
  )
}

function CheckoutConfirmation({ cart, subtotal, discount, total, amountTendered, paymentMethod, customer, onClose, onConfirm, saving, error }) {
  const payment = PAYMENT_METHODS.find(({ value }) => value === paymentMethod)?.label ?? paymentMethod
  const paidCents = amountTendered < total ? amountTendered : total
  const changeCents = amountTendered > total ? amountTendered - total : 0n
  const balanceCents = total > amountTendered ? total - amountTendered : 0n

  return (
    <Modal title="Confirm this sale" description="Review the checkout before updating stock and saving the sale." onClose={onClose} size="medium">
      <div className="sale-confirm-content">
        <ul className="confirm-line-items">
          {cart.map((item) => (
            <li key={item.id}>
              <span>{item.quantity} × {item.name}</span>
              <strong>{formatXaf(centsToMoney(moneyToCents(item.sellingPrice) * BigInt(item.quantity)))}</strong>
            </li>
          ))}
        </ul>
        <dl className="checkout-totals checkout-totals--confirmation">
          <div><dt>Subtotal</dt><dd>{formatXaf(centsToMoney(subtotal))}</dd></div>
          <div><dt>Discount</dt><dd>− {formatXaf(centsToMoney(discount))}</dd></div>
          <div className="checkout-total-final"><dt>Final total</dt><dd>{formatXaf(centsToMoney(total))}</dd></div>
          <div><dt>Amount applied</dt><dd>{formatXaf(centsToMoney(paidCents))}</dd></div>
          {changeCents > 0n && <div><dt>Change due</dt><dd>{formatXaf(centsToMoney(changeCents))}</dd></div>}
          {balanceCents > 0n && <div><dt>Remaining balance</dt><dd>{formatXaf(centsToMoney(balanceCents))}</dd></div>}
          <div><dt>Payment method</dt><dd>{payment}</dd></div>
          {customer && <div><dt>Customer</dt><dd>{customer.name}</dd></div>}
        </dl>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Go back</button>
          <button className="primary-button" type="button" onClick={onConfirm} disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
            {saving ? 'Completing sale…' : 'Confirm & complete sale'}
          </button>
        </footer>
      </div>
    </Modal>
  )
}

function SaleCompleteDialog({ sale, onClose, onViewHistory }) {
  return (
    <Modal title="Sale completed" description="The sale was saved and product stock was updated." onClose={onClose} size="small">
      <div className="sale-complete-content">
        <span className="sale-success-icon"><Check size={22} /></span>
        <strong>{sale.reference}</strong>
        <time>{formatDate(sale.soldAt, { hour: '2-digit', minute: '2-digit' })}</time>
        <dl className="checkout-totals checkout-totals--confirmation">
          <div><dt>Final total</dt><dd>{formatXaf(sale.totalAmount)}</dd></div>
          <div><dt>Amount applied</dt><dd>{formatXaf(sale.amountPaid)}</dd></div>
          {Number(sale.changeDue) > 0 && <div><dt>Change due</dt><dd>{formatXaf(sale.changeDue)}</dd></div>}
          {Number(sale.remainingBalance) > 0 && <div><dt>Remaining balance</dt><dd>{formatXaf(sale.remainingBalance)}</dd></div>}
        </dl>
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onViewHistory}>Sales history</button>
          <button className="primary-button" type="button" onClick={onClose}>New sale</button>
        </footer>
      </div>
    </Modal>
  )
}

export default function SalesPage({ onNavigate }) {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [cart, setCart] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [productStatus, setProductStatus] = useState({ key: '', error: '' })
  const [customerError, setCustomerError] = useState('')
  const [reload, setReload] = useState(0)
  const [discountInput, setDiscountInput] = useState('0')
  const [amountPaidInput, setAmountPaidInput] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [customerId, setCustomerId] = useState('')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [saving, setSaving] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const requestKey = `${search}:${reload}`
  const loading = productStatus.key !== requestKey
  const productError = productStatus.key === requestKey ? productStatus.error : ''

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    api.get('/products', {
      params: { page: 1, pageSize: 100, search: search || undefined },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setProducts(data.data)
        setProductStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setProductStatus({ key: requestKey, error: getErrorMessage(requestError, 'Could not load products.') })
        }
      })
    return () => controller.abort()
  }, [search, reload, requestKey])

  useEffect(() => {
    const controller = new AbortController()
    api.get('/sales/customers', { signal: controller.signal })
      .then(({ data }) => setCustomers(data.data))
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setCustomerError(getErrorMessage(requestError, 'Existing customer options could not be loaded.'))
        }
      })
    return () => controller.abort()
  }, [])

  const totals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) => sum + moneyToCents(item.sellingPrice) * BigInt(item.quantity),
      0n,
    )
    const discount = moneyToCents(discountInput)
    const amountTendered = moneyToCents(amountPaidInput)
    return {
      subtotal,
      discount,
      amountTendered,
      total: discount !== null && discount <= subtotal ? subtotal - discount : null,
    }
  }, [cart, discountInput, amountPaidInput])

  const discountError =
    totals.discount === null
      ? 'Enter a valid non-negative discount with up to two decimal places.'
      : totals.discount > totals.subtotal
        ? 'Discount cannot exceed the cart subtotal.'
        : ''
  const paymentError =
    totals.amountTendered === null
      ? 'Enter a valid non-negative payment amount with up to two decimal places.'
      : ''
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null
  const availableProducts = products.filter((product) => product.stockQuantity > 0)
  const outOfStockCount = products.filter((product) => product.stockQuantity === 0).length

  function addProduct(product) {
    setNotice('')
    const existing = cart.find((item) => item.id === product.id)
    if (existing) {
      if (existing.quantity >= product.stockQuantity) {
        setNotice(`Only ${product.stockQuantity} ${product.name} available in stock.`)
        return
      }
      setCart((current) => current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      return
    }
    setCart((current) => [...current, { ...product, quantity: 1 }])
  }

  function changeQuantity(productId, delta) {
    const item = cart.find((entry) => entry.id === productId)
    if (!item) {
      return
    }
    const nextQuantity = item.quantity + delta
    if (nextQuantity > item.stockQuantity) {
      setNotice(`Only ${item.stockQuantity} ${item.name} available in stock.`)
      return
    }
    setNotice('')
    setCart((current) => current.flatMap((entry) => (
      entry.id !== productId ? [entry] : nextQuantity < 1 ? [] : [{ ...entry, quantity: nextQuantity }]
    )))
  }

  function openCheckout() {
    setNotice('')
    setCheckoutError('')
    if (cart.length === 0) {
      setNotice('Add at least one product before checkout.')
      return
    }
    if (discountError || paymentError || totals.total === null) {
      setNotice(discountError || paymentError || 'Check the sale totals before checkout.')
      return
    }
    setDialog('confirm')
  }

  async function completeSale() {
    setSaving(true)
    setCheckoutError('')
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        discount: centsToMoney(totals.discount),
        amountPaid: centsToMoney(totals.amountTendered),
        paymentMethod,
        customerId: customerId || null,
      })
      setCompletedSale(data.data)
      setDialog('complete')
      setCart([])
      setDiscountInput('0')
      setAmountPaidInput('0')
      setPaymentMethod('CASH')
      setCustomerId('')
      setReload((value) => value + 1)
    } catch (requestError) {
      setCheckoutError(getErrorMessage(requestError, 'Sale could not be completed. Refresh product availability and try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-content pos-page">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> POINT OF SALE</span>
          <h1>New sale</h1>
          <p>Choose products, review the cart, and complete payment in one place.</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary-button" type="button" onClick={() => onNavigate('Daily sales')}>
            Today&apos;s summary <ArrowRight size={15} />
          </button>
          <button className="secondary-button" type="button" onClick={() => onNavigate('Sales history')}>
            Sales history <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {notice && <p className="notice notice--error" role="alert">{notice}</p>}

      <div className="pos-layout">
        <section className="panel pos-catalogue">
          <div className="pos-section-heading">
            <div>
              <span className="panel-kicker">PRODUCT CATALOGUE</span>
              <h2>Select items</h2>
            </div>
            <span className="pos-result-count">{products.length} products</span>
          </div>
          <label className="search-field pos-search">
            <Search size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or SKU"
              aria-label="Search products by name or SKU"
            />
          </label>

          {productError && (
            <div className="notice notice--error" role="alert">
              <span>{productError}</span>
              <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="pos-product-state"><LoaderCircle className="spin" size={20} /> Loading available products…</div>
          ) : productError ? (
            <div className="pos-product-state">Products could not be loaded. Use the retry action above.</div>
          ) : products.length === 0 ? (
            <div className="pos-product-state">
              <span className="empty-icon"><Package size={20} /></span>
              <strong>{search ? 'No matching products' : 'No products in your catalogue yet'}</strong>
              <span>{search ? 'Try another name or SKU.' : 'Add products with stock before opening the POS.'}</span>
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="pos-product-state">
              <span className="empty-icon empty-icon--warning"><Package size={20} /></span>
              <strong>All matching products are out of stock</strong>
              <span>Receive stock before adding these products to a sale.</span>
            </div>
          ) : (
            <>
              <div className="pos-product-grid">
                {availableProducts.map((product) => (
                  <ProductTile key={product.id} product={product} onAdd={addProduct} />
                ))}
              </div>
              {products.length === 100 && (
                <p className="pos-catalogue-note">Showing the first 100 matches. Search by name or SKU to narrow the list.</p>
              )}
            </>
          )}
          {outOfStockCount > 0 && (
            <p className="pos-stock-note">{outOfStockCount} matching {outOfStockCount === 1 ? 'product is' : 'products are'} out of stock and cannot be sold.</p>
          )}
        </section>

        <aside className="panel pos-cart">
          <div className="pos-cart-heading">
            <div>
              <span className="panel-kicker">CURRENT ORDER</span>
              <h2>Sale cart</h2>
            </div>
            <span className="cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </div>

          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <span className="empty-icon"><ShoppingBag size={20} /></span>
              <strong>Your cart is empty</strong>
              <span>Add products from the catalogue to start a sale.</span>
            </div>
          ) : (
            <ul className="pos-cart-items">
              {cart.map((item) => (
                <li key={item.id}>
                  <div className="cart-item-heading">
                    <span><strong>{item.name}</strong><small>{formatXaf(item.sellingPrice)} each</small></span>
                    <button className="icon-button icon-button--danger" type="button" aria-label={`Remove ${item.name}`} onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="cart-item-bottom">
                    <div className="quantity-stepper">
                      <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><Minus size={13} /></button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label={`Increase ${item.name}`} disabled={item.quantity >= item.stockQuantity} onClick={() => changeQuantity(item.id, 1)}><Plus size={13} /></button>
                    </div>
                    <strong>{formatXaf(centsToMoney(moneyToCents(item.sellingPrice) * BigInt(item.quantity)))}</strong>
                  </div>
                  <small className="cart-stock-hint">{item.stockQuantity} available</small>
                </li>
              ))}
            </ul>
          )}

          <div className="pos-checkout-fields">
            <label className="form-field">
              <span>Customer <small>(optional)</small></span>
              <span className="select-wrap">
                <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Walk-in customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </span>
              {customerError && <small className="field-error">{customerError}</small>}
              {!customerError && customers.length === 0 && <small>No customers have been added yet; checkout is still available.</small>}
            </label>
            <label className="form-field">
              <span>Payment method <b aria-hidden="true">*</b></span>
              <span className="select-wrap">
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
                <ChevronDown size={15} />
              </span>
            </label>
          </div>

          <label className="form-field pos-money-field">
            <span>Discount (FCFA)</span>
            <input
              type="number"
              min="0"
              max={centsToMoney(totals.subtotal)}
              step="0.01"
              inputMode="decimal"
              value={discountInput}
              onChange={(event) => setDiscountInput(event.target.value)}
              aria-invalid={Boolean(discountError)}
            />
            {discountError && <small className="field-error">{discountError}</small>}
          </label>

          <dl className="checkout-totals">
            <div><dt>Subtotal</dt><dd>{formatXaf(centsToMoney(totals.subtotal))}</dd></div>
            <div><dt>Discount</dt><dd>− {totals.discount === null ? '—' : formatXaf(centsToMoney(totals.discount))}</dd></div>
            <div className="checkout-total-final"><dt>Final total</dt><dd>{totals.total === null ? '—' : formatXaf(centsToMoney(totals.total))}</dd></div>
          </dl>

          <label className="form-field pos-money-field">
            <span>Amount tendered (FCFA) <b aria-hidden="true">*</b></span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amountPaidInput}
              onChange={(event) => setAmountPaidInput(event.target.value)}
              aria-invalid={Boolean(paymentError)}
            />
            {paymentError && <small className="field-error">{paymentError}</small>}
          </label>

          {totals.total !== null && totals.amountTendered !== null && totals.amountTendered > totals.total && (
            <div className="checkout-change"><span>Change due</span><strong>{formatXaf(centsToMoney(totals.amountTendered - totals.total))}</strong></div>
          )}
          {totals.total !== null && totals.amountTendered !== null && totals.amountTendered < totals.total && (
            <div className="checkout-balance"><span>Remaining balance</span><strong>{formatXaf(centsToMoney(totals.total - totals.amountTendered))}</strong></div>
          )}

          <button
            className="primary-button pos-checkout-button"
            type="button"
            disabled={cart.length === 0 || Boolean(discountError) || Boolean(paymentError) || totals.total === null || loading}
            onClick={openCheckout}
          >
            <Check size={16} /> Review & complete sale
          </button>
        </aside>
      </div>

      {dialog === 'confirm' && (
        <CheckoutConfirmation
          cart={cart}
          subtotal={totals.subtotal}
          discount={totals.discount}
          total={totals.total}
          amountTendered={totals.amountTendered}
          paymentMethod={paymentMethod}
          customer={selectedCustomer}
          onClose={() => setDialog('')}
          onConfirm={completeSale}
          saving={saving}
          error={checkoutError}
        />
      )}
      {dialog === 'complete' && completedSale && (
        <SaleCompleteDialog
          sale={completedSale}
          onClose={() => setDialog('')}
          onViewHistory={() => { setDialog(''); onNavigate('Sales history') }}
        />
      )}
    </section>
  )
}
