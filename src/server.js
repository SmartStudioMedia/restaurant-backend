require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth');
const QRCode = require('qrcode');

const { db, migrate, seed } = require('./db-simple');

const PORT = process.env.PORT || 4000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
const stripe = STRIPE_SECRET ? require('stripe')(STRIPE_SECRET) : null;

// Ensure DB ready
migrate();
seed();

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Ensure API responses are not cached by browsers during development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Public API
app.get('/api/menu', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order ASC').all();
  const itemsByCat = {};
  for (const c of categories) {
    const items = db.prepare('SELECT * FROM items WHERE category_id = ? AND hidden = 0 ORDER BY sort_order ASC, id ASC').all(c.id);
    itemsByCat[c.key] = items.map(i => ({
      id: i.id,
      price: i.price,
      image: i.image_url,
      video: i.video_url,
      name: { en: i.name },
      description: { en: i.description || '' },
      nutrition: { en: i.nutrition || '' },
      ingredients: { en: i.ingredients || '' },
      allergies: { en: i.allergies || '' },
      prepTime: { en: i.prep_time || '' },
    }));
  }
  res.json({
    categories: categories.map(c => ({ key: c.key, name: c.name, icon: c.icon })),
    menu: itemsByCat,
  });
});

// Branding/settings for frontend
app.get('/api/settings', (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json({
    brandName: s.brand_name,
    logoUrl: s.logo_url,
    colors: { primary: s.primary_color, secondary: s.secondary_color },
    backgroundUrl: s.background_url,
    fontFamily: s.font_family,
    currency: s.currency || 'EUR',
  });
});

// Place order
app.post('/api/orders', (req, res) => {
  const { items, orderType, tableToken, tableNumber, paymentMethod } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No items' });
  if (orderType !== 'dine-in' && orderType !== 'takeaway') return res.status(400).json({ error: 'Invalid orderType' });

  const getItemStmt = db.prepare('SELECT id, name, price FROM items WHERE id = ?');
  let total = 0;
  const orderItems = [];
  for (const it of items) {
    const row = getItemStmt.get(it.id);
    if (!row) return res.status(400).json({ error: `Invalid item ${it.id}` });
    const qty = Math.max(1, Number(it.qty || 1));
    total += row.price * qty;
    orderItems.push({ item_id: row.id, name: row.name, price: row.price, quantity: qty });
  }

  const insertOrder = db.prepare(`INSERT INTO orders (table_number, table_token, order_type, total, payment_method, payment_status) VALUES (?,?,?,?,?,?)`);
  const insertOrderItem = db.prepare(`INSERT INTO order_items (order_id, item_id, name, price, quantity) VALUES (?,?,?,?,?)`);

  const tx = db.transaction(() => {
    const info = insertOrder.run(tableNumber || null, tableToken || null, orderType, total, paymentMethod || null, paymentMethod ? 'pending' : null);
    for (const oi of orderItems) insertOrderItem.run(info.lastInsertRowid, oi.item_id, oi.name, oi.price, oi.quantity);
    return info.lastInsertRowid;
  });

  const orderId = tx();

  res.json({ orderId, total });
});

// Confirm order (kitchen marks as confirmed/taken out)
app.post('/api/orders/:id/confirm', (req, res) => {
  const id = Number(req.params.id);
  const upd = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const info = upd.run('confirmed', id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Complete order
app.post('/api/orders/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const upd = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const info = upd.run('completed', id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Analytics: best items
app.get('/api/analytics/top-items', (req, res) => {
  const rows = db.prepare(`
    SELECT oi.item_id, oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.price) as sales
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('confirmed','completed')
    GROUP BY oi.item_id, oi.name
    ORDER BY sales DESC
    LIMIT 20
  `).all();
  res.json(rows);
});

// Stripe payment intent (optional)
app.post('/api/payments/stripe-intent', async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
    const { amount, currency } = req.body;
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: (currency || 'eur').toLowerCase(),
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ===== Admin =====
const adminAuth = basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true });

app.get('/admin', adminAuth, (req, res) => {
  const pending = db.prepare('SELECT COUNT(1) as c FROM orders WHERE status = ?').get('received').c;
  const confirmed = db.prepare('SELECT COUNT(1) as c FROM orders WHERE status = ?').get('confirmed').c;
  const totalSales = db.prepare('SELECT IFNULL(SUM(total),0) as s FROM orders WHERE status IN (\'confirmed\',\'completed\')').get().s;
  res.render('admin_dashboard', { pending, confirmed, totalSales });
});

// Items CRUD (very minimal)
app.get('/admin/items', adminAuth, (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const items = db.prepare('SELECT i.*, c.name as category_name FROM items i JOIN categories c ON c.id = i.category_id ORDER BY c.sort_order, i.sort_order').all();
  res.render('items', { cats, items });
});

app.post('/admin/items/create', adminAuth, (req, res) => {
  const { category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order } = req.body;
  console.log('Creating item:', { category_id, name, price });
  try {
    db.prepare(`INSERT INTO items (category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(Number(category_id), name, description || '', Number(price), image_url || '', video_url || '', nutrition || '', ingredients || '', allergies || '', prep_time || '', hidden ? 1 : 0, Number(sort_order || 0));
    console.log('Item created successfully');
  } catch (error) {
    console.error('Error creating item:', error);
  }
  res.redirect('/admin/items');
});

app.post('/admin/items/:id/update', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const { category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order } = req.body;
  console.log('Updating item:', { id, category_id, name, price });
  try {
    db.prepare(`UPDATE items SET category_id=?, name=?, description=?, price=?, image_url=?, video_url=?, nutrition=?, ingredients=?, allergies=?, prep_time=?, hidden=?, sort_order=? WHERE id=?`)
      .run(Number(category_id), name, description || '', Number(price), image_url || '', video_url || '', nutrition || '', ingredients || '', allergies || '', prep_time || '', hidden ? 1 : 0, Number(sort_order || 0), id);
    console.log('Item updated successfully');
  } catch (error) {
    console.error('Error updating item:', error);
  }
  res.redirect('/admin/items');
});

app.post('/admin/items/:id/delete', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.redirect('/admin/items');
});

// Settings
app.get('/admin/settings', adminAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.render('settings', { s });
});
app.post('/admin/settings', adminAuth, (req, res) => {
  const { brand_name, logo_url, primary_color, secondary_color, background_url, font_family, currency } = req.body;
  db.prepare(`UPDATE settings SET brand_name=?, logo_url=?, primary_color=?, secondary_color=?, background_url=?, font_family=?, currency=? WHERE id = 1`)
    .run(brand_name, logo_url || '', primary_color, secondary_color, background_url || '', font_family, currency);
  res.redirect('/admin/settings');
});

// Tables with QR codes
app.get('/admin/tables', adminAuth, async (req, res) => {
  const rows = db.prepare('SELECT * FROM tables ORDER BY id').all();
  const baseUrl = process.env.TABLE_URL_BASE || `http://localhost:${PORT}`;
  const withQr = await Promise.all(rows.map(async (t) => {
    const url = `${baseUrl}/?table=${encodeURIComponent(t.number)}&token=${encodeURIComponent(t.token)}`;
    const qr = await QRCode.toDataURL(url);
    return { ...t, url, qr };
  }));
  res.render('tables', { tables: withQr });
});
app.post('/admin/tables/create', adminAuth, (req, res) => {
  const { number } = req.body;
  const token = `t-${Math.random().toString(36).slice(2, 10)}`;
  db.prepare('INSERT INTO tables (number, token) VALUES (?, ?)').run(number, token);
  res.redirect('/admin/tables');
});

// Orders list and confirm
app.get('/admin/orders', adminAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  const itemsByOrder = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  for (const o of orders) o.items = itemsByOrder.all(o.id);
  res.render('orders', { orders });
});
app.post('/admin/orders/:id/status', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  res.redirect('/admin/orders');
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Homepage
app.get('/', (req, res) => {
  res.json({ 
    message: 'Restaurant Backend API is running!', 
    endpoints: {
      health: '/api/health',
      menu: '/api/menu',
      settings: '/api/settings',
      admin: '/admin'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});


