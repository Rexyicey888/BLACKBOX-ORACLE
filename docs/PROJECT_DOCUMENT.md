# BlackBox Oracle Project Document

## Deadline And Goal

Submission deadline: June 3, 2026.

BlackBox Oracle is a CDR hackathon app for turning private data into programmable market objects. A creator seals a private answer in a Confidential Data Rails vault. A buyer sees only public metadata, pays or satisfies an on-chain condition, and can decrypt only if CDR validators confirm that access is allowed.

The strongest one-line pitch is:

Sell the value of private data without selling the private data.

## Product Shape

The app should feel like a marketplace for sealed answers:

1. Creator connects a Story Aeneid wallet.
2. Creator writes public listing metadata: title, category, tease, price, weird hook.
3. Creator writes the private answer.
4. The browser encrypts the answer locally through the CDR SDK.
5. The encrypted payload is written to a CDR vault.
6. Public listing metadata appears in the app.
7. Buyer connects a second wallet.
8. Buyer pays the access condition contract.
9. Buyer requests CDR decryption.
10. CDR validators check the read condition and release decryptable data only for allowed wallets.

## Current Codebase

### `src/App.tsx`

This is the main React UI. It owns the application state and renders:

- top wallet connect button
- project status pills
- hero section
- sealed oracle list
- selected oracle detail panel
- creator form
- status console

Important functions:

- `onConnect`: asks the wallet for an account and switches to Story Aeneid.
- `onSeal`: validates the creator form, creates a CDR vault, saves public metadata.
- `onReveal`: requests CDR decryption for a live vault.
- `copySelected`: copies public listing metadata.

`onReveal` supports both the owner-only fallback path and the paid read-condition path. Paid listings also expose `Buy Access`, save the buy transaction, and show StoryScan links for demo proof.

### `src/lib/cdr.ts`

This is the CDR and wallet integration layer.

Important pieces:

- `storyAeneid`: local viem chain definition for Story Aeneid testnet.
- `ensureCdrWasm`: loads the CDR WASM crypto runtime once.
- `getPublicClient`: creates a public RPC client.
- `getReadOnlyCdrClient`: creates a read-only CDR client for fee/status queries.
- `connectWallet`: requests wallet accounts and switches network.
- `ensureAeneidNetwork`: switches or adds Story Aeneid in MetaMask-compatible wallets.
- `getWalletCdrClient`: creates a CDR client with wallet signing.
- `getCdrFees`: reads CDR allocate/write/read fees.
- `sealOwnerOnlySecret`: allocates an owner-only vault, encrypts the secret, writes encrypted data.
- `openOwnerOnlySecret`: calls `accessCDR` and decodes the returned data key as text.

Current important note:

`sealOwnerOnlySecret` is still kept as a fallback demo path. When `VITE_BLACKBOX_CONDITION_ADDRESS` is configured, the app uses `sealPaidSecret` instead and allocates the CDR vault with `BlackBoxAccessCondition` as both read and write condition.

### `src/lib/oracles.ts`

This file defines public marketplace metadata.

The `OracleListing` type includes:

- public title/category/tease/price/weirdness
- optional owner address
- optional CDR vault UUID
- optional transaction hashes
- creation timestamp

The app uses `localStorage` for public listing metadata. It does not store private secrets in `localStorage`.

### `contracts/BlackBoxAccessCondition.sol`

This is the paid access condition contract. It implements the CDR write/read condition interfaces.

Important functions:

- `configureListing`: creator sets the listing owner and price for a vault UUID.
- `deactivateListing`: creator pauses new purchases for a listing.
- `reactivateListing`: creator turns purchases back on.
- `revokeAccess`: creator removes one buyer's read access.
- `buyAccess`: buyer pays the listing price for a specific vault owner and receives read access.
- `checkWriteCondition`: CDR asks whether a caller may write to a vault.
- `checkReadCondition`: CDR asks whether a caller may read a vault.

The design scopes `canRead` by `uuid`, `owner`, and `buyer`. This matters because CDR read condition data should encode the true vault owner. A malicious early configuration for the same UUID should not grant access to the real owner's vault.

`checkWriteCondition` deliberately decodes the owner from CDR `conditionData` instead of reading `listings[uuid]`. This is important because the app usually does not know the final CDR vault UUID until allocation succeeds. If write permission depended only on a listing that had to be configured before allocation, the paid flow could deadlock.

`buyAccess(uuid, owner)` uses a simple reentrancy guard, grants access before payment/refund calls, sends only the configured price to the owner, and refunds excess payment.

## Existing Build Status

The project builds successfully with:

```bash
npm.cmd run build
```

PowerShell may block `npm` directly because `npm.ps1` is disabled by execution policy. Use `npm.cmd` on this Windows machine.

The built app can be previewed with:

```bash
npm.cmd run preview -- --port 4173
```

Local preview URL:

```text
http://127.0.0.1:4173
```

## Current Paid Access Status

The paid access contract is compiled and wired into the app. It must be redeployed after the June 2 security fix.

- Network: Story Aeneid Testnet (`1315`)
- Contract: `BlackBoxAccessCondition`
- Address: set `VITE_BLACKBOX_CONDITION_ADDRESS` after redeploy

Confirmed locally:

- `npm.cmd run build` passes.
- `npm.cmd run compile:contracts` passes.

## Public Deployment

Production app:

`https://blackbox-oracle.vercel.app`

The deployed app is HTTPS. To avoid mixed-content blocking from the plain HTTP Story API endpoint, production builds use:

`VITE_STORY_API_URL=/api/cdr`

The Vercel function at `api/cdr.js` forwards same-origin HTTPS requests to:

`http://172.192.41.96:1317`

Confirmed after deploy:

- production page returns `200`
- `/api/cdr/dkg/latest_active` returns CDR network JSON
- deployed client bundle contains `/api/cdr`, not the raw HTTP upstream

## What We Need To Test Next

### 1. Two-wallet paid flow

Use a funded creator wallet and a funded buyer wallet.

Creator:

1. Connect wallet.
2. Create a live oracle with title, tease, price, and private answer.
3. Approve CDR allocate/write transactions.
4. Approve `configureListing`.

Buyer:

1. Switch MetaMask to the buyer account.
2. Select the creator's live oracle.
3. Click `Buy Access`.
4. Approve `buyAccess(uuid, owner)`.
5. Click `Request Decryption`.
6. Confirm the private answer appears.

Optional proof:

- Try a third wallet that has not bought access and show it cannot decrypt.

### 2. Confirm CDR condition-call behavior in the live test

Must confirm:

- `conditionData` should be `abi.encode(owner)`.
- `checkWriteCondition` receives the creator as `caller`.
- `checkReadCondition` receives the buyer as `caller`.
- CDR passes the same read condition data during `accessCDR`.
- CDR allocation accepts a custom write condition that validates from `conditionData`.

Contract concerns to keep in mind:

- UUID ownership cannot be discovered directly by this draft contract.
- The safety anchor is the `owner` encoded into CDR condition data.
- Access grants must be scoped by owner.
- Frontend must configure the same owner it used in the vault condition data.

### 3. Keep the paid CDR helpers stable

The paid helpers now exist beside the owner-only proof helpers:

- `sealPaidSecret`
- `configurePaidListing`
- `buyAccess`
- `openPaidSecret`

`sealPaidSecret` allocates a CDR vault with:

- write condition: `BlackBoxAccessCondition`
- read condition: `BlackBoxAccessCondition`
- condition data: ABI-encoded owner address

Then it encrypts and writes the secret like the owner-only path.

### 4. Polish buyer UI flow

The selected oracle detail panel now shows different actions:

- Owner can request owner/developer reveal.
- Buyer can buy access.
- Buyer can request paid decryption after buying.
- Mock listings should still say they need a live vault.

Useful UI fields:

- owner address
- vault UUID
- configure tx
- buy tx
- read tx
- StoryScan links for demo proof

### 5. Demo capture

The real demo needs:

- seller wallet creates vault
- seller configures price
- buyer wallet pays
- buyer decrypts
- non-buyer fails if we can show it cleanly

This is the proof judges will understand immediately.

## What We Should Work On Now

Immediate order:

1. Run one creator wallet live seal.
2. Confirm the created listing shows vault UUID and StoryScan links.
3. Run one buyer wallet purchase.
4. Confirm buyer decryption works.
5. Record the demo video once that flow succeeds.

Do not remove the owner-only flow yet. It is our backup demo path if paid access takes longer than expected.

## Required User Prep

The user needs:

- MetaMask or another EVM wallet.
- A funded Story Aeneid creator wallet.
- A funded Story Aeneid buyer wallet.
- One demo dataset/secret.
- Hackathon submission access.
- Permission to approve wallet transactions during tests.

Do not paste private keys, seed phrases, or wallet passwords into chat.

## Recommended Demo Dataset

Use The Anti-Resume Oracle.

Public listing:

The Anti-Resume Oracle is a private founder-evaluation rubric. Buyers can pay for one verdict, but never see the underlying notes.

Private answer example:

This founder is a "shipper under pressure": inconsistent polish, unusually high recovery speed, strong bias toward prototypes over planning.

Why this works:

- judges understand it quickly
- it is weird enough to remember
- it shows why raw data should stay private
- the answer has value without exposing the full dataset

## Security Notes

Current good signs:

- private secret is not saved in `localStorage`
- React escapes visible user text by default
- wallet interactions stay in browser wallet
- app currently binds Vite preview to localhost
- paid contract source compiles
- updated contract still needs redeploy before the final paid demo

Known risks:

- CDR custom condition encoding must be exact
- plain HTTP Story API may be a mixed-content issue on HTTPS deployment
- localStorage listings are public metadata only and should be treated as editable/untrusted
- transaction failure states may still need clearer wording before demo

The full source-code security review is scheduled for May 31, 2026 at 12:00 UTC.
