# Choosing and connecting a POS

The portal side is already built (see `INVENTORY-PRODUCTION-COSTS-POS.md`): a signed, provider-neutral intake at
`POST /api/integrations/pos`, a manager review queue (Sales → Imports), and SKU → recipe mappings for stock.
Nothing more is built until a POS is chosen; the provider decides what we can read.

## Step 1 — ask Schnitzery HQ
Which till and delivery setup does the brand use? If it is prescribed, use it: shared menu, shared deals, one setup.

## Step 2 — requirements for any POS (send to HQ or vendors)
| Must have | Why |
|---|---|
| Certified TSE (KassenSichV) and DSFinV-K export | Legal requirement; the tax adviser needs the export |
| Wolt / Uber Eats / Lieferando orders land in the till | One sales figure across channels, no retyping |
| Export or API per **day**, per **hour** and per **item (SKU)** | Day → labour %, prime cost, forecast. Hour → mid-shift pace alert. Item → food cost per dish |
| Channel on each sale (in-house / takeaway / delivery) and VAT rate | Margin per channel from real numbers |
| Several branches in one account | Owner sees Munich and Stuttgart together |
| Data export when leaving; short contract | No lock-in |

Ask each vendor for a **sample export** (one day, per hour and per item) before signing.

## Step 3 — menu setup in the till
- Categories as on the menu; extras and dips as **modifiers**, not separate items.
- VAT chosen by the till: 19 % eaten in, 7 % takeaway/delivery for food; drinks 19 %.
- Delivery prices kept separate from in-house prices.
- Deals as time-limited promotions, never as permanent price edits.
- Stable SKUs: the same code for the same dish in every branch (needed for the recipe mapping).
- Reference price list: `design/menu-prices-schnitzerys-de.csv` (not loaded into the portal).

## Step 4 — connect (≈ one day of work once the vendor is known)
1. Create the connection under Settings → Integrations; put its signing secret in `POS_INGEST_KEYS` (server only).
2. Small adapter (vendor API or export → `schnitzery-pos-daily-v1` / `-items-v1`), signed with HMAC.
3. Backfill the last 4 weeks so the forecast works from day one.
4. Map SKUs to recipes (Inventory → POS stock).
5. Hourly sales need one contract addition (`hours: [{date, hour, gross_sales}]`) — add only when the vendor delivers it.

Until then: the shift leader enters, at the day close, the Z-Bon total plus each delivery platform's total and order count
(Lieferando, Uber Eats, Wolt print on their own printers and are not in the till). Day sales = till + platforms
(migration `20261116120000_day_close_delivery_channels.sql`). Platform partner portals also offer order exports for later item/hour data.
