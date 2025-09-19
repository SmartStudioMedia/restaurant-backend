const Database = require('better-sqlite3');
const path = require('path');

const dbFilePath = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbFilePath);

function migrate() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      brand_name TEXT NOT NULL DEFAULT 'AROMA',
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#f97316',
      secondary_color TEXT NOT NULL DEFAULT '#ffffff',
      background_url TEXT,
      font_family TEXT NOT NULL DEFAULT 'system-ui, sans-serif',
      currency TEXT NOT NULL DEFAULT 'EUR'
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🍔',
      sort_order INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      video_url TEXT,
      nutrition TEXT,
      ingredients TEXT,
      allergies TEXT,
      prep_time TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT,
      table_token TEXT,
      order_type TEXT NOT NULL CHECK (order_type IN ('dine-in','takeaway')),
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','confirmed','completed','cancelled')),
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      payment_status TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL
    );
  `);
}

function seed() {
  const hasCats = db.prepare('SELECT COUNT(1) as c FROM categories').get().c;
  if (hasCats > 0) return;

  const insertCat = db.prepare('INSERT INTO categories (key, name, icon, sort_order) VALUES (?, ?, ?, ?)');
  const insertItem = db.prepare(`INSERT INTO items (category_id, name, description, price, image_url, nutrition, ingredients, allergies, prep_time, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)`);

  const cats = [
    { key: 'burgers', name: 'Burgers', icon: '🍔', sort: 1 },
    { key: 'sides', name: 'Sides', icon: '🍟', sort: 2 },
    { key: 'drinks', name: 'Drinks', icon: '🥤', sort: 3 }
  ];

  const tx = db.transaction(() => {
    for (const c of cats) insertCat.run(c.key, c.name, c.icon, c.sort);

    const burgersId = db.prepare('SELECT id FROM categories WHERE key=?').get('burgers').id;
    const sidesId = db.prepare('SELECT id FROM categories WHERE key=?').get('sides').id;
    const drinksId = db.prepare('SELECT id FROM categories WHERE key=?').get('drinks').id;

    insertItem.run(burgersId, 'Classic Burger', 'Juicy grilled beef patty with cheese and lettuce', 8.5, 'https://picsum.photos/id/1011/900/540', 'Proteins: 25g, Carbs: 40g, Fats: 20g', 'Beef, Cheese, Lettuce, Tomato, Bun', 'Gluten, Dairy', '10 min', 1);
    insertItem.run(burgersId, 'Veggie Burger', 'Grilled veggie patty with avocado', 7.0, 'https://picsum.photos/id/1012/900/540', 'Proteins: 15g, Carbs: 35g, Fats: 10g', 'Veggie patty, Avocado, Bun', 'Gluten', '8 min', 2);
    insertItem.run(sidesId, 'French Fries', 'Crispy golden fries', 3.0, 'https://picsum.photos/id/1013/900/540', 'Proteins: 3g, Carbs: 40g, Fats: 15g', 'Potatoes, Oil, Salt', 'None', '5 min', 1);
    insertItem.run(drinksId, 'Cola', 'Chilled refreshing drink', 2.0, 'https://picsum.photos/id/1014/900/540', 'Proteins: 0g, Carbs: 40g, Fats: 0g', 'Water, Sugar, Flavorings', 'None', '1 min', 1);

    // Default tables with tokens
    const insertTable = db.prepare('INSERT INTO tables (number, token) VALUES (?, ?)');
    for (let i = 1; i <= 10; i++) {
      insertTable.run(String(i), `t${i}-${Math.random().toString(36).slice(2, 10)}`);
    }
  });
  tx();
}

function reset() {
  db.exec(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS items;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS tables;
    DROP TABLE IF EXISTS settings;
  `);
  migrate();
  seed();
}

// CLI usage: node src/db.js --reset
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



