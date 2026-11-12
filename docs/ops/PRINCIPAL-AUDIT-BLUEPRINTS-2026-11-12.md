# Schnitzery audit blueprints — 12 November 2026

These are integration patches for the existing stack, not applied changes or a ready-to-run production migration bundle. Preserve existing RLS, public/private wrapper grants, inventory shift-leader guards and historic data. Run schema changes through a new reviewed migration and staging first.

## A. Keep dual-state rosters; bind publication to the checked draft

Existing roster_drafts + weekly_roster already implement draft vs published. Do not migrate attendance/payroll into a new state machine.

Add an expected snapshot/revision parameter to BOTH public.publish_roster and private.publish_roster. The existing server rule checker must return the exact snapshot it checked (not just issues), and the RPC must compare it while holding the draft lock:

```sql
-- Inside the existing private.publish_roster transaction, after its existing
-- role/branch guard and advisory lock. p_expected is a new required jsonb argument.
select * into d
from public.roster_drafts
where branch_id = p_branch and week_start = p_week
for update;
if not found then
  raise exception 'No draft to publish' using errcode = '22023';
end if;
if p_expected is null or d.roster_data is distinct from p_expected then
  raise exception 'Draft changed after validation' using errcode = '40001';
end if;
```

This closes the check/use race only. It does NOT close direct RPC rule bypass. The same transaction must validate JSON shape, every active same-branch user, overlaps/rest (with real instants), known-time coverage and agreed cap policy before writing live data. Do not accept client-supplied `rulesPassed=true`. Remove or explicitly disable the old two-argument RPC after all callers migrate; otherwise it remains a bypass. Acquire roster/adjacent-week locks in a consistent sorted order if checking both week boundaries. Preserve the live-vs-base_data stale check.

A row-level lock protects an existing row. Missing-live-row creation needs the shared branch/week advisory lock protocol or expected-version insert conflict handling across every authorized writer, including cover approval. Blanket SERIALIZABLE is not a substitute for these contracts.

## B. Compare-and-delete, not blind discard

In src/lib/queries/schedule.ts change discardRosterDraft to require the snapshot loaded by getRoster. Keep its current getMe/auth/role/date guards; replace its delete block with:

```ts
// expected: { draft: unknown }; reject a missing/null draft before this block.
const { data, error } = await (supabase as any)
  .from('roster_drafts').delete()
  .eq('branch_id', branchId).eq('week_start', weekStart)
  .eq('roster_data', JSON.stringify(expected.draft))
  .select('week_start').maybeSingle();
if (error) return { ok: false as const, error: error.message };
if (!data) return { ok: false as const, error: 'Draft changed. Reload before discarding.' };
return { ok: true as const };
```

Pass the current expected value from roster/page.tsx:doDiscard. JSON CAS already exists in saveRoster; this extends the same behavior instead of adding a parallel lock mechanism. A revision column is a later improvement if no-op edits/ABA changes must be distinguished.

## C. Profile CAS including skill arrays

The smallest consistent versioned-write contract is one DB-maintained row version, not per-field optional guards. Complete additive SQL blueprint:

```sql
alter table public.users add column if not exists row_version bigint not null default 0;
create or replace function private.bump_user_row_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.row_version := old.row_version + 1;
  return new;
end $$;
revoke all on function private.bump_user_row_version() from public, anon, authenticated;
drop trigger if exists bump_user_row_version on public.users;
create trigger bump_user_row_version before update on public.users
for each row execute function private.bump_user_row_version();
```

Include row_version when loading the staff/profile form. Require it as an integer at the server boundary and apply `.eq('row_version', expectedVersion).select('id,row_version').maybeSingle()` to the existing scoped update. Zero rows = conflict; keep the user's unsaved values. Every writer, including updateMyProfile, must participate. This does NOT replace the sensitive-field trigger: prohibit self changes to team, contract_type and manager-owned team qualifications there. Do not authorize by client expected values.

## D. Optimistic edits: keep the draft UI instant, bound persistence

The roster already calls setRoster immediately for add/move/swap. Keep that local-first model. Do not make drag completion wait for the network, and do not autosave every mouse event.

One single-flight persistence pattern using the existing saveRoster contract (adapt variables inside RosterPage):

```tsx
const writeLock = useRef(false);
async function persistSnapshot() {
  if (writeLock.current || !expected || loading || loadError) return;
  writeLock.current = true;
  setSaving(true);
  const snapshot = roster;
  try {
    const result = await saveRoster(weekStart, snapshot, expected);
    if (!result.ok || !result.expected) {
      toast(result.error || t('roster.saveFailed'), 'error');
      return; // Keep unsaved edits for recovery. Do not falsely mark them saved.
    }
    setExpected(result.expected);
    setSavedRoster(result.expected.draft);
    // Do NOT setRoster(result.expected.draft): that can erase newer local edits.
  } catch {
    toast(t('roster.saveFailed'), 'error');
  } finally {
    writeLock.current = false;
    setSaving(false);
  }
}
```

For the shortest safe publish fix, disable ALL mutations/week navigation while publishing, not only Save. For a truly optimistic server-backed one-action operation, capture its inverse and roll it back only if the current local edit generation still matches; otherwise preserve newer work and show conflict. Do not roll back a whole roster over later edits. The <50ms target needs React Profiler measurements at realistic staff/shift counts.

## E. Realtime invalidation that survives busy periods

Keep Supabase Postgres Changes and the existing branch-scoped subscriptions. Replace the blanket busy/four-second drop with queued invalidation. Illustrative component code using existing live, load, branchId and weekStart:

```tsx
const [remoteRevision, invalidateRemote] = useState(0);
const appliedRemote = useRef(0);
useEffect(() => {
  if (!branchId || !weekStart) return;
  const db = createClient();
  const invalidate = () => invalidateRemote(n => n + 1);
  const channel = db.channel(`roster:${branchId}:${weekStart}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'roster_drafts',
      filter: `branch_id=eq.${branchId}`,
    }, invalidate)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'weekly_roster',
      filter: `branch_id=eq.${branchId}`,
    }, invalidate)
    .subscribe(status => { if (status === 'SUBSCRIBED') invalidate(); });
  return () => { void db.removeChannel(channel); };
}, [branchId, weekStart]);

useEffect(() => {
  if (remoteRevision === appliedRemote.current || saving || publishing || loading || drafting) return;
  const timer = setTimeout(() => {
    appliedRemote.current = remoteRevision;
    if (live.current.dirty) setRemoteChange(true);
    else void load(live.current.offset);
  }, 60);
  return () => clearTimeout(timer);
}, [remoteRevision, saving, publishing, loading, drafting]);
```

Use revision/event identity for precise own-echo handling if needed. Mark disconnected/error states and refresh on reconnect/focus. Confirm DELETE delivery/filter behavior on your installed Supabase version; adding a publication alone does not prove draft deletion is observable. An explicit branch-authorized invalidation broadcast is an alternative if deletion events are unsuitable. Never trust realtime payloads as authorization; re-read through RLS. Never broadcast draft bodies to staff.

This favors correctness over suppressing every redundant read. Measure event-to-paint p50/p95/p99 with two sessions before claiming <200ms. Postgres Changes has subscriber authorization overhead; use private authorized Broadcast only when measured scale requires it. [Supabase documentation](https://supabase.com/docs/guides/realtime/postgres-changes)

## F. Replace wall-clock rest arithmetic with actual instants

Reuse src/lib/time/roster.ts:zonedToUtc rather than adding a date library. For ordinary unambiguous times, convert each shift's local date/start/end to UTC before comparing gaps. Overnight rollover must increment the calendar date, not add 24h to a UTC instant.

```ts
import { zonedToUtc } from '@/lib/time/roster';
const nextDate = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
function elapsedSpan(date: string, start: string, end: string) {
  const endDate = end <= start ? nextDate(date) : date;
  return { start: zonedToUtc(date, start).getTime(), end: zonedToUtc(endDate, end).getTime() };
}
// restHours = (next.start - previous.end) / 3_600_000;
```

Before using this as a general compliance primitive, define and test the policy for local times in the DST skipped/repeated hour. The existing converter's comment is not a proof of disambiguation. Also separate paid minutes/breaks from elapsed rest: they are different quantities. Add fixtures for both DST changes, overnight shifts, previous Sunday, next Monday and different adjacent-week editors.

## G. URL-backed tabs and deterministic back paths

The current My Day tab state is lost on remount. Put the selected tab in the URL and return to it, not an arbitrary browser history entry. In the client component (with the Suspense boundary required by the installed Next route configuration):

```tsx
const params = useSearchParams();
const requested = params.get('tab');
const tab = ['avail','timeoff','hours','work'].includes(requested ?? '') ? requested! : 'avail';
// Render each destination with Next Link:
<Link href='/my-day?tab=timeoff' scroll={false} aria-current={tab === 'timeoff' ? 'page' : undefined}>
  {t('myday.tabTimeOff')}
</Link>
```

Add a dirty-check handler to links before allowing the transition, and a beforeunload warning for unsaved drafts. Controlled week/tab navigation needs the same check. For browser Back/Forward that cannot reliably be cancelled, persist a scoped draft and offer Restore; do not pretend beforeunload guards SPA history. EmployeeBack should use explicit parents (`/day-close → /shift`, `/leave-calendar → /my-day?tab=timeoff`) and the inventory variant should hide manager-only links for staff. Server actions/RLS still enforce permissions.

## Integration acceptance, not just snapshots

1. Two sessions edit/save/discard/publish the same draft; newer work survives or yields an explicit conflict.
2. Direct authenticated RPC publication cannot bypass active staff/branch/time/rest rules.
3. Availability month/standing saves fail atomically; failed reads cannot produce an empty overwrite.
4. A remote event during local Save is applied/flagged after Save; disconnected clients revalidate.
5. The DST reproduction fails on the current checker and passes after the shared interval fix.
6. All four roles navigate nested tasks, preserve filters/tabs/drafts, and see only permitted actions.
