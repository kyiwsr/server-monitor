# Backend: Node.js + Express API
#
# NOTE: the build context is the REPO ROOT (see docker-compose.yml), not ./backend.
# This is required so agent.js (which lives at the repo root and is served by
# GET /agent.js + the one-line installer) can be copied into the image. COPY
# cannot reach files outside the build context, so the context must include both
# backend/ and agent.js.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy the Linux agent (repo root) next to the backend source so GET /agent.js
# and the `curl … | bash` installer resolve it inside the container.
COPY agent.js ./agent.js

EXPOSE 3000

# Seed the admin/demo data (idempotent) then start the API.
# `|| true` so a transient seed hiccup never blocks the server from starting.
CMD ["sh", "-c", "node seed.js || true; node server.js"]
