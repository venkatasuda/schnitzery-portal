-- DROP SCHEMA public;

CREATE SCHEMA public AUTHORIZATION pg_database_owner;

COMMENT ON SCHEMA public IS 'standard public schema';

-- DROP SEQUENCE auth_throttle_id_seq;

CREATE SEQUENCE auth_throttle_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;-- public.app_config definition

-- Drop table

-- DROP TABLE app_config;

CREATE TABLE app_config (
	"key" text NOT NULL,
	value text NOT NULL,
	CONSTRAINT app_config_pkey PRIMARY KEY (key)
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;


-- public.auth_throttle definition

-- Drop table

-- DROP TABLE auth_throttle;

CREATE TABLE auth_throttle (
	id bigserial NOT NULL,
	identifier text NOT NULL,
	attempted_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT auth_throttle_pkey PRIMARY KEY (id)
);
CREATE INDEX auth_throttle_idx ON public.auth_throttle USING btree (identifier, attempted_at);
ALTER TABLE public.auth_throttle ENABLE ROW LEVEL SECURITY;


-- public.daily_sales definition

-- Drop table

-- DROP TABLE daily_sales;

CREATE TABLE daily_sales (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	sale_date date NOT NULL,
	amount numeric DEFAULT 0 NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT daily_sales_branch_id_sale_date_key UNIQUE (branch_id, sale_date),
	CONSTRAINT daily_sales_pkey PRIMARY KEY (id)
);
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY daily_sales_mgr ON public.daily_sales
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.announcements definition

-- Drop table

-- DROP TABLE announcements;

CREATE TABLE announcements (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	title text NULL,
	message text NULL,
	category text NULL,
	author text NULL,
	pinned bool DEFAULT false NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT announcements_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_announce_branch ON public.announcements USING btree (branch_id);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY announce_select ON public.announcements
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY announce_write ON public.announcements
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.attendance_corrections definition

-- Drop table

-- DROP TABLE attendance_corrections;

CREATE TABLE attendance_corrections (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	user_id uuid NULL,
	"type" text NOT NULL,
	target_date date NOT NULL,
	attendance_log_id uuid NULL,
	requested_clock_in timestamptz NULL,
	requested_clock_out timestamptz NULL,
	reason text NOT NULL,
	evidence_url text NULL,
	original_snapshot jsonb NULL,
	status text DEFAULT 'pending'::text NOT NULL,
	decided_by text NULL,
	decided_at timestamptz NULL,
	manager_note text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT attendance_corrections_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_corrections_branch ON public.attendance_corrections USING btree (branch_id, status);
CREATE INDEX idx_corrections_user ON public.attendance_corrections USING btree (user_id, created_at DESC);

-- Table Triggers

create trigger trg_correction_submitted after
insert
    on
    public.attendance_corrections for each row execute function notify_correction_submitted();
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY corrections_cancel_own ON public.attendance_corrections
 AS PERMISSIVE
 FOR DELETE
 TO authenticated
 USING (((user_id = auth.uid()) AND (status = 'pending'::text)));
CREATE POLICY corrections_insert_own ON public.attendance_corrections
 AS PERMISSIVE
 FOR INSERT
 TO authenticated
 WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text) AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY corrections_select ON public.attendance_corrections
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING (((user_id = auth.uid()) OR (is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))));


-- public.attendance_events definition

-- Drop table

-- DROP TABLE attendance_events;

CREATE TABLE attendance_events (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	event_uuid uuid NOT NULL,
	user_id uuid NOT NULL,
	branch_id uuid NULL,
	device_id text NULL,
	"action" text NOT NULL,
	captured_at timestamptz NOT NULL,
	"source" text DEFAULT 'online'::text NOT NULL,
	code text NULL,
	code_valid bool NULL,
	sync_status text DEFAULT 'synced'::text NOT NULL,
	attendance_log_id uuid NULL,
	"error" text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT attendance_events_event_uuid_key UNIQUE (event_uuid),
	CONSTRAINT attendance_events_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_att_events_action ON public.attendance_events USING btree (action);
CREATE INDEX idx_att_events_branch ON public.attendance_events USING btree (branch_id, created_at DESC);
CREATE INDEX idx_att_events_user ON public.attendance_events USING btree (user_id, captured_at DESC);
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY att_events_select_mgr ON public.attendance_events
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY att_events_select_own ON public.attendance_events
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((user_id = auth.uid()));


-- public.attendance_logs definition

-- Drop table

-- DROP TABLE attendance_logs;

CREATE TABLE attendance_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NULL,
	branch_id uuid NULL,
	work_date date NOT NULL,
	clock_in timestamptz NULL,
	clock_out timestamptz NULL,
	duration_mins int4 NULL,
	status text NULL,
	breaks jsonb DEFAULT '[]'::jsonb NULL,
	late_mins int4 DEFAULT 0 NULL,
	approval_status text DEFAULT 'pending'::text NULL,
	created_at timestamptz DEFAULT now() NULL,
	"source" text DEFAULT 'online'::text NOT NULL,
	device_id text NULL,
	geo_lat float8 NULL,
	geo_lng float8 NULL,
	geo_distance_m float8 NULL,
	geo_ok bool NULL,
	geo_out_lat float8 NULL,
	geo_out_lng float8 NULL,
	geo_out_distance_m float8 NULL,
	geo_max_distance_m float8 NULL,
	geo_flagged bool DEFAULT false NULL,
	CONSTRAINT attendance_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_att_branch_date ON public.attendance_logs USING btree (branch_id, work_date);
CREATE INDEX idx_att_user_date ON public.attendance_logs USING btree (user_id, work_date);
CREATE INDEX idx_attendance_branch ON public.attendance_logs USING btree (branch_id);
CREATE INDEX idx_attendance_date ON public.attendance_logs USING btree (work_date);
CREATE INDEX idx_attendance_user ON public.attendance_logs USING btree (user_id);
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY att_manage ON public.attendance_logs
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY att_select_mgr ON public.attendance_logs
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY att_select_own ON public.attendance_logs
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((user_id = auth.uid()));


-- public.audit_logs definition

-- Drop table

-- DROP TABLE audit_logs;

CREATE TABLE audit_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	"action" text NULL,
	actor text NULL,
	details text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY audit_insert ON public.audit_logs
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY audit_select ON public.audit_logs
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.availability definition

-- Drop table

-- DROP TABLE availability;

CREATE TABLE availability (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NULL,
	branch_id uuid NULL,
	week_start date NOT NULL,
	days jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT availability_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_avail_branch ON public.availability USING btree (branch_id);
CREATE INDEX idx_avail_branch_week ON public.availability USING btree (branch_id, week_start);
CREATE INDEX idx_avail_user_week ON public.availability USING btree (user_id, week_start);
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY avail_select ON public.availability
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY avail_write ON public.availability
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));


-- public.branch_settings definition

-- Drop table

-- DROP TABLE branch_settings;

CREATE TABLE branch_settings (
	branch_id uuid NOT NULL,
	qr_required bool DEFAULT false NULL,
	gps_mode text DEFAULT 'off'::text NULL,
	settings jsonb DEFAULT '{}'::jsonb NULL,
	CONSTRAINT branch_settings_pkey PRIMARY KEY (branch_id)
);
ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY settings_select ON public.branch_settings
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY settings_write ON public.branch_settings
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.branches definition

-- Drop table

-- DROP TABLE branches;

CREATE TABLE branches (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	address text NULL,
	is_active bool DEFAULT true NULL,
	franchise_id uuid NULL,
	gps_lat numeric NULL,
	gps_lng numeric NULL,
	gps_radius_m int4 DEFAULT 150 NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT branches_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_branches_franchise ON public.branches USING btree (franchise_id);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY branches_select ON public.branches
 AS PERMISSIVE
 FOR SELECT
 USING ((id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY branches_update ON public.branches
 AS PERMISSIVE
 FOR UPDATE
 TO authenticated
 USING ((is_manager() AND (id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.certifications definition

-- Drop table

-- DROP TABLE certifications;

CREATE TABLE certifications (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	user_id uuid NULL,
	cert_type text NULL,
	issue_date date NULL,
	expiry_date date NULL,
	file_url text NULL,
	added_by text NULL,
	note text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT certifications_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_cert_branch ON public.certifications USING btree (branch_id);
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY cert_select ON public.certifications
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY cert_write ON public.certifications
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));


-- public.checklists definition

-- Drop table

-- DROP TABLE checklists;

CREATE TABLE checklists (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	work_date date NOT NULL,
	"type" text NULL,
	task text NULL,
	done bool DEFAULT false NULL,
	completed_by uuid NULL,
	completed_at timestamptz NULL,
	input_kind text DEFAULT 'check'::text NOT NULL,
	value text NULL,
	CONSTRAINT checklists_input_kind_chk CHECK ((input_kind = ANY (ARRAY['check'::text, 'number'::text]))),
	CONSTRAINT checklists_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_checklist_branch ON public.checklists USING btree (branch_id);
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY checklist_select ON public.checklists
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY checklist_write ON public.checklists
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));


-- public.clock_overrides definition

-- Drop table

-- DROP TABLE clock_overrides;

CREATE TABLE clock_overrides (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NULL,
	branch_id uuid NULL,
	granted_by text NULL,
	expires_at timestamptz NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT clock_overrides_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_clock_overrides_user ON public.clock_overrides USING btree (user_id, expires_at);
ALTER TABLE public.clock_overrides ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY overrides_manage ON public.clock_overrides
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY overrides_select ON public.clock_overrides
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING (((user_id = auth.uid()) OR (is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))));


-- public.cover_requests definition

-- Drop table

-- DROP TABLE cover_requests;

CREATE TABLE cover_requests (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	requester_id uuid NOT NULL,
	work_date date NOT NULL,
	"day" text NOT NULL,
	team text NOT NULL,
	shift text NOT NULL,
	reason text NULL,
	status text DEFAULT 'open'::text NOT NULL,
	claimer_id uuid NULL,
	resolved_by text NULL,
	resolved_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT cover_requests_pkey PRIMARY KEY (id)
);
CREATE INDEX cover_requests_branch_status_idx ON public.cover_requests USING btree (branch_id, status);
CREATE INDEX cover_requests_requester_idx ON public.cover_requests USING btree (requester_id);
ALTER TABLE public.cover_requests ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY cover_insert ON public.cover_requests
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK (((requester_id = auth.uid()) AND (branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid())))));
CREATE POLICY cover_select ON public.cover_requests
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY cover_update ON public.cover_requests
 AS PERMISSIVE
 FOR UPDATE
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))))
 WITH CHECK ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));


-- public.franchises definition

-- Drop table

-- DROP TABLE franchises;

CREATE TABLE franchises (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	owner_user_id uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT franchises_pkey PRIMARY KEY (id)
);
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY franchises_select ON public.franchises
 AS PERMISSIVE
 FOR SELECT
 USING ((("current_role"() = 'brand_owner'::text) OR (owner_user_id = auth.uid())));


-- public.incidents definition

-- Drop table

-- DROP TABLE incidents;

CREATE TABLE incidents (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	reported_by uuid NULL,
	category text NULL,
	severity text DEFAULT 'medium'::text NULL,
	description text NULL,
	photo_url text NULL,
	status text DEFAULT 'open'::text NULL,
	reviewed_by text NULL,
	manager_note text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT incidents_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_incident_branch ON public.incidents USING btree (branch_id);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY incident_select ON public.incidents
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY incident_write ON public.incidents
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));


-- public.inventory_counts definition

-- Drop table

-- DROP TABLE inventory_counts;

CREATE TABLE inventory_counts (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	count_date date NOT NULL,
	category text NULL,
	product text NULL,
	ist numeric DEFAULT 0 NULL,
	soll numeric DEFAULT 0 NULL,
	unit text NULL,
	counted_by text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT inventory_counts_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_inv_counts_branch ON public.inventory_counts USING btree (branch_id);
CREATE INDEX idx_inv_counts_date ON public.inventory_counts USING btree (count_date);
CREATE INDEX idx_inv_counts_prod ON public.inventory_counts USING btree (category, product);
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY inv_counts_select ON public.inventory_counts
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY inv_counts_write ON public.inventory_counts
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.inventory_master definition

-- Drop table

-- DROP TABLE inventory_master;

CREATE TABLE inventory_master (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	category text NOT NULL,
	product text NOT NULL,
	soll numeric DEFAULT 0 NULL,
	unit text NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT inventory_master_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_inv_master_branch ON public.inventory_master USING btree (branch_id);
ALTER TABLE public.inventory_master ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY inv_master_select ON public.inventory_master
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY inv_master_write ON public.inventory_master
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.inventory_purchases definition

-- Drop table

-- DROP TABLE inventory_purchases;

CREATE TABLE inventory_purchases (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	category text NULL,
	product text NOT NULL,
	qty numeric DEFAULT 0 NOT NULL,
	unit text NULL,
	"cost" numeric DEFAULT 0 NOT NULL,
	supplier text NULL,
	note text NULL,
	purchase_date date DEFAULT (now() AT TIME ZONE 'Europe/Berlin'::text)::date NOT NULL,
	created_by text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT inventory_purchases_pkey PRIMARY KEY (id)
);
CREATE INDEX inventory_purchases_branch_date_idx ON public.inventory_purchases USING btree (branch_id, purchase_date);
CREATE INDEX inventory_purchases_branch_product_idx ON public.inventory_purchases USING btree (branch_id, product);
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY inventory_purchases_delete ON public.inventory_purchases
 AS PERMISSIVE
 FOR DELETE
 USING (((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) AND (( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['manager'::text, 'branch_owner'::text, 'brand_owner'::text, 'super_admin'::text]))));
CREATE POLICY inventory_purchases_insert ON public.inventory_purchases
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK (((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) AND (( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['manager'::text, 'branch_owner'::text, 'brand_owner'::text, 'super_admin'::text]))));
CREATE POLICY inventory_purchases_select ON public.inventory_purchases
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY inventory_purchases_update ON public.inventory_purchases
 AS PERMISSIVE
 FOR UPDATE
 USING (((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) AND (( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = ANY (ARRAY['manager'::text, 'branch_owner'::text, 'brand_owner'::text, 'super_admin'::text]))));


-- public.kiosks definition

-- Drop table

-- DROP TABLE kiosks;

CREATE TABLE kiosks (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	"label" text DEFAULT 'Main kiosk'::text NOT NULL,
	is_active bool DEFAULT true NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	last_seen timestamptz NULL,
	CONSTRAINT kiosks_pkey PRIMARY KEY (id)
);
ALTER TABLE public.kiosks ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY kiosks_select ON public.kiosks
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY kiosks_write ON public.kiosks
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.leave_requests definition

-- Drop table

-- DROP TABLE leave_requests;

CREATE TABLE leave_requests (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	user_id uuid NULL,
	from_date date NULL,
	to_date date NULL,
	reason text NULL,
	status text DEFAULT 'pending'::text NULL,
	sick_note_url text NULL,
	decided_by text NULL,
	decided_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT leave_requests_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_leave_branch ON public.leave_requests USING btree (branch_id);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY leave_delete_own ON public.leave_requests
 AS PERMISSIVE
 FOR DELETE
 TO authenticated
 USING (((user_id = auth.uid()) AND (status = 'pending'::text)));
CREATE POLICY leave_insert_own ON public.leave_requests
 AS PERMISSIVE
 FOR INSERT
 TO authenticated
 WITH CHECK (((user_id = auth.uid()) AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY leave_manage ON public.leave_requests
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY leave_select_mgr ON public.leave_requests
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY leave_select_own ON public.leave_requests
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((user_id = auth.uid()));
CREATE POLICY leave_update_own ON public.leave_requests
 AS PERMISSIVE
 FOR UPDATE
 TO authenticated
 USING (((user_id = auth.uid()) AND (status = 'pending'::text)))
 WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text)));


-- public.notifications definition

-- Drop table

-- DROP TABLE notifications;

CREATE TABLE notifications (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	user_id uuid NULL,
	"type" text NULL,
	title text NULL,
	message text NULL,
	is_read bool DEFAULT false NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_notif_user ON public.notifications USING btree (user_id);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY notif_select_own ON public.notifications
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((user_id = auth.uid()));
CREATE POLICY notif_update_own ON public.notifications
 AS PERMISSIVE
 FOR UPDATE
 TO authenticated
 USING ((user_id = auth.uid()))
 WITH CHECK ((user_id = auth.uid()));


-- public.payroll_runs definition

-- Drop table

-- DROP TABLE payroll_runs;

CREATE TABLE payroll_runs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	"month" text NOT NULL,
	status text DEFAULT 'draft'::text NOT NULL,
	approved_by text NULL,
	approved_at timestamptz NULL,
	note text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT payroll_runs_branch_id_month_key UNIQUE (branch_id, month),
	CONSTRAINT payroll_runs_pkey PRIMARY KEY (id),
	CONSTRAINT payroll_runs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text])))
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY payroll_runs_select ON public.payroll_runs
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY payroll_runs_write ON public.payroll_runs
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.payroll_settings definition

-- Drop table

-- DROP TABLE payroll_settings;

CREATE TABLE payroll_settings (
	branch_id uuid NOT NULL,
	ot_daily_hours numeric DEFAULT 8 NOT NULL,
	night_start time DEFAULT '22:00:00'::time without time zone NOT NULL,
	night_end time DEFAULT '06:00:00'::time without time zone NOT NULL,
	updated_by text NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT payroll_settings_pkey PRIMARY KEY (branch_id)
);
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY payroll_settings_select ON public.payroll_settings
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY payroll_settings_write ON public.payroll_settings
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.performance_notes definition

-- Drop table

-- DROP TABLE performance_notes;

CREATE TABLE performance_notes (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	user_id uuid NULL,
	note text NULL,
	author uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT performance_notes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.performance_notes ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY perf_select ON public.performance_notes
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY perf_write ON public.performance_notes
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.required_documents definition

-- Drop table

-- DROP TABLE required_documents;

CREATE TABLE required_documents (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	doc_type text NOT NULL,
	is_required bool DEFAULT true NOT NULL,
	sort_order int4 DEFAULT 100 NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT required_documents_branch_id_doc_type_key UNIQUE (branch_id, doc_type),
	CONSTRAINT required_documents_pkey PRIMARY KEY (id)
);
ALTER TABLE public.required_documents ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY reqdocs_manage ON public.required_documents
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND ((branch_id IS NULL) OR (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))))
 WITH CHECK ((is_manager() AND ((branch_id IS NULL) OR (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))));
CREATE POLICY reqdocs_select ON public.required_documents
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING (((branch_id IS NULL) OR (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.shift_broadcasts definition

-- Drop table

-- DROP TABLE shift_broadcasts;

CREATE TABLE shift_broadcasts (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	"day" text NULL,
	shift text NULL,
	team_filter text NULL,
	note text NULL,
	created_by uuid NULL,
	status text DEFAULT 'open'::text NULL,
	responses jsonb DEFAULT '[]'::jsonb NULL,
	filled_by text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT shift_broadcasts_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_broadcast_branch ON public.shift_broadcasts USING btree (branch_id);
ALTER TABLE public.shift_broadcasts ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY broadcast_select ON public.shift_broadcasts
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY broadcast_write ON public.shift_broadcasts
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));


-- public.shift_templates definition

-- Drop table

-- DROP TABLE shift_templates;

CREATE TABLE shift_templates (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	template_name text NULL,
	roster_data jsonb NULL,
	created_by uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT shift_templates_pkey PRIMARY KEY (id)
);
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY tmpl_select ON public.shift_templates
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY tmpl_write ON public.shift_templates
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.shift_times definition

-- Drop table

-- DROP TABLE shift_times;

CREATE TABLE shift_times (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	team text NOT NULL,
	shift text NOT NULL,
	start_time time NOT NULL,
	end_time time NOT NULL,
	break_mins int4 DEFAULT 0 NOT NULL,
	is_active bool DEFAULT true NOT NULL,
	updated_by text NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT shift_times_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX uq_shift_times_branch ON public.shift_times USING btree (branch_id, team, shift) WHERE (branch_id IS NOT NULL);
CREATE UNIQUE INDEX uq_shift_times_global ON public.shift_times USING btree (team, shift) WHERE (branch_id IS NULL);
ALTER TABLE public.shift_times ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY shift_times_select ON public.shift_times
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING (((branch_id IS NULL) OR (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY shift_times_write ON public.shift_times
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.stock_batches definition

-- Drop table

-- DROP TABLE stock_batches;

CREATE TABLE stock_batches (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	product text NOT NULL,
	category text NULL,
	qty numeric NOT NULL,
	unit text NULL,
	received_date date NOT NULL,
	expiry_date date NOT NULL,
	note text NULL,
	status text DEFAULT 'active'::text NOT NULL,
	logged_by uuid NULL,
	logged_by_name text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT stock_batches_pkey PRIMARY KEY (id)
);
CREATE INDEX stock_batches_branch_status_idx ON public.stock_batches USING btree (branch_id, status, expiry_date);
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY batches_insert ON public.stock_batches
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK (((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) AND (logged_by = auth.uid())));
CREATE POLICY batches_select ON public.stock_batches
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY batches_update ON public.stock_batches
 AS PERMISSIVE
 FOR UPDATE
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))))
 WITH CHECK ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));


-- public.stock_transfers definition

-- Drop table

-- DROP TABLE stock_transfers;

CREATE TABLE stock_transfers (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	from_branch_id uuid NOT NULL,
	from_branch_name text NULL,
	to_branch_id uuid NOT NULL,
	to_branch_name text NULL,
	product text NOT NULL,
	category text NULL,
	qty numeric NOT NULL,
	unit text NULL,
	note text NULL,
	status text DEFAULT 'requested'::text NOT NULL,
	requested_by uuid NULL,
	requested_by_name text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT stock_transfers_pkey PRIMARY KEY (id)
);
CREATE INDEX stock_transfers_from_idx ON public.stock_transfers USING btree (from_branch_id, status);
CREATE INDEX stock_transfers_to_idx ON public.stock_transfers USING btree (to_branch_id, status);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY transfers_insert ON public.stock_transfers
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK ((to_branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY transfers_select ON public.stock_transfers
 AS PERMISSIVE
 FOR SELECT
 USING (((from_branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) OR (to_branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid())))));
CREATE POLICY transfers_update ON public.stock_transfers
 AS PERMISSIVE
 FOR UPDATE
 USING (((from_branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) OR (to_branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid())))));


-- public.swap_requests definition

-- Drop table

-- DROP TABLE swap_requests;

CREATE TABLE swap_requests (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	requester_id uuid NULL,
	other_person_id uuid NULL,
	my_day text NULL,
	their_day text NULL,
	status text DEFAULT 'pending'::text NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT swap_requests_pkey PRIMARY KEY (id)
);
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY swap_select ON public.swap_requests
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY swap_write ON public.swap_requests
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))
 WITH CHECK ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));


-- public.temp_logs definition

-- Drop table

-- DROP TABLE temp_logs;

CREATE TABLE temp_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	unit_id uuid NOT NULL,
	"temp" numeric NOT NULL,
	in_range bool NOT NULL,
	note text NULL,
	corrective_action text NULL,
	recorded_by uuid NULL,
	recorded_by_name text NULL,
	work_date date NOT NULL,
	recorded_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT temp_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX temp_logs_branch_date_idx ON public.temp_logs USING btree (branch_id, work_date);
CREATE INDEX temp_logs_unit_idx ON public.temp_logs USING btree (unit_id, recorded_at DESC);
ALTER TABLE public.temp_logs ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY temp_logs_insert ON public.temp_logs
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK (((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) AND (recorded_by = auth.uid())));
CREATE POLICY temp_logs_select ON public.temp_logs
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));


-- public.temp_units definition

-- Drop table

-- DROP TABLE temp_units;

CREATE TABLE temp_units (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	"name" text NOT NULL,
	kind text DEFAULT 'fridge'::text NOT NULL,
	min_temp numeric NOT NULL,
	max_temp numeric NOT NULL,
	is_active bool DEFAULT true NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT temp_units_pkey PRIMARY KEY (id)
);
CREATE INDEX temp_units_branch_idx ON public.temp_units USING btree (branch_id, is_active);
ALTER TABLE public.temp_units ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY temp_units_select ON public.temp_units
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));
CREATE POLICY temp_units_write ON public.temp_units
 AS PERMISSIVE
 FOR ALL
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))))
 WITH CHECK ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));


-- public.user_branches definition

-- Drop table

-- DROP TABLE user_branches;

CREATE TABLE user_branches (
	user_id uuid NOT NULL,
	branch_id uuid NOT NULL,
	CONSTRAINT user_branches_pkey PRIMARY KEY (user_id, branch_id)
);
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY user_branches_manage ON public.user_branches
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_owner() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_owner() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY user_branches_select ON public.user_branches
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING (((user_id = auth.uid()) OR (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.user_documents definition

-- Drop table

-- DROP TABLE user_documents;

CREATE TABLE user_documents (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	branch_id uuid NULL,
	doc_type text NOT NULL,
	file_path text NOT NULL,
	file_name text NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	issue_date date NULL,
	expiry_date date NULL,
	status text DEFAULT 'pending'::text NOT NULL,
	uploaded_by uuid NULL,
	reviewed_by uuid NULL,
	reviewed_at timestamptz NULL,
	rejection_reason text NULL,
	is_active bool DEFAULT true NOT NULL,
	version_no int4 DEFAULT 1 NOT NULL,
	CONSTRAINT user_documents_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_userdocs_active ON public.user_documents USING btree (user_id, doc_type, is_active);
CREATE INDEX idx_userdocs_dash ON public.user_documents USING btree (branch_id, status, expiry_date);
CREATE INDEX idx_userdocs_expiry ON public.user_documents USING btree (expiry_date);
CREATE INDEX idx_userdocs_user ON public.user_documents USING btree (user_id);

-- Table Triggers

create trigger trg_audit_user_document after
insert
    or
update
    on
    public.user_documents for each row execute function audit_user_document();
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY userdocs_insert_own ON public.user_documents
 AS PERMISSIVE
 FOR INSERT
 TO authenticated
 WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text) AND (is_active = false)));
CREATE POLICY userdocs_manager_read ON public.user_documents
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((EXISTS ( SELECT 1
   FROM users mgr
  WHERE ((mgr.id = auth.uid()) AND is_manager() AND (mgr.branch_id = user_documents.branch_id)))));
CREATE POLICY userdocs_manager_write ON public.user_documents
 AS PERMISSIVE
 FOR UPDATE
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY userdocs_select_own ON public.user_documents
 AS PERMISSIVE
 FOR SELECT
 TO authenticated
 USING ((user_id = auth.uid()));
CREATE POLICY userdocs_update_own ON public.user_documents
 AS PERMISSIVE
 FOR UPDATE
 TO authenticated
 USING ((user_id = auth.uid()))
 WITH CHECK (((user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'archived'::text])) AND (is_active = false)));


-- public.users definition

-- Drop table

-- DROP TABLE users;

CREATE TABLE users (
	id uuid NOT NULL,
	employee_code text NULL,
	full_name text NULL,
	email text NULL,
	team text NULL,
	contract_type text NULL,
	contract_hours numeric NULL,
	phone text NULL,
	avatar_url text NULL,
	skills _text DEFAULT '{}'::text[] NULL,
	status text DEFAULT 'active'::text NULL,
	"role" text DEFAULT 'staff'::text NOT NULL,
	branch_id uuid NULL,
	created_at timestamptz DEFAULT now() NULL,
	hourly_wage numeric NULL,
	annual_leave_days numeric DEFAULT 25 NULL,
	must_change_password bool DEFAULT true NOT NULL,
	CONSTRAINT users_employee_code_key UNIQUE (employee_code),
	CONSTRAINT users_pkey PRIMARY KEY (id),
	CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'brand_owner'::text, 'branch_owner'::text, 'manager'::text, 'staff'::text, 'kiosk'::text])))
);
CREATE INDEX idx_users_branch ON public.users USING btree (branch_id);

-- Table Triggers

create trigger trg_guard_role_change before
update
    of role on
    public.users for each row execute function guard_role_change();
create trigger trg_guard_users_sensitive before
update
    on
    public.users for each row execute function guard_users_sensitive_update();
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY users_select ON public.users
 AS PERMISSIVE
 FOR SELECT
 USING (((id = auth.uid()) OR (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));
CREATE POLICY users_update ON public.users
 AS PERMISSIVE
 FOR UPDATE
 TO authenticated
 USING (((id = auth.uid()) OR (is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)))));


-- public.waste_log definition

-- Drop table

-- DROP TABLE waste_log;

CREATE TABLE waste_log (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NOT NULL,
	product text NOT NULL,
	category text NULL,
	qty numeric NOT NULL,
	unit text NULL,
	reason text DEFAULT 'other'::text NOT NULL,
	note text NULL,
	logged_by uuid NULL,
	logged_by_name text NULL,
	work_date date NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT waste_log_pkey PRIMARY KEY (id)
);
CREATE INDEX waste_log_branch_date_idx ON public.waste_log USING btree (branch_id, work_date);
ALTER TABLE public.waste_log ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY waste_delete ON public.waste_log
 AS PERMISSIVE
 FOR DELETE
 USING ((logged_by = auth.uid()));
CREATE POLICY waste_insert ON public.waste_log
 AS PERMISSIVE
 FOR INSERT
 WITH CHECK (((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))) AND (logged_by = auth.uid())));
CREATE POLICY waste_select ON public.waste_log
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id = ( SELECT users.branch_id
   FROM users
  WHERE (users.id = auth.uid()))));


-- public.weekly_roster definition

-- Drop table

-- DROP TABLE weekly_roster;

CREATE TABLE weekly_roster (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	branch_id uuid NULL,
	week_start date NOT NULL,
	roster_data jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT weekly_roster_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_roster_branch ON public.weekly_roster USING btree (branch_id);
CREATE INDEX idx_roster_branch_week ON public.weekly_roster USING btree (branch_id, week_start);
ALTER TABLE public.weekly_roster ENABLE ROW LEVEL SECURITY;

-- Table Policies

CREATE POLICY roster_select ON public.weekly_roster
 AS PERMISSIVE
 FOR SELECT
 USING ((branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids)));
CREATE POLICY roster_write ON public.weekly_roster
 AS PERMISSIVE
 FOR ALL
 TO authenticated
 USING ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))))
 WITH CHECK ((is_manager() AND (branch_id IN ( SELECT accessible_branch_ids() AS accessible_branch_ids))));


-- public.announcements foreign keys

ALTER TABLE public.announcements ADD CONSTRAINT announcements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.attendance_corrections foreign keys

ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_attendance_log_id_fkey FOREIGN KEY (attendance_log_id) REFERENCES attendance_logs(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.attendance_events foreign keys

ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_attendance_log_id_fkey FOREIGN KEY (attendance_log_id) REFERENCES attendance_logs(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.attendance_logs foreign keys

ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.audit_logs foreign keys

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.availability foreign keys

ALTER TABLE public.availability ADD CONSTRAINT availability_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.availability ADD CONSTRAINT availability_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.branch_settings foreign keys

ALTER TABLE public.branch_settings ADD CONSTRAINT branch_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.branches foreign keys

ALTER TABLE public.branches ADD CONSTRAINT branches_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE SET NULL;


-- public.certifications foreign keys

ALTER TABLE public.certifications ADD CONSTRAINT certifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.certifications ADD CONSTRAINT certifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.checklists foreign keys

ALTER TABLE public.checklists ADD CONSTRAINT checklists_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.checklists ADD CONSTRAINT checklists_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL;


-- public.clock_overrides foreign keys

ALTER TABLE public.clock_overrides ADD CONSTRAINT clock_overrides_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.clock_overrides ADD CONSTRAINT clock_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.cover_requests foreign keys

ALTER TABLE public.cover_requests ADD CONSTRAINT cover_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.cover_requests ADD CONSTRAINT cover_requests_claimer_id_fkey FOREIGN KEY (claimer_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.cover_requests ADD CONSTRAINT cover_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.franchises foreign keys

ALTER TABLE public.franchises ADD CONSTRAINT franchises_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;


-- public.incidents foreign keys

ALTER TABLE public.incidents ADD CONSTRAINT incidents_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL;


-- public.inventory_counts foreign keys

ALTER TABLE public.inventory_counts ADD CONSTRAINT inventory_counts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.inventory_master foreign keys

ALTER TABLE public.inventory_master ADD CONSTRAINT inventory_master_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.inventory_purchases foreign keys

ALTER TABLE public.inventory_purchases ADD CONSTRAINT inventory_purchases_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.kiosks foreign keys

ALTER TABLE public.kiosks ADD CONSTRAINT kiosks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.leave_requests foreign keys

ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.notifications foreign keys

ALTER TABLE public.notifications ADD CONSTRAINT notifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.payroll_runs foreign keys

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.payroll_settings foreign keys

ALTER TABLE public.payroll_settings ADD CONSTRAINT payroll_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.performance_notes foreign keys

ALTER TABLE public.performance_notes ADD CONSTRAINT performance_notes_author_fkey FOREIGN KEY (author) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.performance_notes ADD CONSTRAINT performance_notes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.performance_notes ADD CONSTRAINT performance_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.required_documents foreign keys

ALTER TABLE public.required_documents ADD CONSTRAINT required_documents_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.shift_broadcasts foreign keys

ALTER TABLE public.shift_broadcasts ADD CONSTRAINT shift_broadcasts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.shift_broadcasts ADD CONSTRAINT shift_broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;


-- public.shift_templates foreign keys

ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;


-- public.shift_times foreign keys

ALTER TABLE public.shift_times ADD CONSTRAINT shift_times_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.stock_batches foreign keys

ALTER TABLE public.stock_batches ADD CONSTRAINT stock_batches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.stock_batches ADD CONSTRAINT stock_batches_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE SET NULL;


-- public.stock_transfers foreign keys

ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_from_branch_id_fkey FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_to_branch_id_fkey FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.swap_requests foreign keys

ALTER TABLE public.swap_requests ADD CONSTRAINT swap_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.swap_requests ADD CONSTRAINT swap_requests_other_person_id_fkey FOREIGN KEY (other_person_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.swap_requests ADD CONSTRAINT swap_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.temp_logs foreign keys

ALTER TABLE public.temp_logs ADD CONSTRAINT temp_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.temp_logs ADD CONSTRAINT temp_logs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.temp_logs ADD CONSTRAINT temp_logs_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES temp_units(id) ON DELETE CASCADE;


-- public.temp_units foreign keys

ALTER TABLE public.temp_units ADD CONSTRAINT temp_units_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;


-- public.user_branches foreign keys

ALTER TABLE public.user_branches ADD CONSTRAINT user_branches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.user_branches ADD CONSTRAINT user_branches_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.user_documents foreign keys

ALTER TABLE public.user_documents ADD CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- public.users foreign keys

ALTER TABLE public.users ADD CONSTRAINT users_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;


-- public.waste_log foreign keys

ALTER TABLE public.waste_log ADD CONSTRAINT waste_log_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public.waste_log ADD CONSTRAINT waste_log_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE SET NULL;


-- public.weekly_roster foreign keys

ALTER TABLE public.weekly_roster ADD CONSTRAINT weekly_roster_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;



-- DROP FUNCTION public.accessible_branch_ids();

CREATE OR REPLACE FUNCTION public.accessible_branch_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id from public.branches b
  where
    public.current_role() in ('super_admin','brand_owner')              -- everything
    or (public.current_role() in ('manager','staff','branch_owner')      -- home branch
        and b.id = public.current_branch())
    or (public.current_role() in ('manager','branch_owner')              -- extra assigned branches
        and b.id in (select ub.branch_id from public.user_branches ub where ub.user_id = auth.uid()));
$function$
;

-- DROP FUNCTION public.attendance_break_mins(jsonb);

CREATE OR REPLACE FUNCTION public.attendance_break_mins(p_breaks jsonb)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(sum(
    greatest(0, round(extract(epoch from (
      (b->>'end')::timestamptz - (b->>'start')::timestamptz
    )) / 60.0))
  ), 0)::int
  from jsonb_array_elements(coalesce(p_breaks, '[]'::jsonb)) as b
  where (b->>'start') is not null and (b->>'end') is not null;
$function$
;

-- DROP FUNCTION public.audit_user_document();

CREATE OR REPLACE FUNCTION public.audit_user_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor   text;
  v_action  text;
  v_details text;
begin
  select full_name into v_actor from public.users where id = auth.uid();
  v_actor := coalesce(v_actor, 'system');

  -- audit_logs (best-effort)
  begin
    if tg_op = 'INSERT' then
      insert into public.audit_logs (branch_id, action, actor, details)
      values (new.branch_id, 'document_uploaded', v_actor, new.doc_type || ' v' || new.version_no);
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      v_action := case new.status
        when 'approved' then 'document_approved'
        when 'rejected' then 'document_rejected'
        when 'archived' then 'document_archived'
        else 'document_updated' end;
      v_details := new.doc_type || coalesce(' — ' || new.rejection_reason, '');
      insert into public.audit_logs (branch_id, action, actor, details)
      values (new.branch_id, v_action, v_actor, v_details);
    end if;
  exception when others then null;
  end;

  -- notifications (best-effort).
  -- title = doc_type CODE (the UI localizes it); message = uploader name or reason.
  begin
    if tg_op = 'INSERT' then
      insert into public.notifications (branch_id, user_id, type, title, message)
      select new.branch_id, u.id, 'doc_pending', new.doc_type, coalesce(v_actor, '')
      from public.users u
      where u.branch_id = new.branch_id
        and u.role in ('manager', 'branch_owner', 'brand_owner', 'super_admin');

    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      if new.status = 'approved' then
        insert into public.notifications (branch_id, user_id, type, title, message)
        values (new.branch_id, new.user_id, 'doc_approved', new.doc_type, '');
      elsif new.status = 'rejected' then
        insert into public.notifications (branch_id, user_id, type, title, message)
        values (new.branch_id, new.user_id, 'doc_rejected', new.doc_type, coalesce(new.rejection_reason, ''));
      end if;
    end if;
  exception when others then null;
  end;

  return new;
end;
$function$
;

-- DROP FUNCTION public.clock_code_batch(int4);

CREATE OR REPLACE FUNCTION public.clock_code_batch(p_count integer DEFAULT 240)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_branch uuid;
  v_w     bigint;
  v_arr   jsonb := '[]'::jsonb;
  i       int;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if v_role not in ('manager', 'franchise_owner', 'brand_owner', 'kiosk') then
    raise exception 'Not permitted.';
  end if;

  p_count := least(greatest(p_count, 1), 1000);
  v_w := floor(extract(epoch from now()) / 30)::bigint;

  for i in 0 .. (p_count - 1) loop
    v_arr := v_arr || jsonb_build_object('w', v_w + i, 'code', public.clock_code_for(v_branch, v_w + i));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'branchId', v_branch,
    'rotateSeconds', 30,
    'startWindow', v_w,
    'codes', v_arr
  );
end;
$function$
;

-- DROP FUNCTION public.clock_code_for(uuid, int8);

CREATE OR REPLACE FUNCTION public.clock_code_for(p_branch uuid, p_window bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_secret text;
  v_b      bytea;
  v_num    bigint;
begin
  select value into v_secret from public.app_config where key = 'clock_code_secret';
  if v_secret is null then v_secret := 'schnitzery-clock-v1'; end if;

  v_b := digest(p_branch::text || '|' || v_secret || '|' || p_window::text, 'sha256');
  v_num := (get_byte(v_b, 0)::bigint * 16777216)
         + (get_byte(v_b, 1) * 65536)
         + (get_byte(v_b, 2) * 256)
         +  get_byte(v_b, 3);

  return lpad((v_num % 1000000)::text, 6, '0');
end;
$function$
;

-- DROP FUNCTION public.clock_in(text, text, float8, float8);

CREATE OR REPLACE FUNCTION public.clock_in(p_code text DEFAULT NULL::text, p_device text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_branch uuid; v_qr boolean; v_open int; v_logid uuid; v_valid boolean;
  v_gps text; v_blat double precision; v_blng double precision; v_rad int;
  v_dist double precision; v_geo_ok boolean := true; v_override boolean := false;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'Your account has no branch assigned.'; end if;

  select qr_required, gps_mode into v_qr, v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_qr, false) and not public.clock_value_ok(v_branch, p_code) then
    raise exception 'Invalid or expired code. Check the in-store display.';
  end if;

  -- geofence
  if coalesce(v_gps, 'off') <> 'off' then
    select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
    if v_blat is not null and v_blng is not null then
      select exists (select 1 from public.clock_overrides o
                     where o.user_id = v_uid and o.branch_id = v_branch and o.expires_at > now()) into v_override;
      if p_lat is null or p_lng is null then
        v_geo_ok := false;
        if v_gps = 'required' and not v_override then
          raise exception 'Location is required to clock in. Turn on location and try again.';
        end if;
      else
        v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
        v_geo_ok := v_dist <= coalesce(v_rad, 150);
        if not v_geo_ok and v_gps = 'required' and not v_override then
          raise exception 'You are about % m from the branch (limit % m). Ask a manager to clock you in or grant an override.',
            round(v_dist)::int, coalesce(v_rad, 150);
        end if;
      end if;
    end if;
  end if;

  select count(*) into v_open from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break');
  if v_open > 0 then raise exception 'You are already clocked in.'; end if;

  insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, status, approval_status, breaks, source, device_id,
                                      geo_lat, geo_lng, geo_distance_m, geo_ok)
  values (v_uid, v_branch, (now() at time zone 'Europe/Berlin')::date, now(), 'active', 'pending', '[]'::jsonb, 'online', p_device,
          p_lat, p_lng, v_dist, v_geo_ok)
  returning id into v_logid;

  v_valid := case when coalesce(v_qr, false) then true else null end;
  insert into public.attendance_events (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id)
  values (gen_random_uuid(), v_uid, v_branch, p_device, 'clock_in', now(), 'online', p_code, v_valid, 'synced', v_logid);

  return jsonb_build_object('ok', true, 'geoOk', v_geo_ok, 'distanceM', round(coalesce(v_dist, 0))::int);
end; $function$
;

-- DROP FUNCTION public.clock_out(text, text, float8, float8);

CREATE OR REPLACE FUNCTION public.clock_out(p_code text DEFAULT NULL::text, p_device text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_branch uuid; v_qr boolean; v_session public.attendance_logs%rowtype; v_dur int; v_break int; v_valid boolean;
  v_gps text; v_blat double precision; v_blng double precision; v_rad int; v_dist double precision;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  select qr_required, gps_mode into v_qr, v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_qr, false) and not public.clock_value_ok(v_branch, p_code) then
    raise exception 'Invalid or expired code. Check the in-store display.';
  end if;
  select * into v_session from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break') order by created_at desc limit 1;
  if v_session.id is null or v_session.status not in ('active','on-break') then raise exception 'You are not clocked in.'; end if;
  if v_session.status = 'on-break' then raise exception 'End your break before clocking out.'; end if;

  if coalesce(v_gps,'off') <> 'off' and p_lat is not null and p_lng is not null then
    select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
    if v_blat is not null and v_blng is not null then
      v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
    end if;
  end if;

  v_dur   := greatest(0, round(extract(epoch from (now() - v_session.clock_in)) / 60.0));
  v_break := public.attendance_break_mins(v_session.breaks);
  update public.attendance_logs
    set clock_out = now(), duration_mins = v_dur, status = 'complete', device_id = coalesce(device_id, p_device),
        geo_out_lat = p_lat, geo_out_lng = p_lng, geo_out_distance_m = v_dist,
        geo_max_distance_m = greatest(coalesce(geo_max_distance_m, 0), coalesce(v_dist, 0)),
        geo_flagged = coalesce(geo_flagged, false) or (v_dist is not null and v_dist > coalesce(v_rad, 150))
  where id = v_session.id;

  v_valid := case when coalesce(v_qr, false) then true else null end;
  insert into public.attendance_events (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id)
  values (gen_random_uuid(), v_uid, v_branch, p_device, 'clock_out', now(), 'online', p_code, v_valid, 'synced', v_session.id);

  return jsonb_build_object('ok', true, 'durationMin', v_dur, 'breakMin', v_break);
end; $function$
;

-- DROP FUNCTION public.clock_token_batch(uuid, int4);

CREATE OR REPLACE FUNCTION public.clock_token_batch(p_kiosk uuid DEFAULT NULL::uuid, p_count integer DEFAULT 240)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_role text; v_branch uuid; v_kiosk uuid; v_w bigint; v_arr jsonb := '[]'::jsonb; i int;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if not (public.is_manager() or v_role = 'kiosk') then raise exception 'Not permitted.'; end if;
  v_kiosk := public.resolve_kiosk(v_branch, p_kiosk);
  p_count := least(greatest(p_count, 1), 1000);
  v_w := floor(extract(epoch from now()) / 30)::bigint;
  for i in 0 .. (p_count - 1) loop
    v_arr := v_arr || jsonb_build_object('w', v_w + i, 'token', public.clock_token_for(v_branch, v_kiosk, v_w + i), 'code', public.clock_code_for(v_branch, v_w + i));
  end loop;
  return jsonb_build_object('ok', true, 'branchId', v_branch, 'kioskId', v_kiosk, 'rotateSeconds', 30, 'startWindow', v_w, 'codes', v_arr);
end; $function$
;

-- DROP FUNCTION public.clock_token_for(uuid, uuid, int8);

CREATE OR REPLACE FUNCTION public.clock_token_for(p_branch uuid, p_kiosk uuid, p_w bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_iat bigint := p_w * 30; v_exp bigint := p_w * 30 + 60;
begin
  return 'SZQR1|' || p_branch::text || '|' || coalesce(p_kiosk::text, '') || '|'
       || v_iat::text || '|' || v_exp::text || '|' || public.clock_token_sig(p_branch, p_kiosk, p_w);
end; $function$
;

-- DROP FUNCTION public.clock_token_sig(uuid, uuid, int8);

CREATE OR REPLACE FUNCTION public.clock_token_sig(p_branch uuid, p_kiosk uuid, p_w bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_secret text;
begin
  select value into v_secret from public.app_config where key = 'clock_code_secret';
  if v_secret is null then v_secret := 'schnitzery-clock-v1'; end if;
  return left(encode(hmac(p_branch::text || '|' || coalesce(p_kiosk::text, '') || '|' || p_w::text, v_secret, 'sha256'), 'hex'), 16);
end; $function$
;

-- DROP FUNCTION public.clock_token_valid(text, timestamptz);

CREATE OR REPLACE FUNCTION public.clock_token_valid(p_token text, p_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_parts text[]; v_branch text; v_kiosk text; v_iat bigint; v_sig text;
  v_w bigint; v_cur bigint; v_expected text;
begin
  begin
    v_parts := string_to_array(coalesce(p_token, ''), '|');
    if array_length(v_parts, 1) <> 6 or v_parts[1] <> 'SZQR1' then return jsonb_build_object('ok', false, 'reason', 'format'); end if;
    v_branch := v_parts[2]; v_kiosk := v_parts[3]; v_iat := v_parts[4]::bigint; v_sig := v_parts[6];
  exception when others then return jsonb_build_object('ok', false, 'reason', 'format'); end;

  v_w := v_iat / 30;
  v_cur := floor(extract(epoch from p_at) / 30)::bigint;
  if v_w <> v_cur and v_w <> v_cur - 1 then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  v_expected := public.clock_token_sig(v_branch::uuid, nullif(v_kiosk, '')::uuid, v_w);
  if v_sig is null or v_sig <> v_expected then return jsonb_build_object('ok', false, 'reason', 'signature'); end if;

  if v_kiosk <> '' and not exists (
    select 1 from public.kiosks where id = v_kiosk::uuid and branch_id = v_branch::uuid and is_active
  ) then return jsonb_build_object('ok', false, 'reason', 'kiosk'); end if;

  return jsonb_build_object('ok', true, 'branch', v_branch, 'kiosk', v_kiosk);
end; $function$
;

-- DROP FUNCTION public.clock_value_ok(uuid, text);

CREATE OR REPLACE FUNCTION public.clock_value_ok(p_branch uuid, p_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v jsonb;
begin
  if p_value is null then return false; end if;
  if left(p_value, 6) = 'SZQR1|' then
    v := public.clock_token_valid(p_value, now());
    return coalesce((v->>'ok')::boolean, false) and (v->>'branch') = p_branch::text;
  end if;
  return public.code_valid(p_branch, p_value);
end; $function$
;

-- DROP FUNCTION public.code_valid(uuid, text);

CREATE OR REPLACE FUNCTION public.code_valid(p_branch uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_clean text;
  v_now   bigint;
  v_w     bigint;
begin
  v_clean := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if length(v_clean) <> 6 then return false; end if;

  v_now := floor(extract(epoch from now()))::bigint;
  v_w := v_now / 30;
  return v_clean = public.clock_code_for(p_branch, v_w)
      or v_clean = public.clock_code_for(p_branch, v_w - 1);
end;
$function$
;

-- DROP FUNCTION public.code_valid_at(uuid, text, timestamptz, int4);

CREATE OR REPLACE FUNCTION public.code_valid_at(p_branch uuid, p_code text, p_at timestamp with time zone, p_skew_windows integer DEFAULT 4)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_clean text; v_w bigint; i int;
begin
  v_clean := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if length(v_clean) <> 6 then return false; end if;
  v_w := floor(extract(epoch from p_at) / 30)::bigint;
  for i in -p_skew_windows .. p_skew_windows loop
    if v_clean = public.clock_code_for(p_branch, v_w + i) then return true; end if;
  end loop;
  return false;
end;
$function$
;

-- DROP FUNCTION public.current_branch();

CREATE OR REPLACE FUNCTION public.current_branch()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select branch_id from public.users where id = auth.uid();
$function$
;

-- DROP FUNCTION public.current_clock_code();

CREATE OR REPLACE FUNCTION public.current_clock_code()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_branch uuid;
  v_now    bigint;
  v_code   text;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;

  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;

  -- Only managers / owners / the kiosk account may read the live code.
  -- Staff must read it off the in-store screen (this is the presence guarantee).
  if v_role not in ('manager', 'franchise_owner', 'brand_owner', 'kiosk') then
    raise exception 'Not permitted.';
  end if;

  v_now  := floor(extract(epoch from now()))::bigint;
  v_code := public.clock_code_for(v_branch, v_now / 30);

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'rotateSeconds', 30,
    'secondsLeft', 30 - (v_now % 30)::int,
    'qrPayload', 'SCHNITZERY-CLOCK:' || v_branch::text || ':' || v_code
  );
end;
$function$
;

-- DROP FUNCTION public.current_clock_token(uuid);

CREATE OR REPLACE FUNCTION public.current_clock_token(p_kiosk uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_role text; v_branch uuid; v_kiosk uuid; v_now bigint; v_w bigint;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if not (public.is_manager() or v_role = 'kiosk') then raise exception 'Not permitted.'; end if;
  v_kiosk := public.resolve_kiosk(v_branch, p_kiosk);
  v_now := floor(extract(epoch from now()))::bigint; v_w := v_now / 30;
  return jsonb_build_object('ok', true, 'branchId', v_branch, 'kioskId', v_kiosk,
    'token', public.clock_token_for(v_branch, v_kiosk, v_w), 'code', public.clock_code_for(v_branch, v_w),
    'rotateSeconds', 30, 'secondsLeft', 30 - (v_now % 30)::int, 'iat', v_w * 30, 'exp', v_w * 30 + 60);
end; $function$
;

-- DROP FUNCTION public.current_role();

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.users where id = auth.uid();
$function$
;

-- DROP FUNCTION public.decide_attendance_correction(uuid, bool, text);

CREATE OR REPLACE FUNCTION public.decide_attendance_correction(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_role text; v_mgr text;
  c public.attendance_corrections%rowtype; v_log public.attendance_logs%rowtype; v_snap jsonb; v_logid uuid;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, full_name into v_role, v_mgr from public.users where id = v_uid;
  if not public.is_manager() then raise exception 'Managers only.'; end if;

  select * into c from public.attendance_corrections where id = p_id;
  if c.id is null then raise exception 'Request not found.'; end if;
  if c.branch_id not in (select accessible_branch_ids()) then raise exception 'Not your branch.'; end if;
  if c.status <> 'pending' then raise exception 'Already decided.'; end if;

  if not p_approve then
    update public.attendance_corrections set status='rejected', decided_by=v_mgr, decided_at=now(), manager_note=p_note where id=p_id;
    begin insert into public.notifications (branch_id, user_id, type, title, message)
      values (c.branch_id, c.user_id, 'correction_rejected', c.type, coalesce(p_note,'')); exception when others then null; end;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if c.attendance_log_id is not null then
    select * into v_log from public.attendance_logs where id = c.attendance_log_id;
    if v_log.id is not null then v_snap := to_jsonb(v_log); v_logid := v_log.id; end if;
  end if;

  if c.type = 'missing' or v_logid is null then
    insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, clock_out, status, approval_status, breaks, source, duration_mins)
    values (c.user_id, c.branch_id, c.target_date, c.requested_clock_in, c.requested_clock_out,
       case when c.requested_clock_out is not null then 'complete' else 'active' end, 'approved', '[]'::jsonb, 'corrected',
       case when c.requested_clock_in is not null and c.requested_clock_out is not null
            then greatest(0, round(extract(epoch from (c.requested_clock_out - c.requested_clock_in)) / 60.0)) else null end)
    returning id into v_logid;
  else
    update public.attendance_logs
      set clock_in = coalesce(c.requested_clock_in, clock_in), clock_out = coalesce(c.requested_clock_out, clock_out),
          status = case when coalesce(c.requested_clock_out, clock_out) is not null then 'complete' else status end,
          approval_status = 'approved', source = 'corrected',
          duration_mins = case when coalesce(c.requested_clock_out, clock_out) is not null
                               then greatest(0, round(extract(epoch from (coalesce(c.requested_clock_out, clock_out) - coalesce(c.requested_clock_in, clock_in))) / 60.0))
                               else duration_mins end
      where id = v_logid;
  end if;

  update public.attendance_corrections set status='approved', decided_by=v_mgr, decided_at=now(), manager_note=p_note,
        original_snapshot=v_snap, attendance_log_id=coalesce(attendance_log_id, v_logid) where id = p_id;
  begin insert into public.attendance_events (event_uuid, user_id, branch_id, action, captured_at, source, sync_status, attendance_log_id)
    values (gen_random_uuid(), c.user_id, c.branch_id, 'correction', now(), 'corrected', 'synced', v_logid); exception when others then null; end;
  begin insert into public.audit_logs (branch_id, action, actor, details)
    values (c.branch_id, 'attendance_corrected', v_mgr, c.type || ' for ' || c.target_date::text); exception when others then null; end;
  begin insert into public.notifications (branch_id, user_id, type, title, message)
    values (c.branch_id, c.user_id, 'correction_approved', c.type, ''); exception when others then null; end;
  return jsonb_build_object('ok', true, 'status', 'approved', 'attendance_log_id', v_logid);
end; $function$
;

-- DROP FUNCTION public.distance_m(float8, float8, float8, float8);

CREATE OR REPLACE FUNCTION public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  with d as (
    select sin(radians(lat2-lat1)/2)^2 + cos(radians(lat1))*cos(radians(lat2))*sin(radians(lng2-lng1)/2)^2 as a
  )
  select 6371000 * 2 * atan2(sqrt(a), sqrt(1-a)) from d;
$function$
;

-- DROP FUNCTION public.end_break(float8, float8);

CREATE OR REPLACE FUNCTION public.end_break(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_session public.attendance_logs%rowtype; v_breaks jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select * into v_session from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break') order by created_at desc limit 1;
  if v_session.id is null then raise exception 'No active session.'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(v_session.breaks, '[]'::jsonb)) e where (e->>'end') is null) then
    raise exception 'You are not on a break.';
  end if;
  select jsonb_agg(case when (elem->>'end') is null
      then jsonb_set(elem, '{end}', to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      else elem end)
    into v_breaks from jsonb_array_elements(coalesce(v_session.breaks, '[]'::jsonb)) elem;
  update public.attendance_logs set breaks = v_breaks, status = 'active' where id = v_session.id;
  perform public.geo_checkpoint(v_session.id, p_lat, p_lng);
  return jsonb_build_object('ok', true, 'totalBreakMins', public.attendance_break_mins(v_breaks));
end; $function$
;

-- DROP FUNCTION public.geo_checkpoint(uuid, float8, float8);

CREATE OR REPLACE FUNCTION public.geo_checkpoint(p_log_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_branch uuid; v_gps text; v_blat double precision; v_blng double precision; v_rad int; v_dist double precision;
begin
  if p_lat is null or p_lng is null or p_log_id is null then return; end if;
  select branch_id into v_branch from public.attendance_logs where id = p_log_id;
  select gps_mode into v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_gps, 'off') = 'off' then return; end if;
  select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
  if v_blat is null or v_blng is null then return; end if;
  v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
  update public.attendance_logs
    set geo_max_distance_m = greatest(coalesce(geo_max_distance_m, 0), v_dist),
        geo_flagged        = coalesce(geo_flagged, false) or (v_dist > coalesce(v_rad, 150))
  where id = p_log_id;
end; $function$
;

-- DROP FUNCTION public.grant_clock_override(uuid, int4);

CREATE OR REPLACE FUNCTION public.grant_clock_override(p_user uuid, p_minutes integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_name text; v_branch uuid;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  if not public.is_manager() then raise exception 'Managers only.'; end if;
  select full_name into v_name from public.users where id = v_uid;
  select branch_id into v_branch from public.users where id = p_user;
  if v_branch is null or v_branch not in (select public.accessible_branch_ids()) then raise exception 'Not your branch.'; end if;
  insert into public.clock_overrides (user_id, branch_id, granted_by, expires_at)
  values (p_user, v_branch, coalesce(v_name,'manager'), now() + make_interval(mins => greatest(1, least(p_minutes, 240))));
  return jsonb_build_object('ok', true, 'expiresInMin', greatest(1, least(p_minutes, 240)));
end; $function$
;

-- DROP FUNCTION public.guard_role_change();

CREATE OR REPLACE FUNCTION public.guard_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_actor_rank int;
begin
  if auth.uid() is null then return new; end if;                 -- service role / SQL editor
  if new.role is distinct from old.role then
    v_actor_rank := public.role_rank(public.current_role());
    if not public.is_manager() then raise exception 'You cannot change roles.'; end if;
    if public.role_rank(new.role) > v_actor_rank then raise exception 'You cannot grant a role above your own.'; end if;
    if public.role_rank(old.role) > v_actor_rank then raise exception 'You cannot change a higher role than your own.'; end if;
  end if;
  return new;
end; $function$
;

-- DROP FUNCTION public.guard_users_sensitive_update();

CREATE OR REPLACE FUNCTION public.guard_users_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role text;
  caller_rank int;
  new_rank    int;
begin
  -- Only act when a protected column actually changes.
  if (new.role        is distinct from old.role)
  or (new.branch_id   is distinct from old.branch_id)
  or (new.hourly_wage is distinct from old.hourly_wage) then

    -- Backend / service-role / SQL editor has no JWT → trusted, allow.
    if auth.uid() is null then
      return new;
    end if;

    select role into caller_role from public.users where id = auth.uid();

    caller_rank := case caller_role
      when 'super_admin'  then 5
      when 'brand_owner'  then 4
      when 'branch_owner' then 3
      when 'manager'      then 2
      when 'staff'        then 1
      when 'kiosk'        then 0
      else 0
    end;

    -- Manager and above (rank >= 2) may change these columns; staff/kiosk may not.
    if caller_rank < 2 then
      raise exception 'Not permitted to change role, branch, or wage';
    end if;

    -- Cannot grant a role higher than your own.
    if new.role is distinct from old.role then
      new_rank := case new.role
        when 'super_admin'  then 5
        when 'brand_owner'  then 4
        when 'branch_owner' then 3
        when 'manager'      then 2
        when 'staff'        then 1
        when 'kiosk'        then 0
        else -1
      end;
      if new_rank < 0 then
        raise exception 'Invalid role value: %', new.role;
      end if;
      if new_rank > caller_rank then
        raise exception 'Cannot grant a role higher than your own';
      end if;
    end if;
  end if;

  return new;
end;
$function$
;

-- DROP FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$function$
;

-- DROP FUNCTION public.is_manager();

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() in ('manager','branch_owner','brand_owner','super_admin');
$function$
;

-- DROP FUNCTION public.is_owner();

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() in ('branch_owner','brand_owner','super_admin');
$function$
;

-- DROP FUNCTION public.notification_sweep();

CREATE OR REPLACE FUNCTION public.notification_sweep()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  DAY_NAMES text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  rec record; adm record; ent record; b record;
  v_date date; v_dow text; v_monday date; v_roster jsonb;
  v_start time; v_end time; v_start_ts timestamptz; v_end_ts timestamptz;
  v_log public.attendance_logs%rowtype;
  v_sched_now int; v_present_now int;
begin
  -- A) Open sessions left running too long → forgot_checkout (employee) + anomaly (admins)
  for rec in
    select id, user_id, branch_id, clock_in from public.attendance_logs
    where status in ('active','on-break') and clock_in < now() - interval '14 hours'
  loop
    perform public.notify(rec.user_id, rec.branch_id, 'forgot_checkout', rec.id::text,
                           'Still clocked in since ' || to_char(rec.clock_in, 'Mon DD HH24:MI'), interval '24 hours');
    for adm in select id from public.users where branch_id = rec.branch_id and role in ('branch_owner','brand_owner','super_admin') loop
      perform public.notify(adm.id, rec.branch_id, 'attendance_anomaly', 'open:' || rec.id::text, 'A session has been open for over 14 hours.', interval '24 hours');
    end loop;
  end loop;

  -- B) Sync failures in the last hour → branch admins/managers
  for rec in
    select branch_id, count(*) c from public.attendance_events
    where (sync_status = 'recorded_with_error' or error is not null) and created_at > now() - interval '1 hour'
    group by branch_id
  loop
    for adm in select id from public.users where branch_id = rec.branch_id and role in ('manager','branch_owner','brand_owner','super_admin') loop
      perform public.notify(adm.id, rec.branch_id, 'sync_failure', 'sync:' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'),
                            rec.c || ' attendance sync error(s) in the last hour', interval '2 hours');
    end loop;
  end loop;

  -- C) Kiosks that have stopped checking in → managers/admins
  for rec in
    select id, branch_id, label, last_seen from public.kiosks
    where is_active and last_seen is not null and last_seen < now() - interval '15 minutes'
  loop
    for adm in select id from public.users where branch_id = rec.branch_id and role in ('manager','branch_owner','brand_owner','super_admin') loop
      perform public.notify(adm.id, rec.branch_id, 'kiosk_offline',
                            'kiosk:' || rec.id::text || ':' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'),
                            coalesce(rec.label,'Kiosk') || ' last seen ' || to_char(rec.last_seen, 'HH24:MI'), interval '6 hours');
    end loop;
  end loop;

  -- D) Schedule-based alerts — per branch, expand today's roster (Berlin time)
  for b in select id from public.branches loop
    v_date := (now() at time zone 'Europe/Berlin')::date;
    v_dow := DAY_NAMES[extract(isodow from v_date)::int];
    v_monday := v_date - (extract(isodow from v_date)::int - 1);

    select roster_data into v_roster from public.weekly_roster where branch_id = b.id and week_start = v_monday;
    if v_roster is null then continue; end if;

    v_sched_now := 0; v_present_now := 0;

    for ent in
      select e->>'user_id' as uid, e->>'team' as team, e->>'shift' as shift
      from jsonb_array_elements(coalesce(v_roster -> v_dow, '[]'::jsonb)) e
    loop
      if ent.uid is null then continue; end if;

      -- resolve shift time: branch row preferred, else global default
      select start_time, end_time into v_start, v_end from public.shift_times
        where branch_id = b.id and team = ent.team and shift = ent.shift and is_active limit 1;
      if not found then
        select start_time, end_time into v_start, v_end from public.shift_times
          where branch_id is null and team = ent.team and shift = ent.shift and is_active limit 1;
      end if;
      if v_start is null then continue; end if;

      v_start_ts := (v_date + v_start) at time zone 'Europe/Berlin';
      v_end_ts   := (v_date + v_end)   at time zone 'Europe/Berlin';
      if v_end_ts <= v_start_ts then v_end_ts := v_end_ts + interval '1 day'; end if;

      select * into v_log from public.attendance_logs
        where user_id = ent.uid::uuid and branch_id = b.id and work_date = v_date order by created_at desc limit 1;

      if now() between v_start_ts and v_end_ts then v_sched_now := v_sched_now + 1; end if;

      if v_log.id is null or v_log.clock_in is null then
        if now() > v_end_ts then
          perform public.notify(ent.uid::uuid, b.id, 'missing_attendance', v_date::text || ':' || ent.shift,
                                'No clock-in for your ' || ent.shift || ' shift', interval '12 hours');
          for adm in select id from public.users where branch_id = b.id and role in ('manager','branch_owner','brand_owner','super_admin') loop
            perform public.notify(adm.id, b.id, 'mgr_missing', v_date::text || ':' || ent.uid, 'Employee missing for ' || ent.shift, interval '12 hours');
          end loop;
        elsif now() between v_start_ts - interval '60 minutes' and v_start_ts then
          perform public.notify(ent.uid::uuid, b.id, 'upcoming_shift', v_date::text || ':' || ent.shift,
                                ent.shift || ' shift starts at ' || to_char(v_start_ts, 'HH24:MI'), interval '3 hours');
        end if;
      else
        if v_log.status in ('active','on-break') then v_present_now := v_present_now + 1; end if;
        if v_log.clock_in > v_start_ts + interval '5 minutes' then
          for adm in select id from public.users where branch_id = b.id and role in ('manager','branch_owner','brand_owner','super_admin') loop
            perform public.notify(adm.id, b.id, 'employee_late', v_date::text || ':' || ent.uid,
                                  'Late clock-in (' || round(extract(epoch from (v_log.clock_in - v_start_ts))/60)::int || ' min)', interval '12 hours');
          end loop;
        end if;
      end if;
    end loop;

    -- staffing shortage right now (deduped per branch per hour)
    if v_sched_now > v_present_now then
      for adm in select id from public.users where branch_id = b.id and role in ('manager','branch_owner','brand_owner','super_admin') loop
        perform public.notify(adm.id, b.id, 'staffing_shortage', 'short:' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'),
                              v_present_now || ' of ' || v_sched_now || ' scheduled staff are present', interval '2 hours');
      end loop;
    end if;
  end loop;
end; $function$
;

-- DROP FUNCTION public."notify"(uuid, uuid, text, text, text, interval);

CREATE OR REPLACE FUNCTION public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval DEFAULT '12:00:00'::interval)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.notifications
             where user_id = p_user and type = p_type and title = p_title and is_read = false and created_at > now() - p_window)
    then return; end if;
  insert into public.notifications (branch_id, user_id, type, title, message)
  values (p_branch, p_user, p_type, p_title, p_message);
end; $function$
;

-- DROP FUNCTION public.notify_correction_submitted();

CREATE OR REPLACE FUNCTION public.notify_correction_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_name text;
begin
  begin
    select full_name into v_name from public.users where id = new.user_id;
    insert into public.notifications (branch_id, user_id, type, title, message)
    select new.branch_id, u.id, 'correction_pending', new.type, coalesce(v_name, '')
    from public.users u
    where u.branch_id = new.branch_id and u.role in ('manager','branch_owner','brand_owner','super_admin');
  exception when others then null; end;
  return new;
end; $function$
;

-- DROP FUNCTION public.notify_system_error(text, uuid);

CREATE OR REPLACE FUNCTION public.notify_system_error(p_message text, p_branch uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_branch uuid := p_branch; adm record;
begin
  if v_branch is null then select branch_id into v_branch from public.users where id = auth.uid(); end if;
  for adm in select id from public.users where (v_branch is null or branch_id = v_branch) and role in ('branch_owner','brand_owner','super_admin') loop
    perform public.notify(adm.id, v_branch, 'system_error', 'sys:' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'), left(coalesce(p_message,'Error'), 200), interval '2 hours');
  end loop;
end; $function$
;

-- DROP FUNCTION public.resolve_kiosk(uuid, uuid);

CREATE OR REPLACE FUNCTION public.resolve_kiosk(p_branch uuid, p_kiosk uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_kiosk uuid;
begin
  if p_kiosk is not null and exists (select 1 from public.kiosks where id = p_kiosk and branch_id = p_branch and is_active)
    then v_kiosk := p_kiosk;
  else
    select id into v_kiosk from public.kiosks where branch_id = p_branch and is_active order by created_at limit 1;
    if v_kiosk is null then insert into public.kiosks (branch_id, label) values (p_branch, 'Main kiosk') returning id into v_kiosk; end if;
  end if;
  update public.kiosks set last_seen = now() where id = v_kiosk;   -- heartbeat
  return v_kiosk;
end; $function$
;

-- DROP FUNCTION public.rls_auto_enable();

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- DROP FUNCTION public.role_rank(text);

CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_role
    when 'super_admin'  then 5
    when 'brand_owner'  then 4
    when 'branch_owner' then 3
    when 'manager'      then 2
    when 'staff'        then 1
    else 0 end;
$function$
;

-- DROP FUNCTION public.start_break(float8, float8);

CREATE OR REPLACE FUNCTION public.start_break(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_session public.attendance_logs%rowtype; v_breaks jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select * into v_session from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break') order by created_at desc limit 1;
  if v_session.id is null or v_session.status <> 'active' then raise exception 'You are not clocked in.'; end if;
  v_breaks := coalesce(v_session.breaks, '[]'::jsonb);
  if exists (select 1 from jsonb_array_elements(v_breaks) e where (e->>'end') is null) then
    raise exception 'You are already on a break.';
  end if;
  v_breaks := v_breaks || jsonb_build_array(jsonb_build_object(
    'start', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'end', null));
  update public.attendance_logs set breaks = v_breaks, status = 'on-break' where id = v_session.id;
  perform public.geo_checkpoint(v_session.id, p_lat, p_lng);
  return jsonb_build_object('ok', true);
end; $function$
;

-- DROP FUNCTION public.sync_attendance_events(jsonb);

CREATE OR REPLACE FUNCTION public.sync_attendance_events(p_events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_branch uuid; v_qr boolean;
  e jsonb;
  v_uuid uuid; v_action text; v_at timestamptz; v_code text; v_device text;
  v_wd date; v_valid boolean; v_logid uuid; v_err text; v_status text; v_last int;
  v_session public.attendance_logs%rowtype;
  v_results jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  select qr_required into v_qr from public.branch_settings where branch_id = v_branch;

  for e in select value from jsonb_array_elements(p_events) loop
    v_uuid   := (e->>'event_uuid')::uuid;
    v_action := e->>'action';
    v_at     := (e->>'captured_at')::timestamptz;
    v_code   := e->>'code';
    v_device := e->>'device_id';
    v_err := null; v_logid := null; v_status := 'applied';

    -- 1) idempotent dedupe
    if exists (select 1 from public.attendance_events where event_uuid = v_uuid) then
      v_results := v_results || jsonb_build_object('event_uuid', v_uuid, 'status', 'duplicate');
      continue;
    end if;

    -- 2) retro code validation (only meaningful when the branch requires it)
    v_valid := case when coalesce(v_qr, false) then public.code_valid_at(v_branch, v_code, v_at, 4) else null end;
    v_wd := (v_at at time zone 'utc')::date;

    -- 3) apply to the session table (conflict-safe)
    begin
      if v_action = 'clock_in' then
        if exists (select 1 from public.attendance_logs where user_id = v_uid and work_date = v_wd and status in ('active','on-break')) then
          v_err := 'already_clocked_in';
        else
          insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, status, approval_status, breaks, source, device_id)
          values (v_uid, v_branch, v_wd, v_at, 'active', 'pending', '[]'::jsonb, 'offline', v_device)
          returning id into v_logid;
        end if;

      elsif v_action = 'clock_out' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status not in ('active','on-break') then
          v_err := 'no_open_session';
        else
          update public.attendance_logs
            set clock_out = v_at, status = 'complete', approval_status = 'pending',
                duration_mins = greatest(0, round(extract(epoch from (v_at - clock_in)) / 60.0)),
                source = 'offline', device_id = coalesce(device_id, v_device)
            where id = v_session.id;
          v_logid := v_session.id;
        end if;

      elsif v_action = 'break_start' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status <> 'active' then
          v_err := 'no_active_session';
        else
          update public.attendance_logs
            set status = 'on-break',
                breaks = coalesce(breaks, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('start', v_at))
            where id = v_session.id;
          v_logid := v_session.id;
        end if;

      elsif v_action = 'break_end' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status <> 'on-break' then
          v_err := 'no_open_break';
        else
          v_last := jsonb_array_length(coalesce(v_session.breaks, '[]'::jsonb)) - 1;
          update public.attendance_logs
            set status = 'active',
                breaks = jsonb_set(coalesce(breaks, '[]'::jsonb), array[v_last::text, 'end'], to_jsonb(v_at))
            where id = v_session.id and v_last >= 0;
          v_logid := v_session.id;
        end if;

      else
        v_err := 'unknown_action';
      end if;
    exception when others then
      v_err := 'apply_error: ' || sqlerrm;
    end;

    -- 4) record the event no matter what (audit; never lost)
    insert into public.attendance_events
      (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id, error)
    values
      (v_uuid, v_uid, v_branch, v_device, v_action, v_at, 'offline', v_code, v_valid, 'synced', v_logid, v_err);

    if v_err is not null then v_status := 'recorded_with_error'; end if;
    v_results := v_results || jsonb_build_object('event_uuid', v_uuid, 'status', v_status, 'error', v_err);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results);
end;
$function$
;

-- DROP FUNCTION public.accessible_branch_ids();

CREATE OR REPLACE FUNCTION public.accessible_branch_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id from public.branches b
  where
    public.current_role() in ('super_admin','brand_owner')              -- everything
    or (public.current_role() in ('manager','staff','branch_owner')      -- home branch
        and b.id = public.current_branch())
    or (public.current_role() in ('manager','branch_owner')              -- extra assigned branches
        and b.id in (select ub.branch_id from public.user_branches ub where ub.user_id = auth.uid()));
$function$
;

-- DROP FUNCTION public.attendance_break_mins(jsonb);

CREATE OR REPLACE FUNCTION public.attendance_break_mins(p_breaks jsonb)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(sum(
    greatest(0, round(extract(epoch from (
      (b->>'end')::timestamptz - (b->>'start')::timestamptz
    )) / 60.0))
  ), 0)::int
  from jsonb_array_elements(coalesce(p_breaks, '[]'::jsonb)) as b
  where (b->>'start') is not null and (b->>'end') is not null;
$function$
;

-- DROP FUNCTION public.audit_user_document();

CREATE OR REPLACE FUNCTION public.audit_user_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor   text;
  v_action  text;
  v_details text;
begin
  select full_name into v_actor from public.users where id = auth.uid();
  v_actor := coalesce(v_actor, 'system');

  -- audit_logs (best-effort)
  begin
    if tg_op = 'INSERT' then
      insert into public.audit_logs (branch_id, action, actor, details)
      values (new.branch_id, 'document_uploaded', v_actor, new.doc_type || ' v' || new.version_no);
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      v_action := case new.status
        when 'approved' then 'document_approved'
        when 'rejected' then 'document_rejected'
        when 'archived' then 'document_archived'
        else 'document_updated' end;
      v_details := new.doc_type || coalesce(' — ' || new.rejection_reason, '');
      insert into public.audit_logs (branch_id, action, actor, details)
      values (new.branch_id, v_action, v_actor, v_details);
    end if;
  exception when others then null;
  end;

  -- notifications (best-effort).
  -- title = doc_type CODE (the UI localizes it); message = uploader name or reason.
  begin
    if tg_op = 'INSERT' then
      insert into public.notifications (branch_id, user_id, type, title, message)
      select new.branch_id, u.id, 'doc_pending', new.doc_type, coalesce(v_actor, '')
      from public.users u
      where u.branch_id = new.branch_id
        and u.role in ('manager', 'branch_owner', 'brand_owner', 'super_admin');

    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      if new.status = 'approved' then
        insert into public.notifications (branch_id, user_id, type, title, message)
        values (new.branch_id, new.user_id, 'doc_approved', new.doc_type, '');
      elsif new.status = 'rejected' then
        insert into public.notifications (branch_id, user_id, type, title, message)
        values (new.branch_id, new.user_id, 'doc_rejected', new.doc_type, coalesce(new.rejection_reason, ''));
      end if;
    end if;
  exception when others then null;
  end;

  return new;
end;
$function$
;

-- DROP FUNCTION public.clock_code_batch(int4);

CREATE OR REPLACE FUNCTION public.clock_code_batch(p_count integer DEFAULT 240)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_branch uuid;
  v_w     bigint;
  v_arr   jsonb := '[]'::jsonb;
  i       int;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if v_role not in ('manager', 'franchise_owner', 'brand_owner', 'kiosk') then
    raise exception 'Not permitted.';
  end if;

  p_count := least(greatest(p_count, 1), 1000);
  v_w := floor(extract(epoch from now()) / 30)::bigint;

  for i in 0 .. (p_count - 1) loop
    v_arr := v_arr || jsonb_build_object('w', v_w + i, 'code', public.clock_code_for(v_branch, v_w + i));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'branchId', v_branch,
    'rotateSeconds', 30,
    'startWindow', v_w,
    'codes', v_arr
  );
end;
$function$
;

-- DROP FUNCTION public.clock_code_for(uuid, int8);

CREATE OR REPLACE FUNCTION public.clock_code_for(p_branch uuid, p_window bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_secret text;
  v_b      bytea;
  v_num    bigint;
begin
  select value into v_secret from public.app_config where key = 'clock_code_secret';
  if v_secret is null then v_secret := 'schnitzery-clock-v1'; end if;

  v_b := digest(p_branch::text || '|' || v_secret || '|' || p_window::text, 'sha256');
  v_num := (get_byte(v_b, 0)::bigint * 16777216)
         + (get_byte(v_b, 1) * 65536)
         + (get_byte(v_b, 2) * 256)
         +  get_byte(v_b, 3);

  return lpad((v_num % 1000000)::text, 6, '0');
end;
$function$
;

-- DROP FUNCTION public.clock_in(text, text, float8, float8);

CREATE OR REPLACE FUNCTION public.clock_in(p_code text DEFAULT NULL::text, p_device text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_branch uuid; v_qr boolean; v_open int; v_logid uuid; v_valid boolean;
  v_gps text; v_blat double precision; v_blng double precision; v_rad int;
  v_dist double precision; v_geo_ok boolean := true; v_override boolean := false;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'Your account has no branch assigned.'; end if;

  select qr_required, gps_mode into v_qr, v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_qr, false) and not public.clock_value_ok(v_branch, p_code) then
    raise exception 'Invalid or expired code. Check the in-store display.';
  end if;

  -- geofence
  if coalesce(v_gps, 'off') <> 'off' then
    select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
    if v_blat is not null and v_blng is not null then
      select exists (select 1 from public.clock_overrides o
                     where o.user_id = v_uid and o.branch_id = v_branch and o.expires_at > now()) into v_override;
      if p_lat is null or p_lng is null then
        v_geo_ok := false;
        if v_gps = 'required' and not v_override then
          raise exception 'Location is required to clock in. Turn on location and try again.';
        end if;
      else
        v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
        v_geo_ok := v_dist <= coalesce(v_rad, 150);
        if not v_geo_ok and v_gps = 'required' and not v_override then
          raise exception 'You are about % m from the branch (limit % m). Ask a manager to clock you in or grant an override.',
            round(v_dist)::int, coalesce(v_rad, 150);
        end if;
      end if;
    end if;
  end if;

  select count(*) into v_open from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break');
  if v_open > 0 then raise exception 'You are already clocked in.'; end if;

  insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, status, approval_status, breaks, source, device_id,
                                      geo_lat, geo_lng, geo_distance_m, geo_ok)
  values (v_uid, v_branch, (now() at time zone 'Europe/Berlin')::date, now(), 'active', 'pending', '[]'::jsonb, 'online', p_device,
          p_lat, p_lng, v_dist, v_geo_ok)
  returning id into v_logid;

  v_valid := case when coalesce(v_qr, false) then true else null end;
  insert into public.attendance_events (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id)
  values (gen_random_uuid(), v_uid, v_branch, p_device, 'clock_in', now(), 'online', p_code, v_valid, 'synced', v_logid);

  return jsonb_build_object('ok', true, 'geoOk', v_geo_ok, 'distanceM', round(coalesce(v_dist, 0))::int);
end; $function$
;

-- DROP FUNCTION public.clock_out(text, text, float8, float8);

CREATE OR REPLACE FUNCTION public.clock_out(p_code text DEFAULT NULL::text, p_device text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_branch uuid; v_qr boolean; v_session public.attendance_logs%rowtype; v_dur int; v_break int; v_valid boolean;
  v_gps text; v_blat double precision; v_blng double precision; v_rad int; v_dist double precision;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  select qr_required, gps_mode into v_qr, v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_qr, false) and not public.clock_value_ok(v_branch, p_code) then
    raise exception 'Invalid or expired code. Check the in-store display.';
  end if;
  select * into v_session from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break') order by created_at desc limit 1;
  if v_session.id is null or v_session.status not in ('active','on-break') then raise exception 'You are not clocked in.'; end if;
  if v_session.status = 'on-break' then raise exception 'End your break before clocking out.'; end if;

  if coalesce(v_gps,'off') <> 'off' and p_lat is not null and p_lng is not null then
    select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
    if v_blat is not null and v_blng is not null then
      v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
    end if;
  end if;

  v_dur   := greatest(0, round(extract(epoch from (now() - v_session.clock_in)) / 60.0));
  v_break := public.attendance_break_mins(v_session.breaks);
  update public.attendance_logs
    set clock_out = now(), duration_mins = v_dur, status = 'complete', device_id = coalesce(device_id, p_device),
        geo_out_lat = p_lat, geo_out_lng = p_lng, geo_out_distance_m = v_dist,
        geo_max_distance_m = greatest(coalesce(geo_max_distance_m, 0), coalesce(v_dist, 0)),
        geo_flagged = coalesce(geo_flagged, false) or (v_dist is not null and v_dist > coalesce(v_rad, 150))
  where id = v_session.id;

  v_valid := case when coalesce(v_qr, false) then true else null end;
  insert into public.attendance_events (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id)
  values (gen_random_uuid(), v_uid, v_branch, p_device, 'clock_out', now(), 'online', p_code, v_valid, 'synced', v_session.id);

  return jsonb_build_object('ok', true, 'durationMin', v_dur, 'breakMin', v_break);
end; $function$
;

-- DROP FUNCTION public.clock_token_batch(uuid, int4);

CREATE OR REPLACE FUNCTION public.clock_token_batch(p_kiosk uuid DEFAULT NULL::uuid, p_count integer DEFAULT 240)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_role text; v_branch uuid; v_kiosk uuid; v_w bigint; v_arr jsonb := '[]'::jsonb; i int;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if not (public.is_manager() or v_role = 'kiosk') then raise exception 'Not permitted.'; end if;
  v_kiosk := public.resolve_kiosk(v_branch, p_kiosk);
  p_count := least(greatest(p_count, 1), 1000);
  v_w := floor(extract(epoch from now()) / 30)::bigint;
  for i in 0 .. (p_count - 1) loop
    v_arr := v_arr || jsonb_build_object('w', v_w + i, 'token', public.clock_token_for(v_branch, v_kiosk, v_w + i), 'code', public.clock_code_for(v_branch, v_w + i));
  end loop;
  return jsonb_build_object('ok', true, 'branchId', v_branch, 'kioskId', v_kiosk, 'rotateSeconds', 30, 'startWindow', v_w, 'codes', v_arr);
end; $function$
;

-- DROP FUNCTION public.clock_token_for(uuid, uuid, int8);

CREATE OR REPLACE FUNCTION public.clock_token_for(p_branch uuid, p_kiosk uuid, p_w bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_iat bigint := p_w * 30; v_exp bigint := p_w * 30 + 60;
begin
  return 'SZQR1|' || p_branch::text || '|' || coalesce(p_kiosk::text, '') || '|'
       || v_iat::text || '|' || v_exp::text || '|' || public.clock_token_sig(p_branch, p_kiosk, p_w);
end; $function$
;

-- DROP FUNCTION public.clock_token_sig(uuid, uuid, int8);

CREATE OR REPLACE FUNCTION public.clock_token_sig(p_branch uuid, p_kiosk uuid, p_w bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_secret text;
begin
  select value into v_secret from public.app_config where key = 'clock_code_secret';
  if v_secret is null then v_secret := 'schnitzery-clock-v1'; end if;
  return left(encode(hmac(p_branch::text || '|' || coalesce(p_kiosk::text, '') || '|' || p_w::text, v_secret, 'sha256'), 'hex'), 16);
end; $function$
;

-- DROP FUNCTION public.clock_token_valid(text, timestamptz);

CREATE OR REPLACE FUNCTION public.clock_token_valid(p_token text, p_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_parts text[]; v_branch text; v_kiosk text; v_iat bigint; v_sig text;
  v_w bigint; v_cur bigint; v_expected text;
begin
  begin
    v_parts := string_to_array(coalesce(p_token, ''), '|');
    if array_length(v_parts, 1) <> 6 or v_parts[1] <> 'SZQR1' then return jsonb_build_object('ok', false, 'reason', 'format'); end if;
    v_branch := v_parts[2]; v_kiosk := v_parts[3]; v_iat := v_parts[4]::bigint; v_sig := v_parts[6];
  exception when others then return jsonb_build_object('ok', false, 'reason', 'format'); end;

  v_w := v_iat / 30;
  v_cur := floor(extract(epoch from p_at) / 30)::bigint;
  if v_w <> v_cur and v_w <> v_cur - 1 then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  v_expected := public.clock_token_sig(v_branch::uuid, nullif(v_kiosk, '')::uuid, v_w);
  if v_sig is null or v_sig <> v_expected then return jsonb_build_object('ok', false, 'reason', 'signature'); end if;

  if v_kiosk <> '' and not exists (
    select 1 from public.kiosks where id = v_kiosk::uuid and branch_id = v_branch::uuid and is_active
  ) then return jsonb_build_object('ok', false, 'reason', 'kiosk'); end if;

  return jsonb_build_object('ok', true, 'branch', v_branch, 'kiosk', v_kiosk);
end; $function$
;

-- DROP FUNCTION public.clock_value_ok(uuid, text);

CREATE OR REPLACE FUNCTION public.clock_value_ok(p_branch uuid, p_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v jsonb;
begin
  if p_value is null then return false; end if;
  if left(p_value, 6) = 'SZQR1|' then
    v := public.clock_token_valid(p_value, now());
    return coalesce((v->>'ok')::boolean, false) and (v->>'branch') = p_branch::text;
  end if;
  return public.code_valid(p_branch, p_value);
end; $function$
;

-- DROP FUNCTION public.code_valid(uuid, text);

CREATE OR REPLACE FUNCTION public.code_valid(p_branch uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_clean text;
  v_now   bigint;
  v_w     bigint;
begin
  v_clean := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if length(v_clean) <> 6 then return false; end if;

  v_now := floor(extract(epoch from now()))::bigint;
  v_w := v_now / 30;
  return v_clean = public.clock_code_for(p_branch, v_w)
      or v_clean = public.clock_code_for(p_branch, v_w - 1);
end;
$function$
;

-- DROP FUNCTION public.code_valid_at(uuid, text, timestamptz, int4);

CREATE OR REPLACE FUNCTION public.code_valid_at(p_branch uuid, p_code text, p_at timestamp with time zone, p_skew_windows integer DEFAULT 4)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_clean text; v_w bigint; i int;
begin
  v_clean := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if length(v_clean) <> 6 then return false; end if;
  v_w := floor(extract(epoch from p_at) / 30)::bigint;
  for i in -p_skew_windows .. p_skew_windows loop
    if v_clean = public.clock_code_for(p_branch, v_w + i) then return true; end if;
  end loop;
  return false;
end;
$function$
;

-- DROP FUNCTION public.current_branch();

CREATE OR REPLACE FUNCTION public.current_branch()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select branch_id from public.users where id = auth.uid();
$function$
;

-- DROP FUNCTION public.current_clock_code();

CREATE OR REPLACE FUNCTION public.current_clock_code()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_branch uuid;
  v_now    bigint;
  v_code   text;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;

  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;

  -- Only managers / owners / the kiosk account may read the live code.
  -- Staff must read it off the in-store screen (this is the presence guarantee).
  if v_role not in ('manager', 'franchise_owner', 'brand_owner', 'kiosk') then
    raise exception 'Not permitted.';
  end if;

  v_now  := floor(extract(epoch from now()))::bigint;
  v_code := public.clock_code_for(v_branch, v_now / 30);

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'rotateSeconds', 30,
    'secondsLeft', 30 - (v_now % 30)::int,
    'qrPayload', 'SCHNITZERY-CLOCK:' || v_branch::text || ':' || v_code
  );
end;
$function$
;

-- DROP FUNCTION public.current_clock_token(uuid);

CREATE OR REPLACE FUNCTION public.current_clock_token(p_kiosk uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_role text; v_branch uuid; v_kiosk uuid; v_now bigint; v_w bigint;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if not (public.is_manager() or v_role = 'kiosk') then raise exception 'Not permitted.'; end if;
  v_kiosk := public.resolve_kiosk(v_branch, p_kiosk);
  v_now := floor(extract(epoch from now()))::bigint; v_w := v_now / 30;
  return jsonb_build_object('ok', true, 'branchId', v_branch, 'kioskId', v_kiosk,
    'token', public.clock_token_for(v_branch, v_kiosk, v_w), 'code', public.clock_code_for(v_branch, v_w),
    'rotateSeconds', 30, 'secondsLeft', 30 - (v_now % 30)::int, 'iat', v_w * 30, 'exp', v_w * 30 + 60);
end; $function$
;

-- DROP FUNCTION public.current_role();

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.users where id = auth.uid();
$function$
;

-- DROP FUNCTION public.decide_attendance_correction(uuid, bool, text);

CREATE OR REPLACE FUNCTION public.decide_attendance_correction(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_role text; v_mgr text;
  c public.attendance_corrections%rowtype; v_log public.attendance_logs%rowtype; v_snap jsonb; v_logid uuid;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, full_name into v_role, v_mgr from public.users where id = v_uid;
  if not public.is_manager() then raise exception 'Managers only.'; end if;

  select * into c from public.attendance_corrections where id = p_id;
  if c.id is null then raise exception 'Request not found.'; end if;
  if c.branch_id not in (select accessible_branch_ids()) then raise exception 'Not your branch.'; end if;
  if c.status <> 'pending' then raise exception 'Already decided.'; end if;

  if not p_approve then
    update public.attendance_corrections set status='rejected', decided_by=v_mgr, decided_at=now(), manager_note=p_note where id=p_id;
    begin insert into public.notifications (branch_id, user_id, type, title, message)
      values (c.branch_id, c.user_id, 'correction_rejected', c.type, coalesce(p_note,'')); exception when others then null; end;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if c.attendance_log_id is not null then
    select * into v_log from public.attendance_logs where id = c.attendance_log_id;
    if v_log.id is not null then v_snap := to_jsonb(v_log); v_logid := v_log.id; end if;
  end if;

  if c.type = 'missing' or v_logid is null then
    insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, clock_out, status, approval_status, breaks, source, duration_mins)
    values (c.user_id, c.branch_id, c.target_date, c.requested_clock_in, c.requested_clock_out,
       case when c.requested_clock_out is not null then 'complete' else 'active' end, 'approved', '[]'::jsonb, 'corrected',
       case when c.requested_clock_in is not null and c.requested_clock_out is not null
            then greatest(0, round(extract(epoch from (c.requested_clock_out - c.requested_clock_in)) / 60.0)) else null end)
    returning id into v_logid;
  else
    update public.attendance_logs
      set clock_in = coalesce(c.requested_clock_in, clock_in), clock_out = coalesce(c.requested_clock_out, clock_out),
          status = case when coalesce(c.requested_clock_out, clock_out) is not null then 'complete' else status end,
          approval_status = 'approved', source = 'corrected',
          duration_mins = case when coalesce(c.requested_clock_out, clock_out) is not null
                               then greatest(0, round(extract(epoch from (coalesce(c.requested_clock_out, clock_out) - coalesce(c.requested_clock_in, clock_in))) / 60.0))
                               else duration_mins end
      where id = v_logid;
  end if;

  update public.attendance_corrections set status='approved', decided_by=v_mgr, decided_at=now(), manager_note=p_note,
        original_snapshot=v_snap, attendance_log_id=coalesce(attendance_log_id, v_logid) where id = p_id;
  begin insert into public.attendance_events (event_uuid, user_id, branch_id, action, captured_at, source, sync_status, attendance_log_id)
    values (gen_random_uuid(), c.user_id, c.branch_id, 'correction', now(), 'corrected', 'synced', v_logid); exception when others then null; end;
  begin insert into public.audit_logs (branch_id, action, actor, details)
    values (c.branch_id, 'attendance_corrected', v_mgr, c.type || ' for ' || c.target_date::text); exception when others then null; end;
  begin insert into public.notifications (branch_id, user_id, type, title, message)
    values (c.branch_id, c.user_id, 'correction_approved', c.type, ''); exception when others then null; end;
  return jsonb_build_object('ok', true, 'status', 'approved', 'attendance_log_id', v_logid);
end; $function$
;

-- DROP FUNCTION public.distance_m(float8, float8, float8, float8);

CREATE OR REPLACE FUNCTION public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  with d as (
    select sin(radians(lat2-lat1)/2)^2 + cos(radians(lat1))*cos(radians(lat2))*sin(radians(lng2-lng1)/2)^2 as a
  )
  select 6371000 * 2 * atan2(sqrt(a), sqrt(1-a)) from d;
$function$
;

-- DROP FUNCTION public.end_break(float8, float8);

CREATE OR REPLACE FUNCTION public.end_break(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_session public.attendance_logs%rowtype; v_breaks jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select * into v_session from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break') order by created_at desc limit 1;
  if v_session.id is null then raise exception 'No active session.'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(v_session.breaks, '[]'::jsonb)) e where (e->>'end') is null) then
    raise exception 'You are not on a break.';
  end if;
  select jsonb_agg(case when (elem->>'end') is null
      then jsonb_set(elem, '{end}', to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      else elem end)
    into v_breaks from jsonb_array_elements(coalesce(v_session.breaks, '[]'::jsonb)) elem;
  update public.attendance_logs set breaks = v_breaks, status = 'active' where id = v_session.id;
  perform public.geo_checkpoint(v_session.id, p_lat, p_lng);
  return jsonb_build_object('ok', true, 'totalBreakMins', public.attendance_break_mins(v_breaks));
end; $function$
;

-- DROP FUNCTION public.geo_checkpoint(uuid, float8, float8);

CREATE OR REPLACE FUNCTION public.geo_checkpoint(p_log_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_branch uuid; v_gps text; v_blat double precision; v_blng double precision; v_rad int; v_dist double precision;
begin
  if p_lat is null or p_lng is null or p_log_id is null then return; end if;
  select branch_id into v_branch from public.attendance_logs where id = p_log_id;
  select gps_mode into v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_gps, 'off') = 'off' then return; end if;
  select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
  if v_blat is null or v_blng is null then return; end if;
  v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
  update public.attendance_logs
    set geo_max_distance_m = greatest(coalesce(geo_max_distance_m, 0), v_dist),
        geo_flagged        = coalesce(geo_flagged, false) or (v_dist > coalesce(v_rad, 150))
  where id = p_log_id;
end; $function$
;

-- DROP FUNCTION public.grant_clock_override(uuid, int4);

CREATE OR REPLACE FUNCTION public.grant_clock_override(p_user uuid, p_minutes integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_name text; v_branch uuid;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  if not public.is_manager() then raise exception 'Managers only.'; end if;
  select full_name into v_name from public.users where id = v_uid;
  select branch_id into v_branch from public.users where id = p_user;
  if v_branch is null or v_branch not in (select public.accessible_branch_ids()) then raise exception 'Not your branch.'; end if;
  insert into public.clock_overrides (user_id, branch_id, granted_by, expires_at)
  values (p_user, v_branch, coalesce(v_name,'manager'), now() + make_interval(mins => greatest(1, least(p_minutes, 240))));
  return jsonb_build_object('ok', true, 'expiresInMin', greatest(1, least(p_minutes, 240)));
end; $function$
;

-- DROP FUNCTION public.guard_role_change();

CREATE OR REPLACE FUNCTION public.guard_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_actor_rank int;
begin
  if auth.uid() is null then return new; end if;                 -- service role / SQL editor
  if new.role is distinct from old.role then
    v_actor_rank := public.role_rank(public.current_role());
    if not public.is_manager() then raise exception 'You cannot change roles.'; end if;
    if public.role_rank(new.role) > v_actor_rank then raise exception 'You cannot grant a role above your own.'; end if;
    if public.role_rank(old.role) > v_actor_rank then raise exception 'You cannot change a higher role than your own.'; end if;
  end if;
  return new;
end; $function$
;

-- DROP FUNCTION public.guard_users_sensitive_update();

CREATE OR REPLACE FUNCTION public.guard_users_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role text;
  caller_rank int;
  new_rank    int;
begin
  -- Only act when a protected column actually changes.
  if (new.role        is distinct from old.role)
  or (new.branch_id   is distinct from old.branch_id)
  or (new.hourly_wage is distinct from old.hourly_wage) then

    -- Backend / service-role / SQL editor has no JWT → trusted, allow.
    if auth.uid() is null then
      return new;
    end if;

    select role into caller_role from public.users where id = auth.uid();

    caller_rank := case caller_role
      when 'super_admin'  then 5
      when 'brand_owner'  then 4
      when 'branch_owner' then 3
      when 'manager'      then 2
      when 'staff'        then 1
      when 'kiosk'        then 0
      else 0
    end;

    -- Manager and above (rank >= 2) may change these columns; staff/kiosk may not.
    if caller_rank < 2 then
      raise exception 'Not permitted to change role, branch, or wage';
    end if;

    -- Cannot grant a role higher than your own.
    if new.role is distinct from old.role then
      new_rank := case new.role
        when 'super_admin'  then 5
        when 'brand_owner'  then 4
        when 'branch_owner' then 3
        when 'manager'      then 2
        when 'staff'        then 1
        when 'kiosk'        then 0
        else -1
      end;
      if new_rank < 0 then
        raise exception 'Invalid role value: %', new.role;
      end if;
      if new_rank > caller_rank then
        raise exception 'Cannot grant a role higher than your own';
      end if;
    end if;
  end if;

  return new;
end;
$function$
;

-- DROP FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$function$
;

-- DROP FUNCTION public.is_manager();

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() in ('manager','branch_owner','brand_owner','super_admin');
$function$
;

-- DROP FUNCTION public.is_owner();

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() in ('branch_owner','brand_owner','super_admin');
$function$
;

-- DROP FUNCTION public.notification_sweep();

CREATE OR REPLACE FUNCTION public.notification_sweep()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  DAY_NAMES text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  rec record; adm record; ent record; b record;
  v_date date; v_dow text; v_monday date; v_roster jsonb;
  v_start time; v_end time; v_start_ts timestamptz; v_end_ts timestamptz;
  v_log public.attendance_logs%rowtype;
  v_sched_now int; v_present_now int;
begin
  -- A) Open sessions left running too long → forgot_checkout (employee) + anomaly (admins)
  for rec in
    select id, user_id, branch_id, clock_in from public.attendance_logs
    where status in ('active','on-break') and clock_in < now() - interval '14 hours'
  loop
    perform public.notify(rec.user_id, rec.branch_id, 'forgot_checkout', rec.id::text,
                           'Still clocked in since ' || to_char(rec.clock_in, 'Mon DD HH24:MI'), interval '24 hours');
    for adm in select id from public.users where branch_id = rec.branch_id and role in ('branch_owner','brand_owner','super_admin') loop
      perform public.notify(adm.id, rec.branch_id, 'attendance_anomaly', 'open:' || rec.id::text, 'A session has been open for over 14 hours.', interval '24 hours');
    end loop;
  end loop;

  -- B) Sync failures in the last hour → branch admins/managers
  for rec in
    select branch_id, count(*) c from public.attendance_events
    where (sync_status = 'recorded_with_error' or error is not null) and created_at > now() - interval '1 hour'
    group by branch_id
  loop
    for adm in select id from public.users where branch_id = rec.branch_id and role in ('manager','branch_owner','brand_owner','super_admin') loop
      perform public.notify(adm.id, rec.branch_id, 'sync_failure', 'sync:' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'),
                            rec.c || ' attendance sync error(s) in the last hour', interval '2 hours');
    end loop;
  end loop;

  -- C) Kiosks that have stopped checking in → managers/admins
  for rec in
    select id, branch_id, label, last_seen from public.kiosks
    where is_active and last_seen is not null and last_seen < now() - interval '15 minutes'
  loop
    for adm in select id from public.users where branch_id = rec.branch_id and role in ('manager','branch_owner','brand_owner','super_admin') loop
      perform public.notify(adm.id, rec.branch_id, 'kiosk_offline',
                            'kiosk:' || rec.id::text || ':' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'),
                            coalesce(rec.label,'Kiosk') || ' last seen ' || to_char(rec.last_seen, 'HH24:MI'), interval '6 hours');
    end loop;
  end loop;

  -- D) Schedule-based alerts — per branch, expand today's roster (Berlin time)
  for b in select id from public.branches loop
    v_date := (now() at time zone 'Europe/Berlin')::date;
    v_dow := DAY_NAMES[extract(isodow from v_date)::int];
    v_monday := v_date - (extract(isodow from v_date)::int - 1);

    select roster_data into v_roster from public.weekly_roster where branch_id = b.id and week_start = v_monday;
    if v_roster is null then continue; end if;

    v_sched_now := 0; v_present_now := 0;

    for ent in
      select e->>'user_id' as uid, e->>'team' as team, e->>'shift' as shift
      from jsonb_array_elements(coalesce(v_roster -> v_dow, '[]'::jsonb)) e
    loop
      if ent.uid is null then continue; end if;

      -- resolve shift time: branch row preferred, else global default
      select start_time, end_time into v_start, v_end from public.shift_times
        where branch_id = b.id and team = ent.team and shift = ent.shift and is_active limit 1;
      if not found then
        select start_time, end_time into v_start, v_end from public.shift_times
          where branch_id is null and team = ent.team and shift = ent.shift and is_active limit 1;
      end if;
      if v_start is null then continue; end if;

      v_start_ts := (v_date + v_start) at time zone 'Europe/Berlin';
      v_end_ts   := (v_date + v_end)   at time zone 'Europe/Berlin';
      if v_end_ts <= v_start_ts then v_end_ts := v_end_ts + interval '1 day'; end if;

      select * into v_log from public.attendance_logs
        where user_id = ent.uid::uuid and branch_id = b.id and work_date = v_date order by created_at desc limit 1;

      if now() between v_start_ts and v_end_ts then v_sched_now := v_sched_now + 1; end if;

      if v_log.id is null or v_log.clock_in is null then
        if now() > v_end_ts then
          perform public.notify(ent.uid::uuid, b.id, 'missing_attendance', v_date::text || ':' || ent.shift,
                                'No clock-in for your ' || ent.shift || ' shift', interval '12 hours');
          for adm in select id from public.users where branch_id = b.id and role in ('manager','branch_owner','brand_owner','super_admin') loop
            perform public.notify(adm.id, b.id, 'mgr_missing', v_date::text || ':' || ent.uid, 'Employee missing for ' || ent.shift, interval '12 hours');
          end loop;
        elsif now() between v_start_ts - interval '60 minutes' and v_start_ts then
          perform public.notify(ent.uid::uuid, b.id, 'upcoming_shift', v_date::text || ':' || ent.shift,
                                ent.shift || ' shift starts at ' || to_char(v_start_ts, 'HH24:MI'), interval '3 hours');
        end if;
      else
        if v_log.status in ('active','on-break') then v_present_now := v_present_now + 1; end if;
        if v_log.clock_in > v_start_ts + interval '5 minutes' then
          for adm in select id from public.users where branch_id = b.id and role in ('manager','branch_owner','brand_owner','super_admin') loop
            perform public.notify(adm.id, b.id, 'employee_late', v_date::text || ':' || ent.uid,
                                  'Late clock-in (' || round(extract(epoch from (v_log.clock_in - v_start_ts))/60)::int || ' min)', interval '12 hours');
          end loop;
        end if;
      end if;
    end loop;

    -- staffing shortage right now (deduped per branch per hour)
    if v_sched_now > v_present_now then
      for adm in select id from public.users where branch_id = b.id and role in ('manager','branch_owner','brand_owner','super_admin') loop
        perform public.notify(adm.id, b.id, 'staffing_shortage', 'short:' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'),
                              v_present_now || ' of ' || v_sched_now || ' scheduled staff are present', interval '2 hours');
      end loop;
    end if;
  end loop;
end; $function$
;

-- DROP FUNCTION public."notify"(uuid, uuid, text, text, text, interval);

CREATE OR REPLACE FUNCTION public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval DEFAULT '12:00:00'::interval)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.notifications
             where user_id = p_user and type = p_type and title = p_title and is_read = false and created_at > now() - p_window)
    then return; end if;
  insert into public.notifications (branch_id, user_id, type, title, message)
  values (p_branch, p_user, p_type, p_title, p_message);
end; $function$
;

-- DROP FUNCTION public.notify_correction_submitted();

CREATE OR REPLACE FUNCTION public.notify_correction_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_name text;
begin
  begin
    select full_name into v_name from public.users where id = new.user_id;
    insert into public.notifications (branch_id, user_id, type, title, message)
    select new.branch_id, u.id, 'correction_pending', new.type, coalesce(v_name, '')
    from public.users u
    where u.branch_id = new.branch_id and u.role in ('manager','branch_owner','brand_owner','super_admin');
  exception when others then null; end;
  return new;
end; $function$
;

-- DROP FUNCTION public.notify_system_error(text, uuid);

CREATE OR REPLACE FUNCTION public.notify_system_error(p_message text, p_branch uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_branch uuid := p_branch; adm record;
begin
  if v_branch is null then select branch_id into v_branch from public.users where id = auth.uid(); end if;
  for adm in select id from public.users where (v_branch is null or branch_id = v_branch) and role in ('branch_owner','brand_owner','super_admin') loop
    perform public.notify(adm.id, v_branch, 'system_error', 'sys:' || to_char(date_trunc('hour', now()),'YYYY-MM-DD-HH24'), left(coalesce(p_message,'Error'), 200), interval '2 hours');
  end loop;
end; $function$
;

-- DROP FUNCTION public.resolve_kiosk(uuid, uuid);

CREATE OR REPLACE FUNCTION public.resolve_kiosk(p_branch uuid, p_kiosk uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_kiosk uuid;
begin
  if p_kiosk is not null and exists (select 1 from public.kiosks where id = p_kiosk and branch_id = p_branch and is_active)
    then v_kiosk := p_kiosk;
  else
    select id into v_kiosk from public.kiosks where branch_id = p_branch and is_active order by created_at limit 1;
    if v_kiosk is null then insert into public.kiosks (branch_id, label) values (p_branch, 'Main kiosk') returning id into v_kiosk; end if;
  end if;
  update public.kiosks set last_seen = now() where id = v_kiosk;   -- heartbeat
  return v_kiosk;
end; $function$
;

-- DROP FUNCTION public.rls_auto_enable();

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- DROP FUNCTION public.role_rank(text);

CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_role
    when 'super_admin'  then 5
    when 'brand_owner'  then 4
    when 'branch_owner' then 3
    when 'manager'      then 2
    when 'staff'        then 1
    else 0 end;
$function$
;

-- DROP FUNCTION public.start_break(float8, float8);

CREATE OR REPLACE FUNCTION public.start_break(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := auth.uid(); v_session public.attendance_logs%rowtype; v_breaks jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select * into v_session from public.attendance_logs
    where user_id = v_uid and status in ('active','on-break') order by created_at desc limit 1;
  if v_session.id is null or v_session.status <> 'active' then raise exception 'You are not clocked in.'; end if;
  v_breaks := coalesce(v_session.breaks, '[]'::jsonb);
  if exists (select 1 from jsonb_array_elements(v_breaks) e where (e->>'end') is null) then
    raise exception 'You are already on a break.';
  end if;
  v_breaks := v_breaks || jsonb_build_array(jsonb_build_object(
    'start', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'end', null));
  update public.attendance_logs set breaks = v_breaks, status = 'on-break' where id = v_session.id;
  perform public.geo_checkpoint(v_session.id, p_lat, p_lng);
  return jsonb_build_object('ok', true);
end; $function$
;

-- DROP FUNCTION public.sync_attendance_events(jsonb);

CREATE OR REPLACE FUNCTION public.sync_attendance_events(p_events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_branch uuid; v_qr boolean;
  e jsonb;
  v_uuid uuid; v_action text; v_at timestamptz; v_code text; v_device text;
  v_wd date; v_valid boolean; v_logid uuid; v_err text; v_status text; v_last int;
  v_session public.attendance_logs%rowtype;
  v_results jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  select qr_required into v_qr from public.branch_settings where branch_id = v_branch;

  for e in select value from jsonb_array_elements(p_events) loop
    v_uuid   := (e->>'event_uuid')::uuid;
    v_action := e->>'action';
    v_at     := (e->>'captured_at')::timestamptz;
    v_code   := e->>'code';
    v_device := e->>'device_id';
    v_err := null; v_logid := null; v_status := 'applied';

    -- 1) idempotent dedupe
    if exists (select 1 from public.attendance_events where event_uuid = v_uuid) then
      v_results := v_results || jsonb_build_object('event_uuid', v_uuid, 'status', 'duplicate');
      continue;
    end if;

    -- 2) retro code validation (only meaningful when the branch requires it)
    v_valid := case when coalesce(v_qr, false) then public.code_valid_at(v_branch, v_code, v_at, 4) else null end;
    v_wd := (v_at at time zone 'utc')::date;

    -- 3) apply to the session table (conflict-safe)
    begin
      if v_action = 'clock_in' then
        if exists (select 1 from public.attendance_logs where user_id = v_uid and work_date = v_wd and status in ('active','on-break')) then
          v_err := 'already_clocked_in';
        else
          insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, status, approval_status, breaks, source, device_id)
          values (v_uid, v_branch, v_wd, v_at, 'active', 'pending', '[]'::jsonb, 'offline', v_device)
          returning id into v_logid;
        end if;

      elsif v_action = 'clock_out' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status not in ('active','on-break') then
          v_err := 'no_open_session';
        else
          update public.attendance_logs
            set clock_out = v_at, status = 'complete', approval_status = 'pending',
                duration_mins = greatest(0, round(extract(epoch from (v_at - clock_in)) / 60.0)),
                source = 'offline', device_id = coalesce(device_id, v_device)
            where id = v_session.id;
          v_logid := v_session.id;
        end if;

      elsif v_action = 'break_start' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status <> 'active' then
          v_err := 'no_active_session';
        else
          update public.attendance_logs
            set status = 'on-break',
                breaks = coalesce(breaks, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('start', v_at))
            where id = v_session.id;
          v_logid := v_session.id;
        end if;

      elsif v_action = 'break_end' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status <> 'on-break' then
          v_err := 'no_open_break';
        else
          v_last := jsonb_array_length(coalesce(v_session.breaks, '[]'::jsonb)) - 1;
          update public.attendance_logs
            set status = 'active',
                breaks = jsonb_set(coalesce(breaks, '[]'::jsonb), array[v_last::text, 'end'], to_jsonb(v_at))
            where id = v_session.id and v_last >= 0;
          v_logid := v_session.id;
        end if;

      else
        v_err := 'unknown_action';
      end if;
    exception when others then
      v_err := 'apply_error: ' || sqlerrm;
    end;

    -- 4) record the event no matter what (audit; never lost)
    insert into public.attendance_events
      (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id, error)
    values
      (v_uuid, v_uid, v_branch, v_device, v_action, v_at, 'offline', v_code, v_valid, 'synced', v_logid, v_err);

    if v_err is not null then v_status := 'recorded_with_error'; end if;
    v_results := v_results || jsonb_build_object('event_uuid', v_uuid, 'status', v_status, 'error', v_err);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results);
end;
$function$
;