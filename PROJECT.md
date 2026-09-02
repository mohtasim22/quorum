# Quorum — Project Brief

## What this is
A community Q&A platform (Stack Overflow style) built with the MERN stack.
Users post questions with markdown, others answer, the community votes,
and reputation is earned from votes received. This is my second full-stack
portfolio project; the first was a parcel delivery app called Dispatch.

---

## The loop
Everything in this app serves one loop. If a feature does not serve it, it is
out of scope.

1. **Ask** — a signed-in user writes a question in markdown, tags it (max 5),
   and it gets a URL-safe slug.
2. **Answer** — others answer. Both questions and answers can be commented on,
   one level deep. Only the asker can accept an answer.
3. **Vote** — anyone signed in votes a post up or down, once. The post's score
   moves and its *author's* reputation moves with it.

Steps 1 and 2 are documents in a database. Step 3 is the project: one request
that changes two collections in agreement or neither, can never let a person
vote twice, and still feels instant in the browser.

---

## Stack
| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS v4, daisyUI, React Router, TanStack Query, Axios, SweetAlert2 |
| Backend | Node.js, Express (CommonJS) |
| Database | MongoDB Atlas via **Mongoose** |
| Auth | Firebase Authentication (client) + Firebase Admin SDK (server) — *see [Decisions made](#decisions-made)* |
| Storage | Cloudinary (unsigned uploads) |
| Deploy | Vercel (client), Render (server) |

### Why Mongoose and not Prisma
Prisma's MongoDB connector cannot express aggregation pipelines — no `$facet`,
no computed ranking stages. The homepage feed would drop through to
`aggregateRaw()`, which takes the identical raw pipeline and returns an
untyped `JsonObject`. That means writing the same Mongo by hand, with worse
types, while paying for an ORM layer being bypassed. Prisma's MongoDB support
also lags: it is still pinned to v6.x while v7 ships elsewhere.

Mongoose gives schema validation on the boring 70% and leaves
`Model.aggregate()` completely unabstracted on the 30% that matters.

*(Prisma is excellent — over Postgres. Save it for project three.)*

---

## Architecture rules
- **Firebase authenticates. MongoDB authorizes.** The ID token proves identity
  and nothing else. `role` lives in Mongo and is re-read on every privileged
  request by `verifyToken` → `verifyAdmin`. A client that sends
  `{ role: "admin" }` is ignored.
- **Anything with consequences is computed server-side.** Vote values, score
  deltas, reputation points, accepted-answer status, roles. The client sends
  *intent* ("upvote this"), never *outcome* ("add 10 reputation").
- **Server state goes through TanStack Query**, not `useEffect` + `useState`.
- **Layered backend:** `server.js` (connect + listen) → `app.js` (build +
  export) → `routes/` → `middleware/` → `controllers/` → `models/` →
  `config/db.js`. One `asyncHandler` plus one error middleware, so no route
  ever writes try/catch.
- **Axios interceptors:** request interceptor attaches the Firebase ID token,
  response interceptor handles 401/403 globally.

### Why server.js and app.js are separate
`app.js` builds and exports the Express app without calling `.listen()`.
`server.js` connects to Mongo and only then listens. Two payoffs: Supertest can
import the app without binding a port (so the vote tests run in-process and in
parallel), and the process never accepts a request before the database is up.

---

## Data model — six collections

### users
| Field | Type | Notes |
| --- | --- | --- |
| `uid` | String | unique — Firebase UID |
| `email` | String | unique |
| `displayName` | String | |
| `photoURL` | String | |
| `role` | String | `'user' \| 'admin'`, default `'user'` |
| `reputation` | Number | default 0, **denormalized** |
| `bio` | String | max 300 |
| `slug` | String | unique — profile URL |

### questions
| Field | Type | Notes |
| --- | --- | --- |
| `title` | String | required, trim |
| `slug` | String | unique, indexed — generated server-side |
| `body` | String | **raw markdown** |
| `author` | ObjectId | → users |
| `tags` | [String] | max 5, embedded |
| `score` | Number | default 0, **denormalized** |
| `answerCount` | Number | default 0, **denormalized** |
| `viewCount` | Number | default 0 |
| `acceptedAnswer` | ObjectId \| null | → answers |
| `lastActivityAt` | Date | indexed |

### answers
| Field | Type | Notes |
| --- | --- | --- |
| `question` | ObjectId | → questions, indexed |
| `body` | String | raw markdown |
| `author` | ObjectId | → users |
| `score` | Number | default 0 |
| `isAccepted` | Boolean | default false |

### comments
| Field | Type | Notes |
| --- | --- | --- |
| `parentType` | String | `'question' \| 'answer'` |
| `parentId` | ObjectId | polymorphic parent |
| `body` | String | max 600, plain text (no markdown) |
| `author` | ObjectId | → users |

### votes
| Field | Type | Notes |
| --- | --- | --- |
| `user` | ObjectId | → users |
| `targetType` | String | `'question' \| 'answer'` |
| `targetId` | ObjectId | polymorphic target |
| `value` | Number | enum `[1, -1]` |

**Unique compound index on `{ user, targetType, targetId }`.**

### tags
| Field | Type | Notes |
| --- | --- | --- |
| `name` | String | unique, lowercase |
| `slug` | String | unique |
| `description` | String | |
| `questionCount` | Number | **denormalized** |

### The four modeling decisions
1. **Answers referenced, not embedded.** A question collects unlimited answers
   and a document is capped at 16 MB. Embedding also kills independent sorting,
   pagination, and per-answer voting.
2. **Tags embedded as plain strings.** Tag filtering is the most common query;
   embedding means the feed never joins to render a tag pill. Safe because tags
   are hard-capped at five. The `tags` collection holds only descriptions and
   counts.
3. **Votes as their own collection.** An array of voter ids on each post grows
   unbounded *and* cannot enforce one-vote-per-user. A unique index enforces it
   in the database — a double-click yields a duplicate-key error (`11000`),
   not corrupt data.
4. **score / answerCount / reputation are stored, not computed.** All three are
   derivable by counting, and all three are denormalized because reads vastly
   outnumber writes. Recomputing reputation on every profile view is O(every
   vote ever cast). The transaction is how that consistency debt gets paid.

---

## Indexes — created day one
| Collection | Index | Kind |
| --- | --- | --- |
| users | `{ uid: 1 }` | unique |
| users | `{ slug: 1 }` | unique |
| questions | `{ slug: 1 }` | unique |
| questions | `{ tags: 1, createdAt: -1 }` | compound |
| questions | `{ title: 'text', body: 'text' }` | text |
| answers | `{ question: 1, score: -1 }` | compound |
| comments | `{ parentType: 1, parentId: 1, createdAt: 1 }` | compound |
| votes | `{ user: 1, targetType: 1, targetId: 1 }` | **unique** |
| tags | `{ name: 1 }` | unique |

**Mongoose gotchas:** `autoIndex` runs a build on every boot — fine in dev, a
liability in production; disable it there. And a collection can hold only **one
text index**, so `title` and `body` go into a single compound text index.

---

## The hard parts

### 1. Vote integrity
A vote is an **upsert with delta arithmetic**, not an insert.

| Was | Clicks | score Δ | rep Δ (answer) | Becomes | Vote doc |
| --- | --- | --- | --- | --- | --- |
| none | ▲ | +1 | +10 | up | insert |
| none | ▼ | −1 | −2 | down | insert |
| up | ▲ | −1 | −10 | none | delete (toggle off) |
| down | ▼ | +1 | +2 | none | delete (toggle off) |
| up | ▼ | −2 | −12 | down | update value |
| down | ▲ | +2 | +12 | up | update value |

**Do not write six branches.** Define two pure functions of state —
`scoreOf(state)` and `repOf(state, targetType)` — and every row is
`f(newState) - f(oldState)`. Six cases collapse to one line, and the reversal
cases can never disagree with the forward cases.

```
scoreOf:  none → 0    up → +1    down → −1
repOf:    upvote on question → +5
          upvote on answer   → +10
          downvote on either → −2
          answer accepted    → +15   (separate path)
```

Reputation rules live in **one server-side module**. Nowhere else.

One vote writes to **three collections** — `votes`, the target post, and the
author's user document — inside a **single transaction with a session**. If the
score increment lands and the reputation increment fails, the site is
permanently wrong and nothing will ever detect it. Atlas is a replica set by
default, so transactions work out of the box.

Two rules that are easy to get wrong:
- **Nobody votes on their own post** — compare the post's author to the
  authenticated user, server-side.
- **Reputation moves on the author, not the voter.** `req.user._id` is sitting
  right there and it is the wrong id.

### 2. The aggregation feed
The homepage is one pipeline, not four queries:

| Stage | Does what |
| --- | --- |
| `$match` | Filters (tag, unanswered, author) **first**, so an index can be used |
| `$addFields` | `hot = score / (ageInHours + 2)^1.5` — gravity |
| `$sort` | by `hot`, `createdAt` or `score` depending on the tab |
| `$facet` | Two sub-pipelines over the same input: `$skip`/`$limit` for the page, `$count` for the total. One round trip |
| `$lookup` | Author name and avatar — **after** the limit, so you enrich 20 docs, not 20,000 |

### 3. Search
Start with the Mongo text index, sorted by `{ score: { $meta: 'textScore' } }`.
Atlas Search later, only if fuzzy matching and autocomplete are wanted. Debounce
the input either way.

### 4. Markdown safety
Store **raw markdown** in Mongo, never rendered HTML — so the renderer can
change without a migration. Sanitize server-side on write, and render with
`react-markdown` + `rehype-sanitize` + `rehype-highlight`. **Never**
`dangerouslySetInnerHTML` on user content. This is the app's XSS surface and it
is entirely avoidable.

### 5. Optimistic UI on votes
TanStack Query `onMutate` paints the new score instantly and stashes the
previous cache; `onError` rolls back; `onSettled` refetches to reconcile.

---

## Explicitly out of scope
Badges, private messaging, real-time notifications, infinitely nested comment
threads, email digests, bounties, close votes, edit review queues.
One level of comments only. **Do not suggest these.**

Every item here is a plausible feature — which is exactly why it is written
down. Portfolio projects die from a scope list that keeps growing.

---

## Testing
Jest + Supertest on **the vote endpoint specifically** — every transition in
the table above, plus the duplicate-vote race and the self-vote rejection.
Roughly ten tests guarding the only logic in the app that can silently corrupt
data. This is the one piece that gets real coverage.

---

## Decisions made
- [x] **Auth: Firebase Authentication** (client) + **Firebase Admin SDK**
  (server). *Decided 2026-09-02.*
  **Why:** the learning budget for this project belongs to the vote transaction
  and the aggregation pipeline, not to re-solving password storage. Firebase
  removes password handling, email verification and Google sign-in from scope
  entirely, and server-side verification is a few lines of Admin SDK.
  **The tradeoff, accepted knowingly:** "how does your auth work?" is a common
  entry-level interview question, and Firebase means not building hashing,
  signing, expiry and refresh yourself. Plan to hand-roll JWT + bcrypt in
  project three, where auth can be the point.
  **Consequence for this codebase:** Firebase owns *authentication only*.
  `role` and `reputation` live in Mongo, are read by `verifyToken` on every
  privileged request, and are never accepted from a token claim or a request
  body.

---

## Working agreement
- Guide, don't do it for me. Reference code → I implement → I say `review` →
  you read my actual files.
- Explain the *why*, with interview relevance.
- One slice at a time, in order. Ask before scaffolding large amounts of code.
- Flag bugs precisely with `file:line`.
- Verify before declaring success.
- Commit at milestones (Conventional Commits). Feature branches → PRs.
  Secrets in `.env`, gitignored.

## See also
- [WALKTHROUGH.md](./WALKTHROUGH.md) — the slice-by-slice build plan
- Visual blueprint: https://claude.ai/code/artifact/0b020693-7513-4e29-8ccd-5d262b9268dd
