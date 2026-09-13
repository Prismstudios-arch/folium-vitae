# Sorrel

The plant app that tells you when it doesn't know.

Identifies plants from a photo, says honestly how confident it is, and gives
care advice that is curated rather than generated. Built against `SPEC.md`,
which is the contract — when this file and the spec disagree, the spec wins.

---

## What actually works

Everything listed here has been run and verified, not assumed.

| Area | State |
|---|---|
| Plant identification | Live, via the proxy. Real provider, real quota. |
| Health assessment | Live. Premium only. |
| Anonymous sign-in | Live. No account needed for a first scan. |
| Quota | Server-enforced, race-free, 7/day free tier. |
| Pre-flight photo checks | Real Laplacian variance and exposure analysis. |
| My Plants, journal, watering | Local SQLite. Works offline. |
| Care lookup | Real, with synonyms and genus fallback. |
| Paywall | Real store prices via RevenueCat. Not yet configured. |
| Legal pages | In-app and on the web, from one source. |

## What does not

- **Care database holds 4 species against a target of ~450.** This is the
  largest gap. The structure and validation are right; the data is not there.
- **The provider benchmark has not been run.** `SPEC.md` §11 puts it before
  app code: if accuracy on grasses and seedlings is no better than
  PictureThis, the positioning is wrong. See `benchmark/README.md`.
- **No cloud backup of a collection.** `SPEC.md` §2 wants a collection to
  survive a new phone; today it lives only on the device.
- **Expert escalation is not built.** The screen says so rather than
  simulating it.
- **Subscriptions cannot charge anyone yet** — App Store Connect products,
  RevenueCat configuration and keys are all still to do.

---

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go.

**Purchases do not work in Expo Go** — RevenueCat is a native module. The
paywall says so rather than showing invented prices. Everything else works.

### Backend

```bash
cd backend
npm install
npm run dev
```

Needs `backend/.env` (gitignored):

```
DATABASE_URL=postgresql://...        # Supabase, via the connection pooler
JWT_SECRET=...                       # 48+ random bytes
KINDWISE_API_KEY=...                 # server side only, never in the app
REVENUECAT_WEBHOOK_SECRET=...        # shared secret for the webhook
```

The direct `db.<ref>.supabase.co` host is IPv6-only and will not resolve on
most networks. Use the pooler host, and URL-encode any `&` in the password
as `%26`.

Migrations are tracked and safe to re-run:

```bash
node backend/run-migrations.js
```

---

## Commands

| | |
|---|---|
| `npm start` | Expo dev server |
| `npm test` | Watch mode |
| `npm run test:ci` | Once, with coverage |
| `npm run type-check` | `tsc --noEmit` |
| `npm run care:validate` | Check the care database and report coverage |
| `npm run legal:build` | Regenerate the public legal pages into `docs/` |
| `npm run assets` | Regenerate icon, splash and favicon |
| `npm run benchmark` | Run the provider accuracy benchmark |

Run `care:validate` and `legal:build` after editing their sources. The legal
build also runs on every Cloudflare deploy, so the web copy cannot drift from
the in-app copy.

---

## Layout

```
app/              screens (expo-router)
src/
  domain/         types with no framework imports
  services/       identification, camera, database, purchases, API client
  components/     shared UI
  content/        legal copy, rendered to both app and web
  data/           care database
  constants/      design tokens and config
backend/
  src/routes/     auth, identify, diagnose, quota, webhooks
  src/models/     database access
  migrations/     tracked SQL
benchmark/        provider accuracy harness
docs/             generated legal site
scripts/          asset generation, validation, site build
```

---

## Rules this codebase holds to

From `SPEC.md`, and worth keeping:

- **No fake data, ever.** No stubs returning invented results, no placeholder
  values dressed as real ones. When something cannot be done, the app says so.
- **The identification key never reaches the device.** Everything goes through
  the proxy.
- **Prices come from the store.** Never hardcoded, always localised.
- **Confidence is calibrated in one place** so the thresholds have one owner.
- **A failed scan costs no credit.**
- **Zero raw values in views** — colours and spacing come from the tokens.
