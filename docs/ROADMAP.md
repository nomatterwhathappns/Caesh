# Caesh — Product Roadmap

## Milestone 0: Web development foundation
- [x] Next.js web app for development preview
- [x] Responsive dashboard
- [x] IndexedDB local storage
- [x] Wallets, transfers, transactions, analysis, and wishlist
- [x] Document local-first data ownership and privacy boundaries

## Milestone 1: Finance core
- [x] Wallets and wallet balances
- [x] Transfers between wallets
- [x] Transaction history and category management
- [x] Wishlist purchase flow
- [ ] Automated balance calculation tests

## Milestone 2: Data safety — release requirement
- [x] Establish a no-data-loss migration policy
- [ ] Add automated tests for upgrades from every supported IndexedDB version
- [ ] Test migrations with populated transactions, wallets, wishlist entries, and wallet photos
- [ ] Export/import backup with schema versioning and validation
- [ ] Verify backup restoration before any destructive schema transformation
- [ ] Handle storage failures without silently initializing an empty replacement database
- [ ] Verify data survives normal application updates on each target platform

## Milestone 3: Standalone applications
- [ ] Package desktop application
- [ ] Package Android application (APK)
- [ ] Verify device-local storage isolation between users/devices
- [ ] Verify application update behavior without data loss
- [ ] Define safe uninstall/reinstall and backup guidance

## Milestone 4: Release quality
- [ ] Offline behavior and startup verification
- [ ] Cross-platform testing
- [ ] Accessibility review
- [ ] Privacy and security review
- [ ] Production release checklist

A feature is complete only after implementation and testing. IndexedDB is local storage, not encrypted storage or a backup. Data-preservation policy is documented, but automated migration tests and backup/restore are not yet implemented.
