[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 1945
unverified_code_nodes: 0
raw_edges: 5156
valid_candidate_edges: 5090
missing_endpoint_edges: 0
dangling_endpoint_edges: 20
external_reference_edges: 46
self_loop_edges: 3
exact_duplicate_edges: 1
directed_unique_endpoint_pairs: 4851
directed_same_endpoint_collapsed_edges: 239
undirected_unique_endpoint_pairs: 4851
undirected_same_endpoint_collapsed_edges: 239
same_endpoint_group_count: 213
relation_variant_groups: 129
source_file_variant_groups: 0
source_location_variant_groups: 83
context_variant_groups: 0
post_build_graph_type: Graph
post_build_edges: 4917
producer_suppression_sites: 12
producer_suppression_examples:
  - L1661 seen_ids arity=unknown
  - L2194 seen_ids arity=unknown
  - L2196 seen_doc_refs arity=unknown
  - L2613 seen_ids arity=unknown
  - L2760 seen_ids arity=unknown
  - L3486 seen_keys arity=unknown
  - L3655 seen_keys arity=unknown
  - L5762 seen_ids arity=unknown
examples:
  - supabase_schema_production_functions_public_sync_attendance_events -> supabase_schema_production_functions_sql_public_attendance_logs edges=8 relations=['reads_from'] locations=['L2861', 'L2870', 'L2884', 'L2897', 'L4033', 'L4042', 'L4056', 'L4069'] contexts=['']
  - supabase_schema_production_functions_public_notification_sweep -> supabase_schema_production_functions_sql_public_users edges=6 relations=['reads_from'] locations=['L2569', 'L2647', 'L2657', 'L3741', 'L3819', 'L3829'] contexts=['']
  - supabase_pending_01_safe_fixes_public_sync_attendance_events -> supabase_pending_01_safe_fixes_sql_public_attendance_logs edges=4 relations=['reads_from'] locations=['L111', 'L120', 'L134', 'L147'] contexts=['']
  - supabase_pending_02_attendance_enforcement_public_sync_attendance_events -> supabase_pending_02_attendance_enforcement_sql_public_attendance_logs edges=4 relations=['reads_from'] locations=['L111', 'L120', 'L134', 'L147'] contexts=['']
  - supabase_schema_production_functions_public_audit_user_document -> supabase_schema_production_functions_sql_public_users edges=4 relations=['reads_from'] locations=['L1808', 'L1835', 'L2980', 'L3007'] contexts=['']
note: normal graph.json is post-build; raw producer loss must be measured earlier.