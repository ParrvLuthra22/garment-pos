import { getDB } from '@/lib/db';

// GET /api/products/:id
export async function GET(req, { params }) {
  const db = getDB();
  const product = db.prepare(`
    SELECT p.*, COALESCE(i.quantity, 0) AS stock
    FROM products p LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.id = ?
  `).get(params.id);

  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ product });
}

// PUT /api/products/:id — update fields
export async function PUT(req, { params }) {
  const db = getDB();
  const body = await req.json();
  const { name, category, color, size, mrp, gst_rate } = body;

  db.prepare(`
    UPDATE products
    SET name=?, category=?, color=?, size=?, mrp=?, gst_rate=?
    WHERE id=?
  `).run(
    name, category || '', color || '', size || '',
    parseFloat(mrp), parseFloat(gst_rate ?? 12),
    params.id
  );

  return Response.json({ ok: true });
}

// DELETE /api/products/:id
export async function DELETE(req, { params }) {
  const db = getDB();
  db.prepare('DELETE FROM products WHERE id = ?').run(params.id);
  return Response.json({ ok: true });
}
