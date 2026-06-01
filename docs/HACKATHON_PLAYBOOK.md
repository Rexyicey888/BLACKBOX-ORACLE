# BlackBox Oracle Hackathon Playbook

## Core deduction from the CDR docs

CDR is strongest when the app makes secrecy programmable. For BlackBox Oracle, the product should not be "store encrypted text." The product should be "private data can answer, sell, license, or reveal itself only when an on-chain condition says yes."

The first app milestone uses owner-only CDR vaults because it proves the core cryptography path quickly:

- initialize CDR WASM once
- connect a funded Aeneid wallet
- allocate a vault
- encrypt the secret locally against the global public key
- write the encrypted payload on-chain
- request validator partials through `accessCDR`
- recover the secret only when the read condition passes

The prize version adds a custom read condition:

- creator seals data in a vault
- creator configures `BlackBoxAccessCondition`
- buyer pays `buyAccess(uuid)`
- buyer calls CDR read
- validators confirm the read condition and release decryption partials

## What I need from you

1. A browser wallet such as MetaMask.
2. A funded Story Aeneid testnet wallet.
3. A second wallet for buyer testing.
4. One memorable secret dataset for the demo.
5. Your hackathon registration and Discord access.
6. Permission to deploy the condition contract when we reach that step.
7. A 45-90 second demo video recording near the end.

Do not paste private keys into chat. We can keep the main app wallet-based.

## Recommended demo dataset

Use something that feels strange but harmless:

- "The Anti-Resume Oracle": private founder evaluation notes that return one verdict.
- "Leakless Alpha Desk": private market research that sells one synthesized answer.
- "Ghost Co-Founder": an agent memory vault that reveals one hidden decision rule.

My pick is The Anti-Resume Oracle because judges understand it instantly and it still feels weird.

## Sprint schedule

May 27:
App scaffold, CDR SDK integration, first UI, owner-only CDR proof path.

May 28:
Connect your funded wallet, create a real vault, read it back, capture tx hashes.

May 29:
Test the deployed `BlackBoxAccessCondition`, create one paid oracle, and capture tx hashes.

May 30:
Add buyer flow: pay, unlock, request CDR decryption.

May 31:
Two-wallet test: seller creates, buyer pays, buyer reads, non-buyer fails.

June 1:
Polish UI, story, metadata, screenshots, README.

June 2:
Record demo video and prepare submission copy.

June 3:
Submit. This is the real deadline.

June 4:
Judging buffer and live-demo practice.

## Pitch

BlackBox Oracle turns private data into a programmable market object. Sellers do not sell raw data. They sell access to answers, proofs, or unlocks controlled by CDR read conditions.

Tagline: Sell the value of private data without selling the private data.
