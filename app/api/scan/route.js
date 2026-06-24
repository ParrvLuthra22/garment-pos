import { getDB } from '@/lib/db';

// POST /api/scan
// Called by the phone scanner every time a barcode is read.
// Stores the scan in pending_scans; the POS screen polls /api/scan/pending
// to consume these and add the item to the bill.
export async function POST(req) {
  const db = getDB();
  const { barcode } = await req.json();

  if (!barcode) return Response.json({ error: 'barcode required' }, { status: 400 });

  // Look up the product by barcode
  const product = db.prepare(`
    SELECT p.*, COALESCE(i.quantity, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.barcode = ?
  `).get(barcode.trim());

  if (!product) {
    // Still store the scan so the POS knows something was scanned (even if unknown)
    db.prepare(`INSERT INTO pending_scans (barcode) VALUES (?)`).run(barcode);
    return Response.json({ found: false, barcode });
  }

  // Store scan linked to product
  db.prepare(`INSERT INTO pending_scans (barcode) VALUES (?)`).run(barcode);

  return Response.json({ found: true, product });
}
