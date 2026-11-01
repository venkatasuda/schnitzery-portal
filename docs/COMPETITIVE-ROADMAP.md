# Competitive roadmap (Nov 2026)

Compared against public docs and reviews of 7shifts, Toast IQ Team, Restaurant365, Planday,
Papershift and gastromatic. Ideas only: we build our own, from public feature descriptions —
no copied code, screens or texts.

## Where Schnitzery already wins
- German-first: DE/EN, ArbZG compliance checks, HACCP temperatures, document expiry.
- Owner cockpit: targets, forecast, 8-week trend, health score, setup card, Monday summary.
- Honest numbers (missing data is "—", never 0), audited security, EU hosting (Frankfurt).
- One price for the whole stack (competitors sell payroll, tips, forecasting as add-ons).

## Gaps, ranked (impact for a German restaurant ÷ effort)
| # | Feature | Who has it | Why it matters here | Effort |
|---|---|---|---|---|
| 1 | Mindestlohn + Minijob guard | (rare) | 13,90 € → 14,60 € on 1 Jan 2027; Minijob cap 603 €/month (≈43 h). Warn on wages below the legal minimum and on rosters that push a Minijobber over the cap. | S |
| 2 | DATEV LODAS / Lohn und Gehalt export | Planday, Papershift, gastromatic | Table stakes in DE: hours, SFN surcharges and absences as Lohnarten straight into the tax advisor's DATEV. | M |
| 3 | Tip pool (Trinkgeld) | 7shifts | Weekly pool split by hours (service + kitchen), kept separate from sales, exported as tax-free item. | M |
| 4 | Auto-draft roster | Toast IQ, 7shifts, R365 | Draft next week from availability, sales forecast, contract hours, ArbZG rest and the Minijob cap; manager edits. | L |
| 5 | Clock-in only when scheduled | 7shifts, R365 | Block / flag clock-ins far from a planned shift; cuts early clock-ins and overtime. | S |
| 6 | Smarter forecast | R365, Toast | Add German public & school holidays and same-week-last-year to the 4-week average. | S–M |
| 7 | Payslips in the staff app | Planday | Upload DATEV payslips; staff see them in Documents. | S |
| 8 | Onboarding pack | R365 | New hire checklist: contract, §43 IfSG Belehrung, Minijob/tax data, first shifts. | M |
| 9 | Live till sales | all | Needs the till system / API. | M |

Recommended order: 1 → 5 → 6 (quick, visible) → 2 → 3 → 4.

## Status
- #1 done (warnings only, never blocks — trainees/interns can be exempt under § 22 MiLoG):
  rates in `src/lib/pay/legal.ts` (update the table when a new rate is decided);
  labour page badge per person, owner-home alert (below now / below in ≤ 61 days),
  roster panel warns when a Minijobber's month (worked + planned) passes the cap.
- #5 done as "flag, never block" (owner decision): Approvals and the attendance hub mark
  shifts clocked in > 15 min before the planned start, or on a day the person wasn't
  rostered (`src/lib/time/roster.ts`). Planned-vs-actual now understands custom
  "HH:MM–HH:MM" roster entries (they used to show as "unscheduled").
