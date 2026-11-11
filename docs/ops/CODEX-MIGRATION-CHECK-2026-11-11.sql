-- READ ONLY. Run in Schnitzery project vxwtmtlkwvwcdegtcjuz, not FarmersFresh.
-- Existence is a triage check, NOT proof that a function body, RLS, grants or full migration matches.
-- Do not mark migrations applied from this output alone; inspect patch definitions before repair.
with checks as (
select '20261024034605'::text as version, '20261024034605_inventory_count_sessions.sql'::text as file, 'public.inventory_count_sessions'::text as main_object, to_regclass('public.inventory_count_sessions') is not null as object_present
union all
select '20261024041539'::text as version, '20261024041539_inventory_operations.sql'::text as file, 'public.inventory_suppliers'::text as main_object, to_regclass('public.inventory_suppliers') is not null as object_present
union all
select '20261024200000'::text as version, '20261024200000_security_hardening.sql'::text as file, 'public.guard_users_sensitive_update'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_users_sensitive_update') as object_present
union all
select '20261025062639'::text as version, '20261025062639_inventory_batch_hardening.sql'::text as file, 'private.guard_batch_update'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='guard_batch_update') as object_present
union all
select '20261030090000'::text as version, '20261030090000_kiosk_token_window.sql'::text as file, 'public.clock_token_batch'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='clock_token_batch') as object_present
union all
select '20261101074231'::text as version, '20261101074231_inventory_recipe_costing.sql'::text as file, 'public.inventory_recipe_versions'::text as main_object, to_regclass('public.inventory_recipe_versions') is not null as object_present
union all
select '20261101090000'::text as version, '20261101090000_payroll_datev_settings.sql'::text as file, 'public.payroll_settings.datev'::text as main_object, exists(select 1 from information_schema.columns where table_schema='public' and table_name='payroll_settings' and column_name='datev') as object_present
union all
select '20261101100000'::text as version, '20261101100000_tip_pool.sql'::text as file, 'public.tip_pools'::text as main_object, to_regclass('public.tip_pools') is not null as object_present
union all
select '20261101125825'::text as version, '20261101125825_inventory_recipe_retry_conflict.sql'::text as file, 'private.save_inventory_recipe'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='save_inventory_recipe') as object_present
union all
select '20261103101702'::text as version, '20261103101702_inventory_preparation_planning.sql'::text as file, 'public.inventory_recipe_yields'::text as main_object, to_regclass('public.inventory_recipe_yields') is not null as object_present
union all
select '20261103102620'::text as version, '20261103102620_inventory_recipe_optional_selling_price.sql'::text as file, 'public.inventory_recipe_versions.net_price'::text as main_object, exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory_recipe_versions' and column_name='net_price') as object_present
union all
select '20261103125715'::text as version, '20261103125715_inventory_receiving_batches.sql'::text as file, 'public.inventory_purchases.delivery_command'::text as main_object, exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory_purchases' and column_name='delivery_command') as object_present
union all
select '20261104090000'::text as version, '20261104090000_audit_log_and_close_shift.sql'::text as file, 'public.audit_logs_branch_time'::text as main_object, to_regclass('public.audit_logs_branch_time') is not null as object_present
union all
select '20261104100000'::text as version, '20261104100000_kiosk_offline_once.sql'::text as file, 'public.notify'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify') as object_present
union all
select '20261104123000'::text as version, '20261104123000_inventory_purchase_packs.sql'::text as file, 'public.inventory_purchase_packs'::text as main_object, to_regclass('public.inventory_purchase_packs') is not null as object_present
union all
select '20261104133000'::text as version, '20261104133000_inventory_supplier_returns.sql'::text as file, 'public.inventory_supplier_returns'::text as main_object, to_regclass('public.inventory_supplier_returns') is not null as object_present
union all
select '20261104143000'::text as version, '20261104143000_inventory_invoice_costs.sql'::text as file, 'private.inventory_operation'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='inventory_operation') as object_present
union all
select '20261104160000'::text as version, '20261104160000_inventory_manual_production.sql'::text as file, 'public.inventory_production_runs'::text as main_object, to_regclass('public.inventory_production_runs') is not null as object_present
union all
select '20261104161047'::text as version, '20261104161047_production_costs_and_reversals.sql'::text as file, 'public.inventory_production_reversals'::text as main_object, to_regclass('public.inventory_production_reversals') is not null as object_present
union all
select '20261104161758'::text as version, '20261104161758_pos_import_pipeline.sql'::text as file, 'public.pos_connections'::text as main_object, to_regclass('public.pos_connections') is not null as object_present
union all
select '20261104170156'::text as version, '20261104170156_production_reversal_labels.sql'::text as file, 'private.reverse_inventory_production'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='reverse_inventory_production') as object_present
union all
select '20261104190000'::text as version, '20261104190000_inventory_price_versions.sql'::text as file, 'public.inventory_price_imports'::text as main_object, to_regclass('public.inventory_price_imports') is not null as object_present
union all
select '20261105162633'::text as version, '20261105162633_inventory_lot_transfers.sql'::text as file, 'public.inventory_transfer_lots'::text as main_object, to_regclass('public.inventory_transfer_lots') is not null as object_present
union all
select '20261105163333'::text as version, '20261105163333_inventory_pos_recipe_consumption.sql'::text as file, 'public.pos_stock_posts'::text as main_object, to_regclass('public.pos_stock_posts') is not null as object_present
union all
select '20261105163337'::text as version, '20261105163337_inventory_valuation_closes.sql'::text as file, 'public.inventory_batch_net_costs'::text as main_object, to_regclass('public.inventory_batch_net_costs') is not null as object_present
union all
select '20261107120000'::text as version, '20261107120000_notifications_cleanup_indexes.sql'::text as file, 'public.notifications_user_created'::text as main_object, to_regclass('public.notifications_user_created') is not null as object_present
union all
select '20261108090000'::text as version, '20261108090000_checklist_templates.sql'::text as file, 'public.checklist_templates'::text as main_object, to_regclass('public.checklist_templates') is not null as object_present
union all
select '20261108120000'::text as version, '20261108120000_prep_lists.sql'::text as file, 'public.prep_items'::text as main_object, to_regclass('public.prep_items') is not null as object_present
union all
select '20261108150000'::text as version, '20261108150000_shift_leader_inventory.sql'::text as file, 'private.shift_supplier_names'::text as main_object, exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='shift_supplier_names') as object_present
union all
select '20261109090000'::text as version, '20261109090000_day_closes.sql'::text as file, 'public.day_closes'::text as main_object, to_regclass('public.day_closes') is not null as object_present
union all
select '20261109120000'::text as version, '20261109120000_cover_swaps.sql'::text as file, 'public.cover_requests.return_work_date'::text as main_object, exists(select 1 from information_schema.columns where table_schema='public' and table_name='cover_requests' and column_name='return_work_date') as object_present
union all
select '20261109150000'::text as version, '20261109150000_temp_rooms.sql'::text as file, 'public.temp_units.room'::text as main_object, exists(select 1 from information_schema.columns where table_schema='public' and table_name='temp_units' and column_name='room') as object_present
union all
select '20261109170000'::text as version, '20261109170000_leave_types.sql'::text as file, 'public.leave_requests.leave_type'::text as main_object, exists(select 1 from information_schema.columns where table_schema='public' and table_name='leave_requests' and column_name='leave_type') as object_present
)
select c.*, exists(select 1 from supabase_migrations.schema_migrations m where m.version=c.version) as version_recorded
from checks c order by version;
