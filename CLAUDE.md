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

`src/App.tsx` sets up `BrowserRouter` with these routes — `/` redirects to `/auth`; `/auth` and `/share/:token` render bare; every signed-in page is a child of one layout route (`<Route element={<Layout />}>`), so the shell doesn't remount on navigation. Signed-in routes: `/dashboard` (Home: your position, the settle-up plan, recent expenses), `/expenses`, `/reports` (shown as **Balances**), `/analytics`, `/my-cost` and `/leaderboard` (the three **Insights** tabs), `/people` (manage the people in a space), `/split-spaces`. Pages that pull in charts or jsPDF are `React.lazy` loaded; keep Home/Expenses/People eager. New pages must be registered above the `*` catch-all, inside the layout route. `vercel.json` rewrites all paths to `/` for SPA routing.

`src/components/Layout.tsx` is the shell: a sidebar from `md` up; a top bar plus a bottom tab bar (Home, Expenses, central Add, Balances, More) on phones. It also mounts `ExpenseSheetProvider` (`src/contexts/ExpenseSheetContext.tsx`). Call `useExpenseSheet().openNewExpense()` / `openEditExpense(expense)` instead of building another expense form. "N" opens it from anywhere.

There is **no auth guard component** — `Layout` redirects to `/auth` when there's no session. Don't assume a `<ProtectedRoute>` exists.

### Data layer

All data access goes through one Supabase client: `import { supabase } from "@/integrations/supabase/client"`. `src/integrations/supabase/types.ts` is the **generated** Database type — regenerate it (don't hand-edit) after schema changes. It is currently stale (no `split_spaces`, `categories`, `split_space_id`, `category_id`), so new code queries through `db` from `src/lib/db.ts` (the same client, untyped) and types rows with the interfaces defined there.

Reads for the selected space go through `src/hooks/useSpaceData.ts` (TanStack Query, cached per space: flatmates, expenses with `categories` + `expense_splits`, saved settlements, categories). Expenses are read in pages of 1000, because PostgREST caps responses. Writes live in `src/lib/mutations.ts`; after a write, call `useRefreshSpaceData()` to invalidate. Balance and settle-up maths stays in `src/lib/settlement.ts`. `src/lib/ledger.ts` only composes it: an id-keyed copy of the plan, and the "open period" after the latest settled `to_date`. Money and date display go through `src/lib/format.ts` (`formatMoney` for ₹ with en-IN grouping, `parseDateOnly` for DATE columns).

All tables have RLS enabled. Most rows are scoped by `split_space_id`; queries that omit it will silently return nothing or violate policies. When adding a feature that touches `flatmates`, `expenses`, or `expense_splits`, always filter by the currently selected split space.

### Split Space context (cross-cutting)

`src/contexts/SplitSpaceContext.tsx` (`useSplitSpace`) is the single source of truth for "which group am I in." It loads spaces for the authed user (and reloads on `SIGNED_IN` / clears on `SIGNED_OUT`, since it sits above the router), persists the selected ID under `localStorage["selectedSplitSpaceId"]`, and falls back to a space named "Default" (auto-created by a DB trigger on signup). The `Default` space is undeletable at both DB and UI level — preserve that invariant in any new delete flows. Deleting a space cascades to its people and expenses in the DB, so the Spaces page re-counts right before deleting.

Which person in a space is "me" is a per-device preference (`useMe`, `localStorage["expensewaale:me"]`, keyed by space id; `"none"` means not in the group). Flatmates aren't accounts, so this never goes to the server.

### Filter persistence (Reports + Analytics)

`src/hooks/useReportFilters.ts` owns people filters (`exactMatch` / `anyMatch` / `exclude` / `paidBy`), category filters (`include` / `exclude`), and a date range, persisting the whole bag under `localStorage["reportFilters"]`. Reports and Analytics share this hook so a filter set survives navigation between them. New filterable views should reuse this hook rather than re-implementing filter persistence. The UI for it is `src/components/ReportControls.tsx` (period presets from `src/lib/periods.ts`, plus an inline filter panel and removable chips). `PeopleFilters` and `CategoryFilterSection` are controlled components: pass the hook's values in. The filter rules themselves live in `src/lib/expenseFilters.ts`.

Filtering is **client-side**: pages fetch the working set from Supabase, then apply filters in memory (including the date range, which used to be a server-side `gte`/`lte`). Keep this model — server-side filtering would break filter UX that depends on counts/options derived from the unfiltered set.

### UI

shadcn/ui (Radix primitives + Tailwind), with components living in `src/components/ui/`. `components.json` configures the shadcn CLI: style "default", base color slate, alias `@/components/ui`. Add new shadcn components via the CLI rather than hand-writing them so the config stays consistent. Tailwind config: `tailwind.config.ts`. Toaster providers (`Toaster`, `Sonner`, `TooltipProvider`) are wired in `App.tsx`.

Design tokens live in `src/index.css`. `--accent` is shadcn's quiet hover/highlight surface; the brand sage is `--sage`, and money direction is `--positive` ("gets back") and `--negative` ("owes"). Put balances into words with `NetLabel`, never as a bare sign. App-level building blocks: `ResponsiveDialog` (a bottom sheet on phones, a dialog from `md`), `ChoiceChip`, `PersonAvatar`, `ExpenseRow`, `PaymentList` / `BalanceList` (`LedgerViews.tsx`), `EmptyState`, `PageHeader`. Product context for design work is in `PRODUCT.md`.

State management is a deliberate mix: `SplitSpaceContext` for cross-page selection, the `useReportFilters` hook for filter persistence, and TanStack Query (`useSpaceData`) for space data. Every page except `SplitSpaces` (space counts) and `SharedReport` (public snapshot) reads through `useSpaceData`.

PDF reports use `jspdf` + `jspdf-autotable`. Charts use `recharts`. Email sending goes through the Supabase Edge Function `supabase/functions/send-settlement-email/`.

### Database migrations

Migrations live in `supabase/migrations/` and **must run in filename order**. The 2025-11-27 series introduced `split_space_id` scoping and a one-off data migration (`...031024_migrate_existing_data.sql`, `...031025_fix_rls_for_migration.sql`); these two are intended for environments with pre-split-space data and should not be re-run on a fresh database. The categories migration (`...031027_add_categories.sql`) seeds 8 default categories per user via trigger and protects them from deletion.

When adding a migration: new file, lexicographically-later timestamp prefix, preserve RLS on any new table, and regenerate `src/integrations/supabase/types.ts`.

## Conventions worth knowing

- ESLint disables `@typescript-eslint/no-unused-vars` globally — don't expect lint to flag dead variables.
- The repo uses `npm` (there's a `package-lock.json`); `bun.lockb` is also present but `npm` is what the scripts target.
- README.md is developer-facing; GUIDE.md is end-user-facing. Both are long — prefer reading the relevant section over re-reading them in full.
