# BlackBox Oracle

BlackBox Oracle is a CDR hackathon project for Idea 06: go weirder.

The product: a marketplace for sealed insight drops. A creator or anonymous tipster seals one valuable answer in a Confidential Data Rails vault. Buyers unlock the answer, while the raw notes, files, screenshots, or source trail stay private.

## Target audience

BlackBox Oracle is designed for private insight sellers: niche researchers, creator-economy insiders, anonymous tipsters, and community operators who know something valuable but do not want to expose the full source material. The buyer is someone who wants the useful verdict, signal, or tip without receiving extra sensitive context.

Example drops:

- A private deal signal from diligence notes.
- A behind-the-scenes creator sponsorship tip.
- A blind-item style entertainment tip with the receipts still sealed.

## What works first

- React app shell for browsing and creating sealed insight drops.
- Wallet connection to Story Aeneid testnet.
- CDR WASM initialization.
- Owner-only CDR vault creation with `allocate`, `encryptDataKey`, and `write`.
- Owner-only CDR reveal with `accessCDR`.
- Verified `BlackBoxAccessCondition` source/deployment history on Story Aeneid.
- Paid CDR vault wiring is present, but the final public demo uses owner-only CDR until the updated contract is redeployed.

## Deployed contract

- Network: Story Aeneid Testnet (`1315`)
- Contract: `BlackBoxAccessCondition`
- Status: redeploy required after the June 2 security fix.
- Reason: the paid-access contract now keys listings by `(vault UUID, owner)` and `buyAccess` requires the owner address.

## Public app

- Production: https://blackbox-oracle.vercel.app
- The production frontend uses `/api/cdr` as an HTTPS same-origin proxy for the CDR Story API, so browsers do not block CDR requests as mixed content.

## Email dashboard

`Launch App` asks for an email and immediately opens the dashboard. The email is a demo-session label only; wallet approvals and CDR read conditions are the security boundary.

## Backend database

BlackBox Oracle can persist entered emails and created vault listings through Neon Postgres on Vercel. Add `DATABASE_URL` in Vercel, redeploy, and the API creates the required tables automatically. Local demo listings still work in browser storage.

## Hackathon path

1. Ship owner-only CDR proof: prove that secret data is encrypted, written, and recovered through CDR.
2. Record a short demo with a real dataset, CDR vault creation, and owner-wallet reveal.
3. If the updated contract is redeployed, test the paid buyer flow with a second wallet.
4. Capture tx hashes for seal/write/reveal, plus configure/buy if paid flow is restored.
5. Prepare final submission copy and screenshots.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` if you want to override the public Story RPC or Story API endpoint.
