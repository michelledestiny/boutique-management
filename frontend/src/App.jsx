import { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { api } from './api.js'
import DailySalesPage from './pages/DailySalesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LowStockPage from './pages/LowStockPage.jsx'
import ProductsPage from './pages/ProductsPage.jsx'
import SalesHistoryPage from './pages/SalesHistoryPage.jsx'
import SalesPage from './pages/SalesPage.jsx'
import StockHistoryPage from './pages/StockHistoryPage.jsx'
import StockPage from './pages/StockPage.jsx'
import './App.css'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Products', icon: Package },
  { label: 'Stock management', icon: ArrowLeftRight },
  { label: 'Stock history', icon: Clock3 },
  { label: 'Low-stock alerts', icon: CircleAlert },
  { label: 'Point of sale', icon: ShoppingBag },
  { label: 'Sales history', icon: ReceiptText },
  { label: 'Daily sales', icon: CalendarDays },
]

const laterModules = [
  { label: 'Customers', icon: Users },
  { label: 'Credit ledger', icon: CreditCard },
]

function App() {
  const [today] = useState(() => new Date())
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(today)
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState('loading')
  const [apiMessage, setApiMessage] = useState('')
  const [createRequest, setCreateRequest] = useState(0)
  const [stockRequest, setStockRequest] = useState(null)

  useEffect(() => {
    let active = true
    api.get('/health')
      .then(({ data }) => {
        if (active) {
          setApiStatus(data.database === 'connected' ? 'connected' : 'offline')
          setApiMessage(
            data.database === 'connected'
              ? 'Your boutique workspace is connected.'
              : 'Your workspace is open. Start MySQL and configure your database to connect.',
          )
        }
      })
      .catch(() => {
        if (active) {
          setApiStatus('offline')
          setApiMessage('Start the backend and configure MySQL to connect your boutique workspace.')
        }
      })

    return () => {
      active = false
    }
  }, [])

  function navigate(page) {
    setActivePage(page)
    setSidebarOpen(false)
    if (page !== 'Products') {
      setCreateRequest(0)
    }
    if (page !== 'Stock management') {
      setStockRequest(null)
    }
  }

  function addProduct() {
    setCreateRequest((value) => value + 1)
    navigate('Products')
  }

  function restockProduct(product) {
    setStockRequest({ requestId: Date.now(), mode: 'in', product })
    navigate('Stock management')
  }

  function closeSidebar() {
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault()
            navigate('Dashboard')
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="couture-mark" x1="8" y1="8" x2="39" y2="39" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F4D8FF" />
                  <stop offset=".52" stopColor="#C084FC" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <path
                d="M24 7.5c2.4 0 3.8 1.5 3.8 3.5 0 1.5-1.1 2.5-2.4 3.5v3.2L40 28.1c1.7 1.2.9 3.9-1.2 3.9H9.2c-2.1 0-2.9-2.7-1.2-3.9l14.6-10.4v-3.2c-1.3-1-2.4-2-2.4-3.5 0-2 1.4-3.5 3.8-3.5Z"
                stroke="url(#couture-mark)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M24 32v7m-6 0h12" stroke="url(#couture-mark)" strokeWidth="2" strokeLinecap="round" />
              <path d="m36.5 9 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="#F4D8FF" />
            </svg>
          </span>
          <span className="brand-copy">
            <span className="brand-name">maison<span>.</span></span>
            <span className="brand-caption">BOUTIQUE · STOCK · SALES</span>
          </span>
        </a>

        <div className="shop-switcher">
          <div className="shop-avatar"><Package size={17} strokeWidth={1.7} /></div>
          <div className="shop-information">
            <span className="shop-label">YOUR BOUTIQUE</span>
            <span className="shop-name">Your boutique</span>
          </div>
          <ChevronDown size={16} className="shop-chevron" />
        </div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          <span className="nav-section-label">WORKSPACE</span>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`nav-link${activePage === label ? ' nav-link--active' : ''}`}
              key={label}
              type="button"
              aria-current={activePage === label ? 'page' : undefined}
              onClick={() => navigate(label)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
          <span className="nav-section-label nav-section-label--later">COMING IN A LATER PHASE</span>
          {laterModules.map(({ label, icon: Icon }) => (
            <div className="nav-link nav-link--disabled" key={label} aria-disabled="true" title="Not included in Phase 3">
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              <span className="nav-planned">Later</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="setup-card">
            <span className="setup-icon"><Sparkles size={15} /></span>
            <p className="setup-heading">A little more lovely.</p>
            <p className="setup-copy">Your boutique workspace is ready whenever you are.</p>
            <span className="setup-ready-caption">PRODUCTS & STOCK, CONNECTED</span>
          </div>
          <div className="profile-card">
            <div className="profile-avatar"><CircleUserRound size={17} strokeWidth={1.7} /></div>
            <div className="profile-information">
              <span className="profile-name">Boutique owner</span>
              <span className="profile-role">Workspace account</span>
            </div>
          </div>
        </div>
      </aside>

      <main id="dashboard" className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <span className="breadcrumb-current">{activePage}</span>
          </div>
          <div className="topbar-actions">
            <span className="topbar-date"><time dateTime={today.toISOString()}>{formattedDate}</time></span>
            <button type="button" className="icon-button" aria-label="Open product search" onClick={() => navigate('Products')}>
              <Search size={18} />
            </button>
            <span className="topbar-divider" />
            <div className="profile-dropdown" aria-label="Boutique owner profile">
              <span className="profile-avatar profile-avatar--small"><CircleUserRound size={15} strokeWidth={1.7} /></span>
              <span className="profile-short-name">Owner</span>
            </div>
          </div>
        </header>

        {activePage === 'Dashboard' && (
          <DashboardPage
            apiStatus={apiStatus}
            apiMessage={apiMessage}
            onNavigate={navigate}
            onCreateProduct={addProduct}
            onRestock={restockProduct}
          />
        )}
        {activePage === 'Products' && <ProductsPage key={createRequest} createRequest={createRequest} />}
        {activePage === 'Stock management' && <StockPage stockRequest={stockRequest} onNavigate={navigate} />}
        {activePage === 'Stock history' && <StockHistoryPage />}
        {activePage === 'Low-stock alerts' && <LowStockPage onRestock={restockProduct} />}
        {activePage === 'Point of sale' && <SalesPage onNavigate={navigate} />}
        {activePage === 'Sales history' && <SalesHistoryPage />}
        {activePage === 'Daily sales' && <DailySalesPage onNavigate={navigate} />}

        {activePage !== 'Products' && (
          <button className="quick-add" type="button" aria-label="Add product" title="Add product" onClick={addProduct}>
            <Plus size={21} strokeWidth={1.8} />
          </button>
        )}
      </main>
    </div>
  )
}

export default App
