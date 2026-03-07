# Insurance Incident Management System

A full-stack insurance claims management system with AI-powered document analysis, built with Django REST Framework and React TypeScript.

## Features

- **Customer Portal**: Submit claims, upload documents, track status
- **Agent Dashboard**: Review claims, approve/reject, request additional info
- **AI Analysis**: Automated document extraction and damage assessment using Groq LLM
- **Async Processing**: Celery workers for background AI tasks
- **Email Notifications**: Automated status update emails

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Django 5.0 + Django REST Framework |
| Frontend | React 18 + TypeScript + Vite |
| Database | PostgreSQL 15 |
| File Storage | AWS S3 / MinIO |
| Task Queue | Celery + Redis |
| AI/LLM | Groq API |
| Styling | Tailwind CSS |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Using Docker Compose

1. Clone the repository and navigate to the project directory:

```bash
cd insurance-incident-system
```

2. Copy the environment file and add your Groq API key:

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

3. Start all services:

```bash
docker-compose up -d
```

4. Access the applications:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - MinIO Console: http://localhost:9001 (admin: minioadmin/minioadmin)

5. Create a superuser (agent):

```bash
docker-compose exec backend python manage.py createsuperuser
```

### Local Development

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp ../.env.example .env

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# In another terminal, run Celery worker
celery -A celery_app worker -l info
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/register/` - Customer registration
- `POST /api/auth/login/` - JWT token obtain
- `POST /api/auth/token/refresh/` - Refresh JWT token
- `GET /api/auth/me/` - Get current user profile

### Customer Tickets

- `POST /api/tickets/` - Create new ticket
- `GET /api/tickets/` - List customer's tickets
- `GET /api/tickets/{id}/` - Get ticket details
- `POST /api/tickets/{id}/respond/` - Respond to info request

### Agent Actions

- `GET /api/agent/tickets/` - List all tickets
- `GET /api/agent/tickets/{id}/` - Get ticket with AI analysis
- `POST /api/agent/tickets/{id}/approve/` - Approve ticket
- `POST /api/agent/tickets/{id}/reject/` - Reject ticket
- `POST /api/agent/tickets/{id}/request-info/` - Request more info
- `POST /api/agent/tickets/{id}/notes/` - Add note

### Documents

- `POST /api/documents/` - Upload document

## Project Structure

```
insurance-incident-system/
├── backend/
│   ├── config/                 # Django settings
│   ├── apps/
│   │   ├── accounts/           # User auth & profiles
│   │   ├── tickets/            # Ticket management
│   │   ├── documents/          # File handling
│   │   ├── ai_services/        # AI integration
│   │   └── notifications/      # Email notifications
│   ├── celery_app/             # Celery configuration
│   ├── templates/emails/       # Email templates
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/
│   │   │   ├── customer/       # Customer portal pages
│   │   │   └── agent/          # Agent dashboard pages
│   │   ├── services/           # API client
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript types
│   └── package.json
├── docker-compose.yml
└── .env.example
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Django secret key | dev-secret-key |
| `DEBUG` | Debug mode | True |
| `DB_*` | PostgreSQL connection | localhost:5432 |
| `GROQ_API_KEY` | Groq API key for LLM | - |
| `AWS_*` | S3/MinIO configuration | MinIO defaults |
| `CELERY_BROKER_URL` | Redis URL for Celery | redis://localhost:6379/0 |
| `EMAIL_*` | SMTP configuration | Console backend |

## License

MIT
