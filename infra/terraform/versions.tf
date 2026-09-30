terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  # Recommended once you have a project: store state in a GCS bucket, not locally.
  # backend "gcs" { bucket = "schnitzery-tfstate" prefix = "web" }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
