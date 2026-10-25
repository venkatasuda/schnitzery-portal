# Inventory: next capabilities and review boundaries

Updated 2026-10-24. This document is a proposal, not evidence that the capabilities below are implemented. Current release evidence is in [the implementation handoff](INVENTORY-OPERATIONS-IMPLEMENTATION.md).

## Make existing work understandable first

Keep the five existing areas. Do not add a new top-level tab for every feature.

| Area | Manager's question | Information to show |
| --- | --- | --- |
| Overview | What needs action today? | Uncounted items, below-target counts, outstanding orders, expiry alerts and unresolved discrepancies; branch, business date and freshness beside the figures |
| Stock | What do we hold and what should we order? | Product, base unit, last physical count/date, target, reorder point and minimum order; explicitly distinguish last count from current available stock |
| Purchasing | What did we order and actually receive? | Supplier, order status, expected date, outstanding quantity, accepted cost and receipt evidence |
| Movements | Why did this quantity change? | Source document, quantity/unit, actor, business date, recorded time, corrections and discrepancy reasons |
| Reports | What is reliable enough to decide on? | Coverage first; estimated valuation and measured usage with their price basis; withhold incomplete profit/food-cost claims |

Every alert should open the relevant filtered records. Never use green/zero to mean missing data. On mobile, keep essential identity and quantities visible and contain horizontal table scrolling. Show the next valid action on each order rather than every possible action.

## Advanced capabilities, in dependency order

### 1. Purchase packs and base-unit conversions

Example: one case contains six 1-litre bottles; receiving three cases posts 18 litres. A product keeps one immutable stock unit, with explicitly configured purchase-pack factors. Store both entered quantity/unit and converted quantity, and freeze the factor on the order and receipt. Block mixing mass, volume and pieces without a product-specific conversion. Never guess density or change historical conversion factors after an edit.

Acceptance: partial cases, fractional quantities, changed pack sizes, rounding, returns and idempotent receiving preserve the exact base quantity. Existing products and receipts need no reinterpretation.

### 2. Recipe versions and theoretical consumption

Define each sellable menu item's ingredient quantities, portions, yield and effective date. Import sold quantities, modifiers, voids and refunds from a named POS. Deduct or report ingredient usage using the recipe version effective at the sale time. A replayed POS event must not deduct stock twice. Keep theoretical consumption separate from physically measured consumption; their difference is a variance, not automatically theft or waste.

Acceptance: recipe edits do not rewrite old sales, unmapped menu items remain visible as missing coverage, and refunds/modifiers have explicit tested behavior. Comparing to actual stock requires matching count periods and branch scope.

### 3. Receipt-linked lots and expiry traceability

The current expiry register is not a complete lot ledger. Link a supplier lot to its accepted receipt line, base quantity, expiry date and location. Track allocations to waste, transfers, consumption and returns. Recommend first-expiring stock first; allow a reasoned override. A recall lookup must show both origin and every recorded destination, including cross-branch transfers.

Acceptance: partial lot usage leaves the correct remainder, rejected goods never create available lots, expired/held lots are excluded from available quantity, and total lot balances reconcile to their movement history. Do not claim recall coverage for unlinked legacy entries.

### 4. Returns, credits and supplier performance

Record return authorization, goods actually sent back and credit-note amounts separately. Link returns to accepted receipts and lots. Track supplier on-time delivery, fill rate, rejected quantities and price changes from actual evidence. Keep tax, gross/net prices, currency and invoice dates explicit.

Acceptance: a supplier credit does not silently move physical stock, and a physical return does not silently settle an invoice. Duplicate invoices/credits are rejected within the correct supplier and branch scope.

### 5. POS and accounting adapters

Choose the real POS and accounting provider before implementation. Required inputs: provider/API documentation, sandbox access, authentication method, branch identifiers, menu/product mappings and desired posting rules. Reuse the existing command/audit approach. Validate imports, preserve provider event IDs, make retries idempotent, and expose failed/unmapped records for review. Start with a previewable CSV import if the provider supports only exports.

Acceptance: an import replay cannot duplicate sales or accounting postings; partial failures remain recoverable; reconciliation totals match the provider. Supplier sending stays manual until an actual authorized delivery channel is configured.

### 6. Measurable production reliability

Measure response time and failure rates against a documented branch/product/movement workload. Exercise concurrent count completion, duplicate receipts, stale forms and authorization failures. Verify backup restore on a disposable database, migration compatibility, retention, monitoring and a rollback procedure. Database tests and a successful local build alone do not establish scale or disaster recovery.

## Review decision

Review the implemented release now; treat the capabilities above as separate future releases with their own migrations and acceptance evidence. Do not mark integrations, lot traceability, automatic recipe depletion, unit conversion or enterprise parity complete on the strength of a UI mockup or this document.
