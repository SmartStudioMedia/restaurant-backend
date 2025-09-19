const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data.json');

// Initialize data structure
let data = {
  settings: {
    id: 1,
    brand_name: 'AROMA',
    logo_url: '',
    primary_color: '#f97316',
    secondary_color: '#ffffff',
    background_url: '',
    font_family: 'system-ui, sans-serif',
    currency: 'EUR'
  },
  categories: [],
  items: [],
  tables: [],
  orders: [],
  order_items: []
};

// Load data from file or create default
function loadData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const fileContent = fs.readFileSync(dataFilePath, 'utf8');
      data = JSON.parse(fileContent);
    } else {
      saveData();
    }
  } catch (error) {
    console.error('Error loading data:', error);
    saveData();
  }
}

// Save data to file
function saveData() {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Database operations
const db = {
  prepare: (query) => {
    return {
      get: (params) => {
        // Simple query parser for basic operations
        if (query.includes('SELECT * FROM settings WHERE id = 1')) {
          return data.settings;
        }
        if (query.includes('SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order ASC')) {
          return data.categories.filter(c => !c.hidden).sort((a, b) => a.sort_order - b.sort_order);
        }
        if (query.includes('SELECT * FROM categories ORDER BY sort_order')) {
          return data.categories.sort((a, b) => a.sort_order - b.sort_order);
        }
        if (query.includes('SELECT * FROM items WHERE category_id = ? AND hidden = 0 ORDER BY sort_order ASC, id ASC')) {
          const categoryId = params;
          return data.items.filter(i => i.category_id === categoryId && !i.hidden).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        }
        if (query.includes('SELECT * FROM tables ORDER BY id')) {
          return data.tables.sort((a, b) => a.id - b.id);
        }
        if (query.includes('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200')) {
          return data.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
        }
        if (query.includes('SELECT * FROM order_items WHERE order_id = ?')) {
          const orderId = params;
          return data.order_items.filter(oi => oi.order_id === orderId);
        }
        if (query.includes('SELECT COUNT(1) as c FROM orders WHERE status = ?')) {
          const status = params;
          return { c: data.orders.filter(o => o.status === status).length };
        }
        if (query.includes('SELECT IFNULL(SUM(total),0) as s FROM orders WHERE status IN')) {
          return { s: data.orders.filter(o => ['confirmed', 'completed'].includes(o.status)).reduce((sum, o) => sum + o.total, 0) };
        }
        if (query.includes('SELECT i.*, c.name as category_name FROM items i JOIN categories c ON c.id = i.category_id ORDER BY c.sort_order, i.sort_order')) {
          return data.items.map(item => {
            const category = data.categories.find(c => c.id === item.category_id);
            return { ...item, category_name: category ? category.name : 'Unknown' };
          }).sort((a, b) => {
            const catA = data.categories.find(c => c.id === a.category_id);
            const catB = data.categories.find(c => c.id === b.category_id);
            return (catA ? catA.sort_order : 0) - (catB ? catB.sort_order : 0) || a.sort_order - b.sort_order;
          });
        }
        return null;
      },
      all: (params) => {
        // For queries that return multiple rows
        if (query.includes('SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order ASC')) {
          return data.categories.filter(c => !c.hidden).sort((a, b) => a.sort_order - b.sort_order);
        }
        if (query.includes('SELECT * FROM categories ORDER BY sort_order')) {
          return data.categories.sort((a, b) => a.sort_order - b.sort_order);
        }
        if (query.includes('SELECT * FROM items WHERE category_id = ? AND hidden = 0 ORDER BY sort_order ASC, id ASC')) {
          const categoryId = params;
          return data.items.filter(i => i.category_id === categoryId && !i.hidden).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        }
        if (query.includes('SELECT * FROM items ORDER BY id')) {
          return data.items.sort((a, b) => a.id - b.id);
        }
        if (query.includes('SELECT * FROM tables ORDER BY id')) {
          return data.tables.sort((a, b) => a.id - b.id);
        }
        if (query.includes('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200')) {
          return data.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
        }
        if (query.includes('SELECT * FROM order_items WHERE order_id = ?')) {
          const orderId = params;
          return data.order_items.filter(oi => oi.order_id === orderId);
        }
        if (query.includes('SELECT i.*, c.name as category_name FROM items i JOIN categories c ON c.id = i.category_id ORDER BY c.sort_order, i.sort_order')) {
          return data.items.map(item => {
            const category = data.categories.find(c => c.id === item.category_id);
            return { ...item, category_name: category ? category.name : 'Unknown' };
          }).sort((a, b) => {
            const catA = data.categories.find(c => c.id === a.category_id);
            const catB = data.categories.find(c => c.id === b.category_id);
            return (catA ? catA.sort_order : 0) - (catB ? catB.sort_order : 0) || a.sort_order - b.sort_order;
          });
        }
        return [];
      },
      run: (params) => {
        // For INSERT, UPDATE, DELETE operations
        if (query.includes('INSERT INTO items')) {
          const newId = Math.max(0, ...data.items.map(i => i.id)) + 1;
          const item = {
            id: newId,
            category_id: params[0],
            name: params[1],
            description: params[2] || '',
            price: params[3],
            image_url: params[4] || '',
            video_url: params[5] || '',
            nutrition: params[6] || '',
            ingredients: params[7] || '',
            allergies: params[8] || '',
            prep_time: params[9] || '',
            hidden: params[10] ? 1 : 0,
            sort_order: params[11] || 0
          };
          data.items.push(item);
          saveData();
          return { lastInsertRowid: newId };
        }
        if (query.includes('UPDATE items SET')) {
          const id = params[params.length - 1]; // Last parameter is the ID
          const itemIndex = data.items.findIndex(i => i.id === id);
          if (itemIndex !== -1) {
            data.items[itemIndex] = {
              ...data.items[itemIndex],
              category_id: params[0],
              name: params[1],
              description: params[2] || '',
              price: params[3],
              image_url: params[4] || '',
              video_url: params[5] || '',
              nutrition: params[6] || '',
              ingredients: params[7] || '',
              allergies: params[8] || '',
              prep_time: params[9] || '',
              hidden: params[10] ? 1 : 0,
              sort_order: params[11] || 0
            };
            saveData();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (query.includes('DELETE FROM items WHERE id = ?')) {
          const id = params;
          const initialLength = data.items.length;
          data.items = data.items.filter(i => i.id !== id);
          saveData();
          return { changes: initialLength - data.items.length };
        }
        if (query.includes('INSERT INTO orders')) {
          const newId = Math.max(0, ...data.orders.map(o => o.id)) + 1;
          const order = {
            id: newId,
            table_number: params[0],
            table_token: params[1],
            order_type: params[2],
            total: params[3],
            payment_method: params[4],
            payment_status: params[5],
            status: 'received',
            created_at: new Date().toISOString()
          };
          data.orders.push(order);
          saveData();
          return { lastInsertRowid: newId };
        }
        if (query.includes('INSERT INTO order_items')) {
          const newId = Math.max(0, ...data.order_items.map(oi => oi.id)) + 1;
          const orderItem = {
            id: newId,
            order_id: params[0],
            item_id: params[1],
            name: params[2],
            price: params[3],
            quantity: params[4]
          };
          data.order_items.push(orderItem);
          saveData();
          return { lastInsertRowid: newId };
        }
        if (query.includes('UPDATE orders SET status = ? WHERE id = ?')) {
          const status = params[0];
          const id = params[1];
          const orderIndex = data.orders.findIndex(o => o.id === id);
          if (orderIndex !== -1) {
            data.orders[orderIndex].status = status;
            saveData();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (query.includes('UPDATE settings SET')) {
          data.settings = {
            ...data.settings,
            brand_name: params[0],
            logo_url: params[1] || '',
            primary_color: params[2],
            secondary_color: params[3],
            background_url: params[4] || '',
            font_family: params[5],
            currency: params[6]
          };
          saveData();
          return { changes: 1 };
        }
        if (query.includes('INSERT INTO tables')) {
          const newId = Math.max(0, ...data.tables.map(t => t.id)) + 1;
          const table = {
            id: newId,
            number: params[0],
            token: params[1]
          };
          data.tables.push(table);
          saveData();
          return { lastInsertRowid: newId };
        }
        return { changes: 0 };
      }
    };
  },
  transaction: (fn) => {
    return fn;
  }
};

function migrate() {
  loadData();
  // Migration logic is handled in loadData/seed
}

function seed() {
  loadData();
  
  // Always seed with default data (for development)
  if (data.categories.length === 0 || data.items.length < 7) {
    const categories = [
      { id: 1, key: 'burgers', name: 'Burgers', icon: '🍔', sort_order: 1, hidden: 0 },
      { id: 2, key: 'sides', name: 'Sides', icon: '🍟', sort_order: 2, hidden: 0 },
      { id: 3, key: 'drinks', name: 'Drinks', icon: '🥤', sort_order: 3, hidden: 0 }
    ];
    
    const items = [
      { id: 1, category_id: 1, name: 'Classic Burger', description: 'Juicy grilled beef patty with cheese and lettuce', price: 8.5, image_url: 'https://picsum.photos/id/1011/900/540', video_url: '', nutrition: 'Proteins: 25g, Carbs: 40g, Fats: 20g', ingredients: 'Beef, Cheese, Lettuce, Tomato, Bun', allergies: 'Gluten, Dairy', prep_time: '10 min', hidden: 0, sort_order: 1 },
      { id: 2, category_id: 1, name: 'Veggie Burger', description: 'Grilled veggie patty with avocado', price: 7.0, image_url: 'https://picsum.photos/id/1012/900/540', video_url: '', nutrition: 'Proteins: 15g, Carbs: 35g, Fats: 10g', ingredients: 'Veggie patty, Avocado, Bun', allergies: 'Gluten', prep_time: '8 min', hidden: 0, sort_order: 2 },
      { id: 3, category_id: 1, name: 'Chicken Burger', description: 'Grilled chicken breast with fresh vegetables', price: 9.5, image_url: 'https://picsum.photos/id/1015/900/540', video_url: '', nutrition: 'Proteins: 30g, Carbs: 35g, Fats: 12g', ingredients: 'Chicken, Lettuce, Tomato, Bun', allergies: 'Gluten', prep_time: '12 min', hidden: 0, sort_order: 3 },
      { id: 4, category_id: 2, name: 'French Fries', description: 'Crispy golden fries', price: 3.0, image_url: 'https://picsum.photos/id/1013/900/540', video_url: '', nutrition: 'Proteins: 3g, Carbs: 40g, Fats: 15g', ingredients: 'Potatoes, Oil, Salt', allergies: 'None', prep_time: '5 min', hidden: 0, sort_order: 1 },
      { id: 5, category_id: 2, name: 'Onion Rings', description: 'Crispy battered onion rings', price: 4.5, image_url: 'https://picsum.photos/id/1016/900/540', video_url: '', nutrition: 'Proteins: 2g, Carbs: 35g, Fats: 18g', ingredients: 'Onions, Flour, Oil', allergies: 'Gluten', prep_time: '6 min', hidden: 0, sort_order: 2 },
      { id: 6, category_id: 3, name: 'Cola', description: 'Chilled refreshing drink', price: 2.0, image_url: 'https://picsum.photos/id/1014/900/540', video_url: '', nutrition: 'Proteins: 0g, Carbs: 40g, Fats: 0g', ingredients: 'Water, Sugar, Flavorings', allergies: 'None', prep_time: '1 min', hidden: 0, sort_order: 1 },
      { id: 7, category_id: 3, name: 'Orange Juice', description: 'Fresh squeezed orange juice', price: 3.5, image_url: 'https://picsum.photos/id/1017/900/540', video_url: '', nutrition: 'Proteins: 1g, Carbs: 35g, Fats: 0g', ingredients: 'Fresh oranges', allergies: 'None', prep_time: '2 min', hidden: 0, sort_order: 2 }
    ];
    
    const tables = [];
    for (let i = 1; i <= 10; i++) {
      tables.push({
        id: i,
        number: String(i),
        token: `t${i}-${Math.random().toString(36).slice(2, 10)}`
      });
    }
    
    data.categories = categories;
    data.items = items;
    data.tables = tables;
    saveData();
  }
}

function reset() {
  data = {
    settings: {
      id: 1,
      brand_name: 'AROMA',
      logo_url: '',
      primary_color: '#f97316',
      secondary_color: '#ffffff',
      background_url: '',
      font_family: 'system-ui, sans-serif',
      currency: 'EUR'
    },
    categories: [],
    items: [],
    tables: [],
    orders: [],
    order_items: []
  };
  saveData();
  seed();
}

// CLI usage: node src/db-fixed.js --reset
if (require.main === module) {
  const shouldReset = process.argv.includes('--reset');
  if (shouldReset) {
    reset();
    console.log('Database reset and seeded.');
  } else {
    migrate();
    seed();
    console.log('Database migrated and seeded if needed.');
  }
}

module.exports = {
  db,
  migrate,
  seed,
  reset,
};
