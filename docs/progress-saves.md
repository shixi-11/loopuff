# Progress files and account saves

The `/saves/` page compares lesson work and five saved games before any restore. Account uploads are manual. Signing in does not upload or replace local progress. Normal progress files contain no account credentials, cookies, or account identifiers.

## Format and merge rules

`server/save-format.mjs` defines the shared `loopuff-save` version 3 envelope with six domains: `course`, `vault`, `chase`, `dispatch`, `pursuit` and `heist`. Existing local formats remain unchanged; bank infiltration uses `loopuff-heist-v1`. Version 1 four-domain and version 2 five-domain files normalize to version 3, with missing newer domains set to null. A null domain denotes absent data, never a newly generated game. JSON input is limited to 256 KiB, fields and collection sizes are checked, and unsupported versions are rejected. The browser additionally rejects unsupported course IDs and unreachable typing fragments before invoking legacy loaders. `server/pursuit-format.mjs` validates the pursuit simulation snapshot.

Course conflicts select a whole lesson work snapshot and its latest task score; completion records are combined, best scores and attempt counts take the maximum. The selected current lesson rebuilds the legacy top-level mirror. No attempts are summed across devices.

Optional `state.guideWork` drafts and `guideSelected` belong to the course domain. Guide drafts merge per concept with explicit conflict choices, including deliberately empty text, without replacing lesson work or grades. Saved guide reports are not imported; users rerun their restored code.

Optional `state.diagnostic` stores the versioned nine-area seed, selection, drafts, matching submitted sources and hint levels. Runtime reports and passed flags are not imported. Same-seed conflicts choose a complete draft/submission/hint record per area, even for identical code with different invalidation state. Different seeds choose a whole diagnostic run. A missing old diagnostic record preserves the existing record through normal merge. Cloud writes omitting an existing diagnostic are rejected with `SAVE_VERSION` after the revision check; this also protects against old version 2 clients that omit the entire course or state. The diagnostic page lives at `/guide/check/`; reports are recomputed from restored submissions.

Vault drafts include their `edited` flags, so an intentionally empty editor remains empty. Different clue seeds select an entire current run; only collected stamps combine across runs. Chase drafts are selected per role and stage. Dispatch selects a current run when seeds differ and allows individual draft choices; submissions from another seed are invalidated. Combining same-seed partial clears can award that completed round once. These editable records are not trusted leaderboard results.

Pursuit conflicts select one entire snapshot, including current run and bounded history. Actor states, elapsed times, strategy queues and partial runs are not combined. A null incoming pursuit domain, including one migrated from a version 1 file, preserves existing local pursuit through the normal merge flow. Restored running games open paused. See [continuous pursuit](pursuit.md). Bank conflicts likewise select one whole scene, draft, deployed strategy and personal history; old incoming backups preserve an existing bank domain. See [bank infiltration](heist-design.md).

## Local coordination and recovery

All current course, vault, chase, dispatch, pursuit and heist writers share the origin-wide Web Lock `loopuff-progress-v1` with restore, recovery and account-binding operations. Each open page also checks a baseline containing the six raw game strings and the local account link. A stale page cannot overwrite another participating page's newer write. Restore and recovery operations waiting for the lock check that their page is still active before writing.

The browser writes a bounded recovery journal before changing separate legacy keys. A failed restore rolls back only values still equal to this restore's writes. A third version remains in place with the journal for explicit review. Successful restoration or recovery blocks that page's old in-memory writer until reload. Owner metadata is included in preview expiry and rollback.

Unreadable local data can be downloaded separately as `loopuff-recovery` records, even without an unfinished journal. These contain the original six storage strings and local ownership metadata, never cookies or credentials. They are not normal importable progress backups; exporting them does not modify stored data.

Web Storage has no multi-key transaction. Web Locks coordinate this release's writers, not already open pages running an older release or external scripts that bypass the protocol. Players are asked to close other game pages before restoring. A browser without Web Locks can keep playing and download a backup; restoring is refused instead of pretending to offer the same coordination.

## Account protocol

`GET /api/progress/` reads only the signed-in account. `POST` carries a normalized snapshot, `expectedAccountId` and `expectedRevision`. The backend obtains the target identity from the Better Auth session; the supplied account ID is only an equality precondition. SQLite inserts or updates atomically with a matching revision and returns the next revision. Stale revisions return `SAVE_CONFLICT`; a changed session identity returns `ACCOUNT_CHANGED`.

GET responses normalize stored snapshots to version 3; they are not downgraded for old clients. Version 1 writes can migrate records that contain no pursuit. If the current account snapshot contains pursuit data, a version 1 POST returns `SAVE_VERSION` even with a matching revision, so an old client cannot erase the fifth domain. Version 1 and 2 POSTs also return `SAVE_VERSION` when the current snapshot contains heist data. Stale revisions still return `SAVE_CONFLICT`.

No writes occur just from signing in or reading progress. A guest or another account's local work requires an explicit copy choice before uploading. Upload previews identify the destination account and leave browser drafts unchanged. Local ownership is linked only after a confirmed upload with an unchanged browser baseline. A restore from a file clears the account link; a restore from an account binds to that account.

An interrupted POST is `SAVE_UNCONFIRMED`, including an upstream commit whose relay response was lost. The UI clears the old write base before posting, so navigating away or changing language cannot revive a ready-to-upload old preview. The player must read again; writes are never automatically retried.

## Validation and deployment

Run the frontend test command and build in sequence. Server tests run from `server/` with its installed dependencies: `npm test` includes both account and progress suites. Local Node without Better Auth cannot substitute for these tests. Before deploying the schema, back up the existing account database and validate a temporary restore. Preserve the environment, database, session secret and shared Funnel; restart only `com.loopuff.account` after verified source synchronization.

The static build copies only the host-independent `save-format.mjs`, `pursuit-format.mjs`, `diagnostic-format.mjs` and `heist-format.mjs` modules into `dist/server/`; account code, the database and configuration must never enter the static output. Real browser file download/import, two-page conflicts, locale layouts, account isolation, revision conflicts and a live cloud round trip remain separate checks from unit-test success.
