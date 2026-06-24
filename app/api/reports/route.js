import { getDB } from '@/lib/db';

// GET /api/reports?range=today|week|month|all
export async function GET(req) {
  const db = getDB();
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') ?? 'today';

  const filters = {
    today: `DATE(created_at) = DATE('now','localtime')`,
    week:  `DATE(created_at) >= DATE('now','localtime','-7 days')`,
    month: `DATE(created_at) >= DATE('now','localtime','-30 days')`,
    all:   `1=1`,
  };
  const where = filters[range] ?? filters.today;

  const summary = db.prepare(`
    SELECT
      COUNT(*)          AS total_bills,
      COALESCE(SUM(subtotal),   0) AS total_subtotal,
      COALESCE(SUM(gst_amount), 0) AS total_gst,
      COALESCE(SUM(total),      0) AS total_revenue,
      COALESCE(SUM(discount),   0) AS total_discount
    FROM transactions WHERE ${where}
  `).get();

  const paymentBreakdown = db.prepare(`
    SELECT payment_mode, COUNT(*) AS n, SUM(total) AS revenue
    FROM transactions WHERE ${where}
    GROUP BY payment_mode
  `).all();

  const topProducts = db.prepare(`
    SELECT p.name, p.sku, p.category, p.size, p.color,
           SUM(ti.quantity)              AS units_sold,
           SUM(ti.quantity * ti.price_at_sale) AS revenue
    FROM transaction_items ti
    JOIN products p       ON p.id = ti.product_id
    JOIN transactions t   ON t.id = ti.transaction_id
    WHERE ${where.replace(/created_at/g, 't.created_at')}
    GROUP BY p.id
    ORDER BY units_sold DESC
    LIMIT 10
  `).all();

  const recentBills = db.prepare(`
    SELECT id, bill_no, customer_name, total, payment_mode, created_at
    FROM transactions WHERE ${where}
    ORDER BY id DESC LIMIT 20
  `).all();

  const lowStock = db.prepare(`
    SELECT p.id, p.sku, p.name, p.category, p.size, p.color,
           COALESCE(i.quantity, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE COALESCE(i.quantity, 0) <= 3
    ORDER BY stock ASC
    LIMIT 20
  `).all();

  return Response.json({ summary, paymentBreakdown, topProducts, recentBills, lowStock });
}
