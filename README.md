# Sparkflow

Sparkflow is a polyglot open-innovation platform built to practice microservices and hexagonal
architecture.

## Architecture

- `apps/api-gateway`: public HTTP API.
- `apps/challenge-service`: challenge lifecycle.
- `apps/submission-service`: startup submissions and accept/reject decisions.
- `apps/evaluation-service`: Python/FastAPI service for reviewer scoring.
- `apps/notification-service`: event-driven notifications.
- `apps/identity-service`: fake identity directory for V1.
- `apps/web`: Angular dashboard with a light hexagonal frontend structure.

Backend services keep domain/application code independent from Fastify, FastAPI, PostgreSQL, and
NATS.

## Run

```bash
pnpm install
pnpm infra:up
pnpm dev:backend
```

In another terminal:

```bash
cd apps/evaluation-service
uv sync
uv run fastapi dev src/main.py --port 4004
```

For the Angular UI:

```bash
pnpm --filter @sparkflow/web dev
```

Default ports:

- API gateway: `3000`
- Identity service: `4000`
- Challenge service: `4001`
- Submission service: `4002`
- Notification service: `4003`
- Evaluation service: `4004`
- Angular app: `4200`

## Fake auth

The gateway forwards these headers:

```txt
x-user-id
x-organization-id
x-role
```

Supported roles:

- `company-admin`
- `startup-member`
- `reviewer`

## Design reference

The dashboard concept used for the Angular direction is stored at:

```txt
docs/sparkflow-dashboard-concept.png
```
