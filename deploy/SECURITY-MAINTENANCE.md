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

## Build dependencies

Removed the unused Vitest dependency from the shared package (it had no test files), eliminating its vulnerable Vite and Tinypool tree. Shared registration rules remain covered by API tests. Updated Expo's XML parser to @xmldom/xmldom 0.8.15.

Metro requires the image-size 1.x CommonJS API, so `patches/image-size@1.2.1.patch` rejects truncated, zero-length and out-of-bounds boxes and ICNS entries. This prevents the JXL/HEIF and ICNS parser loops without changing Metro's API. Child-process regression tests enforce a time budget and also verify ordinary PNG/ICNS dimensions. Version-only dependency audits will still report image-size 1.2.1; the locked patch hash and regression tests are the evidence for remediation.

The remaining high advisories for `braces` and `node-forge` have no published fixed version in the npm advisory data checked on 21 October. They are in the Expo/build toolchain and are absent from deployed runtime images. Do not run development servers publicly or process untrusted project files/certificates with that toolchain. Recheck upstream releases before the next toolchain update.

Lower-severity fixes also update js-yaml 5.x to 5.4.1, UUID to 11.1.1 and esbuild to 0.28.1. The upstream decode-uri-component 0.5.0 decoder is backported with a CommonJS export in `patches/decode-uri-component@0.2.2.patch`, retaining query-string 7 compatibility. Tests exercise normal Unicode, malformed escapes and a long malformed URL under a child-process time limit. The original package fails with a stack overflow on that regression input. Version-only audits still flag 0.2.2; the patch hash and tests establish the fix.

One additional moderate build-only advisory in `sprintf-js` has no upstream fixed version. Together with braces and node-forge, it remains a tracked development-toolchain limitation; none is included in the deployed runtime images.

All Alpine runtime stages update zlib to the distribution security revision. The gosu rebuild also updates moby/sys/user to 0.4.1 and x/sys to 0.44.0. Full-severity scans supplement the deployment's high/critical gate.
