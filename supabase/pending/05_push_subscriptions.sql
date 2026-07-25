-- ============================================================================
-- PUSH NOTIFICATIONS — table + RLS. Safe to apply; nothing reads it until the
-- app code is wired in (see PUSH-NOTIFICATIONS-SETUP.md).
--
-- One row per device a user has granted notification permission on. A user may
-- have several (phone + tablet). Keyed by the push endpoint URL, which is unique
-- per device+browser.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,   -- client public key (from the browser subscription)
  auth        text NOT NULL,   -- client auth secret (from the browser subscription)
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions USING btree (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user manages only their own device subscriptions.
DROP POLICY IF EXISTS push_subs_own ON public.push_subscriptions;
CREATE POLICY push_subs_own ON public.push_subscriptions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- The server SENDS pushes with the service-role key (which bypasses RLS), so it
-- can read every subscription. No extra read policy is needed for that path.
