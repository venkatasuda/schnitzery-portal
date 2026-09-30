variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "europe-west3" # Frankfurt — keep data in the EU (GDPR)
}
variable "service_name" {
  type    = string
  default = "schnitzery-web"
}
variable "image" {
  type        = string
  description = "Full image ref, e.g. europe-west3-docker.pkg.dev/PROJECT/schnitzery/web:TAG"
}

# Public (build-time) config — safe to pass as plain env.
variable "supabase_url" { type = string }
variable "supabase_anon_key" { type = string }
variable "vapid_public_key" { type = string }
variable "vapid_subject" {
  type    = string
  default = "mailto:admin@schnitzery-stuttgart.de"
}
