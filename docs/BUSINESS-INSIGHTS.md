# Business workspace update

The management workspace uses white surfaces, slate text and teal actions. The analytics page opens with business performance; workforce detail has its own view. Inventory primary actions follow the selected workflow, and the assistant uses a labelled launcher instead of a floating robot.

## Business calculations

Sales, paid minutes, estimated base-wage labour cost and purchase spending share the branch analytics query. Sales-per-hour uses exact paid minutes. Missing wages suppress labour-cost ratios and show an incomplete-data warning. Sales coverage counts distinct elapsed branch-days; a missing sales row is unknown, rather than a zero-sales day. Waste entries are counted without adding incompatible units.

The dashboard monthly summary also suppresses the labour ratio when worked employees have missing wages. Labour estimates exclude payroll premiums and employer contributions. Purchase spending is not food consumption cost. Profit is not available without inventory valuations and complete expenses.

## AI

The read-only assistant adds `get_business_performance` for the current Berlin day, week or month. It calls the same authenticated branch query as the UI and receives scope, date range, metrics and completeness information. Tool validation rejects unrecognised periods and additional parameters. Existing role checks, RLS, database rate limiting and bounded model calls remain in force. This does not enable writes or add a nightly autonomous worker.

## Checks

`node scripts/checks/business.cjs` executes the actual server query with controlled data to check totals, exact productivity, missing wages, missing sales, permission denial and failed reads. `node scripts/checks/business-ui.cjs` renders the real overview component and checks its quality warnings and accounting labels. Pass an output HTML path to generate an illustrative visual preview. The preview is sample data, not live branch performance.

Existing tests and UI checks still apply. Signed-in production UI and model responses require an authenticated app session and configured Anthropic credentials; local checks do not prove those external behaviours.
