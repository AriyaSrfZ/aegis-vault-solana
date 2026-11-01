# claude advisor artifact

- Provider: claude
- Exit code: 0
- Created at: 2026-11-01T20:01:35.265Z

## Original task

You are building Aegis-Vault: Dual-Lock AI Prompt Defense Game.
Description: On-chain prompt injection challenge with dual-lock AI judge (Warden + Referee) and atomic 70/30 Solana Pay transaction request fee splitting.
Operator: Ariya Sarrafzadeh (Zero-KYC target wallet: 2nNtE6uEJQjX5vN1cS1m4FBRDuxxqq2hwmtFqn92xkNd).
Deliver a minimal, complete, working implementation:
1. Core business logic file
2. Unit test file with passing assertions
3. Production README.md
Keep it ultra-lean (no bloat), production-verified, and drop-in runnable.

## Final prompt

You are building Aegis-Vault: Dual-Lock AI Prompt Defense Game.
Description: On-chain prompt injection challenge with dual-lock AI judge (Warden + Referee) and atomic 70/30 Solana Pay transaction request fee splitting.
Operator: Ariya Sarrafzadeh (Zero-KYC target wallet: 2nNtE6uEJQjX5vN1cS1m4FBRDuxxqq2hwmtFqn92xkNd).
Deliver a minimal, complete, working implementation:
1. Core business logic file
2. Unit test file with passing assertions
3. Production README.md
Keep it ultra-lean (no bloat), production-verified, and drop-in runnable.

## Raw output

```text
# Aegis-Vault v1: not built

**Nothing was saved or run, so this isn't production-verified.** This session denied every file write and `npm install` in `/home/aria/projects/aegis-vault-solana`, and it can't ask you for approval. I didn't work around that through the shell.

The folder holds only `CLAUDE_BLUEPRINT.md`, a full earlier draft whose code has never run. My review of it is below as fixes, labelled v1. All of them come from reading the code. The two test bugs would only show up when the tests run.

## Fixes to apply to the blueprint
1. **Prize theft (serious):** `recordPayment` accepts the newest transaction carrying the attempt's reference, and that reference is public once on-chain. A stranger can pay with the same reference and be recorded as the `winner`.
   - In `paymentTx`, lock the attempt to the first wallet:
     ```js
     const address = payer.toBase58();
     const bound = db.prepare('UPDATE attempts SET payer = ? WHERE id = ? AND (payer IS NULL OR payer = ?)').run(address, id, address);
     if (bound.changes === 0) throw httpError(409, 'attempt bound to another wallet');
     ```
   - In `recordPayment`:
     - Return `false` first if `a.payer` is empty.
     - Skip any transaction where `verifyPayment(...) !== a.payer`.
     - Stop writing `payer` in the `paid` update.
2. **Spam can hide a payment:** the limit of 20 signatures lets a stranger bury the real payment under cheap transactions. Raise it to `1000`.
3. **Two test bugs:**
   - `decodeTransfer` belongs to `SystemInstruction`, not `SystemProgram`.
   - The second assertion in the refusal test has misplaced parentheses. It should read `judge(fakeClient(OPEN, reply({}, 'refusal')), 'x')`.
4. **Test gaps:**
   - Tests must call `paymentTx` before `settle`, because attempts are now bound to a wallet.
   - Add tests for a stranger reusing the reference, and for a second wallet being rejected.
   - The blueprint has no HTTP test. Export `serve` so one can run the full flow and sign the returned transaction.

## Decisions
- **Location:** use the existing `aegis-vault-solana` folder, not the blueprint's `aegis-vault` path.
- **Split:** 70% goes to the prize vault and 30% to your wallet. You didn't specify the direction, so this is my assumption.
- **Second wallet:** `VAULT_WALLET` is required and must be different from your wallet.
- **README name:** `README_v1.md`, because your versioning rule overrides the requested `README.md`.
- **Vault deliverable:** this session can't reach `~/ObsidianVault/output`, so nothing goes there yet.

## Risks that remain after the fixes
- **Judging isn't on-chain:** only the payment is, so players must trust your server's verdict. Don't market it as on-chain judging.
- **Legal:** paid entry for a prize can count as gambling, and a no-KYC wallet doesn't remove that obligation. Get legal advice before taking real money.
- **Fairness:** the win rate is unknown, and the game may be close to unwinnable. Measure it with free test attacks before charging anyone.
- **Payouts:** winners and refunds are paid by hand, because the vault key stays off the server.
- **Model requests:** the `fallbacks` and `output_config` shapes come from the skill summary and haven't been tried against the live API. With fallback on, another model could judge some attempts.

## Recap
- **Found:** the unverified blueprint, one prize-theft bug, one spam weakness and two test bugs.
- **Created:** no files. The only output is this v1 fix list, in chat.
- **Verified:** nothing. Neither the operator wallet address nor the `decodeTransfer` fix has been checked, because that check was denied too.

**Next step:** rerun this request with write and `npm` permission for `/home/aria/projects/aegis-vault-solana`. Even then, passing tests would use a fake chain and fake Claude, so taking real money still needs a devnet wallet payment and one live model call.

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
