/**
 * Lokalny odpowiednik funkcji serverless z `api/` — pozwala odpytywać prawdziwą
 * bazę Airtable bez Vercel CLI.
 *
 * Działa dlatego, że `api/_lib/types.ts` celowo nie zależy od `@vercel/node`,
 * tylko deklaruje minimalny kształt request/response. Handler dotyka wyłącznie
 * `req.method`, `req.headers`, `req.query`, `res.setHeader`, `res.status()`
 * i `res.send()` — a to jest `IncomingMessage`/`ServerResponse` plus trzy
 * metody, które dokłada poniższy adapter.
 *
 * Token nigdy nie opuszcza tego procesu: przeglądarka rozmawia z proxy Vite
 * (`vite.config.ts`), proxy z tym serwerem, a dopiero ten serwer z Airtable.
 * Odpytywanie Airtable bezpośrednio z SPA odtworzyłoby incydent z maja 2026.
 *
 * Uruchomienie: npm run dev:api
 */
import http from 'node:http';
import type { VercelRequest, VercelResponse } from '../api/_lib/types.js';
import productHandler from '../api/product.js';

const PORT = Number(process.env.PORT ?? 3000);
const REQUIRED_ENV = ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_FRONT_BASE_ID'];

// Node ≥ 21.7 czyta .env samo — bez dotenv i bez flagi w skrypcie npm.
try {
  process.loadEnvFile();
} catch {
  // Brak .env nie jest tu błędem: zmienne mogą pochodzić ze środowiska powłoki.
}

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[dev-api] Brak zmiennych środowiskowych: ${missing.join(', ')}`);
  console.error('[dev-api] Uzupełnij .env na wzór .env.example.');
  process.exit(1);
}

/** Vercel podaje powtórzony `?a=1&a=2` jako tablicę — handler na tym polega. */
function toQuery(searchParams: URLSearchParams): VercelRequest['query'] {
  const query: VercelRequest['query'] = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}

/** Dokłada do ServerResponse trzy metody, których używa warstwa `api/`. */
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
    // withGuards łapie wszystko samo; ten catch to ostatnia siatka.
    console.error('[dev-api] nieobsłużony błąd', err);
    if (!res.headersSent) vercelRes.status(500).json({ error: 'Internal Server Error' });
  });
});

// Port 3000 bywa zajęty przez inny projekt — bez tego Node wyrzuca surowy
// stack trace z 'error' event, co nic nie mówi o tym, co zrobić dalej.
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
