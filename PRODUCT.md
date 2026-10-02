# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One organizer per group records shared costs for flatmates, trip-mates or colleagues. Everyone else in the group is a name in the app (optionally with an email or phone), not an account holder. They see results through a public share link, a PDF, or a summary pasted into chat. The organizer is usually one of the people splitting costs, so the app can be told which person they are (saved on that device, per space).

Inferred from the code, not yet confirmed: expenses get logged on a phone soon after paying, and settling up, exporting and sharing happen at month-end, often on desktop.

## Product Purpose

Keep each group's costs in its own space. Split every expense equally between the people involved, and answer "who pays whom, and how much" with as few payments as possible. A period can be marked as settled, so the next settle-up starts where the last one ended.

## Positioning

An equal-split ledger with a fewest-payments settle-up plan, a history of settled periods, and frozen read-only snapshots that people outside the account can open.

## Operating Context

- Money is in Indian rupees (₹). PDFs print "Rs." because the PDF font has no rupee glyph.
- Sharing happens outside the app: copied text (typically pasted into chat), PDF downloads, and public `/share/:token` links.
- Each space has its own people, expenses and settled periods. Categories belong to the account and are shared across spaces.

## Capabilities and Constraints

- Splits are equal only (amount ÷ people in the split). There are no percentage, share or exact-amount splits.
- A "Default" space is created at signup and can't be deleted. A space that still has people or expenses can't be deleted from the UI.
- There are 8 default categories plus custom ones. Default categories can't be deleted.
- A settlement records a date range only. Individual payments aren't recorded.
- Share links are snapshots: later edits don't change what viewers see.
- Deleting a person also deletes every expense they paid and removes them from all splits (database cascade).
- Email sending isn't live. An Edge Function exists, but the UI never calls it, and the UI must never pretend it does.
- Frontend-only boundary for current work: no backend, schema, RLS, Edge Function, migration or API-contract changes. The calculation rules in `src/lib/settlement.ts` are fixed.

## Brand Commitments

- Name: ExpenseWaale.
- Keep the warm palette: terracotta primary, sage accent, cream ground, Inter. The user confirmed on 2026-10-02 to keep this look and remove the decorative noise.
- Terracotta exists in two slightly different values, a pre-existing mismatch that was left alone on purpose. The on-screen token is `hsl(18 75% 40%)` (about `#B34719`, in `src/index.css`). PDF exports (`PDF_COLORS.primary` in `src/lib/pdfStyle.ts`) and the browser `theme-color` use `#9F4F2D` (about `hsl(18 56% 40%)`). Unifying them would change either the on-screen look or the PDFs, so it needs a deliberate decision.
- Playful, local touches belong to the leaderboard (badges like "Milk Bhai", "Fuel King"), not to core money screens.

## Evidence on Hand

- There are no verified usage numbers, ratings, testimonials or "amount tracked" totals. Never show user counts, star ratings, version badges or volume claims. The user confirmed removing these on 2026-10-02.

## Product Principles

1. Answer "who owes whom" before anything else.
2. Logging an expense should take seconds: amount, what it was for, done. Defaults cover the rest.
3. Show money the same way everywhere: ₹ with en-IN grouping, and the direction in words ("gets back", "owes"). Amounts someone pays, is owed or spent on an expense always show paise. Aggregate insight figures (totals, averages, chart ticks on Insights) may round to whole rupees.
4. Never imply a capability the product doesn't have.
5. A destructive action says exactly what it will remove before it runs.
