# Opscident - Intelligent Incident Report Analyzer with AI

An AI-powered full-stack insurance claims platform. Customers submit claims with photo/video evidence; the AI automatically analyses damage and approves or rejects in real time. Agents handle edge cases and monitor performance via an analytics dashboard.

---

## Live Deployment (Google Cloud Run)

| Service | URL |
|---|---|
| Frontend | https://opscident-frontend-529242007131.us-central1.run.app |
| Backend  |  https://opscident-backend-529242007131.us-central1.run.app/health/ |

**Agent portal login**
- URL: `/agent/login`
- Email: `agent@opscident.com`
- Password: `Agent@123456`

---

## Features

### Customer Portal
- Register / login and submit insurance claims
- Upload photos, videos, and PDF documents as evidence
- Voice-to-claim: record audio and AI extracts claim fields
- Real-time status updates via WebSocket
- In-app chatbot for claim status queries
- Appeal rejected claims

### Agent Portal
- Separate login at `/agent/login`
- Dashboard showing claims requiring attention
- Review AI decisions, override approve / reject / request info
- Internal notes per claim
- Analytics dashboard — daily submissions, weekly approvals, payout trends, incident breakdown
- Export analytics to CSV

### AI Engine (Groq)
- **Image analysis**: Vision model scores damage severity and fraud indicators
- **Auto-approval**: Image uploaded + no fraud signals → claim approved with `approved_amount` set
- **Auto-rejection**: Clear fraud (≥ 2 indicators) or vehicle type mismatch → rejected
- **PDF extraction**: Text LLM extracts incident details from uploaded documents
- **Video analysis**: Frame extraction + audio transcription via Whisper
- **Fraud detection**: Deterministic vehicle-type mismatch check (bike vs car)

### Notifications
- In-app notification bell
- Email notifications on status changes (approval, rejection, info request)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.0 + Django REST Framework |
| Async server | Daphne (ASGI) + Django Channels |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State management | Zustand |
| Charts | Recharts |
| Database | PostgreSQL 15 (Cloud SQL in production) |
| File storage | AWS S3 / MinIO |
| Task queue | Celery + Redis |
| AI / LLM | Groq API — `llama-4-scout` (vision), `llama-3.3-70b` (text), `whisper-large-v3-turbo` (audio) |
| Auth | JWT (SimpleJWT) — 15 min access / 7 day refresh |
| Real-time | Django Channels WebSockets |
| Deployment | Google Cloud Run + Artifact Registry + Cloud Build |

---

## Project Structure

```
insurance-incident-system/
├── backend/
│   ├── config/                   # Django settings, ASGI, URLs
│   ├── apps/
│   │   ├── accounts/             # Custom User model, JWT auth, password reset
│   │   │   └── management/commands/create_agent.py
│   │   ├── tickets/              # Ticket CRUD, agent views, analytics
│   │   ├── documents/            # File upload, type detection
│   │   ├── ai_services/          # Groq integration, damage scoring, auto-decision
│   │   └── notifications/        # In-app + email notifications
│   ├── Dockerfile.cloudrun
│   └── entrypoint-cloudrun.sh    # Runs migrations + seeds initial agent on start
├── frontend/
│   └── src/
│       ├── components/           # Layout, ChatWidget, FraudRiskPanel, LiveStatusTracker
│       ├── pages/
│       │   ├── customer/         # Dashboard, TicketCreate, TicketDetail
│       │   └── agent/            # Dashboard, Analytics, TicketDetail
│       ├── hooks/                # useTicketSocket (WebSocket)
│       ├── services/api.ts       # Axios API client
│       ├── store/authStore.ts    # Zustand auth state
│       └── types/index.ts        # Shared TypeScript types
├── deploy/
│   ├── gcp-cloud-run.sh          # Full GCP deployment script
│   ├── cloudbuild-backend.yaml
│   ├── cloudbuild-frontend.yaml
│   └── .env.deploy               # Gitignored — GCP credentials & secrets
└── docker-compose.yml            # Local full-stack dev environment
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (optional, for Postgres / Redis / MinIO)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create a .env file (copy fields from .env.example or see variables below)
cp ../.env.example .env         # then fill in GROQ_API_KEY

python manage.py migrate
python manage.py create_agent --email agent@example.com --password Secret123 \
  --first-name Admin --last-name Agent
python manage.py runserver      # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

### Docker Compose (full stack)

```bash
docker-compose up -d
```

Services started: PostgreSQL, Redis, MinIO, backend (port 8000), Celery worker, frontend (port 5173).

---

## Key Environment Variables

| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for local, `False` in prod |
| `GROQ_API_KEY` | **Required** — Groq AI API key |
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL connection |
| `CLOUD_SQL_CONNECTION_NAME` | Cloud SQL Unix socket (Cloud Run only) |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
| `REDIS_URL` | Redis URL for Channels / Celery |
| `CELERY_TASK_ALWAYS_EAGER` | `True` runs tasks synchronously (local dev) |
| `CHANNEL_LAYER_INMEMORY` | `True` uses in-memory WS layer (single instance) |
| `USE_S3` | `True` enables S3/MinIO file storage |
| `AWS_*` | S3 / MinIO credentials and bucket |
| `EMAIL_*` | SMTP config for notification emails |
| `FRONTEND_URL` | Used in password-reset email links |
| `INITIAL_AGENT_EMAIL` / `INITIAL_AGENT_PASSWORD` | Auto-seeded agent on container start |

---

## AI Decision Logic

When a document is uploaded, the AI pipeline runs automatically:

```
Upload → analyze_image / analyze_video / analyze_pdf
       → generate_recommendation_and_decide
```

Decision rules (in priority order):

| Condition | Outcome |
|---|---|
| ≥ 2 fraud indicators detected | Auto-reject |
| Vehicle collision / damage claim with no image | Request photo |
| Vehicle type mismatch (bike claim, car photo) | Auto-reject |
| Image present + 0 fraud indicators | **Auto-approve** + set `approved_amount` |
| Image present + 1 fraud indicator | Escalate to agent |
| No visible damage (`score < 10`) | Reject |
| Low damage (`score 10–19`) | Request clearer photos |

`approved_amount` is set to `claim_amount` (customer-specified) or the AI's estimated minimum payout.

---

## Deployment (Google Cloud Run)

### First-time setup

```bash
# Install gcloud CLI, then:
gcloud auth login
gcloud auth configure-docker us-central1-docker.pkg.dev

# Fill in deploy/.env.deploy (see env.deploy.example)
bash deploy/gcp-cloud-run.sh
```

### Re-deploy after changes

```bash
export PATH="$PATH:/opt/homebrew/share/google-cloud-sdk/bin"
set -a; source deploy/.env.deploy; set +a

REGION="us-central1"
IMAGE_BASE="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/opscident"

# Build both
gcloud builds submit . --config=deploy/cloudbuild-backend.yaml \
  --substitutions="_IMAGE=${IMAGE_BASE}/backend:latest"
gcloud builds submit . --config=deploy/cloudbuild-frontend.yaml \
  --substitutions="_IMAGE=${IMAGE_BASE}/frontend:latest,_VITE_API_BASE_URL=https://<backend-url>/api"

# Deploy
gcloud run deploy opscident-backend --image "${IMAGE_BASE}/backend:latest" --region "${REGION}" ...
gcloud run deploy opscident-frontend --image "${IMAGE_BASE}/frontend:latest" --region "${REGION}" ...
```

### Infrastructure

| Resource | Details |
|---|---|
| Cloud Run backend | 512 MB, 1 CPU, scale-to-zero |
| Cloud Run frontend | 256 MB, 1 CPU, scale-to-zero |
| Cloud SQL | PostgreSQL 15, `db-f1-micro`, 10 GB SSD |
| Artifact Registry | `opscident` repo, `us-central1` |

### Creating additional agents

```bash
python manage.py create_agent \
  --email newagent@company.com \
  --password SecurePass123 \
  --first-name Jane \
  --last-name Smith
```

Or set `INITIAL_AGENT_EMAIL` / `INITIAL_AGENT_PASSWORD` in `.env.deploy` — the agent is seeded automatically on every container start (no-op if already exists).

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register/` | Customer registration |
| POST | `/api/auth/login/` | Login — returns JWT + user |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET/PUT | `/api/auth/me/` | Profile |
| POST | `/api/auth/forgot-password/` | Send reset link |
| POST | `/api/auth/reset-password/` | Reset with uid/token |

### Customer
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/tickets/` | List / create tickets |
| GET | `/api/tickets/{id}/` | Ticket detail + AI analysis |
| POST | `/api/tickets/{id}/respond/` | Submit additional info |

### Agent
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/agent/tickets/` | All tickets |
| POST | `/api/agent/tickets/{id}/approve/` | Approve |
| POST | `/api/agent/tickets/{id}/reject/` | Reject |
| POST | `/api/agent/tickets/{id}/request-info/` | Request more info |
| POST | `/api/agent/tickets/{id}/notes/` | Add note |
| GET | `/api/agent/tickets/stats/` | Dashboard stats |
| GET | `/api/agent/tickets/analytics/` | Full analytics data |

### Documents & AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/documents/` | Upload document (triggers AI) |
| POST | `/api/ai/transcribe/` | Voice → claim fields |
| POST | `/api/ai/chat/` | Customer chatbot |

### WebSocket
```
wss://<backend>/ws/tickets/{ticket_id}/?token=<access_token>
```
Emits `ticket.update` events: `processing_start`, `analyzing_image`, `fraud_checking`, `making_decision`, `decided`.

---

## License

MIT
