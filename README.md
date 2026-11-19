# Maison | Boutique Stock, Sales & Credit Ledger

The application includes connected product and stock management, product image uploads, a database-backed point of sale, sales history, sale details, and a daily sales summary. Full customer management, credit payment tracking, and advanced reporting are still out of scope.

## Requirements

- Node.js 20.19+ and npm.
- XAMPP MySQL/MariaDB running on port `3306`.
- A MySQL database named `boutique_management`.

## Configure and run

Install backend and frontend dependencies:

```powershell
cd backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set `DATABASE_URL` in `backend/.env` to your MySQL credentials. For the passwordless local XAMPP `root` account:

```dotenv
DATABASE_URL="mysql://root@127.0.0.1:3306/boutique_management"
```

Never commit `.env` or put database credentials in frontend code.

This project now uses Prisma migrations. The current Phase 1 database was created with `db push` and has no migration history. **For that existing database**, first generate the Prisma Client and mark the baseline as already present; this does not replay the baseline SQL or recreate tables:

```powershell
npm run db:generate
npm run db:baseline
npm run db:migrate
```

For a **new, empty** `boutique_management` database, do not mark the baseline as applied. Run:

```powershell
npm run db:generate
npm run db:migrate
```

The additive migrations preserve existing records. Phase 2 adds nullable `purchasePrice` for compatibility with existing products and stock movement dates. Phase 3 adds sale references, subtotals, discounts, and change due; legacy sales are assigned `LEGACY-<id>` references and retain their existing total as subtotal. Product image support adds a nullable `imageUrl` field. Do not use `db:push` or reset commands.

Install the frontend dependencies from the project root:

```powershell
cd ..\frontend
npm install
cd ..
```

Run the API and frontend in separate terminals:

```powershell
cd backend
npm run dev
```

```powershell
npm run dev:frontend
```

The frontend is at `http://localhost:5173`, the API at `http://localhost:3000`, and Vite proxies `/api` requests to Express. `GET http://localhost:3000/api/v1/health` reports whether MySQL is connected. If it is unavailable, start MySQL in XAMPP and check `DATABASE_URL` in `backend/.env`.

## Phase 2 API

- `GET /api/v1/products?page=1&pageSize=10&search=...&stockStatus=all|low-stock|out-of-stock`
- `GET /api/v1/products/:id`
- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id` (archives the product; it does not physically delete it)
- `PUT /api/v1/products/:id/image` (raw PNG, JPEG, or WebP body; max 5 MB)
- `GET /api/v1/products/:id/image/:filename` (the image URL returned in product data)
- `DELETE /api/v1/products/:id/image`
- `GET /api/v1/stock/movements?page=1&pageSize=10&productId=...&type=...`
- `POST /api/v1/stock/in`
- `POST /api/v1/stock/out`
- `GET /api/v1/stock/low-stock?page=1&pageSize=10`

Product creation accepts `name`, optional `sku` and `description`, decimal-string `purchasePrice` and `sellingPrice`, optional integer `openingStock`, and optional integer `lowStockAlertAt`. Product images are uploaded separately, limited to 5 MB, and validated as PNG, JPEG, or WebP. The backend stores files under `backend/uploads/product-images/`, which is excluded from version control, while the database stores the image URL. Stock quantities must be positive whole numbers for movements; stock-out quantities are stored as negative adjustments. Product responses expose money as decimal strings.

Stock-in/out changes and their movement records are committed in the same Prisma transaction. Stock-out uses an atomic conditional update, preventing negative quantities during concurrent requests. Product archival preserves its stock and sales history.

## Phase 3: Point of sale

The Point of sale page loads active products from the API, supports search, cart quantity controls, optional existing-customer selection, discounts, and payment. Checkout displays a confirmation before creating the sale. Sale creation uses server-side product prices and one Prisma transaction to create the sale and its line items, decrease inventory, and record `SALE` stock movements. Conditional stock updates prevent negative inventory, including during concurrent checkouts.

Money is calculated in integer cents by the backend. The discount cannot exceed the subtotal. `amountPaid` is the tendered amount and cannot be negative; the amount recorded as collected is capped at the sale total, and any excess is recorded separately as `changeDue`. An unpaid or partially paid sale records its outstanding balance as the total less the collected amount. Historical line item prices are retained.

### Sales API

- `GET /api/v1/sales?page=1&pageSize=20&search=...&from=YYYY-MM-DD&to=YYYY-MM-DD&paymentMethod=CASH&paymentStatus=PAID`
- `GET /api/v1/sales/:id` (accepts a sale ID or reference)
- `POST /api/v1/sales`
- `GET /api/v1/sales/summary`
- `GET /api/v1/sales/customers?search=...` (existing customers for the optional POS selector)

The create request accepts `items` (`productId` and positive integer `quantity`), optional decimal-string `discount`, required decimal-string `amountPaid`, optional `paymentMethod` (`CASH`, `MOBILE_MONEY`, `BANK_TRANSFER`, or `OTHER`), and optional existing `customerId`. Prices and totals supplied by the browser are not accepted as authoritative values. Sale responses include the reference, amounts, payment status, amount tendered, change, and item details where requested.

The summary reports today's sale count, final sales total, collected amount (excluding returned change), and outstanding balance for today's sales. Sales history supports reference search, date range, payment method/status filters, pagination, and opening sale details.

## Validation and tests

Run schema validation, client generation, backend syntax checks/tests, frontend lint, and production build from the project root:

```powershell
npm run db:validate
npm run db:generate
npm run build:backend
npm run lint:frontend
npm run build:frontend
npm run test:backend
```

The integration tests require a separate database whose name ends in `_test`. Create `boutique_management_test` in phpMyAdmin. In PowerShell, configure `backend/.env`'s `DATABASE_URL` to the test database for this test session, deploy its migrations, and set `TEST_DATABASE_URL` to the same test-only URL before running:

```powershell
npm run db:migrate --prefix backend
npm run test:backend
```

The test suite rejects a test database URL that does not end in `_test`, checks product CRUD, duplicate SKUs, search, stock operations, low-stock alerts, POS checkout, payments, stock movements, history, daily summary, and concurrent inventory changes, then removes only records created by the tests. Tests run sequentially to avoid competing integration suites and timing out database transactions. Without `TEST_DATABASE_URL`, integration tests are skipped and validation tests still run. Never point `TEST_DATABASE_URL` at the working database.

### Manually verify the POS

1. Start MySQL in XAMPP, apply pending migrations to the intended `boutique_management` database, then start the backend and frontend as described above.
2. In Products, add or edit a product and upload a PNG, JPEG, or WebP image up to 5 MB. Verify the preview and product list display it.
3. Create or choose a product with available stock, then open Point of sale, search for it, add it to the cart, and try valid quantity, discount, and payment amounts.
4. Confirm checkout and verify the receipt; check that the product quantity and stock history reflect the sale.
5. Open Sales history to search/filter and inspect the sale details. Open Daily sales to see today's database-backed totals.
6. Attempt to add more units than available and verify checkout is blocked or rejected without changing stock.

## Project structure

```text
backend/
  prisma/
    schema.prisma
    migrations/                 Phase 1 baseline and additive product, stock, sales, and image migrations
  src/
    controllers/                Request/response handling
    middleware/                 Centralized API errors
    routes/                     Products, stock, sales, and health endpoints
    services/                   Product, image, stock, money, and sales operations
    validation/                 Request input validation
  tests/                        Input, product/stock, and sales API tests
frontend/
  src/
    components/                 Product picker, sale details dialog, and modals
    pages/                      Dashboard, products, stock, POS, sales history, daily sales
    api.js                      Axios client and formatting helpers
    App.jsx                     Responsive navigation and page shell
```

## Database design

Money uses MySQL `DECIMAL(12, 2)`, not floating-point columns. Product sales prices remain in the existing `unitPrice` column and are exposed by the API as `sellingPrice`; new `purchasePrice` values are also decimal. The `Product`, `StockMovement`, `Customer`, `Sale`, `SaleItem`, and `CreditPayment` models and their relations are retained. The Prisma migration baseline records the existing Phase 1 schema for future deployments; it is marked applied, not executed, on the already-provisioned database.
