# QuickNotes Architecture

## Functional requirements

- Users can create, read, update and delete their own notes.
- Users can attach tags to notes and filter by tag.
- Authentication is required for all note and tag operations.
- The system must support concurrent access from many clients.

## Non-functional requirements

- Availability: 99.9 % (≈ 8.7 hours downtime per year).
- Latency: p95 read < 200 ms, p95 write < 500 ms.
- Scalability: support 1 million registered users.
- Durability: no note data loss under normal failure scenarios.
- Security: all traffic over TLS; passwords stored hashed; authorization enforced per resource.

---

## Load estimate for 1 million users

Assumptions:

- 1 000 000 registered users.
- 10 % daily active users (DAU) → 100 000 DAU.
- Average active user performs 20 reads and 5 writes per day.
- Notes average 2 KB each; each user keeps ~50 notes on average → ~100 GB of note data.
- Growth and indexes → target ~250 GB storage capacity in year 1.

| Metric | Calculation | Estimate |
|--------|-------------|----------|
| Reads per day | 100 000 × 20 | 2 000 000 |
| Reads per second (avg) | 2 000 000 / 86 400 | ≈ 23 rps |
| Peak reads (3×) | | ≈ 70 rps |
| Writes per day | 100 000 × 5 | 500 000 |
| Writes per second (avg) | 500 000 / 86 400 | ≈ 6 wps |
| Peak writes (3×) | | ≈ 18 wps |
| Storage per year | 100 GB notes + indexes + growth | ≈ 250 GB |

Even at peak the load is modest; the architecture is designed for comfortable headroom and future growth.

---

## Architecture diagram

```
                    ┌─────────────┐
                    │   Clients   │
                    │ (browsers / │
                    │   mobile)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     DNS     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     CDN     │
                    │ (static JS, │
                    │  CSS, HTML) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Load Balancer│
                    └──────┬──────┘
               ┌───────────┴───────────┐
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │ App Server 1│         │ App Server 2│
        │  (API)      │         │  (API)      │
        └──────┬──────┘         └──────┬──────┘
               │                       │
               └───────────┬───────────┘
                           │
                    ┌──────▼──────┐
                    │    Cache    │
                    │   (Redis)   │
                    └──────┬──────┘
                           │
               ┌───────────┴───────────┐
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │   Primary   │────────▶│ Read Replica│
        │  Database   │         │  Database   │
        │ (PostgreSQL)│         │ (PostgreSQL)│
        └──────┬──────┘         └─────────────┘
               │
        ┌──────▼──────┐
        │    Queue    │
        │  (e.g. SQS) │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │   Worker    │
        │ (async jobs)│
        └─────────────┘
```

### Component responsibilities

| Component | Problem it solves |
|-----------|-------------------|
| **DNS** | Resolves the public hostname to the load-balancer IP; enables easy failover and multi-region later. |
| **CDN** | Serves static assets (HTML, CSS, JS) from edge locations, reducing latency and origin load. |
| **Load balancer** | Distributes incoming API traffic across app servers and performs health checks so unhealthy instances are removed. |
| **App servers (≥ 2)** | Run the business logic and HTTP handlers; multiple instances provide horizontal scale and remove a single point of failure. |
| **Cache (Redis)** | Stores frequently read note lists and individual notes, cutting database load and improving read latency. |
| **Primary database** | Durable source of truth for writes; enforces schema, constraints and transactions. |
| **Read replica** | Offloads read queries from the primary, increasing total read capacity and providing a hot standby. |
| **Queue + Worker** | Handles asynchronous work (e.g. search indexing, email notifications, analytics) so the API response path stays fast. |

---

## Request flows

### GET /notes (list notes)

1. Client sends `GET /v1/notes` with Bearer token.
2. DNS → CDN (static assets only) → Load balancer.
3. Load balancer routes to a healthy app server.
4. App server validates the JWT and extracts `user_id`.
5. App server checks Redis for a cached list keyed by `user_id` + query params.
6. Cache hit → return cached JSON (200).
7. Cache miss → query the **read replica** with the user-scoped SELECT.
8. App server writes the result into Redis (short TTL) and returns 200 to the client.

### POST /notes (create note)

1. Client sends `POST /v1/notes` with JSON body and Bearer token.
2. Request reaches an app server via the load balancer.
3. App server validates the token and the payload (title required, ≤ 100 chars).
4. App server begins a transaction on the **primary** database: insert into `notes`, insert into `note_tags` if tags are supplied.
5. On success, app server invalidates (or updates) the relevant Redis cache keys for that user.
6. Optionally enqueues a message on the queue (e.g. “index this note for search”).
7. Returns 201 Created with the new note JSON.

---

## Trade-offs and single points of failure

### Trade-off 1: Cache consistency vs latency

We use a short TTL + explicit invalidation on write. This can produce brief stale reads after a write, but keeps read latency low. Stronger consistency (e.g. write-through with locking) would increase write latency and complexity. For notes the eventual-consistency window of a few seconds is acceptable.

### Trade-off 2: Single primary database

All writes go to one primary. This simplifies consistency and transactions but creates a write bottleneck and a potential single point of failure. We mitigate by:

- Streaming replication to a read replica that can be promoted on primary failure.
- Regular automated backups and point-in-time recovery.
- Monitoring and automated failover (e.g. Patroni / RDS Multi-AZ).

### Avoiding single points of failure

- At least two app servers behind a load balancer.
- Redis deployed as a cluster or with a replica.
- Database primary + hot read replica with automatic failover.
- Queue is managed (SQS / RabbitMQ cluster) and workers are horizontally scalable.
- CDN and DNS are multi-region by nature.

Together these choices give us a system that can comfortably serve 1 million users while remaining operable by a small team.
