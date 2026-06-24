import { getDB } from '@/lib/db';

// GET /api/products — list all products with stock
export async function GET() {
  const db = getDB();
  const rows = db.prepare(`
    SELECT p.*, COALESCE(i.quantity, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ORDER BY p.category, p.name, p.size
  `).all();
  return Response.json({ products: rows });
}

// POST /api/products — create a new product + inventory row
export async function POST(req) {
  const db = getDB();
  const body = await req.json();
  const { name, category, color, size, mrp, gst_rate, initial_stock = 0 } = body;

  if (!name || !mrp) {
    return Response.json({ error: 'name and mrp are required' }, { status: 400 });
  }

  // Build SKU from parts: KURTA-WHITE-M
  const parts = [category, color, size].map(s => (s || '').toUpperCase().trim()).filter(Boolean);
  const baseSku = (parts.length ? parts.join('-') : name.toUpperCase().replace(/\s+/g, '-'));

  // Ensure SKU is unique by appending a counter if needed
  let sku = baseSku;
  let counter = 2;
  while (db.prepare('SELECT 1 FROM products WHERE sku = ?').get(sku)) {
    sku = `${baseSku}-${counter++}`;
  }

  // Barcode = SKU (Code128 can encode any ASCII string)
  const barcode = sku;

  const insert = db.prepare(`
    INSERT INTO products (sku, name, category, color, size, mrp, gst_rate, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    sku, name.trim(),
    (category || '').trim(), (color || '').trim(), (size || '').trim(),
    parseFloat(mrp), parseFloat(gst_rate ?? 12),
    barcode
  );

  const productId = result.lastInsertRowid;

  // Create inventory row
  db.prepare(`INSERT INTO inventory (product_id, quantity) VALUES (?, ?)`).run(
    productId, parseInt(initial_stock)
  );

  const product = db.prepare(`
    SELECT p.*, COALESCE(i.quantity, 0) AS stock
    FROM products p LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.id = ?
  `).get(productId);

  return Response.json({ product }, { status: 201 });
}
