# RECORD 0.4.0 — CERTIFICATION / FIELD OPERATIONS
## Release QA Receipt

Release date: 2026-09-25

This receipt records evidence actually produced against the 0.4.0 source/distribution tree. It deliberately separates local mechanical evidence from physical-device, hosted-browser, dedicated-origin and real-provider commissioning.

## Inputs

- Immediate source release: `RECORD-0.3.3-RECONSTRUCTION-INTEGRITY.zip`.
- Immediate source release SHA-256: `3737f5a342b0fbe39608bb9e34c54ddb62dfd7bbaf39b53d093a28469447630a`.
- Controlling hostile audit: `RECORD_v0.2.0_hostile_audit.txt`.
- Controlling hostile-audit SHA-256: `23f31eea522ba68dec312d11580a4c4b91faa0133de38f72ba1fff7ef65f304a`.
- Canonical CAPTUREDMIRAGE logo SHA-256: `df4f56b3ca47981e0202e433fe275bf15328ca58177599b3ba62a99cd796c8e6`.
- Working database remains `record-chess` v3; 0.4.0 introduces no IndexedDB schema migration.

## 0.4.0 corrective focus

0.4.0 treats RECORD as an iPhone field instrument rather than only a reconstruction substrate. The pass specifically hardens:

- fixture-mode safety: deterministic fixture recognition is source-hash fenced to the bundled fixture image at both provider and UI boundaries;
- source intake: separate camera and Photos/Files controls converge on the same JPEG/PNG signature/resource/integrity pipeline;
- capture review: quality warnings and exact source SHA-256 are surfaced while the paper source is still available;
- touch correction: explicit earlier-move editing and confirmed destructive undo;
- certification: visible readiness gates plus a required human review assertion immediately before certification;
- export state: Capsule export requires a currently valid certification and cancellation cannot falsely mark a record `EXPORTED`;
- iPhone archival flow: PGN, Capsule, backup and diagnostics prefer native file sharing; cancelled backup export does not advance backup freshness;
- backup/storage operations: Home/System expose records changed since last backup and storage pressure;
- civil date correctness: new-game PGN date uses local device calendar components rather than UTC slicing;
- note persistence: mobile input/change/blur writes are serialized to avoid redundant/racing evidence mutations;
- PWA operations: waiting service-worker updates surface in the top bar;
- branding: launcher icons are deterministic raster resizes of the canonical CAPTUREDMIRAGE mark and are byte-pinned by static QA;
- deployment: the release carries the already commissioned `RECORD Operational Pages` workflow with deterministic source/build/dist gates and no dependency on the previously flaky Playwright deployment blocker.

The detailed defect/rationale ledger is `IMPROVEMENT_AUDIT_0.4.0.md`.

## Mechanical source gates

Final source-tree QA produced:

- JavaScript syntax: **PASS — 34 / 34 files**;
- JSON schema self-test: **PASS**;
- static/security QA: **PASS**;
- deterministic Node suite: **PASS — 68 / 68 tests**;
- allowlisted `dist/` build: **PASS**;
- content-addressed distribution verification: **PASS — 44 / 44 runtime files**;
- canonical CAPTUREDMIRAGE source-logo hash pin: **PASS**;
- five launcher-icon byte-hash pins: **PASS**;
- operational GitHub Pages workflow full-SHA action pinning: **PASS**;
- default runtime posture: **PASS — remote gateway disabled / fixture profile**.

The deterministic suite includes the 0.2/0.3 hostile-integrity regressions plus 0.4 regressions for fixture source fencing, local civil-date creation, explicit certification UX, valid-certification-only Capsule export, cancelled-share state handling, separate camera/Photos-Files intake, serialized note writes and operational Pages QA preservation.

## Independent chess oracle differential

Using the supplied Stockfish AVX2 binary and deterministic seed `0x5eed1234`:

- perft depth 1: **PASS — 200 / 200 exact**;
- perft depth 2: **PASS — 30 / 30 exact**.

This is independent evidence for legal move generation, not a proof of every reachable chess state.

## Distribution / drop-in gates

Before final delivery, the release process must additionally establish and preserve in the distributed receipt/artifacts:

- generated release-manifest descriptor verification: **PASS — 152 / 152 descriptors**;
- deterministic full-release ZIP generation + SHA-256 sidecar: **PASS**;
- clean-extraction rerun of source/build/dist/release verification: **PASS**;
- drop-in overlay equivalence: applying the drop-in files over the 0.3.3 source tree yields the exact 0.4.0 tree for every changed/new path, with no unaccounted deletion requirement: **PASS**.

The canonical archive SHA-256 values are emitted in external `.sha256` sidecars so the archive does not attempt to contain a self-referential hash of itself.

## Browser/device/infrastructure boundary

The following are **not converted into fabricated PASS claims** by local tests:

1. Optional exact-0.4.0 Chromium/WebKit Playwright commissioning if browser-engine evidence is desired beyond deterministic release QA.
2. Physical iPhone camera and Photos/Files permission/intake matrix against the exact 0.4.0 deployment.
3. Physical iPhone force-kill/reboot/IndexedDB/offline recovery against 0.4.0.
4. Physical iPhone share-sheet, Files, VoiceOver and Dynamic Type acceptance against 0.4.0.
5. Physical iPhone large-image/archive memory stress at release ceilings.
6. Dedicated HTTPS origin cutover/restore verification.
7. Deployed atomic gateway race/replay/budget/key-rotation commissioning.
8. Real provider handwritten-score-sheet accuracy/latency/cost/privacy/hostile-document benchmark.

The predecessor application has already been exercised successfully as a Safari-installed Home Screen PWA by the operator, but that does not substitute for executing the exact 0.4.0 physical-device checklist.

## Release disposition

**SOURCE / DISTRIBUTION FREEZE: PASS — MECHANICALLY VERIFIED FIELD-OPERATIONS RELEASE.**

The complete source/distribution and drop-in overlay are mechanically verified, including clean extraction and exact overlay equivalence. 0.4.0 must not be described as tournament-frozen, dedicated-origin commissioned, or real-handwriting-recognition commissioned until the corresponding external gates actually pass.
