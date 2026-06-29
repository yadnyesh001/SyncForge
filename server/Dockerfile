# server/Dockerfile
# -----------------------------------------------------------------------------
# Production image for the Node/Express/Socket.IO backend.
# Installs ONLY production dependencies (dev deps like mongodb-memory-server are
# omitted), then runs the server.

FROM node:20-alpine

# Tiny init so SIGTERM reaches Node for graceful shutdown.
RUN apk add --no-cache tini

WORKDIR /app

# Install deps first (layer caching: only re-runs when lockfile changes).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

# Liveness probe used by docker / compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
