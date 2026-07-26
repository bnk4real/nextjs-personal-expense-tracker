# SubTracker UI Redesign V2

## Direction

Move the app from a generic dashboard into a ledger-first personal finance workspace.

The app should feel like a clean bank terminal mixed with a personal budget notebook: dense, calm, fast, and built for daily review.

## Product Shape

Primary surfaces:

- Home: Month Workspace
- Ledger: all expenses, income, and transfers
- Imports: bank statement review
- Accounts: balances and account audit
- Insights: spending patterns and reports
- Settings

Secondary tools like subscriptions, debt, tax, transfers, and AI remain available, but the main navigation should stop making every data type feel like a separate app.

## Visual Principles

- Ledger-first, not card-first.
- Use compact panels, tables, grouped lists, and side inspectors.
- Cards are allowed for repeated account/subscription items and framed tools, but page sections should feel like surfaces.
- Semantic color only:
  - red for expenses
  - green for income/assets
  - blue for transfers
  - amber for warnings/review
- Avoid decorative gradients, oversized hero blocks, and marketing layout.
- Use quiet neutral backgrounds with sharp spacing and strong typography.
- Keep button labels short and use icons for quick actions.

## Home: Month Workspace

The home screen should answer:

- how is this month doing?
- what changed recently?
- where is money leaking?
- what needs attention next?

Build:

- Month header with cashflow summary.
- Quick action command bar.
- Main monthly ledger grouped by date.
- Right rail with category pressure, account balances, upcoming payments, and selected date activity.
- Calendar remains secondary and compact.

## Ledger

Build toward one power surface:

- expense, income, transfer rows together
- dense filters
- edit/delete/reclassify actions
- mobile grouped list by day
- import metadata visible when useful

## Imports

Bank imports should feel like a review queue:

- source picker
- upload panel
- preview table
- created/skipped/duplicate counts
- warnings for transfer/payment-like rows
- clear confidence in what will hit the database

## Accounts

Default to card view for scanability, with list view for audit:

- no raw IDs in the UI
- duplicate warning
- credit utilization
- related transaction drawer later

## AI

AI should assist, not own the data:

- Expense/Income modals accept natural text.
- AI fills form fields only.
- User confirms before saving.
- Chat sessions can analyze full filtered data, not arbitrary tiny samples.
- AI answers in a consistent Thai male tone when responding in Thai.
- Chat UI renders basic markdown cleanly.

## First Implementation Pass

1. Redesign shell/nav into a smaller workspace.
2. Redesign Home into Month Workspace.
3. Carry the same visual language to Ledger.
4. Carry the same visual language to Imports.
5. Add account detail drawer.
6. Add reclassify actions.
7. Responsive QA and commit.

## Acceptance For This Pass

- The first screen no longer feels like a generic SaaS dashboard.
- The ledger is visually dominant.
- Quick actions are obvious but not visually noisy.
- Navigation feels smaller and more intentional.
- Existing data behavior remains intact.
