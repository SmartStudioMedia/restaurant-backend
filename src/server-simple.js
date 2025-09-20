require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth');

const PORT = process.env.PORT || 4000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// In-memory data storage
let menuData = {
  burgers: [
    {
      id: 1,
      name: 'Classic Burger',
      description: 'Juicy grilled beef patty with cheese and fresh vegetables',
      price: 8.50,
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&q=80',
      ingredients: 'Beef patty, Cheddar cheese, Lettuce, Tomato, Onion, Special sauce, Brioche bun',
      nutrition: 'Calories: 650, Protein: 35g, Carbs: 45g, Fat: 28g',
      allergies: 'Gluten, Dairy, Eggs',
      prepTime: '12-15 min'
    },
    {
      id: 2,
      name: 'Veggie Delight',
      description: 'Plant-based patty with avocado and fresh sprouts',
      price: 7.50,
      image: 'https://images.unsplash.com/photo-1525059696034-4967a729002e?w=400&h=300&fit=crop&q=80',
      ingredients: 'Veggie patty, Avocado, Sprouts, Tomato, Red onion, Vegan mayo, Whole grain bun',
      nutrition: 'Calories: 520, Protein: 22g, Carbs: 55g, Fat: 18g',
      allergies: 'Gluten',
      prepTime: '10-12 min'
    },
    {
      id: 3,
      name: 'Chicken Supreme',
      description: 'Grilled chicken breast with herbs and premium toppings',
      price: 9.00,
      image: 'https://images.unsplash.com/photo-1606755962773-d324e9b9a5e6?w=400&h=300&fit=crop&q=80',
      ingredients: 'Chicken breast, Bacon, Lettuce, Tomato, Red onion, Herbs, Brioche bun',
      nutrition: 'Calories: 580, Protein: 42g, Carbs: 38g, Fat: 22g',
      allergies: 'Gluten',
      prepTime: '15-18 min'
    }
  ],
  sides: [
    {
      id: 4,
      name: 'Crispy Fries',
      description: 'Golden crispy fries with sea salt and herbs',
      price: 3.50,
      image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&q=80',
      ingredients: 'Potatoes, Sea salt, Herbs, Vegetable oil',
      nutrition: 'Calories: 320, Protein: 4g, Carbs: 42g, Fat: 14g',
      allergies: 'None',
      prepTime: '8-10 min'
    },
    {
      id: 5,
      name: 'Onion Rings',
      description: 'Beer-battered onion rings with dipping sauce',
      price: 4.50,
      image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&h=300&fit=crop&q=80',
      ingredients: 'Onions, Beer batter, Flour, Spices, Dipping sauce',
      nutrition: 'Calories: 280, Protein: 6g, Carbs: 35g, Fat: 12g',
      allergies: 'Gluten',
      prepTime: '6-8 min'
    }
  ],
  drinks: [
    {
      id: 6,
      name: 'Fresh Cola',
      description: 'Classic cola with a refreshing twist',
      price: 2.50,
      image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400&h=300&fit=crop&q=80',
      ingredients: 'Carbonated water, Natural flavors, Caffeine',
      nutrition: 'Calories: 140, Protein: 0g, Carbs: 35g, Fat: 0g',
      allergies: 'None',
      prepTime: '1 min'
    },
    {
      id: 7,
      name: 'Orange Fresh',
      description: 'Freshly squeezed orange juice',
      price: 3.00,
      image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&h=300&fit=crop&q=80',
      ingredients: 'Fresh oranges',
      nutrition: 'Calories: 110, Protein: 2g, Carbs: 26g, Fat: 0g',
      allergies: 'None',
      prepTime: '2 min'
    }
  ]
};

let orders = [];
let orderIdCounter = 1;

// API Routes
app.get('/api/menu', (req, res) => {
  res.json({
    categories: [
      { id: 1, key: 'burgers', name: 'Burgers', icon: '🍔' },
      { id: 2, key: 'sides', name: 'Sides', icon: '🍟' },
      { id: 3, key: 'drinks', name: 'Drinks', icon: '🥤' }
    ],
    menu: menuData
  });
});

app.get('/api/settings', (req, res) => {
  res.json({
    brandName: 'AROMA',
    primaryColor: '#f97316',
    currency: 'EUR'
  });
});

app.post('/api/orders', (req, res) => {
  try {
    const { items, orderType, paymentMethod } = req.body;
    
    // Create order
    const order = {
      id: orderIdCounter++,
      items: items.map(item => {
        // Find the item in menuData
        let foundItem = null;
        for (const category of Object.values(menuData)) {
          foundItem = category.find(i => i.id === item.id);
          if (foundItem) break;
        }
        
        return {
          ...foundItem,
          qty: item.qty
        };
      }),
      orderType: orderType || 'dine-in',
      paymentMethod: paymentMethod || 'cash',
      status: 'pending',
      total: items.reduce((total, item) => {
        let foundItem = null;
        for (const category of Object.values(menuData)) {
          foundItem = category.find(i => i.id === item.id);
          if (foundItem) break;
        }
        return total + (foundItem ? foundItem.price * item.qty : 0);
      }, 0),
      createdAt: new Date().toISOString()
    };
    
    orders.push(order);
    
    res.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

// Admin Routes
app.use('/admin', basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASS },
  challenge: true,
  realm: 'Admin Area'
}));

app.get('/admin', (req, res) => {
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  
  res.render('admin_dashboard', {
    pendingOrders,
    confirmedOrders,
    totalSales,
    orders: orders.slice(0, 10) // Show last 10 orders
  });
});

app.get('/admin/orders', (req, res) => {
  res.render('orders', { orders });
});

app.post('/admin/orders/:id/status', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  
  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.status = status;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Frontend: http://localhost:${PORT}`);
});
