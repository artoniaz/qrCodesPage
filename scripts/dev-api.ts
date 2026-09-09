/**
 * Local stand-in for the serverless functions in `api/` — lets the app query
 * the real Airtable base without the Vercel CLI.
 *
 * It works because `api/_lib/types.ts` deliberately does not depend on
 * `@vercel/node` and instead declares a minimal request/response shape. The
 * handler only touches `req.method`, `req.headers`, `req.query`,
 * `res.setHeader`, `res.status()` and `res.send()` — an
 * `IncomingMessage`/`ServerResponse` plus the three methods the adapter below
 * adds.
 *
 * The token never leaves this process: the browser talks to the Vite proxy
 * (`vite.config.ts`), the proxy to this server, and only this server to
 * Airtable. Querying Airtable straight from the SPA would recreate the May
 * 2026 incident.
 *
 * Run with: npm run dev:api
 */
import http from 'node:http';
import type { VercelRequest, VercelResponse } from '../api/_lib/types.js';
import productHandler from '../api/product.js';

const PORT = Number(process.env.PORT ?? 3000);
const REQUIRED_ENV = ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_FRONT_BASE_ID'];

// Node >= 21.7 reads .env by itself — no dotenv and no flag in the npm script.
try {
  process.loadEnvFile();
} catch {
  // A missing .env is not an error here: the variables may come from the shell.
}

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[dev-api] Brak zmiennych środowiskowych: ${missing.join(', ')}`);
  console.error('[dev-api] Uzupełnij .env na wzór .env.example.');
  process.exit(1);
}

/** Vercel hands a repeated `?a=1&a=2` over as an array — the handler relies on that. */
function toQuery(searchParams: URLSearchParams): VercelRequest['query'] {
  const query: VercelRequest['query'] = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}

/** Adds to ServerResponse the three methods the `api/` layer uses. */
function toVercelResponse(res: http.ServerResponse): VercelResponse {
  const vercelRes = res as VercelResponse;
  vercelRes.status = (code) => {
    res.statusCode = code;
    return vercelRes;
  };
  vercelRes.send = (body) => {
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    return vercelRes;
  };
  vercelRes.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
    return vercelRes;
  };
  return vercelRes;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const vercelRes = toVercelResponse(res);

  if (url.pathname !== '/api/product') {
    vercelRes.status(404).json({ error: `No dev route for ${url.pathname}` });
    return;
  }

  const vercelReq = req as VercelRequest;
  vercelReq.query = toQuery(url.searchParams);

  void productHandler(vercelReq, vercelRes).catch((err: unknown) => {
    // withGuards catches everything itself; this is the last safety net.
    console.error('[dev-api] nieobsłużony błąd', err);
    if (!res.headersSent) vercelRes.status(500).json({ error: 'Internal Server Error' });
  });
});

// Port 3000 is often taken by another project — without this Node throws a
// raw stack trace from the 'error' event, which says nothing about what to do.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[dev-api] Port ${PORT} jest już zajęty przez inny proces.`);
    console.error('[dev-api] Zwolnij go albo uruchom na innym porcie:');
    console.error(`[dev-api]   PORT=3001 npm run dev:api`);
    console.error('[dev-api] Przy zmianie portu popraw też cel proxy w vite.config.ts.');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`[dev-api] nasłuchuje na http://localhost:${PORT}/api/product`);
  console.log('[dev-api] proxy Vite kieruje tu /api — uruchom w drugim terminalu: npm run dev');
});
