# Caesh — Architecture

## Current direction

Caesh is a single-user web application built with Next.js App Router, React, and TypeScript. Vercel hosts the application. Transaction records are stored in the user's browser using IndexedDB.

## Components

- **Presentation:** React client components and responsive CSS.
- **Local data:** IndexedDB database `caesh-local`, object store `transactions`.
- **Domain:** transaction kind, integer rupiah amounts, period totals.
- **Hosting:** Vercel serves the web application; no financial-data backend is configured.

## Data rules

- Store IDR amounts as safe integer rupiah values, not floating-point currency.
- Income increases net cash flow.
- Expense decreases net cash flow.
- Totals are derived from locally stored transaction records.
- Data is scoped to the browser origin and browser profile. It is not shared between devices or browsers.

## Privacy boundaries

- No account registration or server-side financial database in this initial version.
- Vercel Deployment Protection is an access gate for the website, not encryption for browser storage.
- IndexedDB is local browser storage and is not encrypted by this application.
- Clearing browser site data can remove transactions.
- Backup/restore, application lock, and security review are not implemented yet.

## Current implementation

Dashboard, period filters, income/expense entry, recent transactions, and transaction deletion are implemented in the initial web conversion. Build and browser testing must still be run before treating the deployment as verified.
