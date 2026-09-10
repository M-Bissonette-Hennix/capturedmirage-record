# RECORD 0.3.0 — Hostile Audit Remediation Status

This ledger maps the attached 0.2.0 hostile forensic audit into the 0.3.0 implementation. It distinguishes **implemented/mechanically testable** controls from **external commissioning evidence** that cannot truthfully be produced inside an offline release build.

## P0 corrective findings closed in source

- **Actual v0.1 migration:** recognizes the original `record-foundation` database rather than pretending an in-place upgrade of `record-chess` migrates it. The old database is read, transformed, rehashed, written into v3, verified and retained.
- **Zero-move certification:** ordinary `PLAYED_GAME` requires at least one move.
- **Review blocker:** `flags.needsReview` blocks certification and makes an existing certification invalid.
- **Derived certification UI:** displayed certification state is computed from current record/source/observation evidence.
- **Observation referential integrity:** every cited cell must resolve once and bind to the same game, source page/hash and expected move number/side.
- **PGN/record parity:** Capsule verification rejects a self-consistent manifest when `game.pgn` contradicts canonical `record.json`.
- **Restore certification:** imported certification is reverified against imported evidence; raw stored `VALID` is not authority.
- **Restore collision control:** identifiers across games/pages/assets/jobs/observations/reconstruction/audit stores are preflighted before writes.
- **Import-as-copy:** all identifiers are allocated before object transformation; references are remapped in a second pass.
- **Bootstrap:** registration uses a one-use capability and refuses silent replacement of an existing device key.
- **Atomic gateway state:** a Durable Object coordinator provides transactional nonce, registration, budget, rate and idempotency state in the reference gateway.
- **Retry/rerun split:** exact retry keeps the same request/idempotency identity; explicit rerun has a new run sequence/request identity and supersession linkage.
- **Crash recovery:** stale nonterminal recognition jobs are reconciled against immutable observations on foreground.
- **Wrong-cell prevention:** accepting and certifying a recognition cell requires coordinate ↔ ply agreement.
- **Derived-blob integrity:** bytes are rehashed before Capsule construction.
- **Signed observations:** Capsule verification can require a trusted gateway P-256 key and classifies observation trust.
- **Precache generation:** build output generates a content-addressed precache manifest; `perspective.js`, `reconstruction.js` and all runtime files are mechanically covered.
- **Runtime configuration:** network-first/no-store with explicit stale fallback; remote trust configuration fails closed after the configured staleness policy.
- **Service-worker isolation:** RECORD opens its named cache directly and never uses origin-global `caches.match()` for runtime fetches.
- **Image type:** JPEG/PNG magic bytes are verified; animated WebP is rejected and WebP is not accepted as new canonical source evidence.
- **Memory pressure reduction:** lower archive/source/pixel budgets and bounded preprocessing rasters reduce peak risk; large archives may be refused rather than risking iOS termination.
- **Repetition:** en-passant is included in repetition identity only when a legal EP capture exists.
- **Browser QA expansion:** migration, certification invalidation and offline functional paths are present in the Playwright harness.

## 0.3 reconstruction controls

- Reconstruction uses only legal chess state transitions plus transcription evidence.
- It does not use engine evaluation, opening popularity or chess strength as historical evidence.
- Missing plies are labeled `INFERRED_BRIDGE` and always make the selected path review-required.
- Multiple credible paths remain `AMBIGUOUS`; the user decides historical truth.
- Existing manually entered prefix plies are preserved rather than rewritten.
- Reconstruction runs are immutable evidence objects bound to source/record revisions and observation request IDs.

## Controls intentionally fail-closed by default

- Remote recognition is disabled on shared `*.github.io` project origins.
- A gateway-enabled build requires a dedicated canonical HTTPS origin, HTTPS gateway URL and pinned P-256 gateway public JWK.
- Signed recognition observations cannot be accepted as trusted without a matching pinned gateway key.
- Real provider credentials exist only at the gateway.

## External acceptance still required

These are **not** code-complete claims and must remain pending until actually commissioned:

1. GitHub-hosted Chromium/WebKit workflow run on the target repository.
2. Physical iPhone acceptance matrix in `PHYSICAL_IPHONE_QA.md`.
3. Dedicated-origin cutover and restoration verification if moving from `username.github.io` to a custom origin.
4. Deployed Durable Object gateway race/replay/budget/rotation tests.
5. Real provider handwriting benchmark: page/cell localization, top-1/top-3 token performance, metadata accuracy, latency, cost, retention/privacy behavior and hostile-document prompt-injection corpus.
6. Physical iPhone memory stress for the release's archive/image ceilings.

No release receipt may convert these into PASS without actual evidence.
