# Terraform — GCP (Cloud Run) starter

Provisions: Artifact Registry repo, two Secret Manager secrets, a runtime service
account with access to them, and a public Cloud Run service running the web image.
**Starter — review before applying.** Secret values never live in Terraform.

## First-time
```bash
gcloud auth application-default login
cp terraform.tfvars.example terraform.tfvars   # fill in (no secrets)

terraform init
terraform apply -target=google_project_service.svc          # enable APIs first
terraform apply -target=google_artifact_registry_repository.repo
terraform apply -target=google_secret_manager_secret.svc_role \
                -target=google_secret_manager_secret.vapid_private

# add the actual secret values (out of band — not in code/state):
printf '%s' "THE_SERVICE_ROLE_KEY" | gcloud secrets versions add svc-role --data-file=-
printf '%s' "THE_VAPID_PRIVATE_KEY" | gcloud secrets versions add vapid-private --data-file=-

# build + push the image (from repo root), then:
terraform apply   # creates the Cloud Run service; prints the URL
```

## Notes
- Region defaults to **europe-west3 (Frankfurt)** to keep data in the EU (GDPR).
- `terraform.tfvars` and `*.tfstate` are secrets/infra state — add them to `.gitignore`
  (state ideally in a GCS backend; see `versions.tf`).
- This deploys the **web app only**. `apps/api` / `apps/agents` get their own Cloud Run
  services later (copy the `google_cloud_run_v2_service` block) — after the monorepo
  split in `docs/architecture/MONOREPO-MIGRATION.md`.
- Cloud Run scales to zero (min instances 0) so idle cost is ~nil; raise `min_instance_count`
  if cold starts bother you.
