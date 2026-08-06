---
title: How to Handle Duplicate Events Safely in BullMQ Using Idempotency
description: >-
  Idempotency is actually a concept that we often use in software engineering
  without realizing it. In many cases, we already apply this pattern because it
  helps us build more reliable systems with fewe
thumbnail: >-
  /article/how-to-handle-duplicate-events-safely-in-bullmq-using-idempotency/thumbnail.jpg
createdAt: 21-05-2026
writer: zeetec20
tag:
  - software-architecture
  - software-development
  - idempotency
  - bullmq
  - software-engineering
source: medium
sourceUrl: >-
  https://firmanlestari.medium.com/how-to-handle-duplicate-events-safely-in-bullmq-using-idempotency-1e896f0352c1?source=rss-de2e53234d37------2
---
Idempotency is actually a concept that we often use in software engineering without realizing it. In many cases, we already apply this pattern because it helps us build more reliable systems with fewer bugs.

So, what is idempotency?

Idempotency means an operation can run multiple times but still produce the same result without unexpected side effects. The output stays predictable no matter how many times the operation is executed.

For example, imagine we have a function to deactivate a user account. If the function runs for the first time, the user becomes inactive. Then if the same function runs again, the user should still stay inactive without causing any issue or changing other data unexpectedly.

This concept becomes even more important in distributed systems, especially when using pub/sub or queue systems. We should never fully trust that an event will only be sent once. Sometimes publishers accidentally send duplicate events, or the worker crashes and retries the same job again. Crashes can happen because of many things like memory spikes, infrastructure issues, or even simple coding mistakes.

For this example, I created a small demo project using BullMQ to explain idempotency in a simpler way.

The case is about sending upgrade offer emails to free trial users after they registered for one week. The goal is simple: even if the event is triggered multiple times, the user should only receive one email.

Repository: [https://github.com/zeetec20/express-idempotency](https://github.com/zeetec20/express-idempotency)  
Stack:

-   Runtime: Bun + TypeScript (using Nix flake)
-   Web: Express + zod
-   Queue: BullMQ + Redis
-   Database: MySQL + Drizzle ORM
-   Dashboard: bull-board
-   Infrastructure: docker-compose
-   Architecture: single process (server + worker together)

Project structure:

```text
src/
├── env.ts                          # zod-parsed env
├── server.ts                       # express + worker + scheduler (single process)
├── controllers/
│   ├── userController.ts           # POST /register
│   └── adminController.ts          # POST /admin/run-offers, /healthz
├── services/
│   └── offerService.ts             # cron orchestration (scan → per-user dedup → send)
├── repositories/
│   ├── userRepository.ts           # users table queries
│   └── sentFlagRepository.ts       # Redis "already sent" flag
├── queue/
│   ├── redis.ts                    # ioredis connection
│   └── offerQueue.ts               # offers queue + 12h scheduler + manual enqueue
├── offers/
│   └── types.ts                    # OfferJob, OFFER_KIND, window/TTL constants
├── db/
│   ├── client.ts                   # drizzle(mysql2) singleton
│   ├── schema.ts                   # users (the only table)
│   └── seed.ts                     # 15 faker users, spread across 0–14 days ago
└── scripts/
    └── bootstrap.ts                # bun run setup
```

The flow in this project is pretty straightforward.

Every 12 hours, the cron job scans users that:

-   still use the free plan
-   registered between 7 and 10 days ago

After getting the candidate users, the system checks Redis to see whether the offer email was already sent before.

If the Redis key already exists:

-   skip the user

If the Redis key does not exist:

-   send the email
-   if success → save Redis key
-   if failed → do not save the key, so the next cron execution can retry again

Because of this approach, it doesn’t matter if:

-   BullMQ retries the job
-   the scheduler accidentally runs twice
-   the endpoint gets triggered multiple times

The user will still only receive one email.

Flow:

```text
   ┌─────────┐
   │ user    │  POST /register  (plan=free)
   │ signs   │ ─────────────────────────────►  users table
   │ up      │                                      │
   └─────────┘                                      │
                                                    │  ...time passes...
                                                    ▼
                              ┌──────────────────────────────────┐
   every 12h ────────────────►│ cron job (BullMQ scheduler)      │
                              │                                  │
                              │  SELECT id FROM users            │
                              │  WHERE plan='free'               │
                              │    AND created_at IN [10d, 7d)   │
                              └───────────────┬──────────────────┘
                                              │  for each candidate
                                              ▼
                              ┌──────────────────────────────────┐
                              │ EXISTS  offer:sent:<userId> ?    │
                              │                                  │
                              │   yes ─► skip (already sent)     │
                              │   no  ─► send email              │
                              │            success ─► SET key    │
                              │                       EX 604800  │
                              │            failure ─► no SET     │
                              │                       (retry on  │
                              │                        next run) │
                              └──────────────────────────────────┘
```

Main idempotency logic:

```ts
const result = await processUser(user.id);

if (result === "sent") sent++;
else if (result === "skipped") skipped++;
else failed++;
```

The reason I use Redis instead of adding a new field into the users table is because this operation is only needed temporarily. Adding another column would make the table a bit more polluted for something that only runs once per user.

Using Redis also makes the process simpler and faster:

-   fast read/write
-   flexible TTL expiration
-   no need to update the user row every time an email is sent

So overall, idempotency is not only about avoiding duplicate actions, but also about making systems safer when retries, crashes, or duplicated events happen unexpectedly.
