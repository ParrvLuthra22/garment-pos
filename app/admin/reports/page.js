'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const fmt = n =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(parseFloat(n) || 0);

export default function AdminReports() {
  const [range, setRange]   = useState('today');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [range]);

  const rangeLabels = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days', all: 'All time' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="nav">
        <div className="nav-logo">₹</div>
        <span className="nav-title">Reports</span>
        <div className="nav-links">
          <Link href="/"               className="nav-link">POS</Link>
          <Link href="/admin/products" className="nav-link">Products</Link>
          <Link href="/admin/inventory"className="nav-link">Inventory</Link>
        </div>
      </nav>

      {/* Range selector */}
      <div style={{
        padding: '10px 20px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '6px',
      }}>
        {Object.entries(rangeLabels).map(([k, label]) => (
          <button
            key={k} onClick={() => setRange(k)}
            className="btn"
            style={{
              padding: '7px 14px', fontSize: '12px',
              background: range === k ? 'var(--amber)' : 'var(--navy2)',
              color: range === k ? 'var(--navy)' : 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {loading || !data ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '40px' }}>
            Loading reports...
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Revenue',     val: `₹${fmt(data.summary.total_revenue)}`,  color: 'var(--amber)' },
                { label: 'Total Bills', val: data.summary.total_bills,                color: 'var(--text)' },
                { label: 'GST Collected', val: `₹${fmt(data.summary.total_gst)}`,    color: '#10b981' },
                { label: 'Discounts',   val: `₹${fmt(data.summary.total_discount)}`, color: '#f59e0b' },
              ].map(({ label, val, color }) => (
                <div key={label} className="card">
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>{rangeLabels[range]}</div>
                </div>
              ))}
            </div>

            {/* Payment breakdown + Top products side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              {/* Payment breakdown */}
              <div className="card">
                <div className="section-title">Payment Modes</div>
                {data.paymentBreakdown.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No sales yet</div>
                ) : data.paymentBreakdown.map(p => (
                  <div key={p.payment_mode} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--navy3)',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>
                        {p.payment_mode}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.n} bills</div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--amber)' }}>
                      ₹{fmt(p.revenue)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Top products */}
              <div className="card">
                <div className="section-title">Top Selling Products</div>
                {data.topProducts.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No sales yet</div>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'right' }}>Units</th>
                        <th style={{ textAlign: 'right' }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={p.sku}>
                          <td style={{ color: 'var(--muted)', fontWeight: 600 }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {[p.size, p.color].filter(Boolean).join(' / ')}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>
                            {p.units_sold}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{fmt(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Low stock alert */}
            {data.lowStock.length > 0 && (
              <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                <div className="section-title" style={{ color: 'var(--danger)' }}>
                  ⚠ Low Stock Alert
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {data.lowStock.map(p => (
                    <div key={p.id} style={{
                      background: 'var(--navy)', borderRadius: '6px', padding: '6px 12px',
                      border: `1px solid ${p.stock === 0 ? 'var(--danger)' : '#f59e0b'}`,
                      display: 'flex', gap: '8px', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {[p.size, p.color].filter(Boolean).join('/')}
                      </span>
                      <span style={{
                        fontWeight: 700, fontSize: '12px',
                        color: p.stock === 0 ? 'var(--danger)' : '#f59e0b',
                      }}>
                        {p.stock === 0 ? 'OUT' : p.stock + ' left'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent bills */}
            <div className="card">
              <div className="section-title">Recent Bills</div>
              {data.recentBills.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No bills yet</div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Bill No</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th>Payment</th>
                      <th>Date / Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentBills.map(b => (
                      <tr key={b.id}>
                        <td>
                          <code style={{ fontSize: '11px', color: 'var(--amber)' }}>{b.bill_no}</code>
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{b.customer_name || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{fmt(b.total)}</td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{b.payment_mode}</td>
                        <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {new Date(b.created_at).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
