# BlackBox Oracle Backend Security Review

Date: 2026-05-31

## Summary

The most sensitive data is protected by CDR and wallet-controlled read conditions, not by the email dashboard gate. A user who bypasses the frontend email screen still should not be able to decrypt a CDR vault unless their wallet satisfies the on-chain read condition.

## Fixed In This Pass

### Email-code auth

- Production now requires `APP_AUTH_SECRET` to be set to a 32+ character secret.
- Production no longer falls back to a hardcoded signing secret.
- Launch-code requests are rate-limited per IP and per email.
- Code verification attempts are rate-limited per IP and per challenge.
- Auth errors fail closed and return JSON instead of a generic Vercel function error.

### CDR API proxy

- Proxy now allows only the CDR REST paths needed by the SDK:
  - `/dkg/latest_active`
  - `/dkg/dkg_network`
  - `/dkg/global_public_key`
  - `/dkg/registrations`
  - `/dkg/registrations/verified`
  - `/dkg/cdr_partials`
- Proxy rejects path traversal and absolute URL attempts.
- Proxy no longer accepts POST requests.
- Proxy forwards only minimal request headers instead of user cookies or authorization headers.
- Proxy responses are marked `no-store`.

## Required Production Configuration

Set these in Vercel before real users can launch the dashboard:

- `APP_AUTH_SECRET`: random 32+ character secret.
- `RESEND_API_KEY`: Resend API key.
- `AUTH_FROM_EMAIL`: sender on a verified Resend domain.
- `AUTH_DEMO_CODES=false`.

Without `APP_AUTH_SECRET`, the email-code endpoint intentionally fails closed.

## Remaining Risks

### Email gate is not the true security boundary

The email-code dashboard gate is a product/login layer. It does not protect CDR secrets by itself. CDR read conditions and wallet ownership are the true security boundary.

### Stateless rate limits are best-effort

Vercel serverless instances do not share memory reliably. The current in-memory rate limits reduce casual abuse but are not as strong as Redis-backed rate limiting. For production scale, use Upstash Redis, Vercel KV, or another shared rate-limit store.

### Public metadata is editable locally

Marketplace listings are stored in browser `localStorage`. Treat listing metadata as untrusted display data. This is acceptable for the demo because private answers are not stored there.

### Dependency audit

`npm audit` reports:

- Vite/esbuild development-server advisories. The app binds local dev to `127.0.0.1`, and production is served as static assets on Vercel, so this is lower risk for the deployed hackathon app.
- `solc` pulls a vulnerable `tmp` transitive dependency. `solc` is a dev/build tool for contract compilation, not part of the public app runtime.

Avoid exposing the local dev server publicly. Do not use tunnels to share `npm run dev`; share the Vercel deployment instead.

## What Would Be Needed For Stronger Production Security

- Redis-backed rate limiting for auth endpoints.
- Real session cookies after email verification, with `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Server-side persistence for user/vault metadata instead of localStorage.
- A narrower CDR proxy if the SDK path requirements change.
- Dependency upgrades after confirming Vite major-version compatibility.
