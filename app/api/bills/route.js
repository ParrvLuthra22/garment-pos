import { getDB, nextBillNo } from '@/lib/db';

// GET /api/bills?limit=20&offset=0
export async function GET(req) {
  const db = getDB();
  const { searchParams } = new URL(req.url);
  const limit  = parseInt(searchParams.get('limit')  ?? 20);
  const offset = parseInt(searchParams.get('offset') ?? 0);

  const bills = db.prepare(`
    SELECT * FROM transactions
    ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM transactions`).get().n;

  return Response.json({ bills, total });
}

// POST /api/bills — complete a sale
// Body: { items: [{product_id, quantity, price_at_sale, gst_rate}], customer_name,
//         customer_phone, discount, payment_mode }
export async function POST(req) {
  const db   = getDB();
  const body = await req.json();

  const {
    items         = [],
    customer_name  = '',
    customer_phone = '',
    discount       = 0,
    payment_mode   = 'cash',
  } = body;

  if (!items.length) {
    return Response.json({ error: 'No items in bill' }, { status: 400 });
  }

  // Validate all products exist
  for (const item of items) {
    const p = db.prepare(`SELECT id FROM products WHERE id = ?`).get(item.product_id);
    if (!p) return Response.json({ error: `Product ${item.product_id} not found` }, { status: 404 });
  }

  const billNo = nextBillNo(db);

  // Calculate totals
  let subtotal = 0;
  let gstAmount = 0;

  for (const item of items) {
    const lineSubtotal = item.price_at_sale * item.quantity;
    subtotal  += lineSubtotal;
    gstAmount += lineSubtotal * (item.gst_rate / 100);
  }

  const total = subtotal + gstAmount - parseFloat(discount);

  // Wrap in a transaction so stock and bill are always consistent
  const doInsert = db.transaction(() => {
    const billId = db.prepare(`
      INSERT INTO transactions
        (bill_no, customer_name, customer_phone, subtotal, gst_amount, discount, total, payment_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      billNo, customer_name, customer_phone,
      subtotal, gstAmount, parseFloat(discount), total, payment_mode
    ).lastInsertRowid;

    for (const item of items) {
      db.prepare(`
        INSERT INTO transaction_items
          (transaction_id, product_id, quantity, price_at_sale, gst_rate)
        VALUES (?, ?, ?, ?, ?)
      `).run(billId, item.product_id, item.quantity, item.price_at_sale, item.gst_rate);

      // Deduct from inventory (floor at 0)
      db.prepare(`
        UPDATE inventory
        SET quantity = MAX(0, quantity - ?)
        WHERE product_id = ?
      `).run(item.quantity, item.product_id);
    }

    return billId;
  });

  const billId = doInsert();

  // Return the full bill for printing
  const bill = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(billId);
  const billItems = db.prepare(`
    SELECT ti.*, p.name, p.sku, p.category, p.size, p.color
    FROM transaction_items ti
    JOIN products p ON p.id = ti.product_id
    WHERE ti.transaction_id = ?
  `).all(billId);

  return Response.json({ bill, items: billItems }, { status: 201 });
}
