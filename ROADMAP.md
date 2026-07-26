# SubTracker Roadmap

## Next Up

These features are committed for the next development phase, but are not in
active implementation yet.

### 1. Transaction Rules Engine

Automatically normalize and classify incoming transactions using user-managed
rules.

Initial scope:

- Match merchant or description text, amount, account, and transaction source.
- Rename merchants and assign expense categories or income sources.
- Classify known transfer patterns, such as Zelle and credit card payments.
- Preview affected transactions before enabling a rule.
- Apply rules to new transactions and optionally to existing history.
- Preserve the original imported description and record which rule made a change.
- Support rule priority, enable/disable, edit, and delete.

The rules engine should be shared by manual imports and future bank syncs so
classification behavior stays consistent.

### 2. Automatic Bank Sync with Plaid

Connect financial institutions and continuously import balances and
transactions.

Initial scope:

- Plaid Link onboarding and account mapping.
- Encrypt access tokens on the server; never expose them to the browser.
- Webhook-driven transaction updates with a safe manual refresh fallback.
- Idempotent imports using provider transaction IDs.
- Handle pending-to-posted updates and removed transactions.
- Preserve import provenance and sync timestamps.
- Route new transactions through the rules engine.
- Prevent duplicate records across Plaid, CSV/PDF imports, and manual entries.
- Keep internal transfers out of income and expense totals.
- Provide sync health, connection repair, and disconnect controls.

## Recommended Sequence

1. [x] Define the normalized transaction and provenance contract.
2. [ ] Build the rules engine and test it against existing imported history.
3. [ ] Add Plaid in sandbox mode.
4. [ ] Add webhook processing and transaction review.
5. [ ] Validate duplicate and transfer handling before enabling production sync.

The normalized contract is now the boundary for Chase and Bank of America CSV
imports. Provenance stores the source, original description, import hash,
currency, raw source metadata, and owning user so future rules and bank syncs
can share the same ingestion path.
