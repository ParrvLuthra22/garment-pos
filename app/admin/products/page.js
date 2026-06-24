'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const GST_RATES = [0, 5, 12, 18, 28];
const SIZES     = ['XS','S','M','L','XL','XXL','Free Size',''];
const CATEGORIES = ['Shirt','T-Shirt','Jeans','Pant','Kurta','Kurti','Saree','Lehenga','Jacket','Blazer','Other'];

function Barcode({ sku }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!sku || !svgRef.current) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      JsBarcode(svgRef.current, sku, {
        format: 'CODE128',
        lineColor: '#000',
        background: '#fff',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 11,
        margin: 6,
      });
    });
  }, [sku]);

  return (
    <svg ref={svgRef} style={{ maxWidth: '100%' }} />
  );
}

export default function AdminProducts() {
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [barcodeModal, setBarcodeModal] = useState(null); // product to show barcode for
  const [search, setSearch]         = useState('');

  const emptyForm = { name:'', category:'Kurta', color:'', size:'M', mrp:'', gst_rate:'12', initial_stock:'1' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    setLoading(true);
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }

  useEffect(() => { loadProducts(); }, []);

  async function saveProduct(e) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setForm(emptyForm);
    loadProducts();
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    loadProducts();
  }

  function printBarcode(product) {
    setBarcodeModal(product);
    setTimeout(() => window.print(), 500);
  }

  const filtered = products.filter(p =>
    !search || [p.name, p.sku, p.category, p.color, p.size]
      .join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Nav */}
      <nav className="nav no-print">
        <div className="nav-logo">₹</div>
        <span className="nav-title">Products</span>
        <div className="nav-links">
          <Link href="/"                className="nav-link">POS</Link>
          <Link href="/admin/inventory" className="nav-link">Inventory</Link>
          <Link href="/admin/reports"   className="nav-link">Reports</Link>
        </div>
      </nav>

      {/* Toolbar */}
      <div className="no-print" style={{
        padding: '12px 20px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '10px', alignItems: 'center',
      }}>
        <input
          className="inp" style={{ maxWidth: '260px' }}
          placeholder="Search products..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: 'var(--muted)', fontSize: '12px', marginLeft: '4px' }}>
          {filtered.length} products
        </span>
        <button
          className="btn btn-amber"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowForm(true)}
        >
          + Add Product
        </button>
      </div>

      {/* Products table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="no-print">
        {loading ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '40px' }}>
            Loading products...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '60px', fontSize: '14px' }}>
            {search ? 'No products match your search.' : 'No products yet. Click "Add Product" to begin.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU / Barcode</th>
                <th>Name</th>
                <th>Category</th>
                <th>Size</th>
                <th>Color</th>
                <th style={{ textAlign: 'right' }}>MRP</th>
                <th style={{ textAlign: 'right' }}>GST%</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <code style={{ fontSize: '11px', color: 'var(--amber)', fontFamily: 'monospace' }}>
                      {p.sku}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{p.category}</td>
                  <td style={{ color: 'var(--muted)' }}>{p.size || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{p.color || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{p.mrp}</td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{p.gst_rate}%</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      color: p.stock <= 3 ? 'var(--danger)' : p.stock <= 10 ? '#f59e0b' : 'var(--success)',
                      fontWeight: 600,
                    }}>
                      {p.stock}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => setBarcodeModal(p)}
                      >
                        Barcode
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => deleteProduct(p.id)}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Product form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }} className="no-print">
          <div style={{
            background: 'var(--navy2)', borderRadius: '12px', padding: '24px',
            width: '420px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '16px' }}>Add New Product</div>
            <form onSubmit={saveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="field">
                <label className="label">Product Name *</label>
                <input className="inp" required value={form.name}
                  placeholder="e.g. Printed Kurta"
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="field">
                  <label className="label">Category</label>
                  <select className="inp" value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Size</label>
                  <select className="inp" value={form.size}
                    onChange={e => setForm(p => ({ ...p, size: e.target.value }))}>
                    {SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">Color</label>
                <input className="inp" value={form.color}
                  placeholder="White / Blue / Red..."
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="field">
                  <label className="label">MRP (₹) *</label>
                  <input className="inp" type="number" required min="0" value={form.mrp}
                    placeholder="599"
                    onChange={e => setForm(p => ({ ...p, mrp: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">GST %</label>
                  <select className="inp" value={form.gst_rate}
                    onChange={e => setForm(p => ({ ...p, gst_rate: e.target.value }))}>
                    {GST_RATES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Stock (pcs)</label>
                  <input className="inp" type="number" min="0" value={form.initial_stock}
                    onChange={e => setForm(p => ({ ...p, initial_stock: e.target.value }))} />
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '8px', background: 'var(--navy)', borderRadius: '6px' }}>
                SKU will be auto-generated as: <strong style={{ color: 'var(--amber)' }}>
                  {[form.category, form.color, form.size].map(s => (s||'').toUpperCase().trim()).filter(Boolean).join('-') || form.name?.toUpperCase().replace(/\s+/g,'-') || 'SKU'}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="submit" className="btn btn-amber" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode modal */}
      {barcodeModal && (
        <>
          {/* Screen view (hidden on print) */}
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }} className="no-print">
            <div style={{
              background: '#fff', borderRadius: '12px', padding: '24px',
              width: '320px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' }}>
                {barcodeModal.name}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px' }}>
                {[barcodeModal.size, barcodeModal.color].filter(Boolean).join(' / ')}
                &nbsp;· MRP ₹{barcodeModal.mrp}
              </div>
              <Barcode sku={barcodeModal.sku} />
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{barcodeModal.sku}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  className="btn btn-amber"
                  style={{ flex: 1, fontFamily: 'inherit' }}
                  onClick={() => { window.print(); }}
                >
                  🖨 Print Label
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontFamily: 'inherit' }}
                  onClick={() => setBarcodeModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* Print-only label */}
          <div style={{
            display: 'none', padding: '8mm',
            flexDirection: 'column', alignItems: 'center', gap: '2mm',
          }} className="print-bill">
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#000' }}>{barcodeModal.name}</div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              {[barcodeModal.size, barcodeModal.color].filter(Boolean).join(' / ')}
            </div>
            <Barcode sku={barcodeModal.sku} />
            <div style={{ fontSize: '12px', fontWeight: 700 }}>MRP ₹{barcodeModal.mrp}</div>
          </div>
        </>
      )}
    </div>
  );
}
