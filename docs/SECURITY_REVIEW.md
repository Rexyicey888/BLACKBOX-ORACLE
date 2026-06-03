# BlackBox Oracle Security Review

Date: 2026-06-02

## Fixed

- Paid listings are keyed by `(vault UUID, owner)` in `BlackBoxAccessCondition`, preventing another wallet from locking a creator out of a UUID.
- Paid vault creation now configures the access contract before encrypted data is written.
- Buyer payments read the on-chain price before calling `buyAccess`.
- Paid prices must use a strict format such as `0.08 IP`; zero-price paid listings are rejected.
- Browser and backend listing metadata are validated before use.
- Public backend listing writes are disabled by default.
- The CDR API proxy validates its configured upstream origin.
- Email-code delivery and verification were removed. Email is now only a demo-session label.
- Vite was upgraded to remove the production dependency audit finding.

## Remaining Demo Requirements

- Redeploy `BlackBoxAccessCondition` and update `VITE_BLACKBOX_CONDITION_ADDRESS`.
- Fund creator and buyer wallets with Story Aeneid testnet IP.
- Record the demo using the deployed app, not a public tunnel to the dev server.

## Remaining Risks

- CDR and wallet conditions are the real security boundary. The email dashboard step is not authentication.
- `solc` still pulls a vulnerable `tmp` transitive dependency. This is a dev-only compiler dependency; it is not included in the production app audit.
- Browser-local listings are untrusted display metadata. Private answers are not stored in localStorage.
