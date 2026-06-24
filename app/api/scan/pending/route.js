import { getDB } from '@/lib/db';

// GET /api/scan/pending
// POS screen polls this every 500ms to check for new scans from the phone.
// Returns all unconsumed scans with their product data, then marks them consumed.
export async function GET() {
  const db = getDB();

  // Fetch all unconsumed scans
  const scans = db.prepare(`
    SELECT ps.id, ps.barcode, ps.scanned_at,
           p.id         AS product_id,
           p.sku, p.name, p.category, p.color, p.size,
           p.mrp, p.gst_rate, p.barcode AS product_barcode,
           COALESCE(i.quantity, 0) AS stock
    FROM pending_scans ps
    LEFT JOIN products p   ON p.barcode = ps.barcode
    LEFT JOIN inventory i  ON i.product_id = p.id
    WHERE ps.consumed = 0
    ORDER BY ps.id ASC
  `).all();

  if (scans.length === 0) return Response.json({ scans: [] });

  // Mark them all consumed in one go
  const ids = scans.map(s => s.id);
  db.prepare(
    `UPDATE pending_scans SET consumed = 1 WHERE id IN (${ids.map(() => '?').join(',')})`
  ).run(...ids);

  // Shape the response — each scan includes the full product (if found)
  const result = scans.map(row => ({
    scanId: row.id,
    barcode: row.barcode,
    scannedAt: row.scanned_at,
    product: row.product_id ? {
      id:       row.product_id,
      sku:      row.sku,
      name:     row.name,
      category: row.category,
      color:    row.color,
      size:     row.size,
      mrp:      row.mrp,
      gst_rate: row.gst_rate,
      barcode:  row.product_barcode,
      stock:    row.stock,
    } : null,
  }));

  return Response.json({ scans: result });
}

// DELETE /api/scan/pending — clear all pending scans (e.g. new bill started)
export async function DELETE() {
  const db = getDB();
  db.prepare(`UPDATE pending_scans SET consumed = 1 WHERE consumed = 0`).run();
  return Response.json({ ok: true });
}
