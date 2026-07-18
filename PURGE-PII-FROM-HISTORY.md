***REMOVED*** Removing staff phone numbers from Git history — item 5

`seed-stuttgart-team.mjs` contains **32 phone numbers plus a shared password**
(`[REDACTED-PASSWORD]`) for ~30 identifiable employees, and it was pushed to a
**public** repository. Deleting the file in a new commit is not enough — every
previous commit still contains it, and `git log -p` or the GitHub UI will show
it to anyone with access.

This rewrites history so the file never existed.

---

***REMOVED******REMOVED*** Before you start

- [x] **Repo set to private** — done. This stopped the ongoing exposure.
- [ ] The wage code (item 18 step B) is committed, pushed and **deployed**.
      Do not start a history rewrite with uncommitted work in the tree.
- [ ] You know you are the only contributor. GitHub showed **1 contributor**,
      so a force-push will not overwrite anyone else's work.

---

***REMOVED******REMOVED*** Step 1 — replace the script (already done)

`seed-team.mjs` reads an untracked `team.roster.csv` and generates a unique
random password per person. `.gitignore` now excludes `*.roster.csv` and
`*.passwords.txt`.

If you still need the roster data, copy it out of the old file into
`team.roster.csv` **now**, before step 3 destroys it:

```
first_name,team,role,contract_type,contract_hours,phone
Abhi,Kitchen,staff,Working Student,80,+49...
```

---

***REMOVED******REMOVED*** Step 2 — install the tool

```
pip install git-filter-repo
```

`git filter-repo` is the tool the Git project itself recommends. Do not use
`git filter-branch` — it is slow, error-prone, and officially discouraged.

---

***REMOVED******REMOVED*** Step 3 — rewrite history

```
cd E:\Schnitzery
git filter-repo --path seed-stuttgart-team.mjs --invert-paths --force
```

This removes that file from **every commit**, past and present. Every commit
hash after the first change will be different — that is expected and is the
whole point.

Verify it is gone:

```
git log --all --oneline -- seed-stuttgart-team.mjs
```

Must print **nothing**.

Also search the whole history for a leaked number:

```
git log -p --all -S "[REDACTED-PHONE]"
```

Must print **nothing**.

---

***REMOVED******REMOVED*** Step 4 — push the rewritten history

`filter-repo` deletes the remote as a safety measure, so add it back:

```
git remote add origin https://github.com/venkatasuda/schnitzery-portal.git
git push origin --force --all
git push origin --force --tags
```

---

***REMOVED******REMOVED*** Step 5 — rotate the password

`[REDACTED-PASSWORD]` was publicly readable. Treat it as compromised.

Anyone who never signed in still has it as their live password, and the email
pattern is predictable (`name.kit-001@schnitzery-stuttgart.de`), so a stranger
could have signed in as staff — or as `Om` or `Pritesh`, who are **managers**.

Force a reset for anyone who has not yet changed theirs:

```sql
-- who is still on the seeded password path
select full_name, email, employee_code, role
from public.users
where must_change_password = true
order by role, full_name;
```

For those accounts, set a new unique password via the Supabase dashboard
(Authentication → Users → ... → Reset password), or re-run `seed-team.mjs`
logic for just those users. Do not reuse one shared value again.

**Also check for unauthorised access** while the repo was public:
Supabase dashboard → Authentication → Users → sort by *Last sign in*. Anything
from an unexpected time, or an account that "signed in" before you handed the
password over, is worth investigating.

---

***REMOVED******REMOVED*** Step 6 — clean up

```
git rm --cached team.roster.csv 2>nul
del team.passwords.txt
```

Delete the passwords file once handed out. It is gitignored, but it is still
plaintext credentials sitting on your disk.

---

***REMOVED******REMOVED*** What this does NOT fix

Be realistic about the limits:

- **Anyone who cloned or forked the repo while it was public still has the
  data.** History rewriting cannot reach them. GitHub reported 0 forks, which
  is the good case, but clones are not tracked.
- **GitHub may retain cached views of old commits.** To have those purged you
  must contact GitHub Support and ask them to remove cached views for the
  affected SHAs. Do this — it is a real step, not a formality.
- **Search engines and code-scraping services** may have indexed it. Nothing
  you can do beyond the above.

---

***REMOVED******REMOVED*** GDPR

This was personal data of identifiable employees exposed publicly. Under GDPR
this is a personal-data breach, and the 72-hour notification clock started when
you became **aware** of it — 2026-07-18, today.

I am not a lawyer and this is not legal advice. But the facts you would need to
assess it are: ~30 data subjects, categories were name / phone / employment
terms / credentials, exposure was public for the period from the commit date
until today, and there is no evidence either way about whether anyone accessed
it.

Talk to whoever handles compliance for the business. Germany takes this
seriously and "we fixed it quickly" is a much better position than "we did not
report it".

Write down the commit date the file first appeared — you will be asked:

```
git log --format="%ai %h %s" --diff-filter=A -- seed-stuttgart-team.mjs
```

Run that **before** step 3, because afterwards the history is gone.
