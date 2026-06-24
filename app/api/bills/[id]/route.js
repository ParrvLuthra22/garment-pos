import { getDB } from '@/lib/db';

export async function GET(req, { params }) {
  const db = getDB();

  const bill = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(params.id);
  if (!bill) return Response.json({ error: 'Not found' }, { status: 404 });

  const items = db.prepare(`
    SELECT ti.*, p.name, p.sku, p.category, p.size, p.color
    FROM transaction_items ti
    JOIN products p ON p.id = ti.product_id
    WHERE ti.transaction_id = ?
  `).all(params.id);

  return Response.json({ bill, items });
}
