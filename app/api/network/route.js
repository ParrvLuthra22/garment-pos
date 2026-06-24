import os from 'os';

// GET /api/network — returns the desktop's local WiFi IP
// The POS screen shows this so staff can type it into the phone browser.
export async function GET() {
  const nets   = os.networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs) {
      // Only IPv4, non-internal (skip 127.x and loopback)
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push({ name, address: addr.address });
      }
    }
  }

  // Prefer addresses that look like a LAN IP (192.168.x.x or 10.x.x.x or 172.16-31.x.x)
  const lan = results.find(r =>
    r.address.startsWith('192.168.') ||
    r.address.startsWith('10.')      ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(r.address)
  );

  const ip  = lan?.address ?? results[0]?.address ?? 'localhost';
  const url = `http://${ip}:3000`;

  return Response.json({ ip, url, scannerUrl: `${url}/scanner` });
}
