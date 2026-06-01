# BlackBox Oracle Backend Setup

## 1. Add Email Delivery

1. Open https://resend.com and sign in.
2. Go to **API Keys**.
3. Click **Create API Key**.
4. Name it `blackbox-oracle-vercel`.
5. Give it sending access.
6. Copy the key that starts with `re_`.
7. In Vercel, open your project, then **Settings > Environment Variables**.
8. Add:

```txt
RESEND_API_KEY=re_your_key_here
AUTH_FROM_EMAIL=BlackBox Oracle <launch@yourdomain.com>
AUTH_DEMO_CODES=false
```

Use a verified Resend domain for `AUTH_FROM_EMAIL` if you want to send codes to anyone.

## 2. Add The Database

1. In Vercel, open your project.
2. Go to **Storage** or **Marketplace**.
3. Add **Neon Postgres**.
4. Connect it to the BlackBox Oracle project.
5. Let Vercel add `DATABASE_URL` to Production.
6. Redeploy the app.

The app creates its own tables on first use:

- `blackbox_users`
- `blackbox_listings`

## 3. Local Pull

After adding secrets in Vercel, run:

```powershell
vercel.cmd env pull .env.local --yes
```

Then redeploy:

```powershell
vercel.cmd deploy --prod --yes
```
