'use client';

import { useEffect, useRef, useState } from 'react';

export default function ScannerPage() {
  const videoRef  = useRef(null);
  const readerRef = useRef(null);
  const lastRef   = useRef('');   // debounce: ignore same barcode within 1.5s

  const [status, setStatus]         = useState('starting'); // starting | ready | scanning | error
  const [lastProduct, setLastProduct] = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [scanCount, setScanCount]   = useState(0);
  const [flashGreen, setFlashGreen] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'Camera API not available. On mobile, open this page using HTTPS or access via localhost.'
          );
        }

        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        setStatus('ready');

        reader.decodeFromVideoDevice(
          undefined,           // use default camera
          videoRef.current,
          async (result, err) => {
            if (stopped) return;
            if (!result) return;

            const barcode = result.getText().trim();

            // Debounce: ignore the same code within 1.5 seconds
            const now = Date.now();
            if (barcode === lastRef.current?.code && now - lastRef.current?.ts < 1500) return;
            lastRef.current = { code: barcode, ts: now };

            setStatus('scanning');

            // POST to the server (phone is already on the right IP since it opened this page from there)
            try {
              const res  = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode }),
              });
              const data = await res.json();

              if (data.found && data.product) {
                setLastProduct(data.product);
                setScanCount(c => c + 1);
                setFlashGreen(true);
                setTimeout(() => setFlashGreen(false), 600);
              } else {
                setLastProduct({ name: 'Unknown barcode', sku: barcode, mrp: null });
                setFlashGreen(false);
              }
            } catch (e) {
              setErrorMsg('Cannot reach server. Make sure you opened this page from the desktop IP.');
            }

            setTimeout(() => setStatus('ready'), 800);
          }
        );
      } catch (e) {
        setErrorMsg(e.message || 'Camera access denied. Please allow camera and reload.');
        setStatus('error');
      }
    }

    startScanner();

    return () => {
      stopped = true;
      readerRef.current?.reset?.();
    };
  }, []);

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#020817', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#0f172a', borderBottom: '3px solid #e8941a',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px', height: '26px', background: '#e8941a', borderRadius: '5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: '#0f172a',
          }}>₹</div>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Barcode Scanner</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: status === 'ready' || status === 'scanning' ? '#10b981' : '#94a3b8',
            boxShadow: status === 'ready' ? '0 0 6px #10b981' : 'none',
          }} />
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {status === 'starting' ? 'Starting camera...'
            : status === 'error'   ? 'Error'
            : status === 'scanning'? 'Scanning...'
            : 'Ready'}
          </span>
        </div>
      </div>

      {/* Camera view */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: flashGreen ? 'rgba(16,185,129,0.15)' : '#000',
        transition: 'background 0.1s',
      }}>
        <video
          ref={videoRef}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: status === 'error' ? 'none' : 'block',
          }}
          muted
          playsInline
        />

        {/* Scan reticle overlay */}
        {status !== 'error' && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '240px', height: '120px',
            border: `2px solid ${flashGreen ? '#10b981' : '#e8941a'}`,
            borderRadius: '8px',
            boxShadow: flashGreen ? '0 0 20px rgba(16,185,129,0.5)' : '0 0 10px rgba(232,148,26,0.4)',
            transition: 'all 0.15s',
            pointerEvents: 'none',
          }}>
            {/* Corner markers */}
            {[['0%','0%','top','left'],['100%','0%','top','right'],['0%','100%','bottom','left'],['100%','100%','bottom','right']].map(([l,t,v,h]) => (
              <div key={`${v}${h}`} style={{
                position: 'absolute', left: l, top: t,
                width: '16px', height: '16px',
                borderTop: v === 'top' ? `3px solid ${flashGreen ? '#10b981' : '#e8941a'}` : 'none',
                borderBottom: v === 'bottom' ? `3px solid ${flashGreen ? '#10b981' : '#e8941a'}` : 'none',
                borderLeft: h === 'left' ? `3px solid ${flashGreen ? '#10b981' : '#e8941a'}` : 'none',
                borderRight: h === 'right' ? `3px solid ${flashGreen ? '#10b981' : '#e8941a'}` : 'none',
                transform: `translate(${h === 'right' ? '1px' : '-1px'}, ${v === 'bottom' ? '1px' : '-1px'})`,
              }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: '12px', padding: '24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px' }}>📷</div>
            <div style={{ color: '#ef4444', fontWeight: 600 }}>{errorMsg || 'Camera unavailable'}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Allow camera access in your browser settings, then reload this page.
            </div>
          </div>
        )}
      </div>

      {/* Bottom info panel */}
      <div style={{
        background: '#0f172a', borderTop: '1px solid #1e293b',
        padding: '12px 16px', flexShrink: 0,
      }}>
        {errorMsg && status !== 'error' ? (
          <div style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center' }}>{errorMsg}</div>
        ) : lastProduct ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#1e293b', borderRadius: '8px', padding: '10px 14px',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                {lastProduct.name}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {lastProduct.sku}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {lastProduct.mrp != null && (
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#e8941a' }}>
                  ₹{lastProduct.mrp?.toLocaleString('en-IN')}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                Scans: {scanCount}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#475569' }}>
            Point camera at a barcode — hold steady for 1-2 seconds
          </div>
        )}
      </div>
    </div>
  );
}
