From `src/docs/RELEASING.md`, section "5. Before the first automated release"; archived at the 1.9.0 pre-release, its one-time steps long done (ten automated releases, v1.3.0 to v1.8.1).

# Before the first automated release

- **The first tag must be ≥ `v1.2.2`.** The in-app badge only appears when a release tag compares
  *newer* than `APP_VERSION` (1.2.1 today), so re-tagging the current version shows players nothing.
- **The repo must be public**, or the unauthenticated `api.github.com` call the badge makes returns
  404 and it silently never appears. The check is deliberately silent on failure — it must never
  break an offline player — so a private repo looks identical to "no update available".
- CI will fail until `dist/fieldbook.html` is built and committed. That's the staleness gate doing
  its job.
