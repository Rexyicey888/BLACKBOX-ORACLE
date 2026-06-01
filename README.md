# BlackBox Oracle

BlackBox Oracle is a CDR hackathon project for Idea 06: go weirder.

The product: a marketplace where a creator seals private data in a Confidential Data Rails vault. Buyers can ask for the value of that data, satisfy an on-chain access condition, and unlock only what the vault allows.

## What works first

- React app shell for browsing and creating sealed oracle listings.
- Wallet connection to Story Aeneid testnet.
- CDR WASM initialization.
- Owner-only CDR vault creation with `allocate`, `encryptDataKey`, and `write`.
- Owner-only CDR reveal with `accessCDR`.
- Verified `BlackBoxAccessCondition` deployment on Story Aeneid.
- Paid CDR vault creation, listing configuration, buyer payment, and gated reveal wiring.

## Deployed contract

- Network: Story Aeneid Testnet (`1315`)
- Contract: `BlackBoxAccessCondition`
- Address: `0x3eA6aeCd0B42300208D6d6880aA6CA16d5Ad91Bf`
- Deployment tx: `0x10bcfd34c8a486ea256162eaf4b577bad0130e5a34fa5cd1e0d648f6bbf2129f`
- Sourcify: https://repo.sourcify.dev/1315/0x3eA6aeCd0B42300208D6d6880aA6CA16d5Ad91Bf

## Public app

- Production: https://hackathon-vert-kappa.vercel.app
- The production frontend uses `/api/cdr` as an HTTPS same-origin proxy for the CDR Story API, so browsers do not block CDR requests as mixed content.

## Email launch codes

`Launch App` asks for an email, sends a 6-digit launch code, then unlocks the dashboard after verification.

Set these Vercel environment variables for real email delivery:

- `APP_AUTH_SECRET`: long random string used to sign launch-code challenges.
- `RESEND_API_KEY`: Resend API key for sending email.
- `AUTH_FROM_EMAIL`: sender address, for example `BlackBox Oracle <onboarding@yourdomain.com>`.

Production requires `RESEND_API_KEY`; without it, launch-code requests fail instead of unlocking the dashboard. Local development can opt into visible test codes with `AUTH_DEMO_CODES=true`.

## Backend database

BlackBox Oracle can persist verified users and created vault listings through Neon Postgres on Vercel. Add `DATABASE_URL` in Vercel, redeploy, and the API creates the required tables automatically. See `docs/BACKEND_SETUP.md` for the step-by-step launch checklist.

## Hackathon path

1. Ship owner-only CDR proof: prove that secret data is encrypted, written, and recovered through CDR.
2. Test the deployed `BlackBoxAccessCondition` with a creator wallet and buyer wallet.
3. Capture tx hashes for seal, configure, buy, and reveal.
4. Record a short demo with a real dataset and a paid unlock.
5. Prepare final submission copy and screenshots.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` if you want to override the public Story RPC or Story API endpoint.
