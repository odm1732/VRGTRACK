# VRGTrack

Weekly accountability tracking for a business networking group. Members file a report after
each meeting — who they referred, who they met one-to-one, revenue that came back from
referrals, visitors they brought, and whether they attended — and the dashboard rolls it all
up against the group's annual goals.

This repository holds the live tracker and the original application it came from:

| | |
| --- | --- |
| [`demo/`](demo) | The live frontend (React, static build in `demo/dist/`), served by Cloudflare Pages. |
| [`functions/`](functions) | The live API — Cloudflare Pages Functions backed by a D1 (SQLite) database. Deploys automatically with the Pages project. |
| [`app/`](app) | The original full-stack application (React + tRPC + Express + Drizzle/MySQL), kept for reference. Not deployed. |

## How the live site works

- **Public**: the home page scoreboard (`GET /api/summary`) and the weekly report form
  (`POST /api/submissions`) need no login — members just submit.
- **Admin**: the dashboard (reports, member management, goals, export, agenda editing) is
  behind a shared admin password (`ADMIN_PASSWORD`). `POST /api/login` issues a signed
  30-day token carrying the role.
- **Members**: each member has their own password for the Meeting Notes page. On first
  sign-in they create it by presenting the group code (`MEMBER_PASSWORD`); after that it's
  name + personal password. Passwords are stored as salted PBKDF2 hashes; the session
  token carries the member's id, and the API only lets a member read or write their own
  notes. Admins can clear a member's password from Manage Members (the member then
  re-creates it with the group code). A member session cannot open the admin dashboard.
- **Data**: everything lives in a D1 database. On the very first request the API creates
  its tables and, if empty, seeds the snapshot of the group's real totals through
  Aug 19, 2026 (`functions/api/seedData.json`). No migration tooling needed.

## Cloudflare setup (one time)

The Pages project itself is already connected to this repo. To activate the backend:

1. **Create the database** — dashboard → Storage & Databases → D1 → Create → name it
   `vrgtrack`.
2. **Bind it** — Workers & Pages → the Pages project → Settings → Bindings →
   Add → D1 database → variable name `DB` → select `vrgtrack`.
3. **Set the admin password** — same Settings → Variables and Secrets → Add →
   name `ADMIN_PASSWORD`, type Secret, value = the password the leadership team will use.
   Also add a secret named `MEMBER_PASSWORD` — the group code members enter once when
   creating their personal Meeting Notes password (must differ from the admin password).
4. **Optional — Google Sheet backup** — create a Google Sheet, add the Apps Script from
   [`docs/google-sheet-backup.md`](docs/google-sheet-backup.md), deploy it as a web app, and
   store its URL as a secret named `SHEETS_WEBHOOK_URL` on the Pages project. Every new
   submission is then appended to the sheet, and the dashboard's Export Data page gains a
   "Send Full Backup" button.
5. **Redeploy** — Deployments → latest → Retry deployment (bindings only apply to new
   deployments).

Visit the site: the first request seeds the database, and the dashboard accepts the
password you set.

## Local development

```sh
npm install && cd demo && npm install && cd ..
npm run build   # rebuild the frontend into demo/dist
npm run dev     # wrangler serves demo/dist + the API with a local D1 (password: dev-password)
```

## `app/` — the real application

The production app. Members submit through a public form; admins sign in (email/password or
Google OAuth) to reach the dashboard, member reports, absence tracking, member and user
management, goal setting and CSV export.

- **Stack** — React 19, Vite, Tailwind v4, shadcn/ui, wouter, tRPC v11, TanStack Query,
  Express, Drizzle ORM on MySQL, bcrypt + JWT sessions, Vitest.
- **Data model** (`drizzle/schema.ts`) — `users`, `members`, `submissions`, `goals`.
  Submissions store referrals, one-to-ones and money received as JSON arrays.
- **API** (`server/routers.ts`) — `auth`, `dashboard`, `goals`, `members`, `submissions`
  and `users` routers.

```sh
cd app
pnpm install
pnpm db:push     # generate + run migrations
pnpm dev
pnpm test
```

Requires `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL` and related
variables (see `server/_core/env.ts`). Nothing is committed for these — supply them through
the environment.

## `demo/` — the interactive demo

The same client with only the network layer replaced: a tRPC-shaped shim resolves against an
in-browser store seeded with realistic sample data, so every page, dialog, table and form
works with no server, no database and no network call. Edits persist in the visitor's own
browser and can be reset.

The built output in `demo/dist/` is committed and self-contained — deployable as-is.

```sh
cd demo
npm install
npm run dev
npm run build    # writes demo/dist/
```

See [`demo/README.md`](demo/README.md) for deploy options, what a visitor can click through,
and exactly how the demo layer differs from the real one.
