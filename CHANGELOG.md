# CHANGELOG

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
