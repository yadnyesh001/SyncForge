# SyncForge

> A Google-Docs-style collaborative editor built **from first principles** — a hand-rolled CRDT (no Yjs, Automerge, ShareDB, or any OT/CRDT library), real-time sync over Socket.IO, Redis pub/sub for horizontal scaling, and full offline + reconnect support.

Multiple users edit the same document simultaneously, and **every client provably converges to the exact same final state** — eventual consistency, demonstrated with an automated 5-client convergence test.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-010101?logo=socket.io&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-pub%2Fsub-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Tests](https://img.shields.io/badge/tests-36%20passing-success)

---

## ✨ Features

- **Real-time collaboration** — multiple users editing the same document, sub-second sync.
- **Hand-rolled CRDT** — a Logoot/LSEQ-style sequence CRDT with Lamport clocks, written from scratch.
- **Eventual consistency** — proven by a 5-client convergence test across random delivery orders.
- **Offline editing + reconnect** — edits queue locally and sync on reconnect, with no duplicates.
- **Presence** — live online users, remote cursors, and typing indicators (on a separate channel).
- **Version history + revert** — every operation is logged; restore any previous version.
- **Auth** — JWT-based register/login, protected REST routes, and authenticated WebSocket handshake.
- **Horizontal scaling** — Redis Socket.IO adapter fans broadcasts across multiple backend instances.
- **One-command Docker** — MongoDB + Redis + backend + frontend via Docker Compose.
- **Extras** — dark mode, auto-save, document search, sharing/invite links, keyboard shortcuts.

---

## 🧠 Why this project is interesting

This is **not** a CRUD app. It demonstrates real distributed-systems engineering:

| Concept | Where it lives |
| --- | --- |
| **CRDT (sequence)** built by hand | [`server/crdt/`](server/crdt) — dense position identifiers |
| **Lamport logical clocks** | [`LogicalClock.js`](server/crdt/LogicalClock.js) — causal ordering without synced clocks |
| **Eventual consistency** | [5-client convergence test](server/tests/crdt.test.js) across 25 random seeds |
| **Idempotent, commutative merge** | duplicate / out-of-order ops are safe (insert *and* delete) |
| **Offline + reconnect sync** | client outbox + `sync-missed-operations` replay |
| **Horizontal scaling** | Redis Socket.IO adapter |
| **Concurrency control** | per-document mutex + unique op index (no lost updates) |
| **Version history + revert** | append-only operation log; revert never rewrites history |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    Browser["React SPA<br/>+ local CRDT replica"]
    Backend["Node backend (1..N)<br/>Express + Socket.IO + CRDT engine"]
    Mongo[("MongoDB<br/>documents · operations · presence")]
    Redis[("Redis<br/>pub/sub for scaling")]

    Browser -- "REST /api" --> Backend
    Browser -- "WebSocket (live ops + presence)" --> Backend
    Backend --> Mongo
    Backend -- "cross-instance fan-out" --> Redis
    Redis -- "broadcasts" --> Backend
```

The **same CRDT algorithm runs on both the server and the browser** — local edits apply optimistically against an in-memory replica, then merge deterministically everywhere.

---

## 🧰 Tech stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React, Vite, Tailwind CSS, React Router, Axios, Socket.IO client, Context API |
| **Backend** | Node.js, Express, Socket.IO, MongoDB + Mongoose, Redis (ioredis), JWT, Pino |
| **Testing** | Jest, supertest, mongodb-memory-server |
| **Infra** | Docker, Docker Compose, Nginx |

---

## 🔬 How the CRDT works (the core idea)

Indices break under concurrency: position `5` on my screen isn't position `5` on yours after we both edit. So we never identify characters by array index. Instead, every character gets a **permanent, totally-ordered position identifier** — a *path* of `(pos, siteId)` digits, like an infinitely-divisible Dewey decimal.

- Between any two positions you can always mint a new one *between* them (descend a level and allocate a finer digit) — so "insert between H and I" never runs out of room.
- Two replicas independently sort the same characters into the **same order**; ties break on `siteId`, so even concurrent inserts at the same spot converge deterministically.
- Deletes are **tombstones**, keeping the merge commutative.
- Every op carries a unique `opId`; replaying it is a no-op (**idempotent**), which makes at-least-once delivery and reconnect-resend safe.

See [`server/crdt/`](server/crdt) — each file documents *why it exists, what problem it solves, and how it works*.

---

## 🚀 Getting started

### Option A — Run locally with **no Docker, Mongo, or Redis** (fastest)

The backend boots its own in-memory MongoDB.

```bash
# Terminal 1 — backend on :5000
cd server
npm install
node scripts/dev-memdb.js
```

```bash
# Terminal 2 — frontend on :5173
cd client
npm install
npm run dev
```

Create `client/.env` with:

```ini
VITE_SOCKET_URL=http://localhost:5000
VITE_API_URL=/api
```

Then open **http://localhost:5173**.

### Option B — Full stack with **Docker** (real Mongo + Redis + scaling)

```bash
cp .env.example .env     # set a JWT_SECRET
docker compose up --build
```

Open **http://localhost:8080**. This launches MongoDB, Redis, the backend, and the Nginx-served frontend, all wired together.

### Option C — Local with your **own MongoDB** (e.g. Atlas)

Create `server/.env`:

```ini
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/rt_collab?retryWrites=true&w=majority
DISABLE_REDIS=1
JWT_SECRET=any-long-random-string
```

> If your network's DNS refuses SRV lookups (`querySrv ECONNREFUSED`), add `DNS_SERVERS=8.8.8.8,1.1.1.1`.

Then `cd server && npm start`, and run the frontend as in Option A.

---

## 🧪 Testing

```bash
cd server
npm test
```

**36 tests** covering authentication, document APIs + authorization, WebSocket events, CRDT merge logic, offline + reconnect synchronization, history restoration, and the headline **5-client eventual-consistency convergence test**.

---

## 📡 REST API

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | create account → `{ user, token }` |
| `POST` | `/api/auth/login` | → `{ user, token }` |
| `GET` | `/api/auth/profile` | current user *(protected)* |
| `GET` | `/api/documents` | list my documents |
| `POST` | `/api/documents` | create |
| `GET` | `/api/documents/:id` | open (incl. CRDT snapshot) |
| `PUT` | `/api/documents/:id` | rename / share (collaborators) |
| `DELETE` | `/api/documents/:id` | delete *(owner only)* |
| `GET` | `/api/documents/:id/history` | operation log |
| `POST` | `/api/documents/:id/revert` | restore a previous version |

All `/api/documents` routes require `Authorization: Bearer <token>`.

---

## 🔌 Socket events

**Document channel:** `join-document`, `leave-document`, `document-operation` → `document-updated` (broadcast), `sync-missed-operations` (reconnect catch-up), `ping` / `pong`.

**Presence channel (separate):** `presence-join`, `cursor-update`, `typing`, `presence-heartbeat`, `presence-leave` → `presence-state`.

The socket handshake is authenticated with the same JWT as the REST API.

---

## 🔄 How offline & reconnect work

1. While disconnected, local edits keep applying to the browser's CRDT and queue in an **outbox**.
2. On reconnect, the client re-joins, calls `sync-missed-operations` to **pull** what it missed, then **flushes** the outbox to push its own edits.
3. Dedup at three layers — client `appliedOps`, server `appliedOps`, and a unique `{documentId, operationId}` MongoDB index — makes the at-least-once flush safe.

---

## 📈 Scaling notes & honest limitations

- The Redis adapter makes `io.to(room).emit(...)` fan out across all instances, so you can run N backends behind a load balancer (`docker compose up --scale server=3` + a WebSocket-aware proxy).
- Within an instance, a per-document mutex prevents lost updates. **Across** instances, the unique op index is the correctness backstop; a fully hardened deployment would add a Redis distributed write-lock (Redlock).
- Remote cursors are shown as presence indicators (name + caret index); inline pixel-positioned carets are a natural next enhancement.

---

## 📁 Project structure

```text
client/   React SPA — pages, context, services, socket, browser CRDT, editor
server/   Express API + Socket.IO — controllers, services, routes, middleware,
          models, crdt engine, socket handlers, config, tests
docker-compose.yml   four-container orchestration
render.yaml          one-click Render blueprint (backend + frontend)
```

Built module by module; every module is documented inline and verified by tests.
