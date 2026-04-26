#!/bin/sh
set -e
PORT="${PORT:-8080}"
python manage.py migrate --noinput

# Seed initial agent from env vars (no-op if already exists)
if [ -n "$INITIAL_AGENT_EMAIL" ] && [ -n "$INITIAL_AGENT_PASSWORD" ]; then
  python manage.py create_agent \
    --email "$INITIAL_AGENT_EMAIL" \
    --password "$INITIAL_AGENT_PASSWORD" \
    --first-name "${INITIAL_AGENT_FIRST_NAME:-Agent}" \
    --last-name "${INITIAL_AGENT_LAST_NAME:-User}"
fi

exec daphne -b 0.0.0.0 -p "$PORT" config.asgi:application
