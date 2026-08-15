# Prash & Ki — storefront

Customer storefront and admin dashboard for Prash & Ki.

```
Next.js 16 (App Router, React Server Components) · TypeScript · Tailwind CSS v4
```

Requires the API to be running: **[prashki-backend](https://github.com/02Jawahar/prashki-backend)**.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then edit it
npm run dev
```

Storefront at **http://localhost:3100**, admin at **/admin**.

The API must be up first — the app degrades gracefully if it is not (fallback
navigation, empty grids), but nothing will actually work.

---

## Environment

| Variable | |
|---|---|
| `NEXT_PUBLIC_API_URL` | Browser → API, e.g. `https://api.example.com/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL, used by sitemap and robots |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Publishable key id **only** |
| `API_URL` | Server-side rendering → API; use the internal address in production |

> `NEXT_PUBLIC_*` values are inlined into the browser bundle at **build** time.
> On a container platform they must be **build args**, and changing one requires
> a rebuild. Setting them as runtime environment variables silently has no
> effect on client-side code.
>
> Nothing secret belongs in this repository. The Razorpay key **secret** and
> webhook secret live in the backend.

---

## Layout

```
src/
├── app/
│   ├── (storefront)/     home · products · categories · cart · checkout
│   │                     account · login · register
│   └── admin/            login, then a guarded (dashboard) route group
├── components/
│   ├── ui/               buttons, fields, badges, empty and loading states
│   ├── storefront/       header, footer, product card, gallery, cart drawer
│   └── admin/            sidebar, product form, media picker
├── services/             api-client + one service per domain
├── hooks/                use-auth · use-cart
├── lib/                  money · utils · server-auth · product-query
├── types/                API response types
└── styles/               design tokens
```

### Conventions

**One API client.** Everything goes through `services/api-client.ts` — no stray
`fetch()` in components. It handles cookies, transparently refreshes an expired
access token once, and normalises the error envelope.

**Money arrives as integer paise** and is formatted in `lib/money.ts`. Never
format prices inline.

**Server components by default.** `'use client'` only where interactivity
genuinely requires it — cart, forms, filters, admin screens.

**Admin permission checks are cosmetic.** `can('product.create')` hides controls
the user cannot use. The API independently enforces every one of them; hiding a
button is not security.

---

## Design system

Tokens live in `src/styles/globals.css`. Layout rhythm, type scale and the 2:3
portrait product crop follow the reference the brand was designed against.

| | |
|---|---|
| Brand sage | `#838E5E`, ramp `sage-50` → `sage-900` |
| Ink / muted | `#212121` / `#646464` |
| Display / body | Cormorant Garamond / Jost |
| Radius | `3px` |

**One accessibility constraint worth keeping.** The brand sage measures only
**3.50:1** on white — fine for large display type, borders and icons, but it
fails WCAG AA for body text. Anything small or interactive uses **`sage-700`
(`#5B6241`, 6.43:1)**. That is why buttons are `sage-700` and not the logo green;
please don't "fix" them back.

---

## Commands

```bash
npm run dev         # dev server on :3100
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
```

---

## Deployment

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://shop.example.com \
  --build-arg API_URL=http://backend:4000/api/v1 \
  -t prashki-frontend .
```

Two things that catch people out:

1. **Build args, not env vars** — see the note above.
2. **The storefront and API should share a registrable domain**
   (`shop.example.com` + `api.example.com`). Sessions are httpOnly cookies set by
   the API; subdomains of one domain are same-site, so the cookie travels. On
   unrelated domains logins appear to succeed and then immediately fail.

Full walkthrough lives in the backend repository's `DEPLOYMENT.md`.
