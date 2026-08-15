# VRGTrack

Weekly accountability tracking for a business networking group. Members file a report after
each meeting — who they referred, who they met one-to-one, revenue that came back from
referrals, visitors they brought, and whether they attended — and the dashboard rolls it all
up against the group's annual goals.

This repository holds two things:

| | |
| --- | --- |
| [`app/`](app) | The full-stack application: React + tRPC + Express + Drizzle/MySQL. Needs a database and environment config to run. |
| [`demo/`](demo) | A self-contained, no-backend build of the same client, for showing the product without provisioning anything. |

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
