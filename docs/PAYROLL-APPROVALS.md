# Payroll approval and history

Final approval requires a completed calendar month in Europe/Berlin, approved attendance for every completed shift, valid clock-in/out intervals, and a finite nonnegative wage for every worked employee. Drafts retain pending and rejected completed shifts. Rejected records must be corrected and reviewed; they are never silently omitted from pay.

The manager reviews a source revision. The server calculates the snapshot using the existing minute and DST helpers. A service-only RPC verifies the manager's branch, locks the source tables, compares the revision again, checks prerequisites and inserts the approval and run in one transaction. Browser JWTs cannot invoke this RPC or write payroll runs or snapshots. Staff cannot read approval archives.

Approved summaries and exports use stored rows, totals and settings, without reading current wages or attendance. Reopening retains the previous approval. The month selector's recent approvals list allows read-only viewing and export of the last 50 snapshots. A stale reopening request is rejected. Updates and deletes of snapshots are rejected by a database trigger.

Legacy approvals have no recoverable historical snapshot and are labelled accordingly. No historical records are fabricated. Reopen and review before issuing a new frozen approval.

Remaining limitations: draft calculations use the current wage for the entire month; effective-dated wage history is still pending. Gross is base pay, excluding premiums, taxes and employer costs. Brief global source-table locks favor correctness at the current scale; branch revision triggers should replace them if measured contention requires it. Automated checks cover the actual query/UI and isolated PostgreSQL authorization, gates, stale revisions, rollback and immutability. They do not constitute a live payroll approval or a full staging-role test matrix.
