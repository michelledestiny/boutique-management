import { useEffect, useState } from 'react'
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImagePlus,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import { api, formatDate, formatXaf, getErrorMessage } from '../api.js'
import Modal from '../components/Modal.jsx'

const PAGE_SIZE = 8

function ProductFormDialog({ product, onClose, onSaved }) {
  const [savedProductId, setSavedProductId] = useState(product?.id ?? null)
  const editing = Boolean(product || savedProductId)
  const [values, setValues] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    description: product?.description ?? '',
    purchasePrice: product?.purchasePrice ?? '',
    sellingPrice: product?.sellingPrice ?? '',
    openingStock: '0',
    lowStockAlertAt: String(product?.lowStockAlertAt ?? 5),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [removeExistingImage, setRemoveExistingImage] = useState(false)

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(imageFile)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [imageFile])

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function chooseImage(event) {
    const [file] = event.target.files ?? []
    event.target.value = ''
    if (!file) {
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Product images must be 5 MB or smaller.')
      return
    }
    setError('')
    setRemoveExistingImage(false)
    setImageFile(file)
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const body = {
      name: values.name,
      sku: values.sku || null,
      description: values.description || null,
      sellingPrice: values.sellingPrice,
      lowStockAlertAt: Number(values.lowStockAlertAt),
    }

    if (values.purchasePrice !== '') {
      body.purchasePrice = values.purchasePrice
    }
    if (!editing) {
      body.purchasePrice = values.purchasePrice
      body.openingStock = Number(values.openingStock)
    }

    let productId = product?.id ?? savedProductId
    try {
      if (productId) {
        await api.patch(`/products/${productId}`, body)
      } else {
        const { data } = await api.post('/products', body)
        productId = data.data.id
        setSavedProductId(productId)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save this product.'))
      setSaving(false)
      return
    }

    try {
      if (imageFile) {
        await api.put(`/products/${productId}/image`, imageFile, {
          headers: { 'Content-Type': imageFile.type },
        })
      } else if (removeExistingImage && product?.imageUrl) {
        await api.delete(`/products/${productId}/image`)
      }
      onSaved(editing ? 'Product details updated.' : 'Product added to your collection.')
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Could not save the product image.')
      setError(
        productId
          ? `Product details were saved, but the image could not be updated: ${message}`
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  const imageSource = imagePreview || (removeExistingImage ? '' : product?.imageUrl ?? '')

  return (
    <Modal
      title={editing ? 'Edit product' : 'Add a product'}
      description={editing ? 'Update the product details and pricing.' : 'Add an item to your boutique inventory.'}
      onClose={onClose}
      size="large"
    >
      <form className="form-layout" onSubmit={submit}>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <div className="product-image-upload form-field--wide">
          <span className="product-image-label">Product image</span>
          <div className="product-image-upload-row">
            <div className="product-image-preview">
              {imageSource
                ? <img src={imageSource} alt="Product preview" />
                : <Package size={25} strokeWidth={1.5} />}
            </div>
            <div className="product-image-upload-actions">
              <p>Show customers what makes this piece special.</p>
              <div>
                <label className="image-upload-button">
                  <ImagePlus size={15} />
                  <span>{imageSource ? 'Change image' : 'Upload image'}</span>
                  <input
                    className="image-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Upload product image"
                    onChange={chooseImage}
                  />
                </label>
                {product?.imageUrl && !removeExistingImage && !imageFile && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setRemoveExistingImage(true)}
                  >
                    Remove image
                  </button>
                )}
              </div>
              <small>PNG, JPEG, or WebP · up to 5 MB</small>
            </div>
          </div>
        </div>
        <label className="form-field form-field--wide">
          <span>Product name <b aria-hidden="true">*</b></span>
          <input name="name" value={values.name} onChange={updateField} maxLength="160" required autoFocus />
        </label>
        <label className="form-field">
          <span>SKU or product code</span>
          <input name="sku" value={values.sku} onChange={updateField} maxLength="80" autoCapitalize="characters" />
        </label>
        <label className="form-field">
          <span>Low-stock threshold <b aria-hidden="true">*</b></span>
          <input
            name="lowStockAlertAt"
            type="number"
            min="0"
            step="1"
            value={values.lowStockAlertAt}
            onChange={updateField}
            required
          />
        </label>
        <label className="form-field">
          <span>Purchase price (FCFA) <b aria-hidden="true">*</b></span>
          <input
            name="purchasePrice"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.purchasePrice}
            onChange={updateField}
            required={!editing}
          />
        </label>
        <label className="form-field">
          <span>Selling price (FCFA) <b aria-hidden="true">*</b></span>
          <input
            name="sellingPrice"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.sellingPrice}
            onChange={updateField}
            required
          />
        </label>
        {!editing && (
          <label className="form-field">
            <span>Opening quantity</span>
            <input
              name="openingStock"
              type="number"
              min="0"
              step="1"
              value={values.openingStock}
              onChange={updateField}
            />
            <small>A starting quantity is recorded in stock history.</small>
          </label>
        )}
        <label className="form-field form-field--wide">
          <span>Description</span>
          <textarea name="description" rows="3" maxLength="5000" value={values.description} onChange={updateField} />
        </label>
        <footer className="modal-actions form-field--wide">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving && <LoaderCircle className="spin" size={16} />}
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

function ProductDetailsDialog({ product, loading, error, onClose, onEdit }) {
  return (
    <Modal title="Product details" description="Product information and latest stock movements." onClose={onClose}>
      {loading ? (
        <div className="state-box"><LoaderCircle className="spin" size={20} /> Loading product details…</div>
      ) : error ? (
        <p className="notice notice--error" role="alert">{error}</p>
      ) : product ? (
        <div className="detail-content">
          <div className="detail-summary">
            <span className="detail-icon detail-icon--image">
              {product.imageUrl
                ? <img src={product.imageUrl} alt={product.name} />
                : <Package size={22} />}
            </span>
            <div>
              <h3>{product.name}</h3>
              <p>{product.sku || 'No SKU assigned'}</p>
            </div>
          </div>
          <dl className="detail-grid">
            <div><dt>Purchase price</dt><dd>{product.purchasePrice === null ? 'Not recorded' : formatXaf(product.purchasePrice)}</dd></div>
            <div><dt>Selling price</dt><dd>{formatXaf(product.sellingPrice)}</dd></div>
            <div><dt>Available quantity</dt><dd>{product.stockQuantity}</dd></div>
            <div><dt>Low-stock threshold</dt><dd>{product.lowStockAlertAt}</dd></div>
            <div><dt>Added</dt><dd>{formatDate(product.createdAt)}</dd></div>
            <div><dt>Status</dt><dd>{product.isActive ? 'Active' : 'Archived'}</dd></div>
          </dl>
          {product.description && <p className="detail-description">{product.description}</p>}
          <div className="detail-section-heading"><h4>Latest stock movements</h4></div>
          {product.movements?.length ? (
            <ul className="detail-movements">
              {product.movements.map((movement) => (
                <li key={movement.id}>
                  <span>{movement.type === 'PURCHASE' ? 'Stock received' : movement.type.replace('_', ' ').toLowerCase()}</span>
                  <strong className={movement.quantity < 0 ? 'quantity-negative' : 'quantity-positive'}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </strong>
                  <time>{formatDate(movement.occurredAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No stock movements have been recorded.</p>
          )}
          <footer className="modal-actions">
            {product.isActive && <button className="primary-button" type="button" onClick={() => onEdit(product)}>Edit product</button>}
          </footer>
        </div>
      ) : null}
    </Modal>
  )
}

function ArchiveDialog({ product, onClose, onConfirm, saving, error }) {
  return (
    <Modal title="Archive product?" description="Archived products are hidden from the active list, but their stock history is preserved." onClose={onClose} size="small">
      <div className="confirm-content">
        <p><strong>{product.name}</strong> will no longer appear in the active product list.</p>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Keep product</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={saving}>
            {saving ? 'Archiving…' : 'Archive product'}
          </button>
        </footer>
      </div>
    </Modal>
  )
}

export default function ProductsPage({ createRequest = 0 }) {
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 0 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [stockStatus, setStockStatus] = useState('all')
  const [requestStatus, setRequestStatus] = useState({ key: '', error: '' })
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [dialog, setDialog] = useState(() => (
    createRequest > 0 ? { type: 'form', product: null } : null
  ))
  const [details, setDetails] = useState({ product: null, loading: false, error: '' })
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const requestKey = `${page}:${search}:${stockStatus}:${reload}`
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
    api.get('/products', {
      params: { page, pageSize: PAGE_SIZE, search: search || undefined, stockStatus },
      signal: controller.signal,
    })
      .then(({ data }) => {
        setProducts(data.data)
        setPagination(data.pagination)
        setRequestStatus({ key: requestKey, error: '' })
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setRequestStatus({
            key: requestKey,
            error: getErrorMessage(requestError, 'Could not load products.'),
          })
        }
      })
    return () => controller.abort()
  }, [page, search, stockStatus, reload, requestKey])

  async function openDetails(id) {
    setDetails({ product: null, loading: true, error: '' })
    setDialog({ type: 'details' })
    try {
      const { data } = await api.get(`/products/${id}`)
      setDetails({ product: data.data, loading: false, error: '' })
    } catch (requestError) {
      setDetails({ product: null, loading: false, error: getErrorMessage(requestError, 'Could not load product details.') })
    }
  }

  function onProductSaved(message) {
    setDialog(null)
    setNotice(message)
    setReload((value) => value + 1)
  }

  async function archiveProduct() {
    setArchiving(true)
    setArchiveError('')
    try {
      await api.delete(`/products/${dialog.product.id}`)
      setDialog(null)
      setNotice('Product archived. Its history remains available.')
      setReload((value) => value + 1)
    } catch (requestError) {
      setArchiveError(getErrorMessage(requestError, 'Could not archive this product.'))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> INVENTORY</span>
          <h1>Products</h1>
          <p>Keep your collection, pricing and stock thresholds up to date.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setDialog({ type: 'form', product: null })}>
          <Plus size={17} /> Add product
        </button>
      </header>

      {notice && <p className="notice notice--success" role="status">{notice}</p>}
      {error && (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </div>
      )}

      <section className="panel data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by product name or SKU"
              aria-label="Search products by name or SKU"
            />
          </label>
          <label className="filter-field">
            <span>Stock status</span>
            <select value={stockStatus} onChange={(event) => { setStockStatus(event.target.value); setPage(1) }}>
              <option value="all">All products</option>
              <option value="low-stock">Low stock</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Purchase price</th>
                <th>Selling price</th>
                <th>Available</th>
                <th>Low-stock at</th>
                <th>Added</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="table-state" colSpan="8"><LoaderCircle className="spin" size={19} /> Loading products…</td></tr>
              ) : error ? (
                <tr><td className="table-state" colSpan="8">Products could not be loaded. Use the retry action above.</td></tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-table-state">
                      <span className="empty-icon"><Package size={20} /></span>
                      <strong>{search || stockStatus !== 'all' ? 'No matching products' : 'Your product list is ready'}</strong>
                      <span>{search || stockStatus !== 'all' ? 'Try a different search or filter.' : 'Add your first product to start tracking stock.'}</span>
                      {!search && stockStatus === 'all' && (
                        <button className="text-button" type="button" onClick={() => setDialog({ type: 'form', product: null })}>Add a product <Plus size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-table-cell">
                      <span className="product-table-image">
                        {product.imageUrl
                          ? <img src={product.imageUrl} alt="" />
                          : <Package size={16} />}
                      </span>
                      <span className="table-primary">{product.name}</span>
                    </div>
                  </td>
                  <td>{product.sku || <span className="muted-copy">—</span>}</td>
                  <td>{product.purchasePrice === null ? '—' : formatXaf(product.purchasePrice)}</td>
                  <td>{formatXaf(product.sellingPrice)}</td>
                  <td>
                    <span className={`stock-quantity${product.stockQuantity <= product.lowStockAlertAt ? ' stock-quantity--warning' : ''}`}>
                      {product.stockQuantity}
                    </span>
                  </td>
                  <td>{product.lowStockAlertAt}</td>
                  <td>{formatDate(product.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" type="button" aria-label={`View ${product.name}`} title="View details" onClick={() => openDetails(product.id)}><Eye size={16} /></button>
                      <button className="icon-button" type="button" aria-label={`Edit ${product.name}`} title="Edit product" onClick={() => setDialog({ type: 'form', product })}><Pencil size={15} /></button>
                      <button className="icon-button icon-button--danger" type="button" aria-label={`Archive ${product.name}`} title="Archive product" onClick={() => { setArchiveError(''); setDialog({ type: 'archive', product }) }}><Archive size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>{loading || error ? '— products' : `${pagination.totalItems} ${pagination.totalItems === 1 ? 'product' : 'products'}`}</span>
          <div className="pagination">
            <span>Page {page} of {Math.max(pagination.totalPages, 1)}</span>
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      {dialog?.type === 'form' && (
        <ProductFormDialog
          key={dialog.product?.id ?? 'new'}
          product={dialog.product}
          onClose={() => setDialog(null)}
          onSaved={onProductSaved}
        />
      )}
      {dialog?.type === 'details' && (
        <ProductDetailsDialog
          product={details.product}
          loading={details.loading}
          error={details.error}
          onClose={() => setDialog(null)}
          onEdit={(product) => setDialog({ type: 'form', product })}
        />
      )}
      {dialog?.type === 'archive' && (
        <ArchiveDialog
          product={dialog.product}
          onClose={() => setDialog(null)}
          onConfirm={archiveProduct}
          saving={archiving}
          error={archiveError}
        />
      )}
    </section>
  )
}
