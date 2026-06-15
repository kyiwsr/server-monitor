# Cost-Effective Server Monitoring System

A lightweight, self-hosted server monitoring system for small businesses, built on the
**MEVN stack** (MongoDB, Express.js, Vue.js, Node.js). It collects CPU, RAM, disk, and
uptime metrics from a lightweight Linux agent, evaluates them against per-server
thresholds, and surfaces plain-language, business-impact alerts (email + dashboard).

## Architecture

```
 Linux server(s)          Backend (Node/Express)        Frontend (Vue + nginx)
 ┌────────────┐  metrics  ┌──────────────────────┐      ┌────────────────────┐
 │  agent.js  │ ────────▶ │  /api/metrics (token) │ ◀──▶ │  SPA dashboard      │
 └────────────┘           │  REST API + JWT auth  │ /api │  (proxied via nginx)│
                          │  down-alert scheduler │      └────────────────────┘
                          └───────────┬──────────┘
                                      │
                                ┌─────▼─────┐
                                │  MongoDB  │
                                └───────────┘
```

## Run with Docker (recommended)

Requires Docker Desktop / Docker Engine with the Compose plugin.

```bash
# 1. Configure environment
cp .env.example .env
#    (edit .env to set JWT_SECRET and, optionally, SMTP email settings)

# 2. Build and start everything (MongoDB + backend + frontend)
docker-compose up --build
```

Then open:

- **Dashboard:** http://localhost:8080
- **API health:** http://localhost:3000/api/health

A default admin account is seeded automatically on first start:

| Email | Password |
|-------|----------|
| `admin@example.com` | `admin123` |

> Change this password after first login (Settings → Profile).

To stop: `docker-compose down` (add `-v` to also wipe the MongoDB volume).

### How the pieces talk

- The **frontend** is served by nginx on port `8080`; it reverse-proxies `/api` to the
  backend, so the browser makes same-origin calls (no CORS).
- The **backend** is published on port `3000` so monitoring agents running on other
  machines can POST metrics to `http://<host-ip>:3000/api/metrics`.
- **MongoDB** is internal to the Compose network and persists to the `mongo-data` volume.

## Connecting a Linux server (agent)

1. In the dashboard, go to **Servers → Add Server**, fill in name/host/business functions,
   and copy the **agent token** shown once.
2. Copy [`agent.js`](agent.js) to the Linux server (Node.js required).
3. Edit the `CONFIG` block: set `BACKEND_URL` to `http://<host-ip>:3000/api/metrics`,
   `AGENT_TOKEN` to the token from step 1, then run `node agent.js`
   (or install it as the included systemd service).

## Local development (without Docker)

```bash
# Backend (needs a local MongoDB on mongodb://localhost:27017)
cd backend
npm install
# ensure backend/.env has MONGODB_URI / JWT_SECRET / EMAIL_* set
npm run seed     # seed admin + demo server (one-time)
npm start        # http://localhost:3000

# Frontend
cd ../frontend
npm install
npm run dev      # http://localhost:5173 (calls http://localhost:3000/api by default)
```

## Environment variables (backend)

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | API port | `3000` |
| `MONGODB_URI` | MongoDB connection string | — |
| `JWT_SECRET` | Secret for signing auth tokens | — |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` | SMTP for alert emails (optional) | — |
| `DOWN_CHECK_INTERVAL_SECONDS` | How often to scan for unreachable servers | `30` |
| `METRIC_RETENTION_DAYS` | Auto-delete metrics older than this (MongoDB TTL) | `30` |

## Roles & Access Control

The system uses a two-role model enforced via JWT + middleware:

| Role (`user.role`) | Shown in UI as | Capabilities |
|--------------------|----------------|--------------|
| `admin` | Administrator | Full access: sees **all** servers and alerts; manages users (list, create viewers, activate/deactivate). |
| `user` | Viewer / Member | Sees and manages **only the servers they created** (ownership-scoped); receives alerts for those servers. |

**Implementation note (ownership vs. pure read-only):** The original proposal framed the
Viewer as strictly read-only. The implemented model is an **ownership-scoped** model: a
non-admin (`user`) can register and manage their own servers but cannot see other users'
servers, and cannot access admin user-management. This was chosen so a small team can
self-serve their own servers without an admin gatekeeping every change, while admins retain
a full cross-tenant view. Access is enforced server-side:

- `adminOnly` middleware guards all `/api/auth/users*` routes (403 for non-admins).
- Server/alert routes filter by `createdBy` for non-admins (you only ever see your own).

To make Viewers strictly read-only instead, gate the server write routes
(`POST/PUT/DELETE /api/servers`) behind `adminOnly` — the middleware already exists.
