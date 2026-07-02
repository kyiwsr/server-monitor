# fyp-server-monitor — Fix List

Ordered by priority. Check off as you go.

## Critical

- [x] **1. Ship `agent.js` in the Docker image.** Backend builds from `./backend`, but `install.js` reads `agent.js` from the repo root, so it's never in the container → `GET /agent.js` and the `curl … | bash` installer both fail in prod.
  - Files: `backend/Dockerfile`, `docker-compose.yml`, `backend/routes/install.js`
  - Fix: build backend from repo root (adjust context + COPY paths) OR copy `agent.js` into `backend/` at build; confirm the resolved path exists in the image.

- [x] **2. Fix bcrypt O(N) per metrics POST.** Agent auth loads every server and `bcrypt.compare`s each token → O(N²) hashing across the fleet + DoS vector on bad tokens.
  - Files: `backend/routes/metrics.js`, `backend/models/Server.js`
  - Fix: store an indexed SHA-256/HMAC of the token, look up the server in O(1), then `bcrypt.compare` only that one.

## High

- [x] **3. Resolve the registration/role contradiction.** Public `POST /api/auth/register` creates the same `role: 'user'` as the admin-only `register-viewer`, defeating the gate and allowing open self-signup.
  - Files: `backend/routes/auth.js`
  - Fix: decide open vs. closed; if closed, gate `/register` behind admin/bootstrap; if open, drop `register-viewer` as redundant. Document role capabilities.
  - Decision: **closed (admin-only)** — `/register` now only bootstraps the first (admin) account; further accounts via `register-viewer`.

- [x] **4. Add a `PORT` fallback.** `app.listen(process.env.PORT)` has no default; `.env.example` omits `PORT` → random port locally, logs "port undefined".
  - Files: `backend/server.js`, `.env.example`
  - Fix: `const PORT = process.env.PORT || 3000;` used in `listen` and log.

## Medium

- [x] **5. Validate metric numeric fields.** `cpuPercent`/`ramPercent`/`diskPercent`/`uptimeSeconds` aren't coerced/validated; `NaN`/string values silently mis-classify against thresholds.
  - File: `backend/routes/metrics.js` — coerce to finite number in `[0,100]` (uptime `>= 0`), else 400.

- [x] **6. Persist failed alert email status.** `emailStatus` stays `'pending'` after a permanent send failure, conflating "not tried" with "gave up."
  - Files: `backend/routes/metrics.js`, `backend/utils/downChecker.js` — persist `'failed'`.

- [x] **7. Use real alert records in ServerDetail history.** "Alert History" is reconstructed client-side from downsampled averages (7d/30d), so real spikes vanish and numbers don't match `Alert` records.
  - Files: `frontend/src/views/ServerDetail.vue` — fetch `/api/alerts?serverId=…` instead of re-deriving.

- [x] **8. Surface TTL retention changes.** `Metric` TTL index won't update `expireAfterSeconds` when `METRIC_RETENTION_DAYS` changes (silent no-op).
  - File: `backend/models/Metric.js` — run `collMod` on boot or log a warning.

## Low / cleanup

- [x] **9. N+1 in `GET /api/servers`** — one `Metric.findOne` per server per poll; use `$lookup`/aggregation or cache latest metric on the server doc. (`backend/routes/servers.js`)
- [x] **10. `agent.js` blocks event loop** with `execSync("sleep 0.5")` + shell-outs each cycle; prefer reading `/proc` + `setTimeout`. (`agent.js`)
- [x] **11. Deep `watch` on large metrics array** in ServerDetail just to bump `chartKey`; watch `.length`/fetch completion. (`frontend/src/views/ServerDetail.vue`)
- [x] **12. Dead code:** `.limit(1)` on `findOne`. (`backend/routes/servers.js`)
- [x] **13. Inconsistent threshold coloring:** `ServersPage.vue getMetricColor` hardcodes 70/90/75/90 instead of per-server thresholds.
- [x] **14. Typos:** "MongodDB connection error" (`server.js`), "succesfully" (`seed.js`).
- [x] **15. Seed on every boot:** `seed.js` runs on container start, re-creating hardcoded `admin@example.com / admin123`; guard for non-demo deploys.
- [x] **16. DB connect failure:** `server.js` `.catch` logs but doesn't exit; app runs DB-less and 500s every request.

---
