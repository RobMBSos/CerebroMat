# Security maintenance — 21 October 2026

Public registration accepts only student, parent and teacher roles. Administrator creation is an administrative operation. The service also rejects unexpected roles before accessing the database; regression tests cover both boundaries.

Login forms no longer publish or prefill demo credentials. Demo seeding refuses to run with NODE_ENV=production. Existing production demo passwords and both JWT signing keys were rotated separately through the maintenance procedure; no credentials belong in this repository.

Runtime images omit npm, Corepack and Yarn. Run production migrations with:

```sh
docker compose -f docker-compose.production.yml run --rm api node node_modules/prisma/build/index.js migrate deploy
```

PostCSS is pinned to 8.5.29 and deepmerge-ts to 8.0.0. Caddy 2.11.7 and gosu 1.19 are rebuilt from fixed upstream commits using Go 1.27.3; Caddy uses golang.org/x/net 0.60.0. PostgreSQL stays on version 16.15 and keeps the existing volume. The mobile image receives the same patched Caddy binary. The Go builder and upstream runtime images are pinned by digest.

The deployment workflow builds all five images and requires a high/critical runtime vulnerability scan to pass before deployment. The production compose file must reference this repository's `caddy` and `postgres` images, as shown in `docker-compose.production.yml`. Preserve the host's existing Caddyfile, including its Cromos routes; the workflow does not replace host configuration.

Cromos is maintained separately under /opt/cromos with private administration and data in /var/lib/cromos. Never deploy local test data or run integration fixtures against its production database.
