# azMEBLOPŁYT — product lookup kiosk

A tablet in the showroom. The customer scans the QR code on a product sample
and the screen shows that product's specification and current price. Nothing
else — no navigation, no search, no cart.

That single purpose explains most of the decisions below.

## How it works

```
QR scan (keyboard-wedge scanner)
  └─ useBarcodeScanner  →  /product/:id
       └─ /api/product   →  Airtable
```

The scanner behaves as a keyboard. `src/hooks/useBarcodeScanner.ts` listens for
keystrokes on `window`, and on Enter navigates to the product route.

Airtable is reached **only** through the serverless functions in `api/`. The
token is server-side and must stay there: it was once exposed in the client
bundle through a `VITE_` prefix, and that must not happen again. Any future
feature needing a secret goes through an `api/` proxy.

Four product views are chosen by the record's own `kind` field, not by the
route: worktop (with a price calculator), front, sheet + front, and a plain
product.

## Running locally

Two terminals:

```bash
npm run dev:api   # :3000 — the api/ functions against real Airtable
npm run dev       # :5173 — the app
```

Copy `.env.example` to `.env` and fill in three values:

```
AIRTABLE_TOKEN=
AIRTABLE_BASE_ID=
AIRTABLE_FRONT_BASE_ID=
```

`scripts/dev-api.ts` runs the real handlers from `api/` on a small `node:http`
adapter, so no Vercel CLI is needed. It is read-only by construction:
`withGuards` accepts `GET` only and there is no writing call to Airtable
anywhere in the codebase.

Port 3000 is a common collision. `PORT=3001 npm run dev:api` moves the server,
but the proxy target in `vite.config.ts` is hardcoded and has to move with it.

## Scripts

| | |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run dev:api` | local `api/` functions (see above) |
| `npm run build` | `tsc -b` across four projects, then `vite build` |
| `npm run lint` | ESLint over `**/*.{ts,tsx}` |
| `npm run preview` | serve the production build |

There are no tests and no CSS linting. Visual changes are verified by running
the app.

## Brand

The visual identity follows the azMEBLOPŁYT brandbook. It is not in this
repository; what it mandates lives as tokens at the top of `src/index.css`:

- **`#C21834`** red — a rare, deliberate accent. In this app it is carried by
  prices, the header rule and the scan line, and nothing else.
- **`#1B1B1B`** ink and **`#E8E7DE`** sand — the base pair.
- Montserrat, self-hosted via `@fontsource-variable/montserrat`. Do not move it
  back to Google Fonts: the CSP in `vercel.json` blocks external stylesheets
  and font files, which is why the app silently rendered in `system-ui` before.
- Sharp corners (`--azm-radius: 0`), uniform 2px strokes, no shadows and no
  gradients.

`src/assets/logo-poziome.png` is the secondary horizontal version, which the
brandbook assigns to web headers. Clear space around it is derived from
`--azm-logo-aspect` and `--azm-logo-clear` rather than hand-tuned, because the
rule is "the height of the monogram" and the monogram is 54% of the logotype
height in this version.

## Kiosk constraints

The target device is a portrait tablet at roughly 768px CSS width, operated by
finger, read from about a metre away by a standing customer. Hence:

- a fluid type scale (`--fs-*` in `src/index.css`) sized for that distance,
  rather than breakpoints — an earlier `max-width: 768px` block meant for
  phones was *shrinking* the text on exactly this device;
- 48px minimum touch targets on the calculator chips;
- the price pinned to the bottom of the screen on the worktop view, because it
  is the one number the customer came for.

### Kiosk mode

Left alone, the kiosk sits on the previous customer's product with nothing
saying another sample can be scanned. So after 90 seconds with no activity a
product page warns for 10 seconds — a countdown the customer can cancel by
touching the screen — and then returns to the welcome screen, which does say
it (`KioskGuard`, `useIdleTimeout`).

This is deliberately *not* shared with a customer's phone. There it would be
sabotage: the customer scanned a sample with their camera, is reading the
spec, and the page would vanish onto a screen asking them to scan a QR code
they have no scanner for.

So the timer runs only when `isKiosk()` (`src/lib/kiosk.ts`) says so:

- **`/?kiosk=1`** — the URL the kiosk app launches the tablet at every
  morning. The flag persists in `localStorage` under `azm:kiosk`.
- **`/?kiosk=0`** — the escape hatch, for a device marked by mistake. There is
  no button for this on purpose: a button a customer could press is a button a
  customer will press.
- **A keyboard-wedge scan** promotes the current session to kiosk mode even
  without the flag, since no phone can type a whole URL in a few milliseconds.
  Session-only, deliberately: it is a fallback for a tablet that was set up
  without the query parameter, not a second source of truth.

The tablet's screen is kept lit by the kiosk app's own "never sleep" setting,
so there is no Wake Lock code here and there should not be.

## Deployment

Vercel. `vercel.json` holds the SPA rewrite and the security headers, including
a strict CSP — `default-src 'self'` with no external origins. Everything the
page needs is served from its own origin.
