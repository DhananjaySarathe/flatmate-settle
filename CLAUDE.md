# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ExpenseWaale (package name `expensewaale`) — a React + TypeScript + Vite SPA for splitting shared expenses, backed by Supabase (Postgres + Auth + Edge Functions). Bootstrapped via Lovable; the `lovable-tagger` Vite plugin runs only in development mode.

## Commands

```bash
npm run dev        # Vite dev server on port 8080 (host "::")
npm run build      # production build to dist/
npm run build:dev  # development-mode build (with componentTagger)
npm run preview    # serve the production build
npm run lint       # eslint .
```

There is no test runner configured. Do not invent one.

Required env (in `.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (note: README mentions `VITE_SUPABASE_ANON_KEY`, but the code in `src/integrations/supabase/client.ts` reads `VITE_SUPABASE_PUBLISHABLE_KEY` — use that)

Path alias: `@/*` → `src/*` (configured in `vite.config.ts` and `tsconfig`).

## Architecture

### Routing & layout

`src/App.tsx` sets up `BrowserRouter` with these routes — `/` redirects to `/auth`; `/auth` and `/share/:token` render bare; every signed-in page (`/dashboard` "Home", `/expenses`, `/reports` "Settle up", `/analytics` + `/my-cost` + `/leaderboard` "Insights", `/split-spaces` "Groups") is a child of a `<Route element={<Layout />}>` layout route, so the shell and the global expense composer never remount on navigation. New signed-in pages go inside that layout route, above the `*` catch-all. `vercel.json` rewrites all paths to `/` for SPA routing.

`Layout` owns the sticky header (group switcher, nav, "Add expense"), the mobile bottom tab bar (`.pb-tabbar` keeps content clear of it) and `ExpenseComposerProvider` (`useExpenseComposer()` → `openNew` / `openEdit` / `openDetail`). Pages must not add their own `container`/outer padding. UI copy says "group" for a split space and "people" for flatmates; code identifiers keep the schema names.

There is **no auth guard component** — pages individually handle the unauthenticated case via the Supabase client. Don't assume a `<ProtectedRoute>` exists.

### Data layer

All data access goes through one Supabase client: `import { supabase } from "@/integrations/supabase/client"`. `src/integrations/supabase/types.ts` is the **generated** Database type — regenerate it (don't hand-edit) after schema changes. It is currently stale (no `split_spaces`/`categories`, no `split_space_id`/`category_id`), so app code imports `db` from `src/lib/db.ts`: the same client re-typed with those parts of the existing schema. Delete that augmentation once the types are regenerated.

Pages inside the shell read through `src/hooks/useSpaceData.ts` (TanStack Query, keyed by space; pages past PostgREST's 1000-row cap; keeps legacy rows with a NULL `split_space_id` visible as the old pages did). After a write, call `useRefreshSpace()(spaceId)`. Writes live in `src/lib/mutations.ts` — expense create rolls back the expense if its splits fail, and edits insert added splits before deleting removed ones (there is no UPDATE policy on `expense_splits`), so an expense never ends up with nobody in its split. `src/hooks/useSettleView.ts` is the one place pages turn expenses into balances and a payment plan via `src/lib/settlement.ts` (unchanged calculation rules).

All tables have RLS enabled. Most rows are scoped by `split_space_id`; queries that omit it will silently return nothing or violate policies. When adding a feature that touches `flatmates`, `expenses`, or `expense_splits`, always filter by the currently selected split space.

### Split Space context (cross-cutting)

`src/contexts/SplitSpaceContext.tsx` (`useSplitSpace`) is the single source of truth for "which group am I in." It loads spaces for the authed user, persists the selected ID under `localStorage["selectedSplitSpaceId"]`, and falls back to a space named "Default" (auto-created by a DB trigger on signup). The `Default` space is undeletable at both DB and UI level — preserve that invariant in any new delete flows.

### Filter persistence (Reports + Analytics)

`src/hooks/useReportFilters.ts` owns people filters (`exactMatch` / `anyMatch` / `exclude` / `paidBy`), category filters (`include` / `exclude`), a `datePreset` (`since-settlement` default, `this-month`, `last-month`, `all-time`, `custom`) and the custom date range, persisting the whole bag under `localStorage["reportFilters"]`. Dynamic presets are resolved from data at render time with `resolveDateRange` (`src/lib/expenseFilters.ts`), so they never go stale. Reports and Analytics share this hook so a filter set survives navigation between them. New filterable views should reuse this hook rather than re-implementing filter persistence. Filter semantics live in `applyPeopleAndCategoryFilters`.

Filtering is **client-side**: pages fetch the working set from Supabase, then apply filters in memory. Keep this model — server-side filtering would break filter UX that depends on counts/options derived from the unfiltered set.

### UI

shadcn/ui (Radix primitives + Tailwind), with components living in `src/components/ui/`. `components.json` configures the shadcn CLI: style "default", base color slate, alias `@/components/ui`. Add new shadcn components via the CLI rather than hand-writing them so the config stays consistent. Tailwind config: `tailwind.config.ts`. Toaster providers (`Toaster`, `Sonner`, `TooltipProvider`) are wired in `App.tsx`.

State management: `SplitSpaceContext` for cross-page selection (it reloads on sign-in/out), `useSpaceData` (TanStack Query) for server data, `useReportFilters` / `useMyCostFilters` for persisted filters. Only `SharedReport` (token lookup) and `SplitSpaces` (counts) query Supabase directly. Shared UI building blocks live in `src/components/common/` (PageHeader/Section/Panel, ResponsiveDialog — a bottom sheet on phones, ConfirmDialog, SettlementPlan, BalanceList, Chip, PersonAvatar, EmptyState/ErrorState). Format money with `formatMoney` and parse `date` columns with `parseDay` (`src/lib/format.ts`); never `new Date("yyyy-MM-dd")`.

PDF reports use `jspdf` + `jspdf-autotable` (builders in `src/lib/reportExports.ts` and `src/lib/insightExports.ts`; amounts print as "Rs." because Helvetica has no ₹ glyph). Charts use `recharts`. Email sending goes through the Supabase Edge Function `supabase/functions/send-settlement-email/`.

### Database migrations

Migrations live in `supabase/migrations/` and **must run in filename order**. The 2025-11-27 series introduced `split_space_id` scoping and a one-off data migration (`...031024_migrate_existing_data.sql`, `...031025_fix_rls_for_migration.sql`); these two are intended for environments with pre-split-space data and should not be re-run on a fresh database. The categories migration (`...031027_add_categories.sql`) seeds 8 default categories per user via trigger and protects them from deletion.

When adding a migration: new file, lexicographically-later timestamp prefix, preserve RLS on any new table, and regenerate `src/integrations/supabase/types.ts`.

## Conventions worth knowing

- ESLint disables `@typescript-eslint/no-unused-vars` globally — don't expect lint to flag dead variables.
- The repo uses `npm` (there's a `package-lock.json`); `bun.lockb` is also present but `npm` is what the scripts target.
- README.md is developer-facing; GUIDE.md is end-user-facing. Both are long — prefer reading the relevant section over re-reading them in full.
