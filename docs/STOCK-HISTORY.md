# Stock evidence history

Inventory → Stock history is a manager-only, read-only journal for the current
branch. It captures changes to inventory_counts, inventory_purchases, waste_log
and stock_transfers. Both branches can see a transfer's evidence. The existing
source-table RLS still decides who may perform the original action.

Each event retains source ID, before/after values, authenticated actor and audit
time. Capture runs in the source transaction: an audit failure rolls back the
source write. A no-op update creates no event. This does not deduplicate two
separately submitted deliveries; they remain separate source records.

The capture function is a revoked, private-schema trigger, deliberately using
definer privileges so callers cannot insert their own journal entries. Journal
writes are unavailable to browser and service clients. Immutable triggers also
reject updates/deletions/truncation; source-table TRUNCATE is blocked because it
would bypass row capture. Database owners can still alter schema: this is not
external tamper-proof storage.

Deployment takes a short write lock while copying existing rows as BASELINE
snapshots and installing capture. These snapshots have no verified actor or
historical audit time. Rows with no branch cannot be scoped and are excluded.
Earlier modifications/deletions cannot be recovered from current source tables.
Counts are observations, not receipts or inferred adjustments. Transfer status
changes are workflow evidence, not proof of a reconciled running balance.

The UI uses ID keyset pagination, 100 records per page, source-type filtering,
explicit empty/error states and Berlin audit times. Source dates remain visible
in evidence details. It does not report food consumption cost, valuation or profit.

Verification: `node scripts/checks/stock-history.cjs` applies the real migration
to isolated PostgreSQL; `node scripts/checks/stock-history-ui.cjs` executes the
actual query and component. CI runs both. No real stock is entered/deleted for tests.

Rollout: test migration with BEGIN/ROLLBACK against the intended linked project,
apply once through migration history, then release UI after exact-head CI.
On UI failure roll back the application deployment while retaining evidence.
If capture rejects valid authenticated writes, investigate the transaction and
actor context; do not disable audit triggers or discard history to hide errors.
