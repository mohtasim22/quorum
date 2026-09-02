# Quorum — Build Walkthrough

Slice-by-slice build plan. **Work top to bottom. Do not jump ahead.**

## How to use this file
Each slice works **end to end** — browser → database → browser — before the
next one starts. No slice is "build the whole backend". The numbering is real:
each slice depends on the one before it.

Per slice, the loop is:
1. Read the slice. Ask about anything unclear **before** writing code.
2. Claude teaches the concept + gives reference code.
3. You implement it in your own files.
4. You say **`review`**. Claude reads your actual files and flags problems.
5. Tick the boxes, commit, move on.

**Estimate: 5–6 weeks.** Slice 4 is the reason this project exists — everything
before it is scaffolding that makes it possible, everything after is
presentation.

| # | Slice | Estimate | Status |
| --- | --- | --- | --- |
| 0 | Skeleton | ~1 day | ☐ |
| 1 | Identity | 4–5 days | ☐ |
| 2 | Questions | ~1 week | ☐ |
| 3 | Conversation | ~5 days | ☐ |
| 4 | **Votes & reputation** | ~1 week | ☐ |
| 5 | Discovery | ~1 week | ☐ |
| 6 | Moderation & ship | ~4 days | ☐ |

---

## Slice 0 — Skeleton
**Goal:** the server boots, connects to Atlas, and serves one route. The client
boots and calls it. Both are deployed while there is nothing to debug.

**What you learn:** why app construction is separate from server startup, and
why deploying on day one is cheaper than deploying in week five.

### Setup
- [ ] `git init` at `quorum/` (the root, **not** inside a subfolder)
- [ ] `.gitignore` — `node_modules/`, `.env`, `dist/`, `.DS_Store`
- [ ] First commit *before* any secret has ever existed in the folder

### Server — `quorum-server/`
- [ ] `npm init -y`
- [ ] `npm i express mongoose dotenv cors`
- [ ] `.env` — `MONGODB_URI`, `PORT=5000`
- [ ] `.env.example` — same keys, empty values, **committed**
- [ ] `config/db.js` — `mongoose.connect(process.env.MONGODB_URI)`, no options
      object, no try/catch (let it throw)
- [ ] `app.js` — express, cors, `express.json()`, `GET /health`, **exports app,
      never calls `.listen()`**
- [ ] `server.js` — `require('dotenv').config()` on line 1, then connect, then
      listen
- [ ] `package.json` script: `"dev": "node --watch server.js"` (Node 24 has
      watch built in — no nodemon)

### Atlas
- [ ] Cluster created, database user added, your IP allowlisted
- [ ] Connection string includes the **database name**: `.../quorum?retryWrites=true`
      — without it, Mongoose writes to a database called `test`

### Client — `quorum-client/`
- [ ] `npm create vite@latest . -- --template react`
- [ ] `npm i axios @tanstack/react-query react-router`
- [ ] Tailwind v4 + daisyUI wired up
- [ ] `.env` — `VITE_API_URL=http://localhost:5000`
- [ ] `src/api/axios.js` — one shared instance with `baseURL`
- [ ] `QueryClientProvider` at the app root
- [ ] One component that fetches `/health` and renders the result

### Deploy
- [ ] Server to Render (set env vars there — `.env` is not deployed)
- [ ] Client to Vercel
- [ ] CORS origin set to the deployed client URL

**Done when:** two terminal lines in this order — `MongoDB connected: …` then
`Listening on 5000` — JSON at `localhost:5000/health`, and the deployed client
shows the deployed server's health response.

**Commit:** `chore: scaffold express server and vite client`

---

## Slice 1 — Identity
**Goal:** sign up and sign in. The token reaches the server, the server verifies
it and loads that user — *with their role* — from its own database.

**What you learn:** the difference between authentication and authorization,
and why the role can never travel in the request body.

> **Decided:** Firebase Auth (client) + Firebase Admin SDK (server).
> Rationale in [PROJECT.md](./PROJECT.md#decisions-made).

### Server
- [ ] `config/firebase.js` — Admin SDK initialised from a service account held
      in env vars (**not** a committed JSON file)
- [ ] `models/User.js` — schema per PROJECT.md, `uid` and `slug` unique
- [ ] `middleware/asyncHandler.js` — wraps a controller, forwards rejections to
      `next()`
- [ ] `middleware/errorHandler.js` — the single place a response is shaped from
      a thrown error
- [ ] `middleware/verifyToken.js` — verify the ID token, look the user up **by
      uid in Mongo**, attach `req.user`
- [ ] `middleware/verifyAdmin.js` — reads `req.user.role`, runs after
      `verifyToken`
- [ ] `utils/slugify.js` — with collision handling
- [ ] `controllers/userController.js` — `upsertUser`, `getMe`, `getBySlug`
- [ ] `routes/userRoutes.js`, mounted in `app.js`

### Client
- [ ] Firebase config from `VITE_` env vars
- [ ] `AuthProvider` context around `onAuthStateChanged`
- [ ] Register, login, logout, Google sign-in
- [ ] **Axios request interceptor** attaches `Authorization: Bearer <token>`
- [ ] **Axios response interceptor** handles 401 / 403 globally
- [ ] `POST /api/users` on first sign-in to mirror the account into Mongo
- [ ] `PrivateRoute` that redirects back to where the user was blocked

**Done when:** a protected route returns your **Mongo** user document; a
tampered token returns 401; and a `role: 'user'` account hitting an admin route
returns 403 even after editing the role in devtools.

**Commit:** `feat(auth): firebase auth with mongo-backed roles`

---

## Slice 2 — Questions
**Goal:** post a question in markdown with tags, see it rendered safely, list
them, open one by slug, edit and delete your own.

**What you learn:** your first Mongoose schemas, and the XSS surface of
user-authored content.

### Server
- [ ] `models/Question.js` — schema + all its indexes
- [ ] `models/Tag.js`
- [ ] Slug generated **server-side** from the title, with collision suffixes
- [ ] Markdown sanitized on write, stored **raw**
- [ ] Tag array validated — max 5, lowercased, deduped, upserts into `tags`
- [ ] `middleware/verifyOwner.js` — author **or** admin
- [ ] `controllers/questionController.js` — create, list, getBySlug, update, remove
- [ ] `routes/questionRoutes.js`

### Client
- [ ] `/ask` — split markdown editor with live preview
- [ ] `TagInput` component, hard-capped at 5
- [ ] `<Markdown />` component: `react-markdown` + `rehype-sanitize` +
      `rehype-highlight`. **No `dangerouslySetInnerHTML` anywhere**
- [ ] Question list page and `/questions/:slug` detail page
- [ ] TanStack Query hooks — `useQuestions`, `useQuestion`, `useCreateQuestion`
- [ ] Edit and delete, visible only on your own questions

**Done when:** a question survives a full round trip; typing
`<script>alert(1)</script>` into the body renders as **visible text**; and two
questions with identical titles get distinct slugs.

**Commit:** `feat(questions): markdown crud with slugs and tags`

---

## Slice 3 — Conversation
**Goal:** answers, comments on both parent types, and the accepted answer.

**What you learn:** per-resource ownership — a real step up from "is this user
logged in?"

### Server
- [ ] `models/Answer.js` + `{ question: 1, score: -1 }` index
- [ ] `models/Comment.js` + `{ parentType, parentId, createdAt }` index
- [ ] Creating an answer also `$inc`s `answerCount` and bumps `lastActivityAt`
- [ ] `PATCH /api/questions/:id/accept` — **only the question's author.** Sets
      `acceptedAnswer` and `isAccepted`, awards +15 reputation
- [ ] Un-accepting, or accepting a different answer, reverses the previous +15
- [ ] Comments validate that the parent actually exists
- [ ] Deleting a question cascades to its answers and comments

### Client
- [ ] Answer form and list — accepted first, then by score
- [ ] Accept button rendered **only** for the asker (and enforced server-side
      regardless)
- [ ] Comment list plus inline add form under both questions and answers
- [ ] One level only — a comment has no reply box

**Done when:** a second account cannot accept an answer on your question (check
with the API directly, not just the hidden button); `answerCount` matches an
actual count; deleting a question leaves no orphans.

**Commit:** `feat(answers): answers, comments and accepted answer`

---

## Slice 4 — Votes & reputation ⭐
**Goal:** the delta function, the unique index, the transaction, optimistic UI,
and the test suite.

**What you learn:** the thing this whole project exists to teach. Transactions,
database-level constraints, and denormalized data that has to stay honest.

### Server
- [ ] `models/Vote.js` — **unique compound index** on
      `{ user, targetType, targetId }`
- [ ] `config/reputation.js` — the **one** module holding `scoreOf(state)` and
      `repOf(state, targetType)`. Point values live nowhere else
- [ ] `controllers/voteController.js`:
  - [ ] Find any existing vote by the unique key → `oldState`
  - [ ] Compute both deltas as `f(new) - f(old)` — **not six branches**
  - [ ] Open a session, and inside one transaction:
        write the vote doc, `$inc` the target's `score`, `$inc` the **author's**
        `reputation`
  - [ ] Reject self-votes (compare post author to `req.user`)
  - [ ] Catch duplicate-key `11000` and return something sensible
- [ ] `GET /api/votes/mine?ids=` — so the UI can show current vote state

### Tests — `Jest + Supertest`
- [ ] none → up
- [ ] none → down
- [ ] up → none (toggle off)
- [ ] down → none (toggle off)
- [ ] up → down
- [ ] down → up
- [ ] Duplicate vote race — two concurrent requests produce one vote
- [ ] Self-vote rejected
- [ ] Reputation lands on the **author**, not the voter

### Client
- [ ] `VoteButtons` component with up / down / active states
- [ ] `useVote` mutation: `onMutate` paints instantly and stashes the cache,
      `onError` rolls back, `onSettled` refetches
- [ ] Buttons disabled on your own posts

**Done when:** all six transitions pass; a fast double-click cannot produce two
votes; and for any user, reputation equals exactly what their received votes
imply.

**Commit:** `feat(votes): vote transactions with reputation deltas`

---

## Slice 5 — Discovery
**Goal:** the aggregation feed, search, tag pages, profiles.

**What you learn:** aggregation pipelines, and why stage order is a performance
decision.

### Server
- [ ] Feed aggregation, in this order:
      `$match` → `$addFields` (hot) → `$sort` → `$facet` → `$lookup`
- [ ] `hot = score / (ageInHours + 2)^1.5`
- [ ] `$facet` returns the page **and** the total count in one round trip
- [ ] `$lookup` runs **after** the limit
- [ ] Filters: `?tag= &sort= &page= &unanswered=`
- [ ] `GET /api/search?q=` against the text index, sorted by
      `{ score: { $meta: 'textScore' } }`
- [ ] `GET /api/tags` with `questionCount`
- [ ] `GET /api/users/:slug` with their questions and answers

### Client
- [ ] Feed with sort tabs — hot / newest / unanswered
- [ ] Pagination driven by the `$facet` count
- [ ] Debounced search input, with empty and no-results states
- [ ] `/tags` index and `/tags/:slug` — **reuse the feed component**, don't
      rebuild it
- [ ] `/users/:slug` profile with reputation

**Done when:** the feed is a single database round trip, and `.explain()` shows
the `$match` using an index rather than a collection scan.

**Commit:** `feat(feed): hot ranking, faceted pagination and search`

---

## Slice 6 — Moderation & ship
**Goal:** admin actions, polish, deploy, README.

### Server
- [ ] Admin routes reusing `verifyAdmin` — delete any post, promote/demote users
- [ ] Production `autoIndex: false`
- [ ] CORS locked to the deployed client origin

### Client
- [ ] `/admin` dashboard, guarded by the role read from Mongo
- [ ] Loading skeletons, empty states, a real 404 page
- [ ] SweetAlert2 confirmations on destructive actions
- [ ] Cloudinary avatar upload on the profile

### Ship
- [ ] Both deployed, env vars set on Render and Vercel
- [ ] Seed data so the site isn't empty for a visitor
- [ ] `README.md` with an **Architecture Decisions** section — Mongoose over
      Prisma, votes as a collection, the transaction, embed vs reference,
      `$facet` pagination, markdown safety

**Done when:** a stranger can use the deployed site without you explaining
anything.

**Commit:** `feat(admin): moderation dashboard` then `docs: readme with architecture decisions`

---

## Project definition of done
- [ ] All six vote transitions covered by passing tests
- [ ] Reputation is always reconstructable from the votes collection
- [ ] No user content is ever rendered with `dangerouslySetInnerHTML`
- [ ] No privileged decision trusts anything from the request body
- [ ] The feed is one round trip and uses an index
- [ ] Deployed, seeded, and documented
