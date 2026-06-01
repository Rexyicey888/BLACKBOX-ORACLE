# BlackBox Oracle Submission Guide

## Public Links

- App: https://hackathon-vert-kappa.vercel.app
- Verified contract: https://repo.sourcify.dev/1315/0x3eA6aeCd0B42300208D6d6880aA6CA16d5Ad91Bf
- StoryScan deployment tx: https://aeneid.storyscan.io/tx/0x10bcfd34c8a486ea256162eaf4b577bad0130e5a34fa5cd1e0d648f6bbf2129f

## One-Line Pitch

BlackBox Oracle lets creators sell access to valuable private answers without exposing the underlying private data.

## Short Description

BlackBox Oracle is a CDR-powered marketplace for sealed private answers. A creator encrypts a private answer into a Confidential Data Rails vault, configures a paid access condition on Story Aeneid, and publishes only public metadata. A buyer can pay the access gate, request CDR decryption, and recover the answer only if the on-chain condition allows it.

## What To Demo

1. Open the public app.
2. Click `Launch App`.
3. Enter an email and verify the launch code.
4. Connect the creator wallet on Story Aeneid.
5. Open `Dashboard`.
6. Click `Demo Template`.
7. Create a CDR vault.
8. Show the wallet/payment-gate panel:
   - wallet address
   - unlock price
   - payment gate
   - read condition
   - write condition
   - public tease
9. Show the live vault in `Recent BlackBoxes`.
10. Switch to buyer wallet.
11. Buy access from the market panel.
12. Request CDR decryption.
13. Show the recovered answer and transaction proof.

## Demo Dataset

Title:

`The Anti-Resume Oracle`

Public tease:

`A private founder-evaluation rubric. Buyers pay for one verdict, but never see the underlying notes.`

Private answer:

`This founder is a "shipper under pressure": inconsistent polish, unusually high recovery speed, and a strong bias toward prototypes over planning.`

## Judging Points

- Private answer is not stored in frontend localStorage.
- CDR encrypts locally and reveals only through `accessCDR`.
- Paid access is enforced by `BlackBoxAccessCondition`.
- Production site is HTTPS.
- CDR HTTP API is accessed through the same-origin `/api/cdr` HTTPS proxy.
- Launch flow uses an emailed code before the dashboard opens.

## Submission Copy

BlackBox Oracle turns private data into a programmable market object. A creator can seal an answer inside CDR, publish only a public tease and unlock price, and let a buyer pay an on-chain access gate before requesting decryption. The buyer gets the value of the answer, while the raw private dataset remains sealed.

## Final Checklist

- `RESEND_API_KEY` configured in Vercel.
- `APP_AUTH_SECRET` configured in Vercel.
- `AUTH_FROM_EMAIL` uses a verified Resend domain.
- Creator wallet funded on Story Aeneid.
- Buyer wallet funded on Story Aeneid.
- Demo vault created and read successfully.
- Demo video recorded.
