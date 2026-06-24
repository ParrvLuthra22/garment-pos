# Garment Shop POS System

Barcode-based billing and inventory management for garment shops.
Phone camera scans barcodes → items auto-add to bill on desktop.

---

## Quick Start

```bash
npm install
npm run dev         # starts on http://localhost:3000
```

On first run, `shop.db` is created automatically with all tables.

---

## How to use

### Step 1 — Add your products
Open http://localhost:3000/admin/products → click **Add Product**
- Enter: Name, Category, Size, Color, MRP, GST%, Initial Stock
- A barcode (SKU) is generated automatically (e.g. `KURTA-WHITE-M`)

### Step 2 — Print barcodes
- Click **Barcode** next to any product
- Click **Print Label** → use it as a price sticker on the garment

### Step 3 — Set up the scanner (phone)
1. Make sure phone and desktop are on **the same WiFi**
2. On the desktop POS screen (http://localhost:3000), you'll see the scanner URL:
   e.g. `http://192.168.1.5:3000/scanner`
3. Type that URL in your phone's browser
4. Allow camera access when prompted
5. Point at a barcode → item appears in the bill on desktop instantly

### Step 4 — Complete a sale
1. All scanned items appear in the desktop bill
2. Adjust quantities with +/- buttons
3. Optionally enter customer name/phone and discount
4. Select payment mode (Cash / Card / UPI)
5. Click **Complete Sale** → receipt generated, stock updated

---

## Pages

| URL                       | Purpose                          |
|---------------------------|----------------------------------|
| `/`                       | POS billing terminal (desktop)   |
| `/scanner`                | Camera scanner (open on phone)   |
| `/admin/products`         | Add products, generate barcodes  |
| `/admin/inventory`        | Update stock levels              |
| `/admin/reports`          | Sales reports and low-stock alert|

---

## GST
- Garments ≤ ₹1000: 5% (set manually per product)
- Garments > ₹1000: 12% (set manually per product)
- Default in the add-product form is 12%
- Bills show GST breakdown in the receipt

---

## Tech Stack
- **Next.js 14** — serves all pages and API routes
- **better-sqlite3** — local database (zero setup, `shop.db` file)
- **@zxing/browser** — barcode scanning via phone camera
- **JsBarcode** — generates printable Code128 barcodes

---

## Production (running permanently on the shop computer)
```bash
npm run build
npm start           # runs on port 3000
```

Add to startup: use PM2 or Windows Task Scheduler to auto-start on boot.
```bash
npm install -g pm2
pm2 start "npm start" --name garment-pos
pm2 save && pm2 startup
```
