# Real-Time Collaborative Sync Engine

A Google-Docs-style collaborative editor built **from first principles** — a hand-rolled
CRDT (no Yjs, Automerge, ShareDB, or any OT/CRDT library), real-time sync over
Socket.IO, Redis pub/sub for horizontal scaling, and full offline + reconnect support.

Multiple users edit the same document simultaneously and **every client provably
converges to the exact same final state** — eventual consistency, demonstrated with an
automated 5-client convergence test.

---

## Why this project is interesting

This is not a CRUD app. It demonstrates real distributed-systems engineering:

| Concept | Where it lives |
|---|---|
| **CRDT (sequence)** built by hand | [`server/crdt/`](server/crdt) — Logoot/LSEQ-style dense position identifiers |
| **Lamport logical clocks** | [`LogicalClock.js`](server/crdt/LogicalClock.js) — causal ordering without synced wall-clocks |
| **Eventual consistency** | proven by the [5-client convergence test](server/tests/crdt.test.js) across 25 random seeds |
| **Idempotent, commutative merge** | duplicate / out-of-order ops are safe (insert *and* delete) |
| **Offline editing + reconnect sync** | client outbox + `sync-missed-operations` replay |
| **Horizontal scaling** | Redis Socket.IO adapter — broadcasts cross every backend instance |
| **Concurrency control** | per-document mutex + unique op index (no lost updates) |
| **Version history + revert** | append-only operation log; revert never rewrites history |

---

## Architecture

```
┌────────────┐   REST /api      ┌──────────────────────────────┐
│  Browser   │ ───────────────▶ │  Nginx (client container)    │
│  React SPA │   WebSocket      │  serves SPA + proxies to API  │
│  + local   │ ◀──────────────▶ └───────────────┬──────────────┘
│  CRDT copy │                                   │
└────────────┘                                   ▼
                                   ┌──────────────────────────┐
                                   │  Node backend (1..N)     │
                                   │  Express + Socket.IO     │
                                   │  CRDT engine · services  │
                                   └───────┬───────────┬──────┘
                                           │           │
                                  ┌────────▼───┐  ┌────▼─────────┐
                                  │  MongoDB   │  │   Redis      │
                                  │ docs/ops/  │  │  pub/sub for │
                                  │ presence   │  │  scaling     │
                                  └────────────┘  └──────────────┘
```

The **same CRDT algorithm runs on both the server and the browser** — local edits apply
optimistically against an in-memory replica, then merge deterministically everywhere.

---

## Tech stack

**Frontend:** React, Vite, Tailwind CSS, React Router, Axios, Socket.IO client, Context API
**Backend:** Node.js, Express, Socket.IO, MongoDB + Mongoose, Redis (ioredis), JWT, Pino
**Testing:** Jest, supertest, mongodb-memory-server
**Infra:** Docker, Docker Compose, Nginx

---

## How the CRDT works (the core idea)

Indices break under concurrency: position `5` on my screen isn't position `5` on yours
after we both edit. So we never identify characters by array index. Instead every
character gets a **permanent, totally-ordered position identifier** — a *path* of
`(pos, siteId)` digits, like an infinitely-divisible Dewey decimal.

- Between any two positions you can always mint a new one *between* them (descend a level
  and allocate a finer digit) — so "insert between H and I" never runs out of room.
- Two replicas independently sort the same characters into the **same order**; ties break
  on `siteId`, so even concurrent inserts at the same spot converge deterministically.
- Deletes are **tombstones**, keeping the merge commutative.
- Every op carries a unique `opId`; replaying it is a no-op (**idempotent**), which makes
  at-least-once delivery and reconnect-resend safe.

See [`server/crdt/`](server/crdt) — each file documents *why it exists, what problem it
solves, and how it works*.

---

## Running it

### Option A — Docker (everything, one command)

```bash
cp .env.example .env        # set a JWT_SECRET
docker compose up --build
```

Then open **http://localhost:8080**. This launches MongoDB, Redis, the backend, and the
Nginx-served frontend, all wired together.

### Option B — Local dev (no Docker, no Mongo/Redis needed)

```bash
# Terminal 1 — backend on :5000 against an in-memory MongoDB, no Redis
cd server && npm install && node scripts/dev-memdb.js

# Terminal 2 — frontend on :5173
cd client && npm install
echo "VITE_SOCKET_URL=http://localhost:5000" > .env
npm run dev
```

Open **http://localhost:5173**.

> For multi-instance scaling you need real Redis (Option A), since the in-memory dev
> bootstrap runs a single instance with Redis disabled.

---

## Testing

```bash
cd server && npm test
```

Covers authentication, document APIs + authorization, WebSocket events, CRDT merge logic,
offline + reconnect synchronization, history restoration, and the headline
**5-client eventual-consistency convergence test**.

---

## REST API

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` | create account → `{ user, token }` |
| POST | `/api/auth/login` | → `{ user, token }` |
| GET | `/api/auth/profile` | current user *(protected)* |
| GET | `/api/documents` | list my documents |
| POST | `/api/documents` | create |
| GET | `/api/documents/:id` | open (incl. CRDT snapshot) |
| PUT | `/api/documents/:id` | rename / share (collaborators) |
| DELETE | `/api/documents/:id` | delete *(owner only)* |
| GET | `/api/documents/:id/history` | operation log |
| POST | `/api/documents/:id/revert` | restore a previous version |

All `/api/documents` routes require `Authorization: Bearer <token>`.

---

## Socket events

**Document channel:** `join-document`, `leave-document`, `document-operation` →
`document-updated` (broadcast), `sync-missed-operations` (reconnect catch-up), `ping`/`pong`.

**Presence channel (separate):** `presence-join`, `cursor-update`, `typing`,
`presence-heartbeat`, `presence-leave` → `presence-state`.

The socket handshake is authenticated with the same JWT as the REST API.

---

## How offline & reconnect work

1. While disconnected, local edits keep applying to the browser's CRDT and queue in an
   **outbox**.
2. On reconnect, the client re-joins, calls `sync-missed-operations` to **pull** what it
   missed, then **flushes** the outbox to push its own edits.
3. Dedup at three layers — client `appliedOps`, server `appliedOps`, and a unique
   `{documentId, operationId}` MongoDB index — makes the at-least-once flush safe.

---

## Scaling notes & honest limitations

- The Redis adapter makes `io.to(room).emit(...)` fan out across all instances, so you can
  run N backends behind a load balancer (`docker compose up --scale server=3` + an external
  LB / sticky-less websocket-aware proxy).
- Within an instance, a per-document mutex prevents lost updates. **Across** instances, the
  unique op index is the correctness backstop; a fully hardened deployment would add a Redis
  distributed write-lock (Redlock).
- Remote cursors are shown as presence indicators (name + caret index); inline pixel-positioned
  carets are a natural next enhancement.

---

## Project structure

```
client/   React SPA — pages, context, services, socket, browser CRDT, editor
server/   Express API + Socket.IO — controllers, services, routes, middleware,
          models, crdt engine, socket handlers, config, tests
docker-compose.yml   four-container orchestration
```

Built module-by-module; every module is documented inline and verified by tests.
#   S y n c F o r g e  
 