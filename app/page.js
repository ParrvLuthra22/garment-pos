'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(parseFloat(n) || 0);

// Indian number-to-words
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const twd  = n => { n=Math.floor(n); return n<20?ONES[n]:TENS[Math.floor(n/10)]+(n%10?' '+ONES[n%10]:''); };
function cvt(n){
  if(!n) return '';
  let r='';
  if(n>=10000000){r+=cvt(Math.floor(n/10000000))+' Crore ';n%=10000000;}
  if(n>=100000){r+=twd(Math.floor(n/100000))+' Lakh ';n%=100000;}
  if(n>=1000){r+=twd(Math.floor(n/1000))+' Thousand ';n%=1000;}
  if(n>=100){r+=ONES[Math.floor(n/100)]+' Hundred ';n%=100;}
  if(n>0)r+=twd(n)+' ';
  return r;
}
function numWords(num){
  if(!num) return 'Zero Rupees Only';
  num=Math.round(parseFloat(num)*100)/100;
  const r=Math.floor(num),p=Math.round((num-r)*100);
  let w=cvt(r).trim();
  if(w)w+=' Rupees';
  if(p>0)w+=(w?' and ':'')+twd(p)+' Paise';
  return (w||'Zero Rupees')+' Only';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function POS() {
  const [bill, setBill]         = useState([]);   // [{product, qty, subtotal}]
  const [discountType, setDiscountType] = useState('mrp'); // 'mrp' | '15' | '20'
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [payMode, setPayMode]   = useState('cash');
  const [lastScan, setLastScan] = useState(null); // { product, time }
  const [scanError, setScanError] = useState('');
  const [networkInfo, setNetworkInfo] = useState(null);
  const [completing, setCompleting]   = useState(false);
  const [completedBill, setCompletedBill] = useState(null);
  const pollRef = useRef(null);

  // Load network info once
  useEffect(() => {
    fetch('/api/network').then(r => r.json()).then(setNetworkInfo);
  }, []);

  // Poll for new scans every 500ms
  const poll = useCallback(async () => {
    try {
      const res  = await fetch('/api/scan/pending');
      const data = await res.json();
      if (!data.scans?.length) return;

      for (const scan of data.scans) {
        if (!scan.product) {
          setScanError(`Unknown barcode: ${scan.barcode}`);
          setTimeout(() => setScanError(''), 3000);
          continue;
        }
        addToBill(scan.product);
        setLastScan({ product: scan.product, time: new Date() });
      }
    } catch { /* network errors ignored during polling */ }
  }, []);  // eslint-disable-line

  useEffect(() => {
    pollRef.current = setInterval(poll, 500);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  // ── Bill operations ─────────────────────────────────────────────────────
  function addToBill(product) {
    setBill(prev => {
      const existing = prev.find(l => l.product.id === product.id);
      if (existing) {
        return prev.map(l =>
          l.product.id === product.id
            ? { ...l, qty: l.qty + 1, subtotal: (l.qty + 1) * l.product.mrp }
            : l
        );
      }
      return [...prev, { product, qty: 1, subtotal: product.mrp }];
    });
    setScanError('');
  }

  function removeFromBill(productId) {
    setBill(prev => prev.filter(l => l.product.id !== productId));
  }

  function updateQty(productId, newQty) {
    const q = parseInt(newQty);
    if (q <= 0) return removeFromBill(productId);
    setBill(prev => prev.map(l =>
      l.product.id === productId
        ? { ...l, qty: q, subtotal: q * l.product.mrp }
        : l
    ));
  }

  function newBill() {
    setBill([]);
    setDiscountType('mrp');
    setCustomer({ name: '', phone: '' });
    setPayMode('cash');
    setLastScan(null);
    setCompletedBill(null);
    fetch('/api/scan/pending', { method: 'DELETE' }); // clear stale scans
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const subtotal = bill.reduce((s, l) => s + l.subtotal, 0);
  const gstAmt   = bill.reduce((s, l) => {
    const rate = l.product.gst_rate ?? 12;
    return s + (l.subtotal * rate / 100);
  }, 0);
  const discPct = discountType === '15' ? 15 : discountType === '20' ? 20 : 0;
  const disc    = subtotal * discPct / 100;
  const total   = subtotal + gstAmt - disc;

  // ── Complete sale ────────────────────────────────────────────────────────
  async function completeSale() {
    if (!bill.length) return;
    setCompleting(true);
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: bill.map(l => ({
            product_id:    l.product.id,
            quantity:      l.qty,
            price_at_sale: l.product.mrp,
            gst_rate:      l.product.gst_rate ?? 12,
          })),
          customer_name:  customer.name,
          customer_phone: customer.phone,
          discount:       disc,
          payment_mode:   payMode,
        }),
      });
      const data = await res.json();
      setCompletedBill(data);
    } catch (e) {
      alert('Error completing sale: ' + e.message);
    }
    setCompleting(false);
  }

  // ── Print bill ───────────────────────────────────────────────────────────
  function printBill() { window.print(); }

  // ── Render ───────────────────────────────────────────────────────────────
  if (completedBill) {
    return <BillReceipt data={completedBill} onNew={newBill} onPrint={printBill} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Nav ── */}
      <nav className="nav no-print">
        <div className="nav-logo">₹</div>
        <span className="nav-title">Garment POS</span>
        {networkInfo && (
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>
            Phone scanner → <strong style={{ color: 'var(--amber)' }}>{networkInfo.scannerUrl}</strong>
          </span>
        )}
        <div className="nav-links">
          <Link href="/admin/products"  className="nav-link">Products</Link>
          <Link href="/admin/inventory" className="nav-link">Inventory</Link>
          <Link href="/admin/reports"   className="nav-link">Reports</Link>
        </div>
      </nav>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: Bill ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', borderRight: '1px solid var(--border)',
        }}>
          {/* Scan indicator */}
          <div style={{
            padding: '10px 16px',
            background: lastScan ? 'rgba(16,185,129,0.1)' : 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '10px', minHeight: '50px',
          }} className="no-print">
            {scanError ? (
              <span style={{ color: 'var(--danger)', fontSize: '13px' }}>⚠ {scanError}</span>
            ) : lastScan ? (
              <>
                <span style={{ color: 'var(--success)', fontSize: '18px' }}>✓</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{lastScan.product.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {lastScan.product.sku} · ₹{fmt(lastScan.product.mrp)}
                  </div>
                </div>
              </>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Scan a product from your phone → or search manually below
              </span>
            )}
          </div>

          {/* Items list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
            {bill.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%',
                color: 'var(--muted)', fontSize: '13px', gap: '8px',
              }}>
                <div style={{ fontSize: '32px' }}>🛍</div>
                <div>Scan a barcode to start billing</div>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ width: '30px' }} />
                  </tr>
                </thead>
                <tbody>
                  {bill.map(line => (
                    <tr key={line.product.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{line.product.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {[line.product.size, line.product.color].filter(Boolean).join(' · ')}
                          &nbsp;· GST {line.product.gst_rate}%
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>₹{fmt(line.product.mrp)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 8px', fontSize: '14px' }}
                            onClick={() => updateQty(line.product.id, line.qty - 1)}
                          >−</button>
                          <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                            {line.qty}
                          </span>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 8px', fontSize: '14px' }}
                            onClick={() => updateQty(line.product.id, line.qty + 1)}
                          >+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{fmt(line.subtotal)}
                      </td>
                      <td>
                        <button
                          onClick={() => removeFromBill(line.product.id)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--muted)',
                            cursor: 'pointer', fontSize: '16px', padding: '2px 4px',
                          }}
                          title="Remove"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: Payment ── */}
        <div style={{
          width: '300px', minWidth: '300px', display: 'flex',
          flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)',
        }} className="no-print">

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Customer */}
            <div>
              <div className="section-title">Customer (optional)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="field">
                  <label className="label">Name</label>
                  <input className="inp" value={customer.name} placeholder="Customer name"
                    onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">Phone</label>
                  <input className="inp" value={customer.phone} placeholder="+91 98765 43210"
                    onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Payment mode */}
            <div>
              <div className="section-title">Payment Mode</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['cash', 'card', 'upi'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMode(m)}
                    className="btn"
                    style={{
                      flex: 1, padding: '8px 4px', fontSize: '12px',
                      background: payMode === m ? 'var(--amber)' : 'var(--navy2)',
                      color: payMode === m ? 'var(--navy)' : 'var(--text)',
                      border: '1px solid var(--border)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div>
              <div className="section-title">Discount</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { key: 'mrp', label: 'On MRP' },
                  { key: '15',  label: '15%' },
                  { key: '20',  label: '20%' },
                ].map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDiscountType(d.key)}
                    className="btn"
                    style={{
                      flex: 1, padding: '8px 4px', fontSize: '12px',
                      background: discountType === d.key ? 'var(--amber)' : 'var(--navy2)',
                      color: discountType === d.key ? 'var(--navy)' : 'var(--text)',
                      border: '1px solid var(--border)',
                      fontWeight: discountType === d.key ? 700 : 400,
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div style={{
              background: 'var(--navy2)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', padding: '12px',
            }}>
              <div className="section-title" style={{ marginBottom: '8px' }}>Summary</div>
              {[
                { label: 'Subtotal',   val: fmt(subtotal) },
                { label: `GST`,        val: fmt(gstAmt) },
                ...(disc > 0 ? [{ label: `Discount (${discPct}%)`, val: `−₹${fmt(disc)}` }] : []),
              ].map(({ label, val }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '4px 0', borderBottom: '1px solid var(--navy3)',
                  fontSize: '12px',
                }}>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span>₹{val}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: '10px',
                padding: '10px', background: 'var(--navy)', borderRadius: '6px',
                border: '2px solid var(--amber)',
              }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>TOTAL</span>
                <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--amber)' }}>
                  ₹{fmt(total)}
                </span>
              </div>
            </div>

          </div>

          {/* Actions */}
          <div style={{ padding: '14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn btn-amber"
              style={{ padding: '13px', fontSize: '14px', fontWeight: 700, width: '100%' }}
              disabled={!bill.length || completing}
              onClick={completeSale}
            >
              {completing ? 'Processing...' : '✓ Complete Sale'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: '12px' }}
              onClick={newBill}
            >
              New Bill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bill Receipt (shown after completing a sale) ───────────────────────────
function BillReceipt({ data, onNew, onPrint }) {
  const { bill, items } = data;
  const subtotal = items.reduce((s, i) => s + i.price_at_sale * i.quantity, 0);
  const gstAmt   = items.reduce((s, i) => s + i.price_at_sale * i.quantity * i.gst_rate / 100, 0);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Action bar (hidden on print) */}
      <div className="no-print" style={{
        background: 'var(--bg)', padding: '12px 20px', borderBottom: '3px solid var(--amber)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--success)' }}>✓ Sale completed — {bill.bill_no}</span>
        <button className="btn btn-amber" style={{ marginLeft: 'auto' }} onClick={onPrint}>
          🖨 Print Bill
        </button>
        <button className="btn btn-ghost" onClick={onNew}>New Bill</button>
      </div>

      {/* The printable receipt */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#f5f5f5' }}>
        <div style={{
          maxWidth: '420px', margin: '0 auto', background: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: '10px', overflow: 'hidden',
          fontFamily: 'system-ui, sans-serif',
        }}>
          {/* Header */}
          <div style={{
            background: '#0f172a', padding: '20px 24px', borderBottom: '3px solid #e8941a',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>GARMENT SHOP</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Tax Invoice</div>
          </div>

          {/* Bill meta */}
          <div style={{ padding: '12px 24px', background: '#f9fafb', borderBottom: '1px solid #e2e8f0', fontSize: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {[
                ['Bill No', bill.bill_no],
                ['Date', new Date(bill.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })],
                ['Customer', bill.customer_name || '—'],
                ['Phone', bill.customer_phone || '—'],
                ['Payment', bill.payment_mode?.toUpperCase()],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
                  <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Item</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Rate</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '8px 12px', color: '#1a1a2e', fontWeight: 500 }}>
                    {item.name}
                    {(item.size || item.color) && (
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>
                        {[item.size, item.color].filter(Boolean).join(' / ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{fmt(item.price_at_sale)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                    ₹{fmt(item.price_at_sale * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ padding: '12px 24px', borderTop: '2px solid #e2e8f0', fontSize: '12px' }}>
            {[
              ['Subtotal', subtotal],
              ['GST', gstAmt],
              ...(bill.discount > 0 ? [['Discount', -bill.discount]] : []),
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#6b7280' }}>{l}</span>
                <span>₹{fmt(Math.abs(v))}{v < 0 ? ' (-)' : ''}</span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: '8px',
              background: '#0f172a', color: '#fff', padding: '10px 12px',
              borderRadius: '6px', fontWeight: 700,
            }}>
              <span>TOTAL</span>
              <span style={{ color: '#e8941a', fontSize: '15px' }}>₹{fmt(bill.total)}</span>
            </div>
          </div>

          {/* Amount in words */}
          <div style={{ padding: '10px 24px', background: '#fef9f0', borderTop: '1px solid #fde68a', fontSize: '11px' }}>
            <span style={{ color: '#92400e', fontWeight: 600, marginRight: '6px' }}>Amount in words:</span>
            <span style={{ color: '#78350f', fontStyle: 'italic' }}>{numWords(bill.total)}</span>
          </div>

          <div style={{ padding: '12px 24px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
            Thank you for shopping with us!
          </div>
        </div>
      </div>
    </div>
  );
}
