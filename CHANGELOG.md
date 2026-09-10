# CHANGELOG

## 0.3.3 — BROWSER DIAGNOSTIC CONSISTENCY — 2026-09-10

### Hosted-browser commissioning correction

- Preserved RECORD application behavior and the 0.3.2 WebKit-seeding portability correction unchanged.
- Corrected the browser harness so the deliberate `REC-CERT-006` recertification rejection is treated as an **expected domain-level console error** after the test explicitly proves the user-visible rejection toast.
- The harness consumes exactly one matching `console.error` entry and still fails closed on every unexpected browser error, page error, missing expected rejection, or duplicate unexpected diagnostic.
- Added a bounded wait for the expected console event so Playwright event delivery cannot race the toast assertion.
- Added deterministic static regression coverage requiring the expected-error consumption path while retaining final `diagnostics.assertClean()` checks.
- Updated the deployment commissioner to preserve the exact archived hostile-audit bytes while excluding only that SHA-verified archival file from Git whitespace lint.
- Rotated the PWA shell cache namespace and release identity to 0.3.3.

### Commissioning evidence inherited from 0.3.2 hosted run

GitHub Actions run `34478353081` against exact 0.3.2 commit `83723cb0178a2c1fab5b021ba2ff4783c68ad332` established:
- Chromium actual v0.1→v0.3 browser migration: **PASS**.
- Chromium reached and correctly executed the functional certification path, including the deliberate post-`MARK UNREADABLE` recertification rejection.
- The run failed because the harness classified that intentional application `console.error` as an unexpected browser error after already observing the correct `REC-CERT-006` UI behavior.
- WebKit was therefore not reached in that run.

0.3.3 corrects the test oracle, not the application certification semantics. The exact 0.3.3 Chromium/WebKit hosted run remains a deployment gate.


## 0.3.2 — BROWSER PORTABILITY — 2026-09-10

### Hosted-browser commissioning correction

- Preserved all 0.3 reconstruction/integrity application semantics; this release does not weaken certification, provenance, migration, or recognition authority boundaries.
- Replaced the legacy-migration harness's JSON-resource execution context with a dedicated same-origin HTML seed fixture (`fixtures/browser-seed.html`) before creating the historical `record-foundation` IndexedDB database.
- Moved source-fixture byte loading and SHA-256 calculation into the Node/Playwright host, then passes only bounded serializable seed data into the browser context.
- Replaced implicit IndexedDB event-to-Promise resolution with explicit `() => resolve()` completion handlers and explicit error/abort/blocked handling.
- Added post-seed IndexedDB readback checks for the legacy game and source Blob before migration is attempted.
- Added post-migration browser readback checks for v3 game schema, invalidated legacy certification, `needsReview`, move count, source schema, source SHA-256 and Blob byte size.
- Added structured browser-seed error reporting so a future WebKit failure identifies the actual IndexedDB stage instead of surfacing only `page.evaluate: null`.
- Added browser/page error collection and guaranteed context/browser cleanup.
- Added a deterministic regression test requiring the same-origin HTML migration seed and explicit transaction completion semantics.
- Rotated the PWA shell cache namespace to 0.3.2.

### Commissioning evidence inherited from 0.3.1 hosted run

GitHub Actions run `34474562019` against commit `bb9bd2a842f0aa416ebe2a7982b9117b1fe34b0a` established:
- Chromium actual v0.1→v0.3 browser migration: **PASS**.
- Chromium functional/certification/offline workflow: **PASS**.
- WebKit reached the migration harness but failed during the pre-migration legacy seed `page.evaluate` call before the RECORD migration application path could be evaluated.

0.3.2 treats that WebKit result as a harness-portability failure rather than falsely calling the application migration path either PASS or FAIL. The exact 0.3.2 Chromium/WebKit hosted run remains a deployment gate.

## 0.3.1 — BROWSER COMMISSIONING — 2026-09-10

### Hosted-browser correction

- Corrected the Playwright certification-state expectation discovered by the first GitHub-hosted Chromium run: evidence-bearing `MARK UNREADABLE` invalidates the prior certification, so the authoritative status is `INVALIDATED`, not `REVIEW_REQUIRED`.
- Strengthened the browser gate to prove that immediate recertification fails closed with `REC-CERT-006` while `needsReview` remains set.
- Preserved application certification semantics; no weakening was made to satisfy the test.

### Release engineering

- Replaced the POSIX-shell-only JavaScript syntax loop with a deterministic cross-platform Node syntax checker so `npm run check` works on Windows and Linux.
- Updated the ephemeral browser QA dependency from Playwright 1.55.0 to 1.63.0.
- Refreshed GitHub Actions to current SHA-pinned releases using Node-24-era action runtimes.
- Prevented generated RECORD release ZIPs from being accidentally committed back into the source tree.
- Rotated the PWA shell cache namespace to 0.3.1.

## 0.3.0 — RECONSTRUCTION / INTEGRITY — 2026-09-09

### Reconstruction

- Added `record-legal-beam/1`, a bounded legal-sequence reconstruction engine.
- Legal moves, not language-model preference, define candidate chess state transitions.
- Added SAN-normalized evidence ranking, ranked path alternatives and ambiguity preservation.
- Added explicit `INFERRED_BRIDGE` handling for missing score-sheet plies; bridges always require human review.
- Added persistent reconstruction runs with record/source revision binding.
- Added path application with stale-revision rejection.
- Added manual-prefix preservation: existing user-entered plies cannot be silently rewritten by vision reconstruction.
- Added reconstruction runs and audit events to Capsule v3.

### Integrity corrections from the 0.2 hostile audit

- Added real `record-foundation` v1 cross-database detection and migration commissioner into `record-chess` v3; legacy DB is retained after migration.
- Rejected zero-move ordinary `PLAYED_GAME` certification.
- Made `needsReview` a certification blocker.
- Switched user-facing certification state to derived `verifyCertification()` results.
- Bound certification to resolved recognition cells, source page, source SHA-256, move number and side.
- Added PGN/canonical-record parity verification to Capsule validation.
- Reverify certifications on restore; stale/fabricated `VALID` state cannot be accepted as trusted status.
- Added all-store restore collision preflight and two-pass import-as-copy ID remapping.
- Added one-use bootstrap capability and registered-device overwrite rejection.
- Replaced non-atomic gateway security state with Durable-Object transaction reference controls.
- Namespaced idempotency by device and full request binding.
- Split exact retry and deliberate rerun semantics.
- Added recognition run sequence/supersession and current-observation selection.
- Added stale `UPLOADING`/`PROCESSING` recovery.
- Rehash derived recognition blobs before Capsule generation and self-verify generated Capsules before export.
- Verify signed observation trust when a pinned gateway key is available/required.
- Added generated content-addressed precache manifest and distribution QA.
- Made runtime trust configuration network-first/no-store with stale fallback explicitly surfaced and remote recognition fail-closed after policy expiry.
- Removed origin-global service-worker cache lookup.
- Added binary MIME signature detection; new evidence intake is JPEG/PNG only and animated WebP is rejected.
- Reduced mobile resource ceilings and bounded the recognition working raster independently from original evidence bytes.
- Corrected repetition identity so phantom FEN en-passant targets do not split otherwise equivalent positions.
- Moved frontend recognition transport from base64 JSON to signed binary request bodies.

### Vision / evidence

- `record-preprocess/3`: bounded decode, quadrilateral detection, homography rectification, local illumination normalization, metadata-stripping JPEG derivative and separate source/derivative SHA-256 identities.
- Immutable provider observations remain non-authoritative.
- OpenAI Responses-style gateway adapter is present as a separately commissioned backend option; provider credentials never enter the PWA.

### QA / release engineering

- Expanded deterministic suite beyond the 0.2 hostile probes.
- Added `npm run check:dist` to verify every generated precache member and digest.
- GitHub Pages deployment remains downstream of full source/build/browser QA.
- External physical-iPhone and commissioned-provider gates remain explicitly pending until run.

## 0.2.0 — VISION / INTEGRITY — 2026-09-09

Sealed predecessor. Its hostile post-release audit is preserved under `audits/RECORD_v0.2.0_hostile_audit.txt` and is the binding corrective input for 0.3.0.
