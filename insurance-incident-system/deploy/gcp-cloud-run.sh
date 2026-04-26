#!/usr/bin/env bash
# Deploy Opscident backend + frontend to Google Cloud Run (scale-to-zero; pay per use).
#
# Prereqs: gcloud CLI installed and logged in (`gcloud auth login`), billing enabled on the project.
#
# Required env vars:
#   GCP_PROJECT_ID   Your GCP project ID
#   DJANGO_SECRET_KEY  Strong secret (do not commit). Example:
#                      python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
#
# Optional:
#   GCP_REGION              Default: us-central1
#   ARTIFACT_REPO           Default: opscident
#   BACKEND_SERVICE         Default: opscident-backend
#   FRONTEND_SERVICE        Default: opscident-frontend
#   GROQ_API_KEY            If unset, AI features may be limited
#
# Optional Postgres (otherwise SQLite is used — data is NOT durable across Cloud Run restarts):
#   DB_HOST DB_NAME DB_USER DB_PASSWORD DB_PORT
#
# Config file (recommended): copy deploy/env.deploy.example → deploy/.env.deploy (gitignored).
#
# Cost note: This script only enables Run + Artifact Registry + Cloud Build (all have free tiers).
#            Avoid Cloud SQL / Redis / Load Balancer unless you accept their pricing.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f deploy/.env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source deploy/.env.deploy
  set +a
fi

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${DJANGO_SECRET_KEY:?Set DJANGO_SECRET_KEY (use a long random string; never commit it)}"

REGION="${GCP_REGION:-us-central1}"
REPO="${ARTIFACT_REPO:-opscident}"
BACKEND_SVC="${BACKEND_SERVICE:-opscident-backend}"
FRONTEND_SVC="${FRONTEND_SERVICE:-opscident-frontend}"

AR_HOST="${REGION}-docker.pkg.dev"
BACKEND_IMAGE="${AR_HOST}/${GCP_PROJECT_ID}/${REPO}/backend:latest"
FRONTEND_IMAGE="${AR_HOST}/${GCP_PROJECT_ID}/${REPO}/frontend:latest"

echo "==> Project: ${GCP_PROJECT_ID}  Region: ${REGION}"
gcloud config set project "${GCP_PROJECT_ID}" >/dev/null

echo "==> Enabling required APIs (idempotent)"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --quiet

echo "==> Artifact Registry repo: ${REPO}"
if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Opscident images" \
    --quiet
fi

gcloud auth configure-docker "${AR_HOST}" --quiet

echo "==> Build & push backend (Cloud Build)"
gcloud builds submit . \
  --config=deploy/cloudbuild-backend.yaml \
  --substitutions="_IMAGE=${BACKEND_IMAGE}"

echo "==> Deploy backend (Cloud Run)"
BACKEND_ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/opscident-backend-env.XXXXXX.yaml")"
cleanup_env_file() { rm -f "$BACKEND_ENV_FILE"; }
trap cleanup_env_file EXIT

python3 - "$BACKEND_ENV_FILE" <<'PY'
import os
import sys

def esc(v: str) -> str:
    return str(v).replace("'", "''")

path = sys.argv[1]
rows = [
    ("DEBUG", "False"),
    ("DJANGO_SECRET_KEY", os.environ["DJANGO_SECRET_KEY"]),
    ("ALLOWED_HOSTS", "*"),
    ("CELERY_TASK_ALWAYS_EAGER", "True"),
    ("CHANNEL_LAYER_INMEMORY", "True"),
]
if os.environ.get("GROQ_API_KEY"):
    rows.append(("GROQ_API_KEY", os.environ["GROQ_API_KEY"]))
if os.environ.get("INITIAL_AGENT_EMAIL"):
    rows.extend([
        ("INITIAL_AGENT_EMAIL",      os.environ["INITIAL_AGENT_EMAIL"]),
        ("INITIAL_AGENT_PASSWORD",   os.environ["INITIAL_AGENT_PASSWORD"]),
        ("INITIAL_AGENT_FIRST_NAME", os.environ.get("INITIAL_AGENT_FIRST_NAME", "Agent")),
        ("INITIAL_AGENT_LAST_NAME",  os.environ.get("INITIAL_AGENT_LAST_NAME", "User")),
    ])
if os.environ.get("DB_HOST"):
    rows.extend(
        [
            ("DB_HOST", os.environ["DB_HOST"]),
            ("DB_NAME", os.environ.get("DB_NAME", "insurance_db")),
            ("DB_USER", os.environ["DB_USER"]),
            ("DB_PASSWORD", os.environ["DB_PASSWORD"]),
            ("DB_PORT", os.environ.get("DB_PORT", "5432")),
        ]
    )
with open(path, "w", encoding="utf-8") as f:
    for k, v in rows:
        f.write("%s: '%s'\n" % (k, esc(v)))
PY

# CORS + FRONTEND_URL are set after the frontend URL is known.
gcloud run deploy "${BACKEND_SVC}" \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --env-vars-file "${BACKEND_ENV_FILE}" \
  --quiet

rm -f "$BACKEND_ENV_FILE"
trap - EXIT

BACKEND_URL="$(gcloud run services describe "${BACKEND_SVC}" --region "${REGION}" --format='value(status.url)')"
echo "    Backend URL: ${BACKEND_URL}"

API_BASE="${BACKEND_URL}/api"
echo "==> Build & push frontend (VITE_API_BASE_URL=${API_BASE})"
gcloud builds submit . \
  --config=deploy/cloudbuild-frontend.yaml \
  --substitutions="_IMAGE=${FRONTEND_IMAGE},_VITE_API_BASE_URL=${API_BASE}"

echo "==> Deploy frontend (Cloud Run)"
gcloud run deploy "${FRONTEND_SVC}" \
  --image "${FRONTEND_IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --quiet

FRONTEND_URL="$(gcloud run services describe "${FRONTEND_SVC}" --region "${REGION}" --format='value(status.url)')"
echo "    Frontend URL: ${FRONTEND_URL}"

echo "==> Update backend CORS + FRONTEND_URL"
gcloud run services update "${BACKEND_SVC}" \
  --region "${REGION}" \
  --update-env-vars "CORS_ALLOWED_ORIGINS=${FRONTEND_URL},FRONTEND_URL=${FRONTEND_URL}" \
  --quiet

echo ""
echo "Done."
echo "  Frontend: ${FRONTEND_URL}"
echo "  Backend:  ${BACKEND_URL}"
echo ""
echo "Notes:"
echo "  - SQLite on Cloud Run is ephemeral; use DB_* env vars + Postgres for real data."
echo "  - Uploaded files need USE_S3=true and bucket settings for durable storage."
echo "  - WebSockets require HTTPS; use the https:// frontend URL."
