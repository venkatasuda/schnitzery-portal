# Schnitzery backlog — open work

Updated 8 November 2026. One list for everything still open (Claude + Codex + team). Tick items off here when done.

## Code (Claude)
- [x] **C4 — instant refusal on manager pages.** `src/proxy.ts` + `src/lib/auth/manager-paths.ts`: plain staff opening a manager page go straight to `/no-access`; shift leaders keep `/inventory/counts`. *(built 8 Nov, release pending)*
- [x] **C5 — keyboard-only pass** (9 Nov, staging): skip link, visible focus, Tab through Workplace, Esc closes dialogs with discard guard, first field focused in dialogs — OK. Fixed: progress ring was a focusable unlabelled chart (now one labelled image).
- [x] **E2 — end-of-day close:** `/day-close` + migration `20261109090000_day_closes.sql` (built 9 Nov; staging test + release pending).
- [x] **E3 — hygiene logbook PDF:** `/compliance/logbook` (managers), print layout → "Save as PDF" (built 9 Nov; staging test + release pending).
- [ ] **E4 — shift swaps** with manager approval and Mindestlohn / Minijob / rest-time checks.
- [ ] **E5 — prep targets suggested from history** (prepared vs. left over).
- [ ] **E1 — food cost per dish** (recipe vs. actual) — blocked by missing prices (see Team data).
- [ ] **D — load test** on a Supabase test branch (50 → 500 → 2,000 simulated users), after more real usage.
- [ ] **Switch the app to Supabase publishable/secret API keys** — required before the legacy JWT secret can ever be revoked. Do NOT revoke it before.
- [ ] Later: POS/till provider integration, AI invoice reading (provider choice first).

## Data (team / Venky — Claude does not write production data)
- [ ] **C6 — catalogue tidy-up:** do NOT bulk-rename units (KG / Kg / kg): products are matched case-sensitively by name + category + unit, so renaming would cut them off from past counts, deliveries, batches and waste. Rule from now on: **new products always "kg" / "l" / "Stk."**. Drinks without a unit: give them a unit via Catalogue → Edit only when they start being counted (the app archives and replaces the product cleanly).
- [ ] **C7 — pause prepared food in the stock catalogue** (Fleisch paniert, Krautsalat, Käsesoße, Käse gerieben, Mango Curry) after 1–2 weeks of using the prep list.
- [ ] **Switch on Stuttgart shift leaders:** Wajidi, Pritesh, Venkata Nagendra Reddy Suda, Alfredo (Prep planning → Setup). Check: `select u.full_name from shift_leaders s join users u on u.id = s.user_id`.
- [ ] **Push keys** in Vercel (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) if phone push should work.
- [ ] **First full stocktake in Stuttgart** (76 products never counted; blocks the valuation close).
- [ ] Answers: cheese-sauce version for Stuttgart (Berlin ¼ butter/40 g pepper or Munich ½/60 g); cheddar 184 kg/week (prep list) vs 144–168 kg (sauce) — separate uses or double count?
- [ ] Prices: chicken, Paniermehl (aro 1 kg, Metro 131243), Schnitzel seasoning, Kerrygold cheddar (~2.5 kg block), flour (aro Type 405, Metro 61224).
- [ ] Older: Ermin two-branch setup (Munich + Stuttgart), Ekta's wage, DATEV numbers from the tax advisor, real payslip test, shift templates for Cashier/Dishwashing, "Pommes/Fries" category.

## Codex (when access is back)
- [ ] Migration history repair: `supabase migration repair --status applied` for the 8 hand-applied versions.
- [ ] Review Claude's inventory changes (Phase 2, prep list, shift leaders). **Note:** migration `20261108150000_shift_leader_inventory.sql` swapped one permission clause in `private.edit_inventory_count`, `private.resolve_stock_batch_expiry` and `private.inventory_operation`. Any future redefinition of these functions must keep the `private.is_shift_leader(...)` part.
- [ ] Purchasing tab race fix was applied by Claude (no `replaceState` when the URL is unchanged) — confirm with repeated e2e runs.

## Done recently (for reference)
Phase 0 (speed), Phase 2 (11 fixes), Phase 3 deploy, team checklists, prep list + history + setup, shift leaders + mobile Inventory tasks, new employee start page, Phase C1–C3 (clean manager start page, valuation cost suggestion, prep-list push).
