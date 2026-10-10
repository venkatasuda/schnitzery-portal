import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/auth/rank";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// PHASE 1 — read-only ops assistant chat.
//
// Ships DARK: returns 404 unless AGENT_CHAT_ENABLED=true. Manager+ only.
// The three tools READ live business data through the caller's own session
// (createClient = anon key + cookies), so RLS scopes every query to the
// branches that user may see. The model can ONLY call these three tools — it
// cannot run arbitrary SQL — so blast radius is the tool set, not a DB key.
// No writes, no service-role key, no separate agent DB role needed here.
//
// ponytail: tool logic is intentionally duplicated from schnitzery-ops-agent
// (separate build). Phase 2 (worker + writes) consolidates them; not worth a
// monorepo/package link for 3 read queries today.
// ============================================================================

const MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-5";
const MAX_STEPS = 6;
const MAX_TOKENS = 1024;

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

type Sb = Awaited<ReturnType<typeof createClient>>;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_stock_levels",
    description:
      "Current stock vs. reorder point per product for the branches this user can see. " +
      "Reorder point is the product target (soll); current qty is the latest count (ist). " +
      "Items with qty below reorder point are purchase candidates.",
    input_schema: {
      type: "object",
      properties: {
        belowReorderOnly: { type: "boolean", description: "If true, only items under their reorder point." },
      },
    },
  },
  {
    name: "get_expiry_risk",
    description: "Active stock batches expiring within N days, oldest first — for waste prevention / transfers.",
    input_schema: {
      type: "object",
      properties: { withinDays: { type: "number", description: "Expiry horizon in days, e.g. 3." } },
      required: ["withinDays"],
    },
  },
  {
    name: "get_waste_trend",
    description: "Waste quantity per product and per reason over the last N days, from the waste log.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Lookback window in days, e.g. 7." } },
      required: ["days"],
    },
  },
];

async function runTool(sb: Sb, name: string, input: any): Promise<unknown> {
  if (name === "get_stock_levels") {
    const { data: master, error: me } = await sb
      .from("inventory_master")
      .select("branch_id, product, category, unit, soll")
      .eq("is_active", true);
    if (me) throw new Error(me.message);
    const { data: counts, error: ce } = await sb
      .from("inventory_counts")
      .select("branch_id, product, ist, count_date")
      .order("count_date", { ascending: false });
    if (ce) throw new Error(ce.message);

    const latest = new Map<string, number>();
    for (const c of counts ?? []) {
      const k = `${c.branch_id}|${c.product}`;
      if (!latest.has(k)) latest.set(k, Number(c.ist));
    }
    const items = (master ?? []).map((m) => {
      const qty = latest.get(`${m.branch_id}|${m.product}`) ?? null;
      const reorderPoint = Number(m.soll) || 0;
      return { product: m.product, category: m.category, unit: m.unit, qty, reorderPoint, belowReorder: qty != null && qty < reorderPoint };
    });
    return { asOf: todayISO(), items: input?.belowReorderOnly ? items.filter((i) => i.belowReorder) : items };
  }

  if (name === "get_expiry_risk") {
    const withinDays = Number(input?.withinDays) || 3;
    const { data, error } = await sb
      .from("stock_batches")
      .select("branch_id, product, qty, unit, expiry_date, status")
      .eq("status", "active")
      .lte("expiry_date", plusDaysISO(withinDays))
      .order("expiry_date", { ascending: true });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const items = (data ?? []).map((b) => ({
      product: b.product, qty: b.qty, unit: b.unit, expiry_date: b.expiry_date,
      days_left: Math.ceil((new Date(b.expiry_date).getTime() - now) / 86400000),
    }));
    return { asOf: todayISO(), withinDays, items };
  }

  if (name === "get_waste_trend") {
    const days = Number(input?.days) || 7;
    const { data, error } = await sb
      .from("waste_log")
      .select("product, category, qty, reason, work_date")
      .gte("work_date", plusDaysISO(-days));
    if (error) throw new Error(error.message);
    const byProduct: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    for (const r of data ?? []) {
      byProduct[r.product] = (byProduct[r.product] || 0) + Number(r.qty);
      byReason[r.reason] = (byReason[r.reason] || 0) + Number(r.qty);
    }
    const topProducts = Object.entries(byProduct)
      .map(([product, qty]) => ({ product, qty: Math.round(qty * 100) / 100 }))
      .sort((a, b) => b.qty - a.qty);
    return { asOf: todayISO(), windowDays: days, entryCount: (data ?? []).length, topProducts, byReason };
  }

  throw new Error(`Unknown tool: ${name}`);
}

const SYSTEM = (role: string) =>
  `You are the Schnitzery operations assistant. The user is a "${role}". ` +
  `Answer questions about inventory, expiry risk, and waste using ONLY the tools provided. ` +
  `The tools already return only the data this user is allowed to see — never ask for or mention branch IDs. ` +
  `Be concise and concrete: cite products, quantities and the reorder gap. ` +
  `You are read-only: you cannot place orders, change stock, or take actions — if asked, say so and summarise what you can see instead. ` +
  `Reply in the language the user writes in (German or English).`;

export async function POST(request: Request) {
  if (process.env.AGENT_CHAT_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Assistant is disabled." }, { status: 404 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Assistant not configured." }, { status: 500 });
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });

  const { data: me } = await sb.from("users").select("role").eq("id", user.id).single();
  if (!me || !isManagerRole(me.role)) {
    return NextResponse.json({ ok: false, error: "Managers only." }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const messages: Anthropic.MessageParam[] = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || !messages.length) {
    return NextResponse.json({ ok: false, error: "Missing messages." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const convo: Anthropic.MessageParam[] = messages.slice(-20); // cap history

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res: Anthropic.Message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM(me.role),
        tools: TOOLS,
        messages: convo,
      });

      if (res.stop_reason !== "tool_use") {
        const text = res.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text).join("\n").trim();
        return NextResponse.json({ ok: true, reply: text || "(no answer)" });
      }

      convo.push({ role: "assistant", content: res.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        let out: unknown;
        try { out = await runTool(sb, block.name, block.input); }
        catch (e: any) { out = { error: String(e?.message || e) }; }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      }
      convo.push({ role: "user", content: toolResults });
    }
    return NextResponse.json({ ok: true, reply: "I couldn't finish that — try a narrower question." });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Assistant error." }, { status: 502 });
  }
}
