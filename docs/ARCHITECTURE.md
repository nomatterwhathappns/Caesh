# Architecture Notes

## Initial direction

Caesh is a single-user, offline-first Android application. The initial app uses Kotlin and Jetpack Compose. The planned application structure follows MVVM with clear boundaries between presentation, domain rules, and local data access.

## Planned layers

- **Presentation:** Compose screens, reusable UI components, navigation, ViewModels, and UI state.
- **Domain:** finance entities, validation, balance rules, and use cases.
- **Data:** Room database, DAOs, repository implementations, and local backup/restore.
- **Core:** currency/date formatting, input validation, and security helpers.

## Finance invariants

- Store IDR amounts as integer rupiah (Long), never floating-point values.
- An income increases its source account balance.
- An expense decreases its source account balance.
- A transfer decreases the source account and increases the destination account by the same amount.
- Transfers are excluded from income and expense totals.
- Dashboard totals must be derived from persisted local data, not hardcoded sample data.

## Privacy constraints

- No account registration, backend, cloud sync, analytics, ads, or external AI.
- Do not request Android's INTERNET permission.
- Keep financial data in app-private local storage.
- Encryption is a release requirement for real personal financial data; it must be implemented and tested before claiming the app is secure.

## Current implementation status

This document describes the intended architecture. The current initial commit contains only the Android shell and a static dashboard. Database persistence and finance features are not implemented yet.
