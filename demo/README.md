# VRGTrack — interactive demo

A clickable, no-backend demo of **VRGTrack**, the weekly accountability app for a business
networking group: members file a report after each meeting, and the dashboard rolls those
up into referrals, one-to-ones, revenue exchanged, visitors and attendance against annual
goals.

Everything runs in the browser. There is no server, no database and no network call — so
the demo can be handed to a prospect as a link, a folder, or a zip.

## Deploying

The build in `dist/` is committed and self-contained. Assets are referenced relatively and
routing is hash-based, so it works at any path with no rewrite rules.

- **Cloudflare Pages / Netlify / Vercel** — connect the repo with root directory `demo`,
  build command `npm run build`, output directory `dist`. Or skip the build entirely and
  upload `demo/dist/` directly.
- **GitHub Pages** — serve from `demo/dist/` on the default branch.
- **Anywhere else** — copy `demo/dist/` onto the host, or open `demo/dist/index.html`
  locally.

Add a `noindex` header or meta tag if you publish it on a domain you care about ranking.

## What a visitor can do

- **Public home** — year-to-date and current-month progress against annual goals.
- **Submit a weekly report** — attendance or absence reason, visitors brought, referrals
  given, one-to-ones held, money received. The numbers show up in the dashboard immediately.
- **Sign in** — credentials are pre-filled (`admin@vrgdemo.com`, any password), or use
  "Skip sign-in". Signing in with any *other* email lands in the non-admin view, which
  hides the user-management controls.
- **Dashboard** — year-to-date, this-month and group-total rollups.
- **Weekly report** — week-by-week submission table with member search.
- **Member reports / member detail** — per-member totals and full submission history.
- **Absence tracking** — absences per member for any month.
- **Manage members** — add, edit, deactivate, remove.
- **Export data** — real CSV downloads of submissions and members.
- **Annual goals** — edit the targets and watch every progress bar recalculate.
- **User management** — invite users, change roles, remove (admin only).

Edits persist in the visitor's browser (`localStorage`) and affect nobody else. "Reset demo
data" in the corner notice restores the seeded dataset.

## How it relates to the real app

This is the production client from [`../app`](../app) (React + tRPC + Drizzle/MySQL) with
only the network layer replaced:

| Real app | Demo |
| --- | --- |
| tRPC client → Express → MySQL | `src/lib/trpc.ts` shim → `src/demo/api.ts` → in-browser store |
| Session cookie, bcrypt, Google OAuth | Demo session in the same store; any password accepted |
| Rows in MySQL | Deterministic sample data in `src/demo/seed.ts`, persisted to `localStorage` |
| Browser-history routing | Hash routing, so the build runs from any static path |

`src/demo/api.ts` reimplements each tRPC procedure's logic against the local dataset, and
`src/demo/types.ts` mirrors the Drizzle row shapes. The pages in `src/pages/` and the
components in `src/components/` are the app's own code, unchanged apart from two spots in
`DashboardLayout.tsx`: hash-prefixed sidebar links, and demo sign-in in place of the OAuth
redirect.

Pointing the client back at a real backend is mostly a matter of restoring the original
`src/lib/trpc.ts` and `src/main.tsx` — the pages themselves need no changes.

## Sample data

`src/demo/seed.ts` generates the dataset from a fixed seed, so every visitor sees the same
numbers. It builds 16 members (14 active, 2 inactive), a meeting every Wednesday from
January 1 of the **current** year through today, and a submission per member per meeting
with realistic rates for attendance, referrals, one-to-ones, revenue and visitors.

Because it is generated relative to today, the demo never goes stale — "This Week" and
"This Month" always have data, and it re-seeds automatically when the calendar year rolls
over.

## Development

```sh
npm install
npm run dev      # local dev server
npm run check    # typecheck
npm run build    # writes dist/
```

Rebuild and commit `dist/` whenever you change the demo, since the built output is what
gets served.
