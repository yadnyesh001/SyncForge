# client/Dockerfile
# -----------------------------------------------------------------------------
# Multi-stage: build the Vite SPA with Node, then serve the static bundle with
# Nginx (which also proxies /api and /socket.io to the backend container).

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_SOCKET_URL is intentionally left unset -> the app connects same-origin,
# and Nginx proxies the websocket to the backend (see nginx.conf).
RUN npm run build

# ---- Stage 2: serve ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
