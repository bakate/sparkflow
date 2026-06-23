# Deployment

Sparkflow is deployed as independent backend services on Fly.io and a static Angular application on
Netlify.

## Backend on Fly.io

Each backend service owns its `Dockerfile` and `fly.toml`:

- `apps/api-gateway`
- `apps/identity-service`
- `apps/challenge-service`
- `apps/submission-service`
- `apps/notification-service`

Create the shared NATS app:

```sh
fly apps create sparkflow-nats
fly volumes create sparkflow_nats --app sparkflow-nats --region cdg --size 1
fly deploy . --config infra/nats/fly.toml
```

Create the Fly apps without deploying first:

```sh
fly apps create sparkflow-api-gateway
fly apps create sparkflow-identity-service
fly apps create sparkflow-challenge-service
fly apps create sparkflow-submission-service
fly apps create sparkflow-notification-service
```

## Infrastructure dependencies

Do not deploy service placeholders such as `DATABASE_URL="<challenge-database-url>"` or
`KEYCLOAK_ISSUER="https://<keycloak-host>/realms/sparkflow"`. They are documentation placeholders
and will crash the machines.

If machines are already crash-looping, stop them before provisioning the real dependencies:

```sh
fly scale count 0 --app sparkflow-api-gateway
fly scale count 0 --app sparkflow-challenge-service
fly scale count 0 --app sparkflow-submission-service
fly scale count 0 --app sparkflow-notification-service
```

### Postgres

Use Fly Managed Postgres for the first deployed environment:

region cdg is not available for Managed Postgres. Available regions: [ams fra gru iad lax lhr nrt
ord sin sjc syd yyz]

```sh
fly mpg create --name sparkflow-postgres --region cdg --plan basic
fly mpg list
```

Attach the created cluster to each service that needs a database:

```sh
fly mpg attach <cluster-id> -a sparkflow-challenge-service
fly mpg attach <cluster-id> -a sparkflow-submission-service
fly mpg attach <cluster-id> -a sparkflow-notification-service
```

Each attach sets a real `DATABASE_URL` secret on the target app and restarts it.

When `fly mpg attach` asks `Select user`, prefer `Create new user...` for each service instead of
reusing the shared `fly-user`. The services create their own tables on startup, so the selected user
must have schema/table creation privileges for the database it connects to. Use service-oriented
names when the CLI asks for them:

- `sparkflow-challenge-service-user`
- `sparkflow-submission-service-user`
- `sparkflow-notification-service-user`

### NATS

The application services communicate with NATS through Fly private networking:

```sh
fly secrets set --config apps/challenge-service/fly.toml \
  NATS_URL="nats://sparkflow-nats.internal:4222"

fly secrets set --config apps/submission-service/fly.toml \
  NATS_URL="nats://sparkflow-nats.internal:4222"

fly secrets set --config apps/notification-service/fly.toml \
  NATS_URL="nats://sparkflow-nats.internal:4222"
```

### Keycloak

`KEYCLOAK_ISSUER` must be a real public issuer URL. The placeholder
`https://<keycloak-host>/realms/sparkflow` is not a valid URL.

For a first deployment, use either:

- a managed or externally hosted Keycloak instance;
- a dedicated Keycloak app on Fly with its own Postgres database.

Whichever option is chosen, update the `sparkflow-web` Keycloak client with the deployed frontend
origin:

- redirect URI: `https://<netlify-site>.netlify.app/*`
- web origin: `https://<netlify-site>.netlify.app`

Then set the gateway secrets:

```sh
fly secrets set --config apps/api-gateway/fly.toml \
  KEYCLOAK_ISSUER="https://<real-keycloak-host>/realms/sparkflow" \
  KEYCLOAK_CLIENT_ID="sparkflow-web"
```

`fly secrets set` creates a new release by default. If a service was already deployed without
secrets, set the missing secrets and let Fly redeploy the machines. Use `--stage` only when secrets
must be prepared without deploying immediately.

Then deploy from the repository root:

```sh
fly deploy . --config apps/identity-service/fly.toml
fly deploy . --config apps/challenge-service/fly.toml
fly deploy . --config apps/submission-service/fly.toml
fly deploy . --config apps/notification-service/fly.toml
fly deploy . --config apps/api-gateway/fly.toml
```

If apps were scaled to zero while provisioning dependencies, scale them back up:

```sh
fly scale count 1 --app sparkflow-challenge-service
fly scale count 1 --app sparkflow-submission-service
fly scale count 1 --app sparkflow-notification-service
fly scale count 1 --app sparkflow-api-gateway
```

The `.` is required because each Dockerfile builds from the monorepo root. Without it, Fly uses the
directory containing the selected `fly.toml` as the build context and cannot resolve workspace
dependencies correctly.

In each `fly.toml`, `build.dockerfile = "Dockerfile"` is intentionally relative to the service
directory that contains the config file. Do not replace it with `apps/<service>/Dockerfile`, or Fly
will resolve it as `apps/<service>/apps/<service>/Dockerfile`.

The API gateway is public. Other services are addressed through Fly private networking:

- `http://sparkflow-identity-service.internal:4000`
- `http://sparkflow-challenge-service.internal:4001`
- `http://sparkflow-submission-service.internal:4002`
- `http://sparkflow-notification-service.internal:4003`
- `http://sparkflow-evaluation-service.internal:4004`

The evaluation service is not part of the Node.js deployment batch above and should be deployed
separately before enabling user-facing flows that depend on it.

Check the deployed secrets without exposing their values:

```sh
fly secrets list --config apps/challenge-service/fly.toml
fly secrets list --config apps/submission-service/fly.toml
fly secrets list --config apps/notification-service/fly.toml
fly secrets list --config apps/api-gateway/fly.toml
```

## Frontend on Netlify

Netlify uses `netlify.toml`.

Build command:

```sh
node apps/web/scripts/write-environment.mjs && pnpm --filter web build
```

Publish directory:

```txt
apps/web/dist/sparkflow/browser
```

Required Netlify environment variables:

- `SPARKFLOW_API_URL`: public API gateway URL, for example `https://sparkflow-api-gateway.fly.dev`
- `SPARKFLOW_AUTH_ISSUER`: public Keycloak issuer, for example
  `https://<keycloak-host>/realms/sparkflow`
- `SPARKFLOW_AUTH_CLIENT_ID`: OAuth client ID, usually `sparkflow-web`

The SPA fallback is configured through a Netlify redirect to `/index.html`.
