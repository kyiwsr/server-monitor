# Backend: Node.js + Express API
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

EXPOSE 3000

# Seed the admin/demo data (idempotent) then start the API.
# `|| true` so a transient seed hiccup never blocks the server from starting.
CMD ["sh", "-c", "node seed.js || true; node server.js"]
