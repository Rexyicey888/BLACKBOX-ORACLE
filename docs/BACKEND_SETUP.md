# BlackBox Oracle Backend Setup

## 1. Email Flow

No email provider or verified domain is required for the hackathon demo.

`Launch App` asks for an email and immediately opens the dashboard. The email is only a demo-session label. Wallet connection, Story Aeneid transactions, and CDR read conditions are the actual security boundary.

## 2. Contract Redeploy

Redeploy `BlackBoxAccessCondition` after the June 2 security fix:

```powershell
npm.cmd run compile:contracts
npm.cmd run deploy:condition
```

Copy the new address into `.env` and Vercel:

```txt
VITE_BLACKBOX_CONDITION_ADDRESS=0x...
```

The old deployed contract does not match the updated `buyAccess(uuid, owner)` ABI.

## 3. Optional Database

The app can persist entered emails and created vault listings through Neon Postgres on Vercel.

1. In Vercel, open the project.
2. Go to **Storage** or **Marketplace**.
3. Add **Neon Postgres**.
4. Connect it to the BlackBox Oracle project.
5. Let Vercel add `DATABASE_URL` to Production.
6. Redeploy the app.

The app creates `blackbox_users` and `blackbox_listings` on first use.

Public listing writes are disabled by default. For the demo, browser-local listings are enough unless you need listings to persist across devices.

## 4. Deploy

```powershell
vercel.cmd deploy --prod --yes
```
