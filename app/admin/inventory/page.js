'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [edits, setEdits]         = useState({});  // { [product_id]: newQty }
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all'); // all | low | out

  async function loadInventory() {
    setLoading(true);
    const res  = await fetch('/api/inventory');
    const data = await res.json();
    setInventory(data.inventory ?? []);
    setLoading(false);
  }

  useEffect(() => { loadInventory(); }, []);

  async function saveAll() {
    if (!Object.keys(edits).length) return;
    setSaving(true);
    const updates = Object.entries(edits).map(([product_id, quantity]) => ({
      product_id: parseInt(product_id), quantity: parseInt(quantity), mode: 'set',
    }));
    await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    setSaving(false);
    setEdits({});
    loadInventory();
  }

  async function addStock(product_id, amount) {
    await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id, quantity: amount, mode: 'add' }),
    });
    loadInventory();
  }

  function getDisplayQty(p) {
    return edits[p.id] !== undefined ? edits[p.id] : p.stock;
  }

  let displayed = inventory;
  if (search) displayed = displayed.filter(p =>
    [p.name, p.sku, p.category, p.color, p.size]
      .join(' ').toLowerCase().includes(search.toLowerCase())
  );
  if (filter === 'low')  displayed = displayed.filter(p => p.stock > 0 && p.stock <= 5);
  if (filter === 'out')  displayed = displayed.filter(p => p.stock === 0);

  const totals = {
    items: inventory.length,
    units: inventory.reduce((s, p) => s + p.stock, 0),
    low:   inventory.filter(p => p.stock > 0 && p.stock <= 5).length,
    out:   inventory.filter(p => p.stock === 0).length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="nav">
        <div className="nav-logo">₹</div>
        <span className="nav-title">Inventory</span>
        <div className="nav-links">
          <Link href="/"               className="nav-link">POS</Link>
          <Link href="/admin/products" className="nav-link">Products</Link>
          <Link href="/admin/reports"  className="nav-link">Reports</Link>
        </div>
      </nav>

      {/* Summary cards */}
      <div style={{
        padding: '12px 20px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '12px', flexWrap: 'wrap',
      }}>
        {[
          { label: 'Total SKUs', val: totals.items, color: 'var(--text)' },
          { label: 'Total Units', val: totals.units, color: 'var(--amber)' },
          { label: 'Low Stock (≤5)', val: totals.low, color: '#f59e0b' },
          { label: 'Out of Stock', val: totals.out, color: 'var(--danger)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{
            background: 'var(--navy2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '8px 16px', minWidth: '120px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '10px 20px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          className="inp" style={{ maxWidth: '240px' }}
          placeholder="Search..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {['all','low','out'].map(f => (
            <button
              key={f} onClick={() => setFilter(f)}
              className="btn"
              style={{
                padding: '6px 12px', fontSize: '11px',
                background: filter === f ? 'var(--amber)' : 'var(--navy2)',
                color: filter === f ? 'var(--navy)' : 'var(--text)',
                border: '1px solid var(--border)', textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
        {Object.keys(edits).length > 0 && (
          <button
            className="btn btn-success"
            style={{ marginLeft: 'auto' }}
            onClick={saveAll} disabled={saving}
          >
            {saving ? 'Saving...' : `Save ${Object.keys(edits).length} changes`}
          </button>
        )}
      </div>

      {/* Inventory table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Size / Color</th>
                <th style={{ textAlign: 'right' }}>MRP</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Stock</th>
                <th style={{ textAlign: 'center', width: '140px' }}>Add Stock</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(p => {
                const q   = getDisplayQty(p);
                const edited = edits[p.id] !== undefined;
                return (
                  <tr key={p.id} style={{ background: edited ? 'rgba(232,148,26,0.05)' : undefined }}>
                    <td>
                      <code style={{ fontSize: '11px', color: 'var(--amber)' }}>{p.sku}</code>
                    </td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: 'var(--muted)' }}>{p.category}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      {[p.size, p.color].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>₹{p.mrp}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <input
                          type="number" min="0"
                          className="inp"
                          style={{
                            width: '70px', textAlign: 'center',
                            color: q === 0 ? 'var(--danger)' : q <= 5 ? '#f59e0b' : 'var(--success)',
                            fontWeight: 700,
                            borderColor: edited ? 'var(--amber)' : 'var(--border)',
                          }}
                          value={q}
                          onChange={e => setEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        {edited && (
                          <span style={{ fontSize: '10px', color: 'var(--amber)' }}>●</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {[5, 10, 25].map(n => (
                          <button
                            key={n}
                            className="btn btn-ghost"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => addStock(p.id, n)}
                          >
                            +{n}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
