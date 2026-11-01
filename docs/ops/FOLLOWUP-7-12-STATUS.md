# Follow-up items 7–12

Item 7 checked through 2026-10-30. Other items retain their last recorded status below.

| Item | Evidence and remaining work |
| --- | --- |
| 7 — post-merge live checks | Completed for the named acceptance checks: owner HQ dashboard, branch switching, production permission attacks, three-failure login lock, direct Auth bypass denial and owner unlock recovery. See the dated evidence below. This is not an exhaustive security audit. |
| 8 — CAPTCHA | Not implemented or activated. Requires the chosen provider's site key and server-side Supabase configuration. |
| 9 — kiosk offline token window | Pending the offline-duration requirement. No arbitrary shorter window has been applied. |
| 10 — transfers and batches | Production guards and verification recorded in INVENTORY-OPERATIONS-IMPLEMENTATION.md. No production database mutation performed in this follow-up. |
| 11 — inventory formatting | Fixed remaining currency inconsistencies in overview, order draft and saved-order unit prices by reusing formatEur. Totals retain cents, unit prices retain up to four decimal places, English/German follow the selected app language. Reviewed calendar-date displays use fmtDay; inventory event timestamps explicitly use Europe/Berlin. Not a claim of exhaustive visual sign-off. |
| 12 — automatic POS integration | Not implemented; provider and integration access are unknown. |

Verification: format and Berlin-calendar suites passed (15 tests across two files); inventory UI and operations regressions passed. PR #66 passed the complete CI gate: TypeScript, production build, unit/coverage, security/UI and atomic database regression steps. CodeQL and secret scanning also passed. PR merged as `5e209d559030eb3775167e513d71e88c2229cf30`.

Production deployment `dpl_EX6WhzgDrB1PggeatLKL9mFXU9dE` is READY and assigned to https://schnitzery-portal.vercel.app/. Post-deploy HTTP smoke checks passed. No error/fatal runtime log records were returned for this deployment during the immediate release check; this short observation does not prove all signed-in workflows. No production accounts were intentionally locked and no business records were edited during this release.

## Demo-owner browser follow-up, 2026-10-29

User-provided demo owner login and the live HQ dashboard passed (19 branches). Testing the branch picker exposed stale client inventory state after switching branches: the selector changed but the previous branch's catalogue remained until reload. PR #67 keys the shared page subtree by user, active branch and HQ/branch mode so a context change resets page data and drafts. Its runnable layout check passed. CI also exposed overlapping offline attendance test samples dependent on wall-clock hour; the fixture now uses a fixed past morning, preserving the existing overlap/chronology assertions. The corrected offline check and the full CI gate passed.

PR #67 merged as `2a25e2078831bafef5901ba689144c32c8512ef4`; production deployment `dpl_3p4xGdSx22cJ93F3ymc357Q7qjzp` is READY on the public domain. Live owner verification passed Stuttgart (75 products) → Charlottenburg (0 products) → Stuttgart without manual reload, then returned to the HQ dashboard. No business records were changed. Demo credentials are local and Git-ignored, not in this document. Live login-lockout and a fresh authenticated direct-database attack check remain unperformed; item 7 is still partially complete overall.

## Login lockout and database acceptance, completed 2026-10-30

- Production SQL attack check `supabase/tests/production_demo_permissions.sql` passed as the actual `authenticated` role with the demo staff identity, not as an unrestricted administrator. Own-profile visibility was a positive control. Cross-branch user reads, self-promotion, self branch reassignment, batch quantity/expiry rewrite grants, batch deletion grants and the internal notification sweep were denied. All attempted database writes were rolled back. The production role guard returned `You cannot change roles.`; the test accepts only the known denial messages, not arbitrary failures.
- A real demo staff password login through the public Supabase API passed. Its JWT could read its own profile and could not read users from another branch. Tokens were neither printed nor saved.
- The live portal rejected three intentionally incorrect demo staff passwords. A subsequent correct password was rejected with the locked-login message. Direct Supabase Auth login with the correct password also failed with `user_banned`; both the application lock and active Auth ban were confirmed in production.
- The demo owner selected Stuttgart and used the normal staff-management **Unlock login** action. The UI showed `Login unlocked`; production confirmed `login_locked=false` and no active Auth ban. Direct login with the original demo password succeeded afterward, and cross-branch API reads remained denied.
- The previous attempt on 2026-10-29 stopped after its first wrong password when automatic approval review hit an account usage limit. The 2026-10-30 run completed the sequence. Only the supplied demo staff account was intentionally locked and restored; no employee passwords, payroll, attendance or stock records were changed.

Item 7's named checks are now complete. This does not claim exhaustive penetration testing, a 40-attempt shared-IP stress test, or timed verification of the automatic 15-minute expiry. CAPTCHA/POS integration and independent kiosk work are outside this acceptance run.
