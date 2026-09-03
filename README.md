# SecureHire — Role-Based Hiring Tracker

A hiring tracker for three roles — **Admin**, **Recruiter**, **Panelist** — whose point is
not that it *has* role-based access control, but that an automated suite **proves** the
control holds: unauthorized data cannot leak between roles or between users, and a future
regression that reintroduced a leak would fail the build.

Every access decision is made in the backend, inside the database query. The React app
hides links and guards routes purely for user experience; the same requests typed into a
terminal are refused identically.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT in an HTTP-only cookie (Bearer also accepted for API clients), bcrypt password hashing |
| Tests | Vitest + Supertest against a real Postgres test database |

---

## Running it locally

```bash
# 1. Database (Docker)
docker compose up -d

# 2. Backend
cd server
cp .env.example .env          # the committed .env already has working local values
npm install
npx prisma migrate deploy     # or: npx prisma db push
npm run seed
npm run dev                   # http://localhost:4100

# 3. Frontend (second terminal)
cd web
npm install
npm run dev                   # http://localhost:5175
```

The Vite dev server proxies `/api` to the backend, so the session cookie stays same-origin.

### Development credentials

Seeded by `npm run seed`. **Local development only — never use these anywhere real.**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Password123!` |
| Recruiter A | `recruiter.a@example.com` | `Password123!` |
| Recruiter B | `recruiter.b@example.com` | `Password123!` |
| Panelist A | `panelist.a@example.com` | `Password123!` |
| Panelist B | `panelist.b@example.com` | `Password123!` |

The password comes from `SEED_PASSWORD` in `server/.env`, so it is not hard-coded in the
seed script.

### Commands

```bash
cd server
npm test              # prepares the test database, then runs the whole suite
npm run test:leak-check   # the mutation proof described below
npm run typecheck
npm run build

cd ../web
npm run build
```

---

## The seeded access boundaries

The dataset exists to create deliberate isolation:

```
Requisition A  → Recruiter A        Requisition B  → Recruiter B
  Candidate A1 (Ananya Rao)           Candidate B1 (Brian Osei)
  Candidate A2 (Arjun Mehta)          Candidate B2 (Bianca Costa)

Panelist A → assigned to Candidate A1 only
Panelist B → assigned to Candidate B1 only
```

Candidates A2 and B2 are assigned to nobody, which is what makes "a panelist must not see
an *unassigned* candidate in a requisition they already have a foothold in" testable.

---

## Authorization model

### Where the decision is made

`src/services/authorization.service.ts` is the only place that answers "may this user
touch this row". Controllers call it; they never compare IDs themselves and never read an
owner ID out of a request body or query string.

| Helper | Responsibility |
|---|---|
| `candidateScopeWhere(user)` / `requisitionScopeWhere(user)` | The Prisma `where` clause that reduces a list query to the caller's scope |
| `authorizeCandidateAccess(user, id, action)` | Loads a candidate only if the caller may perform `action` on it |
| `authorizeRequisitionAccess(user, id, action)` | The same gate for requisitions |
| `authorizeRequisitionTarget(user, id)` | Guards writes that *name* a requisition (create a candidate, move one) |
| `verifyRecruiterOwnership` / `verifyPanelistAssignment` | The two primitive ownership questions |

### Admin

`ADMIN` short-circuits every scope to `{}` and every resource check to "allowed". Admins
are the only role that can list users, delete requisitions, reassign requisition
ownership, and use preview mode.

### Recruiter isolation

Scope is `WHERE requisition.recruiterId = <authenticated user id>`, applied inside the SQL
query — never by filtering an unfiltered result set afterwards. On a single resource, the
candidate's `requisition.recruiterId` must equal the caller's id.

Ownership always comes from the session:

- `POST /api/requisitions` ignores `recruiterId` in the body for recruiters (it is honoured
  for admins only), so a recruiter cannot plant a requisition under a colleague.
- `PATCH /api/candidates/:id` re-checks the *target* requisition when `requisitionId`
  changes, so a candidate cannot be pushed into or pulled out of another tenancy.

### Panelist isolation

`CandidatePanelistAssignment` is the single source of truth — a row keyed
`UNIQUE(candidateId, panelistId)`. Scope is
`WHERE assignments SOME (panelistId = <authenticated user id>)`. Requisition membership
grants nothing: Panelist A, assigned to A1, still receives 403 for A2 in the same
requisition.

Panelists are read-plus-feedback only, they never see the rest of the panel or other
panelists' scorecards, and their candidate payload is reduced — no email, no phone, no
recruiter notes — by `serializeCandidate`.

### Preview mode

An admin sends `X-Preview-As-User: <userId>`. The authentication middleware:

1. Establishes `req.authenticatedUser` from the verified token (re-read from the database
   every request, so deactivations and role changes take effect immediately).
2. Honours the preview header **only** if that proven identity is `ADMIN`. Anyone else
   sending it gets `403` — the request is refused outright, not silently ignored.
3. Looks the preview target up in the database and uses that user's real role as
   `req.effectiveUser`.

Authorization runs against `effectiveUser`; the right to preview at all is governed by
`authenticatedUser`. `User.role` is never written, so preview leaves nothing behind, and an
admin previewing as Recruiter A genuinely loses admin reach — including on writes.

### Denial strategy

Non-admins receive an identical `403 FORBIDDEN` with an identical message whether a record
does not exist or exists and belongs to someone else, so responses cannot be used to
enumerate IDs. Admins, who may read everything anyway, get an honest `404` for a missing
row. Errors are uniform:

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "You do not have permission to access this resource." } }
```

---

## API

```
POST   /api/auth/register        # RECRUITER or PANELIST only — ADMIN is rejected by the schema
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me              # returns { authenticatedUser, effectiveUser, isPreview }

GET    /api/candidates           # scoped: all / own requisitions / assigned only
GET    /api/candidates/:id
POST   /api/candidates           # admin + recruiter (own requisitions)
PATCH  /api/candidates/:id
DELETE /api/candidates/:id

GET    /api/candidates/:candidateId/panelists
POST   /api/candidates/:candidateId/panelists
DELETE /api/candidates/:candidateId/panelists/:panelistId

GET    /api/candidates/:candidateId/feedback
POST   /api/candidates/:candidateId/feedback   # panelists: assigned candidates only

GET    /api/requisitions         # admin: all, recruiter: own, panelist: 403
GET    /api/requisitions/:id
POST   /api/requisitions
PATCH  /api/requisitions/:id
DELETE /api/requisitions/:id     # admin only

GET    /api/users                # admin only
GET    /api/users/panelists      # admin + recruiter (needed to staff a panel)
PATCH  /api/users/:id            # admin only — activate/deactivate
GET    /api/preview/users        # authenticated admin only
GET    /api/stats/dashboard      # counts computed over the caller's scope
```

---

## The security test suite

`server/tests/` — 65 tests, all against a real database through the real Express app.

Every authorization test asserts **two** things: that the request is refused, *and* that
the protected data is absent from the response body. `expectAbsent()` serializes the whole
body and fails if a protected name, email, phone number or id appears anywhere in it — so a
handler that returned `403` while still echoing the record would fail.

| File | What it attacks |
|---|---|
| `authorization/recruiter-isolation.test.ts` | Recruiter A reading, editing, deleting and planting candidates in Recruiter B's requisition |
| `authorization/panelist-assignment.test.ts` | Panelist A reaching an unassigned candidate — including one in the same requisition |
| `authorization/requisition-isolation.test.ts` | Recruiter A enumerating Recruiter B's requisitions |
| `authorization/id-manipulation.test.ts` | Swapping the id in the URL, forging query params and body ownership fields |
| `authorization/preview-escalation.test.ts` | Non-admins sending `X-Preview-As-User`; admins losing reach while previewing |
| `authorization/assignments.test.ts` | Assignment as a privilege-granting write; duplicate and concurrent assignment |
| `authorization/edge-cases.test.ts` | Deactivation, ownership transfer, candidate moved between requisitions, deleted preview target |
| `auth/auth.test.ts` | Cookies, forged tokens, inflated role claims, expired tokens, ADMIN self-registration |

### Leak-detection proof

`npm run test:leak-check` rewrites the authorization code into the insecure form a
developer might plausibly ship, runs the suite against it, and restores the original. The
script exits non-zero if any mutation goes undetected.

| Simulated bug | Result |
|---|---|
| List endpoint drops the role filter (`findMany()` with no `where`) | **15 tests failed** |
| Role is checked but resource ownership is not | **13 tests failed** |
| `X-Preview-As-User` trusted from any authenticated user | **3 tests failed** |
| Panelist visibility inferred from the requisition instead of the assignment | **6 tests failed** |
| Secure code restored | **65 passed, 0 failed** |

---

## Security measures

- Password hashing with bcrypt (12 rounds); no password or hash ever appears in
  an API response.
- JWT in an HTTP-only, `SameSite=Lax` cookie; `secure` flag driven by `COOKIE_SECURE`.
- The user record is re-read from the database on every request, so a token's `role` claim
  is decorative — inflating it buys nothing, and deactivating an account kills live
  sessions immediately.
- Zod validation on every body, param and query; unknown fields are dropped, not trusted.
- Rate limiting: 20 attempts / 15 min on the credential endpoints, 300 req/min globally.
- Helmet, an explicit CORS origin allow-list with credentials, and a 100 kB body cap.
- Secrets come from environment variables; production refuses to boot with a short
  `JWT_SECRET`.
- Prisma query logging is off, so candidate PII never reaches stdout; unhandled errors log a
  message only and return a generic 500.

---

## Deployment (Render + Vercel)

The backend runs on Render, the static frontend on Vercel. `render.yaml` and
`web/vercel.json` in this repo hold the configuration.

**The frontend calls `/api` as a relative path with `credentials: 'include'`.**
That single fact drives the whole setup: rather than pointing the browser at the
Render host, Vercel *rewrites* `/api/*` through to Render. The browser therefore
only ever talks to one origin, so the session cookie stays first-party and
`SameSite=Lax` — the same model the local Vite proxy provides, and the one the
test suite exercises. Nothing has to be relaxed to `SameSite=None`, and no
frontend code changes between local and production.

```
browser → securehire.vercel.app ──/api/*──▶ securehire-api.onrender.com
             (one origin, first-party cookie)
```

### Order matters

1. **Database first** — create a free Postgres (Neon or Supabase) and copy its
   connection string. Render permits only one free Postgres per account, and
   SecureHire needs a database of its own: the init migration is
   schema-qualified (`CREATE TABLE "public"."User"`), so a `?schema=` parameter
   cannot divert it into a corner of an existing database.
2. **Render** — deploy the Blueprint (`render.yaml`); set `DATABASE_URL` to that
   connection string. Render generates `JWT_SECRET` and runs
   `prisma migrate deploy` during the build. Note the resulting service URL.
3. **Point Vercel at it** — replace the host in `web/vercel.json` with that URL.
4. **Vercel** — import the repo with **Root Directory `web`**, then set
   `CORS_ORIGIN` on Render to the Vercel URL and redeploy.

### Notes

- The Render build uses `npm ci --include=dev`: `NODE_ENV=production` applies to
  the build too, and `tsc`/`prisma` are devDependencies. Without the flag the
  build fails with `tsc: not found`.
- Seed the deployed database from your machine, using the *external* connection
  string from the Render dashboard:
  `DATABASE_URL="<external-url>" npm run seed`
- Free Render services sleep after ~15 minutes idle, so the first request after
  a pause takes roughly 50 seconds.
- `COOKIE_SECURE=true` is required in production and is set in the Blueprint.

---

## Known limitations

- `npm test` runs against a live Postgres database and re-seeds per file, so the suite is
  serialized (`fileParallelism: false`). It is not safe to point it at a database you care
  about; `DATABASE_URL` in `.env.test` is a dedicated `securehire_test` database.
- The JWT is also returned in the login response body for non-browser API clients. Browsers
  should ignore it and rely on the cookie; if you do not need API clients, delete that field.
- There is no refresh-token rotation — sessions simply expire after `JWT_EXPIRES_IN` (2h).
- Registration is open to anyone who can reach the API (as RECRUITER or PANELIST). A real
  deployment would put it behind an invite or SSO.
- The frontend has no component tests; correctness of the access boundary is asserted at the
  API level, which is where it is enforced.
