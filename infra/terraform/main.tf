# Schnitzery — GCP deploy (Cloud Run + Artifact Registry + Secret Manager).
# STARTER: review before applying. Secret VALUES are never stored here — only
# references; you add the actual values with `gcloud secrets versions add`.

# ── Enable the APIs this stack needs ─────────────────────────────────────────
resource "google_project_service" "svc" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ── Container registry ───────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "schnitzery"
  format        = "DOCKER"
  depends_on    = [google_project_service.svc]
}

# ── Secrets (create the containers here; add values out-of-band) ──────────────
# gcloud secrets versions add svc-role       --data-file=- <<< "THE_KEY"
# gcloud secrets versions add vapid-private   --data-file=- <<< "THE_KEY"
resource "google_secret_manager_secret" "svc_role" {
  secret_id = "svc-role"
  replication { auto {} }
  depends_on = [google_project_service.svc]
}
resource "google_secret_manager_secret" "vapid_private" {
  secret_id = "vapid-private"
  replication { auto {} }
  depends_on = [google_project_service.svc]
}

# ── Runtime service account + access to the two secrets ───────────────────────
resource "google_service_account" "run" {
  account_id   = "schnitzery-web-run"
  display_name = "Schnitzery web (Cloud Run)"
}
resource "google_secret_manager_secret_iam_member" "svc_role_access" {
  secret_id = google_secret_manager_secret.svc_role.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}
resource "google_secret_manager_secret_iam_member" "vapid_access" {
  secret_id = google_secret_manager_secret.vapid_private.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

# ── The Cloud Run service ────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "web" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email
    scaling { min_instance_count = 0, max_instance_count = 4 }

    containers {
      image = var.image
      ports { container_port = 3000 }

      # Public config (safe as plain env).
      env { name = "NEXT_PUBLIC_SUPABASE_URL"      value = var.supabase_url }
      env { name = "NEXT_PUBLIC_SUPABASE_ANON_KEY" value = var.supabase_anon_key }
      env { name = "NEXT_PUBLIC_VAPID_PUBLIC_KEY"  value = var.vapid_public_key }
      env { name = "VAPID_PUBLIC_KEY"              value = var.vapid_public_key }
      env { name = "VAPID_SUBJECT"                 value = var.vapid_subject }

      # Secrets — injected from Secret Manager, never in code or state.
      env {
        name = "SUPABASE_SERVICE_ROLE_KEY"
        value_source { secret_key_ref { secret = google_secret_manager_secret.svc_role.secret_id, version = "latest" } }
      }
      env {
        name = "VAPID_PRIVATE_KEY"
        value_source { secret_key_ref { secret = google_secret_manager_secret.vapid_private.secret_id, version = "latest" } }
      }
    }
  }
  depends_on = [google_project_service.svc]
}

# ── Make it publicly reachable (it's a staff login app; auth is in-app) ───────
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.web.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "url" { value = google_cloud_run_v2_service.web.uri }
