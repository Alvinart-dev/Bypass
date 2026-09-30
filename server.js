import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.SERVER_PORT;
const HOST = '0.0.0.0';

const SITEKEY = '0x4AAAAAADNEi_2N24gpQqY0';
const API_KEY = process.env.IZZ_API_KEY || 'izzsolve_70a2kz8';
const TURNSTILE_API = 'https://solver.izzcs.my.id/api/turnstile';
const BYPASS_API = 'https://izen.lol/api/bypass';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const t = new Date().toISOString();
  console.log(`[${t}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    port: PORT
  });
});

async function getCaptchaToken() {
  const res = await fetch(TURNSTILE_API, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      siteurl: 'https://izen.lol',
      sitekey: SITEKEY
    })
  });

  const data = await res.json();

  if (!data.success || !data.token) {
    throw new Error('Gagal dapet captcha token: ' + JSON.stringify(data));
  }

  return data.token;
}

app.post('/api/bypass', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL wajib diisi'
      });
    }

    let parsed;
    try {
      parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('protocol');
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Format URL tidak valid'
      });
    }

    console.log('Solving captcha untuk:', url);
    const captchaToken = await getCaptchaToken();

    console.log('Mengirim bypass request...');
    const bypassRes = await fetch(BYPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, captchaToken })
    });

    const bypassData = await bypassRes.json();

    return res.json({
      success: true,
      ...bypassData
    });

  } catch (err) {
    console.error('Bypass error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan di server'
    });
  }
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Server jalan di http://${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});