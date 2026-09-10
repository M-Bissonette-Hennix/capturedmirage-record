# RECORD 0.3.2 — RECONSTRUCTION / INTEGRITY — BROWSER PORTABILITY
## Release QA Receipt

Release date: 2026-09-10

This receipt records evidence actually produced against the final 0.3.2 source tree and explicitly separates that evidence from browser/device/infrastructure work that still requires execution outside this build container.

## Inputs

- Source lineage: RECORD 0.3.1 commit `bb9bd2a842f0aa416ebe2a7982b9117b1fe34b0a`.
- Original 0.2 source release: `RECORD-0.2.0-VISION-INTEGRITY(2).zip`.
- Original 0.2 source release SHA-256: `c77c17c85279d9b17371c488b79b60f264a6231d9793d13bce000cd9b493135c`.
- Controlling hostile audit: `RECORD_v0.2.0_hostile_audit.txt`.
- Canonical CAPTUREDMIRAGE logo SHA-256: `df4f56b3ca47981e0202e433fe275bf15328ca58177599b3ba62a99cd796c8e6`.

## Mechanical source gates

- JavaScript syntax: **PASS — 34 / 34 files**.
- JSON schema parse/self-test: **PASS**.
- Static/security QA: **PASS**.
- Deterministic Node test suite: **PASS — 60 / 60**.
- Allowlisted `dist/` build: **PASS**.
- Content-addressed `dist/` verification: **PASS**.
- Generated precache coverage: **PASS — 44 / 44 runtime files verified**.
- Release manifest descriptor verification: **PASS — 150 / 150 files**.
- Embedded Node deployment commissioner package self-verification: **PASS — 150 / 150 descriptors**.
- npm package audit for shipped source dependency graph: **0 vulnerabilities**.

The 60-test deterministic suite includes the 59 integrity/reconstruction regressions already present in 0.3.1 plus a new browser-harness portability regression requiring a same-origin HTML IndexedDB seed context and explicit IndexedDB transaction completion semantics.

## Hostile-audit closure gates retained

The suite continues to cover, among other controls:

- zero-move `PLAYED_GAME` certification rejection;
- `needsReview` certification rejection;
- stale certification failure;
- dangling and wrong-coordinate recognition observation references;
- exact observation page/hash/move-number/side binding;
- semantic PGN ↔ canonical `record.json` mismatch rejection even after manifest rebuild;
- derived-asset byte mutation rejection before Capsule export;
- signed remote observation verification against a trusted gateway key;
- one-use bootstrap capability and registered-device overwrite rejection;
- binary request signature/body-digest binding;
- exact-retry idempotency and deliberate-rerun separation;
- device-namespaced/full-binding idempotency coordination;
- source signature sniffing and animated-WebP rejection;
- actual v0.1 game-shape transformation without invented certification;
- legal reconstruction beam, inferred-bridge review requirement, fail-closed impossible continuation, and manual-prefix preservation;
- single canonical move ledger and deterministic downstream rebuild;
- source mutation certification invalidation;
- phantom-en-passant repetition-key correction;
- service-worker namespace isolation;
- SHA-pinned GitHub Actions;
- ZIP traversal, duplicate-path and CRC-tamper rejection.

## Independent chess oracle differential

The underlying 0.3 chess engine is unchanged from the 0.3.1 mechanical freeze. The supplied Stockfish AVX2 oracle was rerun against this final 0.3.2 source tree and produced:

- perft depth 1: **PASS — 200 / 200 positions exact match**;
- perft depth 2: **PASS — 30 / 30 positions exact match**;
- deterministic seed: `0x5eed1234`.

This is independent evidence for legal-move generation, not a proof of every possible chess state.

## Hosted-browser evidence before 0.3.2

GitHub Actions run `34474562019`, against exact 0.3.1 commit `bb9bd2a842f0aa416ebe2a7982b9117b1fe34b0a`, produced:

- Chromium actual `record-foundation` v1 → `record-chess` v3 browser migration: **PASS**.
- Chromium functional/certification/offline workflow: **PASS**.
- WebKit migration harness: **DID NOT COMPLETE**. The failure occurred inside the pre-migration `seedLegacy()` `page.evaluate` call and surfaced as `page.evaluate: null`.

The 0.3.1 harness had established origin by navigating to a JSON resource before opening/storing the legacy IndexedDB fixture. Because the failure occurred while constructing the fixture, before the application migration route could be exercised, it is not legitimate to classify the WebKit application migration itself as either PASS or FAIL from that run.

## 0.3.2 browser-portability correction

The 0.3.2 harness now:

1. navigates to a dedicated same-origin HTML fixture before touching IndexedDB;
2. loads/hash-verifies source fixture bytes in Node rather than depending on page-context fetch/WebCrypto during seed construction;
3. passes only serializable bounded values into `page.evaluate`;
4. uses explicit success/error/abort/blocked IndexedDB handlers;
5. reads the historical game/source back before closing the legacy DB;
6. after application migration, reads v3 game/source objects back from IndexedDB and checks source SHA/Blob size;
7. converts seed failures into structured diagnostic errors rather than an opaque `null`;
8. guarantees browser cleanup via `finally`.

## External commissioning boundary

The following remain **PENDING EXTERNAL** until executed against the exact 0.3.2 commit:

1. GitHub-hosted Chromium browser workflow.
2. GitHub-hosted WebKit browser workflow.
3. GitHub Pages deployment and public-runtime verification.
4. Physical iPhone Safari + Add to Home Screen matrix.
5. Physical iPhone camera/Photos/Files permission paths.
6. Physical iPhone process-kill/reboot/IndexedDB/offline recovery.
7. Physical iPhone share-sheet and VoiceOver acceptance.
8. Physical iPhone large-image/archive memory stress.
9. Dedicated HTTPS origin cutover/restore verification.
10. Deployed atomic gateway race/replay/budget/key-rotation commissioning.
11. Real provider handwritten-score-sheet accuracy/latency/cost/privacy/hostile-document benchmark.

## Release disposition

**SOURCE / DISTRIBUTION FREEZE: PASS SUBJECT TO EXACT 0.3.2 HOSTED-BROWSER AND DEVICE COMMISSIONING.**

The source package is eligible to be pushed as RECORD 0.3.2 — RECONSTRUCTION / INTEGRITY — BROWSER PORTABILITY. It must not be described as WebKit-commissioned, physically iPhone-commissioned, real-provider-commissioned, or tournament-frozen until those gates have actually passed.
