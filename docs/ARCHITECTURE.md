# Caesh — Architecture

## Current direction

Caesh is a personal, local-first finance application. The current development preview is a Next.js web app hosted on Vercel. The intended release targets are standalone desktop and Android applications. Financial data belongs to each user's device; no financial-data backend or account system is planned.

## Components

- **Presentation:** React client components and responsive CSS.
- **Local data:** IndexedDB database `caesh-local`, with `transactions`, `wallets`, and `wishlist` object stores.
- **Preferences:** browser-local settings such as theme and custom categories.
- **Hosting:** Vercel serves the development web app; it does not act as the financial-data store.
- **Future packaging:** desktop and Android wrappers will use device-local storage. Their storage behavior must be verified independently before release.

## Data rules

- Store IDR amounts as safe integer rupiah values, not floating-point currency.
- Income increases net cash flow.
- Expense decreases net cash flow.
- Transfers move value between wallets and do not count as income or expense.
- Wallet balances and summaries are derived from locally stored records.
- Data is scoped to the app's local storage container on each device. It is not automatically shared between devices.

## Data preservation policy

Data preservation is a release requirement, not an optional enhancement.

1. Never delete, clear, or recreate the existing database as part of a normal application update.
2. Every IndexedDB schema change must use a higher, explicit database version and an additive, versioned migration.
3. A migration must preserve existing transactions, wallets, wishlist entries, and wallet photos unless the user explicitly requests deletion through a clearly explained feature.
4. Run schema changes inside the IndexedDB version-change transaction. If a migration fails, abort it and leave the previous database version/data intact; do not continue with a partially migrated schema.
5. Do not silently replace malformed or unreadable user data with an empty database. Show an actionable error instead.
6. Before introducing any migration that transforms or removes stored fields/records, implement and test a backup/restore path first.
7. Test upgrades from every supported previous database version, including populated data and edge cases, before release.
8. Keep storage keys and database names stable across app updates and packaging changes. If a future platform requires a storage move, use a verified copy-and-validate migration before switching over.

## Privacy boundaries

- No account registration or server-side financial database is configured.
- Vercel Deployment Protection is an access gate for the preview website, not encryption for local storage.
- IndexedDB and local preferences are not encrypted by this application.
- Clearing browser/app site data can remove local records.
- Backup/restore, application lock, and a full security review are not implemented yet.

## Current implementation

The database currently uses version 3 and creates stores for transactions, wallets, and wishlist. Existing version 1 transactions are retained and assigned to the default wallet during the version 2 migration. Current schema setup is additive and does not intentionally delete existing stores or records.

A migration safety policy is now documented. Automated migration tests, backup/restore, and packaged-app storage verification remain required before a public release.
