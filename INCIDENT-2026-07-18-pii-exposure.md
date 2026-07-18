***REMOVED*** Incident record — employee personal data in public repository

**Keep a copy of this file OUTSIDE the repository.** Step 3 of the purge
rewrites history; this record must survive that.

This is a factual record, not a legal assessment. It is written so that whoever
handles compliance for the business has the facts in one place.

---

***REMOVED******REMOVED*** Summary

Employee personal data was committed to a public GitHub repository and remained
publicly readable for approximately **43 days**.

| | |
|---|---|
| **Repository** | `github.com/venkatasuda/schnitzery-portal` |
| **File** | `seed-stuttgart-team.mjs` |
| **First committed** | **2026-06-05 14:09:59 +0200** (commit `83053c0`, *"Batch 1: hub navigation + light/dark mode"*) |
| **Discovered** | 2026-07-18, during a security audit of the codebase |
| **Repository set to private** | 2026-07-18 (exposure ended) |
| **Exposure window** | ~43 days |
| **Forks at time of discovery** | 0 (per GitHub) |
| **Clones** | Not tracked by GitHub — cannot be ruled out |

***REMOVED******REMOVED*** Data exposed

Approximately **30 identifiable employees** of Schnitzery Stuttgart:

- First name
- Team / department (Kitchen, Preparation, Cashier, Manager, Dishwashing)
- Role, including which individuals are **managers**
- Contract type (Full Time / Mini Job / Working Student)
- Contract hours
- **Mobile phone number** — 32 numbers, German (+49) and international (+91, +977)
- **A shared temporary password** (`[REDACTED-PASSWORD]`) applied to every account
- The email address pattern (`firstname.kit-001@schnitzery-stuttgart.de`),
  making every account name derivable

No special-category data (health, religion, union membership) was included.

***REMOVED******REMOVED*** Why the password matters

The shared password was published alongside the derivable email pattern. Any
account whose holder had not yet signed in and changed it was directly
accessible to anyone reading the repository — including at least two manager
accounts (`Om`, `Pritesh`). A manager account can read the whole branch's
records.

Note also that until 2026-07-18, `users.hourly_wage` was readable by any
authenticated user (audit item 18), so an account takeover during this window
would also have exposed the branch's wage data.

***REMOVED******REMOVED*** Evidence of access

**Unknown.** GitHub does not provide access logs for public repository reads.
There is no evidence that the data was accessed, and no evidence that it was
not.

To check for account misuse: Supabase dashboard → Authentication → Users →
sort by *Last sign in*. Look for sign-ins that predate the password being handed
to that employee, or that occur at implausible times.

```sql
-- accounts still on the published shared password
select full_name, email, employee_code, role, created_at
from public.users
where must_change_password = true
order by role, full_name;
```

***REMOVED******REMOVED*** Remediation

| Action | Status |
|---|---|
| Repository set to private | Done 2026-07-18 |
| Seed script replaced — roster moved to untracked CSV, unique random password per user | Done 2026-07-18 (`seed-team.mjs`) |
| `.gitignore` updated to exclude `*.roster.csv`, `*.passwords.txt` | Done 2026-07-18 |
| File purged from Git history (`git filter-repo`) | **Pending** — see `PURGE-PII-FROM-HISTORY.md` |
| Shared password rotated for all accounts still using it | **Pending** |
| Supabase sign-in log reviewed for unauthorised access | **Pending** |
| GitHub Support asked to purge cached views of affected commits | **Pending** |
| Wage exposure closed (audit item 18) | Done 2026-07-18 |

***REMOVED******REMOVED*** Residual risk after remediation

- Anyone who cloned the repository while it was public retains a full copy.
  History rewriting cannot reach them.
- GitHub may serve cached views of old commit SHAs until Support purges them.
- Search engines or code-scraping services may have indexed the content.

***REMOVED******REMOVED*** Notes for the compliance conversation

Under GDPR the 72-hour notification window runs from **awareness**, which was
**2026-07-18**, not from the original commit date.

The facts a supervisory authority would typically want are all above: number of
data subjects, categories of data, duration, whether access can be evidenced,
and what was done in response.

Germany's authorities take employee-data cases seriously. Prompt self-reporting
with a clear remediation record is a materially better position than a late or
absent disclosure.

**This document is not legal advice.** Take it to whoever handles data
protection for the business and let them make the call on notification.
