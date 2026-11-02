# Progress files and account saves

The `/saves/` page compares lesson work and the three saved games before any restore. Account uploads are manual. Signing in does not upload or replace local progress. Files contain no account credentials, cookies, or account identifiers.

## Format and merge rules

`server/save-format.mjs` defines the shared `loopuff-save` version 1 envelope. Its four domains retain the existing `loopuff-v1`, `loopuff-vault-v1`, `loopuff-chase-v1` and `loopuff-dispatch-v1` formats. A missing domain is `null`, never a newly generated game. JSON input is limited to 256 KiB, fields and collection sizes are checked, and unsupported versions are rejected. The browser additionally rejects unsupported course IDs and unreachable typing fragments before invoking legacy loaders.

Course conflicts select a whole lesson work snapshot and its latest task score; completion records are combined, best scores and attempt counts take the maximum. The selected current lesson rebuilds the legacy top-level mirror. No attempts are summed across devices.

Optional `state.guideWork` drafts and `guideSelected` belong to the course domain. Guide drafts merge per concept with explicit conflict choices, including deliberately empty text, without replacing lesson work or grades. Saved guide reports are not imported; users rerun their restored code.

Vault drafts include their `edited` flags, so an intentionally empty editor remains empty. Different clue seeds select an entire current run; only collected stamps combine across runs. Chase drafts are selected per role and stage. Dispatch selects a current run when seeds differ and allows individual draft choices; submissions from another seed are invalidated. Combining same-seed partial clears can award that completed round once. These editable records are not trusted leaderboard results.

## Local coordination and recovery

All current course, vault, chase and dispatch writers share the origin-wide Web Lock `loopuff-progress-v1` with restore, recovery and account-binding operations. Each open page also checks a baseline containing the four raw game strings and the local account link. A stale page cannot overwrite another participating page's newer write. Restore and recovery operations waiting for the lock check that their page is still active before writing.

The browser writes a bounded recovery journal before changing separate legacy keys. A failed restore rolls back only values still equal to this restore's writes. A third version remains in place with the journal for explicit review. Successful restoration or recovery blocks that page's old in-memory writer until reload. Owner metadata is included in preview expiry and rollback.

Web Storage has no multi-key transaction. Web Locks coordinate this release's writers, not already open pages running an older release or external scripts that bypass the protocol. Players are asked to close other game pages before restoring. A browser without Web Locks can keep playing and download a backup; restoring is refused instead of pretending to offer the same coordination.

## Account protocol

`GET /api/progress/` reads only the signed-in account. `POST` carries a normalized snapshot, `expectedAccountId` and `expectedRevision`. The backend obtains the target identity from the Better Auth session; the supplied account ID is only an equality precondition. SQLite inserts or updates atomically with a matching revision and returns the next revision. Stale revisions return `SAVE_CONFLICT`; a changed session identity returns `ACCOUNT_CHANGED`.

No writes occur just from signing in or reading progress. A guest or another account's local work requires an explicit copy choice before uploading. Upload previews identify the destination account and leave browser drafts unchanged. Local ownership is linked only after a confirmed upload with an unchanged browser baseline. A restore from a file clears the account link; a restore from an account binds to that account.

An interrupted POST is `SAVE_UNCONFIRMED`, including an upstream commit whose relay response was lost. The UI clears the old write base before posting, so navigating away or changing language cannot revive a ready-to-upload old preview. The player must read again; writes are never automatically retried.

## Validation and deployment

Run the frontend test command and build in sequence. Server tests run from `server/` with its installed dependencies: `npm test` includes both account and progress suites. Local Node without Better Auth cannot substitute for these tests. Before deploying the schema, back up the existing account database and validate a temporary restore. Preserve the environment, database, session secret and shared Funnel; restart only `com.loopuff.account` after verified source synchronization.

The static build copies only the host-independent format module into `dist/server/`; account code, the database and configuration must never enter the static output. Real browser file download/import, two-page conflicts, locale layouts, account isolation, revision conflicts and a live cloud round trip remain separate checks from unit-test success.
