# Backend Readiness

This document defines the backend baseline required before starting the Angular application.

## Public API Surface

The frontend must talk only to `apps/api-gateway`.

Gateway endpoints currently covered by tests:

```txt
POST /challenges
POST /challenges/:challengeId/publish
GET /challenges
POST /challenges/:challengeId/submissions
GET /challenges/:challengeId/submissions
POST /submissions/:submissionId/evaluations
POST /submissions/:submissionId/accept
POST /submissions/:submissionId/reject
GET /notifications
```

Fake auth is still header-based:

```txt
x-user-id
x-organization-id
x-role
```

Supported roles:

```txt
company-admin
startup-member
reviewer
```

## Local Infrastructure

Start PostgreSQL and NATS JetStream:

```bash
pnpm infra:up
```

Docker Compose creates one PostgreSQL database per service:

```txt
sparkflow_identity
sparkflow_challenge
sparkflow_submission
sparkflow_evaluation
sparkflow_notification
```

## Checks

Run fast checks:

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Run Docker-backed integration checks:

```bash
pnpm test:integration:backend
```

That command runs:

```txt
challenge-service PostgreSQL repository tests
challenge-service NATS publisher tests
submission-service PostgreSQL repository tests
submission-service NATS publisher tests
notification-service PostgreSQL repository tests
notification-service NATS consumer tests
evaluation-service PostgreSQL repository tests
evaluation-service NATS publisher tests
evaluation-service HTTP/application/contract tests
```

## Frontend Gate

Before starting Angular, keep this invariant:

```txt
pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm test:integration:backend
```

If this fails, fix the backend first. The UI should not compensate for backend contract drift.
