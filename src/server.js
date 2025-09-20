require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth');
const QRCode = require('qrcode');

const { db, migrate, seed } = require('./db-fixed');

const PORT = process.env.PORT || 4000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
const stripe = STRIPE_SECRET ? require('stripe')(STRIPE_SECRET) : null;

// Ensure DB ready
migrate();
seed();

// Force add menu items if they don't exist
const items = db.prepare('SELECT * FROM items ORDER BY id').all();
if (items.length === 0) {
  console.log('No items found, adding default menu...');
  const defaultItems = [
    { category_id: 1, name: 'Classic Burger', description: 'Juicy grilled beef patty with cheese and lettuce', price: 8.5, image_url: 'https://picsum.photos/id/1011/900/540', video_url: '', nutrition: 'Proteins: 25g, Carbs: 40g, Fats: 20g', ingredients: 'Beef, Cheese, Lettuce, Tomato, Bun', allergies: 'Gluten, Dairy', prep_time: '10 min', hidden: 0, sort_order: 1 },
    { category_id: 1, name: 'Veggie Burger', description: 'Grilled veggie patty with avocado', price: 7.0, image_url: 'https://picsum.photos/id/1012/900/540', video_url: '', nutrition: 'Proteins: 15g, Carbs: 35g, Fats: 10g', ingredients: 'Veggie patty, Avocado, Bun', allergies: 'Gluten', prep_time: '8 min', hidden: 0, sort_order: 2 },
    { category_id: 1, name: 'Chicken Burger', description: 'Grilled chicken breast with fresh vegetables', price: 9.5, image_url: 'https://picsum.photos/id/1015/900/540', video_url: '', nutrition: 'Proteins: 30g, Carbs: 35g, Fats: 12g', ingredients: 'Chicken, Lettuce, Tomato, Bun', allergies: 'Gluten', prep_time: '12 min', hidden: 0, sort_order: 3 },
    { category_id: 2, name: 'French Fries', description: 'Crispy golden fries', price: 3.0, image_url: 'https://picsum.photos/id/1013/900/540', video_url: '', nutrition: 'Proteins: 3g, Carbs: 40g, Fats: 15g', ingredients: 'Potatoes, Oil, Salt', allergies: 'None', prep_time: '5 min', hidden: 0, sort_order: 1 },
    { category_id: 2, name: 'Onion Rings', description: 'Crispy battered onion rings', price: 4.5, image_url: 'https://picsum.photos/id/1016/900/540', video_url: '', nutrition: 'Proteins: 2g, Carbs: 35g, Fats: 18g', ingredients: 'Onions, Flour, Oil', allergies: 'Gluten', prep_time: '6 min', hidden: 0, sort_order: 2 },
    { category_id: 3, name: 'Cola', description: 'Chilled refreshing drink', price: 2.0, image_url: 'https://picsum.photos/id/1014/900/540', video_url: '', nutrition: 'Proteins: 0g, Carbs: 40g, Fats: 0g', ingredients: 'Water, Sugar, Flavorings', allergies: 'None', prep_time: '1 min', hidden: 0, sort_order: 1 },
    { category_id: 3, name: 'Orange Juice', description: 'Fresh squeezed orange juice', price: 3.5, image_url: 'https://picsum.photos/id/1017/900/540', video_url: '', nutrition: 'Proteins: 1g, Carbs: 35g, Fats: 0g', ingredients: 'Fresh oranges', allergies: 'None', prep_time: '2 min', hidden: 0, sort_order: 2 }
  ];
  
  for (const item of defaultItems) {
    db.prepare(`INSERT INTO items (category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(item.category_id, item.name, item.description, item.price, item.image_url, item.video_url, item.nutrition, item.ingredients, item.allergies, item.prep_time, item.hidden, item.sort_order);
  }
  console.log('Default menu items added!');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
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

// In-memory storage for orders
let orders = [];

// In-memory menu data (can be edited and saved)
let menuData = {
  categories: [
    { key: 'burgers', name: 'Burgers', icon: '🍔' },
    { key: 'sides', name: 'Sides', icon: '🍟' },
    { key: 'drinks', name: 'Drinks', icon: '🥤' }
  ],
  menu: {
    burgers: [
      {
        id: 1,
        price: 8.5,
        image: 'https://picsum.photos/id/1011/900/540',
        video: '',
        name: { en: 'Classic Burger' },
        description: { en: 'Juicy grilled beef patty with cheese and lettuce' },
        nutrition: { en: 'Proteins: 25g, Carbs: 40g, Fats: 20g' },
        ingredients: { en: 'Beef, Cheese, Lettuce, Tomato, Bun' },
        allergies: { en: 'Gluten, Dairy' },
        prepTime: { en: '10 min' }
      },
      {
        id: 2,
        price: 7.0,
        image: 'https://picsum.photos/id/1012/900/540',
        video: '',
        name: { en: 'Veggie Burger' },
        description: { en: 'Grilled veggie patty with avocado' },
        nutrition: { en: 'Proteins: 15g, Carbs: 35g, Fats: 10g' },
        ingredients: { en: 'Veggie patty, Avocado, Bun' },
        allergies: { en: 'Gluten' },
        prepTime: { en: '8 min' }
      },
      {
        id: 3,
        price: 9.5,
        image: 'https://picsum.photos/id/1015/900/540',
        video: '',
        name: { en: 'Chicken Burger' },
        description: { en: 'Grilled chicken breast with fresh vegetables' },
        nutrition: { en: 'Proteins: 30g, Carbs: 35g, Fats: 12g' },
        ingredients: { en: 'Chicken, Lettuce, Tomato, Bun' },
        allergies: { en: 'Gluten' },
        prepTime: { en: '12 min' }
      }
    ],
    sides: [
      {
        id: 4,
        price: 3.0,
        image: 'https://picsum.photos/id/1013/900/540',
        video: '',
        name: { en: 'French Fries' },
        description: { en: 'Crispy golden fries' },
        nutrition: { en: 'Proteins: 3g, Carbs: 40g, Fats: 15g' },
        ingredients: { en: 'Potatoes, Oil, Salt' },
        allergies: { en: 'None' },
        prepTime: { en: '5 min' }
      },
      {
        id: 5,
        price: 4.5,
        image: 'https://picsum.photos/id/1016/900/540',
        video: '',
        name: { en: 'Onion Rings' },
        description: { en: 'Crispy battered onion rings' },
        nutrition: { en: 'Proteins: 2g, Carbs: 35g, Fats: 18g' },
        ingredients: { en: 'Onions, Flour, Oil' },
        allergies: { en: 'Gluten' },
        prepTime: { en: '6 min' }
      }
    ],
    drinks: [
      {
        id: 6,
        price: 2.0,
        image: 'https://picsum.photos/id/1014/900/540',
        video: '',
        name: { en: 'Cola' },
        description: { en: 'Chilled refreshing drink' },
        nutrition: { en: 'Proteins: 0g, Carbs: 40g, Fats: 0g' },
        ingredients: { en: 'Water, Sugar, Flavorings' },
        allergies: { en: 'None' },
        prepTime: { en: '1 min' }
      },
      {
        id: 7,
        price: 3.5,
        image: 'https://picsum.photos/id/1017/900/540',
        video: '',
        name: { en: 'Orange Juice' },
        description: { en: 'Fresh squeezed orange juice' },
        nutrition: { en: 'Proteins: 1g, Carbs: 35g, Fats: 0g' },
        ingredients: { en: 'Fresh oranges' },
        allergies: { en: 'None' },
        prepTime: { en: '2 min' }
      }
    ]
  }
};

// Public API
app.get('/api/menu', (req, res) => {
  res.json(menuData);
});

// Branding/settings for frontend
app.get('/api/settings', (req, res) => {
  // Hardcoded settings to ensure it always works
  res.json({
    brandName: 'AROMA',
    logoUrl: '',
    colors: { primary: '#f97316', secondary: '#ffffff' },
    backgroundUrl: '',
    fontFamily: 'system-ui, sans-serif',
    currency: 'EUR'
  });
});

// Place order
app.post('/api/orders', (req, res) => {
  const { items, orderType, tableToken, tableNumber, paymentMethod } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No items' });
  if (orderType !== 'dine-in' && orderType !== 'takeaway') return res.status(400).json({ error: 'Invalid orderType' });

  // Find items in our dynamic menu data
  let total = 0;
  const orderItems = [];
  
  for (const it of items) {
    // Search through all categories to find the item
    let foundItem = null;
    for (const categoryKey of Object.keys(menuData.menu)) {
      const item = menuData.menu[categoryKey].find(item => item.id === it.id);
      if (item) {
        foundItem = item;
        break;
      }
    }
    
    if (!foundItem) return res.status(400).json({ error: `Invalid item ${it.id}` });
    
    const qty = Math.max(1, Number(it.quantity || 1));
    const price = Number(foundItem.price);
    const subtotal = price * qty;
    total += subtotal;
    orderItems.push({ 
      item_id: it.id, 
      name: foundItem.name.en, 
      price, 
      quantity: qty, 
      subtotal 
    });
  }

  // Generate a simple order ID (in a real app, you'd use a database)
  const orderId = Date.now();
  
  // Store order in memory
  const order = {
    id: orderId,
    order_type: orderType,
    table_token: tableToken || null,
    table_number: tableNumber || null,
    payment_method: paymentMethod || 'cash',
    total: total,
    status: 'received',
    created_at: new Date().toISOString(),
    items: orderItems
  };
  
  // Store in our in-memory orders array
  orders.unshift(order); // Add to beginning of array (newest first)
  
  console.log('New order received:', order);
  console.log('Total orders:', orders.length);

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

// Simple admin login page
app.get('/admin/login', (req, res) => {
  res.send(`
    <html>
      <head><title>Admin Login</title></head>
      <body>
        <h1>Admin Login</h1>
        <p>Use HTTP Basic Authentication:</p>
        <p>Username: ${ADMIN_USER}</p>
        <p>Password: ${ADMIN_PASS}</p>
        <p><a href="/admin">Go to Admin Panel</a></p>
      </body>
    </html>
  `);
});

app.get('/admin', adminAuth, (req, res) => {
  // Calculate stats from our in-memory orders
  const pending = orders.filter(order => order.status === 'received').length;
  const confirmed = orders.filter(order => order.status === 'confirmed').length;
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  res.render('admin_dashboard', { pending, confirmed, totalSales });
});

// Items CRUD (very minimal)
app.get('/admin/items', adminAuth, (req, res) => {
  // Convert menuData to admin format
  const cats = menuData.categories.map((cat, index) => ({
    id: index + 1,
    name: cat.name,
    key: cat.key,
    icon: cat.icon,
    sort_order: index + 1
  }));
  
  // Flatten all items from all categories
  const items = [];
  Object.keys(menuData.menu).forEach(categoryKey => {
    const category = menuData.categories.find(c => c.key === categoryKey);
    menuData.menu[categoryKey].forEach(item => {
      items.push({
        id: item.id,
        category_id: category ? menuData.categories.indexOf(category) + 1 : 1,
        name: item.name.en,
        description: item.description.en,
        price: item.price,
        image_url: item.image,
        category_name: category ? category.name : 'Unknown'
      });
    });
  });
  
  res.render('items', { cats, items });
});

app.post('/admin/items/create', adminAuth, (req, res) => {
  const { category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order } = req.body;
  console.log('Creating item:', { category_id, name, price });
  
  try {
    // Find the category key
    const category = menuData.categories[category_id - 1];
    if (!category) {
      return res.redirect('/admin/items?error=Invalid category');
    }
    
    // Create new item
    const newItem = {
      id: Date.now(), // Simple ID generation
      price: parseFloat(price),
      image: image_url || 'https://picsum.photos/900/540',
      video: video_url || '',
      name: { en: name },
      description: { en: description || '' },
      nutrition: { en: nutrition || '' },
      ingredients: { en: ingredients || '' },
      allergies: { en: allergies || '' },
      prepTime: { en: prep_time || '' }
    };
    
    // Add to menuData
    if (!menuData.menu[category.key]) {
      menuData.menu[category.key] = [];
    }
    menuData.menu[category.key].push(newItem);
    
    console.log('Item created successfully:', newItem);
    res.redirect('/admin/items?success=created');
  } catch (error) {
    console.error('Error creating item:', error);
    res.redirect('/admin/items?error=' + encodeURIComponent(error.message));
  }
});

app.post('/admin/items/:id/update', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const { category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order } = req.body;
  console.log('Updating item:', { id, category_id, name, price });
  
  try {
    // Find the category key
    const category = menuData.categories[category_id - 1];
    if (!category) {
      return res.redirect('/admin/items?error=Invalid category');
    }
    
    // Find and update the item
    let itemFound = false;
    Object.keys(menuData.menu).forEach(categoryKey => {
      const items = menuData.menu[categoryKey];
      const itemIndex = items.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        // Update the item
        items[itemIndex] = {
          ...items[itemIndex],
          price: parseFloat(price),
          image: image_url || items[itemIndex].image,
          video: video_url || items[itemIndex].video,
          name: { en: name },
          description: { en: description || '' },
          nutrition: { en: nutrition || '' },
          ingredients: { en: ingredients || '' },
          allergies: { en: allergies || '' },
          prepTime: { en: prep_time || '' }
        };
        itemFound = true;
      }
    });
    
    if (!itemFound) {
      return res.redirect('/admin/items?error=Item not found');
    }
    
    console.log('Item updated successfully');
    res.redirect('/admin/items?success=updated');
  } catch (error) {
    console.error('Error updating item:', error);
    res.redirect('/admin/items?error=' + encodeURIComponent(error.message));
  }
});

app.post('/admin/items/:id/delete', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  console.log('Deleting item:', { id });
  
  try {
    // Find and delete the item
    let itemFound = false;
    Object.keys(menuData.menu).forEach(categoryKey => {
      const items = menuData.menu[categoryKey];
      const itemIndex = items.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        items.splice(itemIndex, 1);
        itemFound = true;
      }
    });
    
    if (!itemFound) {
      return res.redirect('/admin/items?error=Item not found');
    }
    
    console.log('Item deleted successfully');
    res.redirect('/admin/items?success=deleted');
  } catch (error) {
    console.error('Error deleting item:', error);
    res.redirect('/admin/items?error=' + encodeURIComponent(error.message));
  }
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
  // Use our in-memory orders array
  const sortedOrders = orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.render('orders', { orders: sortedOrders });
});
app.post('/admin/orders/:id/status', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  
  // Find and update order in our in-memory array
  const orderIndex = orders.findIndex(order => order.id === id);
  if (orderIndex !== -1) {
    orders[orderIndex].status = status;
    console.log(`Order ${id} status updated to: ${status}`);
  }
  
  res.redirect('/admin/orders');
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Debug endpoint to test database operations
app.get('/api/debug', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    const items = db.prepare('SELECT * FROM items ORDER BY id').all();
    res.json({ 
      success: true, 
      categories: categories.length, 
      items: items.length,
      sampleItem: items[0] || null
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Simple API to add menu items (alternative to admin panel)
app.post('/api/add-item', (req, res) => {
  try {
    const { category_id, name, description, price, image_url } = req.body;
    console.log('Adding item via API:', { category_id, name, price });
    
    db.prepare(`INSERT INTO items (category_id, name, description, price, image_url, video_url, nutrition, ingredients, allergies, prep_time, hidden, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(Number(category_id), name, description || '', Number(price), image_url || '', '', '', '', '', '', 0, 0);
    
    res.json({ success: true, message: 'Item added successfully' });
  } catch (error) {
    console.error('Error adding item:', error);
    res.json({ success: false, error: error.message });
  }
});

// Force reset database (for development)
app.get('/api/reset-db', (req, res) => {
  try {
    console.log('Resetting database...');
    reset();
    res.json({ success: true, message: 'Database reset successfully' });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.json({ success: false, error: error.message });
  }
});

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


