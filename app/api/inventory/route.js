import { getDB } from '@/lib/db';

// GET /api/inventory — all products with current stock
export async function GET() {
  const db = getDB();
  const rows = db.prepare(`
    SELECT p.id, p.sku, p.name, p.category, p.color, p.size, p.mrp,
           COALESCE(i.quantity, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ORDER BY p.category, p.name, p.size
  `).all();
  return Response.json({ inventory: rows });
}

// PUT /api/inventory — update one or more products' stock
// Body: { updates: [{product_id, quantity}] }  OR  { product_id, quantity, mode: 'add'|'set' }
export async function PUT(req) {
  const db   = getDB();
  const body = await req.json();

  const updates = body.updates ?? [body];

  const doUpdate = db.transaction(() => {
    for (const u of updates) {
      const { product_id, quantity, mode = 'set' } = u;
      const qty = parseInt(quantity);

      if (mode === 'add') {
        db.prepare(`
          UPDATE inventory SET quantity = MAX(0, quantity + ?) WHERE product_id = ?
        `).run(qty, product_id);
      } else {
        db.prepare(`
          UPDATE inventory SET quantity = MAX(0, ?) WHERE product_id = ?
        `).run(qty, product_id);
      }
    }
  });

  doUpdate();
  return Response.json({ ok: true });
}
