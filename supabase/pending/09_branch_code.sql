-- ============================================================================
-- BRANCH CODE — a short, editable prefix per branch, used to auto-generate
-- employee codes like STG-001, MITTE-002. Encodes the BRANCH (stable), never the
-- team (which changes). Kept deliberately flexible:
--   • it's a plain editable column — an owner can rename a branch's code anytime
--   • employee_code auto-fill (in create-staff) is only a DEFAULT; managers can
--     still type any code, and edit it later
--   • NO unique constraint here on purpose — so the scheme can change without
--     old data blocking it. Uniqueness is handled by the per-branch numbering.
-- 2026-09-20
-- ============================================================================

alter table public.branches add column if not exists code text;

-- Backfill existing branches with the first 3 letters of the name (editable).
-- e.g. Stuttgart -> STU (change to STG etc. by hand whenever you like).
update public.branches
set code = upper(regexp_replace(left(name, 3), '[^A-Za-z]', '', 'g'))
where code is null or code = '';
