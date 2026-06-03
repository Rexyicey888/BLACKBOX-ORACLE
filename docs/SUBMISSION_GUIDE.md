# BlackBox Oracle Submission Guide

## Public Links

- App: https://blackbox-oracle.vercel.app
- Verified contract: https://repo.sourcify.dev/1315/0x3eA6aeCd0B42300208D6d6880aA6CA16d5Ad91Bf
- StoryScan deployment tx: https://aeneid.storyscan.io/tx/0x10bcfd34c8a486ea256162eaf4b577bad0130e5a34fa5cd1e0d648f6bbf2129f

## One-Line Pitch

BlackBox Oracle lets creators sell access to valuable private answers without exposing the underlying private data.

## Short Description

BlackBox Oracle is a CDR-powered marketplace concept for sealed private answers. A creator encrypts a private answer into a Confidential Data Rails vault and publishes only public metadata. The public demo proves the core CDR path: seal private data, write it to a vault, and recover it only from the approved wallet. Paid access wiring is present and can be restored after the updated condition contract is redeployed.

## What To Demo

1. Open the public app.
2. Click `Launch App`.
3. Enter an email to open the dashboard.
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
10. Request CDR decryption from the approved wallet.
11. Show the recovered answer and transaction proof.

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
- The public demo uses owner-wallet CDR read conditions while the updated paid contract awaits redeploy.
- Production site is HTTPS.
- CDR HTTP API is accessed through the same-origin `/api/cdr` HTTPS proxy.
- Email is a demo-session label; wallet/CDR conditions enforce real access.

## Submission Copy

BlackBox Oracle turns private data into a programmable market object. A creator can seal an answer inside CDR, publish only a public tease, and prove that the private answer can be recovered only through the CDR reveal flow. The buyer/payment gate path is wired for the updated access condition contract, while the final public demo prioritizes the reliable CDR seal-and-reveal proof.

## Final Checklist

- Public app is running in owner-only CDR mode.
- Updated `BlackBoxAccessCondition` redeploy is optional if a funded deployer key is added.
- Creator wallet funded on Story Aeneid.
- Buyer wallet funded on Story Aeneid.
- Demo vault created and read successfully from the creator wallet.
- Demo video recorded.
