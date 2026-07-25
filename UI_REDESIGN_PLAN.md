# Expense Tracker UI Redesign Plan

## Goal

Rebuild the app UI into a faster personal finance workspace while keeping the current stack:

- Next.js app router
- shadcn/ui primitives
- existing Prisma/API behavior
- existing expense, income, transfer, import, account, subscription, and report data

The redesign should prioritize daily use: quick manual entry, reviewing imported data, fixing classification mistakes, and seeing cash movement clearly.

## Implementation Status

Current pass status before commit:

- Done: shared workspace UI primitives, searchable selects, unified Transactions page, Dashboard command center, AI draft fill in Expense/Income dialogs, Transfers page, Imports review workflow, Accounts audit view, Subscriptions cleanup, Reports cleanup, Settings polish.
- Verified: `npm run lint` passes with zero warnings and `npm run build` passes.
- Manual QA still recommended after login: create expense, create income, create transfer, preview BoFA import, preview Chase import, export one report PDF.

## Product Direction

The app should feel like an operations tool for personal finance, not a marketing dashboard.

Key principles:

- dense but calm information layout
- fast add/edit/review workflows
- unified transaction visibility
- clear separation between expense, income, and transfer
- AI assists with drafts, but the user confirms before saving
- searchable selectors everywhere
- mobile usable, desktop efficient

## Navigation Model

Replace the current scattered navigation with a smaller workspace structure:

- Dashboard
- Transactions
- Imports
- Accounts
- Subscriptions
- Reports
- Settings

Transfers should be available inside Transactions and quick actions, not necessarily as a top-level primary destination unless it remains useful during migration.

## Phase 1: Shared UI Foundation

### Build

- Create shared page shell components:
  - `PageHeader`
  - `PageToolbar`
  - `MetricTile`
  - `EmptyState`
  - `LoadingState`
- Create shared transaction UI primitives:
  - `TransactionTypeBadge`
  - `AccountBadge`
  - `AmountText`
  - `SourceBadge`
- Create shared date formatting helpers for UI consistency if needed.
- Standardize add/edit dialog widths and form spacing.

### Rules

- Use shadcn/ui primitives.
- Keep cards only for repeated items, modals, and framed tools.
- Avoid nested cards.
- Keep table/list layouts dense and scannable.

### Acceptance Criteria

- Existing pages still render.
- No behavior changes.
- New components are reusable and do not introduce a second visual language.

## Phase 2: Unified Transaction Model In UI

### Build

- Create a normalized frontend transaction type that can represent:
  - Expense
  - Income
  - Transfer
- Build a data loader for the Transactions page that fetches:
  - `/api/expenses`
  - `/api/incomes`
  - `/api/transfers`
  - `/api/accounts`
  - `/api/categories`
- Normalize rows into one list with:
  - id
  - type
  - date
  - description
  - amount
  - account(s)
  - category/source
  - imported/manual metadata if available

### Acceptance Criteria

- A single screen can show expense, income, and transfer rows together.
- Transfers are visually distinct and not counted as expense/income.
- Sorting by date works across all transaction types.

## Phase 3: Transactions Page

### Build

- Create `/transactions`.
- Build a primary transaction table/list with:
  - date
  - type
  - description
  - category/source
  - account
  - amount
  - actions
- Add filters:
  - date range
  - transaction type
  - account
  - category/source
  - search text
- Add row actions:
  - edit
  - delete
  - convert/reclassify when appropriate
- Add compact summary row:
  - total expenses
  - total income
  - total transfers
  - net cashflow

### UX Notes

- Desktop: table-first.
- Mobile: grouped list by date.
- Keep filters in a toolbar, not large cards.

### Acceptance Criteria

- User can inspect mixed transaction history without switching pages.
- User can find imported mistakes quickly.
- User can edit/delete from the unified page.

## Phase 4: Smart Add/Edit Dialogs

### Build

- Create shared dialog components:
  - `ExpenseFormDialog`
  - `IncomeFormDialog`
  - `TransferFormDialog`
- Move duplicated quick action modal logic out of Dashboard, Expenses, and Incomes pages.
- Keep AI draft input inside Expense and Income dialogs:
  - plain text input
  - `AI Fill Form`
  - fields are populated
  - user confirms with normal save button
- Add field-level AI draft feedback:
  - optional confidence text
  - optional "filled by AI" subtle indicator

### Acceptance Criteria

- Dashboard quick actions and Transactions page use the same dialogs.
- AI never saves automatically.
- Manual entry still works without AI.
- Add/edit behavior matches existing API behavior.

## Phase 5: Dashboard Redesign

### Build

- Rebuild Dashboard as command center:
  - top quick actions
  - this month spend
  - this month income
  - net cashflow
  - current assets
  - upcoming subscriptions
  - recent transactions
  - compact calendar/date activity
- Make calendar secondary, not the dominant surface.
- Add shortcuts from dashboard rows to Transactions filters.

### Acceptance Criteria

- Dashboard answers "what is happening now?"
- User can add expense/income/transfer from top area.
- Recent transactions show all transaction types.

## Phase 6: Imports Review UI

### Build

- Redesign Imports page as a review workflow:
  - upload/import panel
  - preview result
  - created/skipped/duplicate counts
  - list of imported rows
  - warnings for possible transfer/payment rows
- Add import source badges:
  - BoFA
  - Chase
  - Manual
- Add clear guidance for duplicate handling.

### Acceptance Criteria

- User can see what an import will or did create.
- Imported transfers/payments are not hidden inside income/expense assumptions.
- Import errors are actionable.

## Phase 7: Accounts Page Redesign

### Build

- Show accounts as compact rows/cards:
  - name
  - type
  - balance
  - credit limit if present
  - updated date
- Add account detail view or drawer:
  - recent transactions
  - related transfers
  - edit account
- Improve credit card vs bank account display.

### Acceptance Criteria

- Duplicate account problems are easier to spot.
- Credit cards and bank accounts are visually distinct.
- Account balances are easy to audit.

## Phase 8: Subscriptions Page Cleanup

### Build

- Keep table/card/list views only if all are actually useful.
- Make active filters clearer.
- Improve payment status badges.
- Use shared page header and toolbar.

### Acceptance Criteria

- Subscription page no longer feels visually separate from the rest of the app.
- Upcoming/overdue payments are easy to scan.

## Phase 9: Reports Page Redesign

### Build

- Simplify report generation form.
- Use date range picker pattern consistent with Transactions.
- Add preview summary before PDF generation.
- Keep existing PDF behavior.

### Acceptance Criteria

- Report generation remains stable.
- The page visually matches the redesigned app.

## Phase 10: Polish And Verification

### Build

- Responsive pass for:
  - Dashboard
  - Transactions
  - Imports
  - Add/edit dialogs
- Empty states for all major pages.
- Loading states for all major data fetches.
- Error states for failed APIs.
- Remove unused old components once replacement is complete.

### Verification

- Run `npm run lint`.
- Run `npm run build`.
- Manually test:
  - create expense
  - create income
  - create transfer
  - AI fill expense
  - AI fill income
  - edit expense
  - edit income
  - delete transaction
  - import BoFA CSV
  - import Chase CSV

## Suggested Execution Order

1. Shared UI foundation
2. Shared add/edit dialogs
3. Transactions page
4. Dashboard redesign
5. Imports redesign
6. Accounts redesign
7. Subscriptions cleanup
8. Reports cleanup
9. Final responsive and verification pass

This order gives the fastest practical payoff because the shared dialogs and Transactions page reduce duplication before the larger visual redesign.

## Non-Goals For First Pass

- Do not rewrite backend models unless a UI workflow exposes a real data issue.
- Do not redesign authentication pages unless time remains.
- Do not remove existing pages until replacement routes are verified.
- Do not add automatic AI saving.
- Do not introduce a new component library outside shadcn/ui.

## Open Decisions

- Should `/earnings` remain as tabs for expenses/incomes, or should it redirect to `/transactions`?
- Should `/transfers` remain standalone after Transactions is built?
- Should imported rows have a dedicated review table stored in DB, or remain immediate-create with metadata?
- Should AI draft also support transfer detection in the transfer modal?
