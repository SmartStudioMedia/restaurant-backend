AROMA Simple Backend (Node + Express + SQLite)

Quick backend with admin to manage menu, items, settings, tables/QR, orders, and simple analytics. Optional Stripe payment intent.

Run locally

1) Install deps
```
npm install
```
2) Initialize DB (creates tables, seeds example data and tables with QR tokens)
```
npm run db:reset
```
3) Start server
```
npm run dev
```
Server: http://localhost:4000

Admin: http://localhost:4000/admin (Basic auth)
- Username: admin
- Password: changeme (change via .env)

Optional env in .env
```
PORT=4000
ADMIN_USER=admin
ADMIN_PASS=changeme
FRONTEND_ORIGIN=*
# STRIPE_SECRET=sk_test_xxx
# TABLE_URL_BASE=http://localhost:5173
```

If your frontend runs on CodeSandbox or another host, set `FRONTEND_ORIGIN` to that exact URL and restart the server:
```
FRONTEND_ORIGIN=https://4v4k57-3000.csb.app
TABLE_URL_BASE=https://4v4k57-3000.csb.app
```
After creating/updating `.env`, stop `npm run dev` and start it again so changes take effect.

Public API

- GET /api/menu → returns { categories, menu } excluding hidden items
- GET /api/settings → returns branding/currency settings
- POST /api/orders → body: { items: [{id, qty}], orderType: 'dine-in'|'takeaway', tableToken?, tableNumber?, paymentMethod? } → returns { orderId, total }
- POST /api/orders/:id/confirm → mark as confirmed
- POST /api/orders/:id/complete → mark as completed
- GET /api/analytics/top-items → top sellers
- POST /api/payments/stripe-intent → { amount, currency } → { clientSecret } (if Stripe configured)

Frontend integration (no UI changes required)

Your existing React page can stay intact. Just call these endpoints at checkout and, optionally, replace the hardcoded menu with backend data.

1) Read table params from URL (supports QR per table):
```
const params = new URLSearchParams(window.location.search);
const tableNumber = params.get('table') || null;
const tableToken = params.get('token') || null;
```

2) Build payload from your cart when pressing Complete Order:
```
const payload = {
  items: cart.map(c => ({ id: c.id, qty: c.qty })),
  orderType: orderType, // 'dine-in' or 'takeaway' from your state
  tableNumber,
  tableToken,
  paymentMethod: 'cash' // or 'card' if using Stripe client
};
const res = await fetch('http://localhost:4000/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
const data = await res.json();
```

3) If using Stripe, first fetch a client secret:
```
const intent = await fetch('http://localhost:4000/api/payments/stripe-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: total, currency: 'eur' })
}).then(r => r.json());
// Then confirm on client with Stripe.js and include paymentMethod in payload
```

4) Optionally load menu from backend instead of hardcoded menu:
```
const data = await fetch('http://localhost:4000/api/menu').then(r => r.json());
// data.categories and data.menu match the structure your UI expects enough to render
```

Admin usage

- Manage items: /admin/items (create, edit, hide/show, images/videos, price)
- Settings/branding: /admin/settings (brand name, logo, colors, background, font, currency)
- Tables/QR: /admin/tables (auto QR codes per table)
- Orders: /admin/orders (view items, totals; change statuses to received/confirmed/completed)
- Analytics API: /api/analytics/top-items

Notes

- SQLite file: data.sqlite in project root
- Keep a backup before resetting DB in production
- PayPal not included yet; can be added with an additional endpoint




