# RECORD 0.3.0 — RECONSTRUCTION / INTEGRITY
## Release QA Receipt

Release date: 2026-09-09

This receipt records evidence actually produced against the final 0.3.0 source tree. It does not convert infrastructure- or device-dependent commissioning work into fictitious PASS results.

## Inputs

- Source release: `RECORD-0.2.0-VISION-INTEGRITY(2).zip`
- Source release SHA-256: `c77c17c85279d9b17371c488b79b60f264a6231d9793d13bce000cd9b493135c`
- Controlling hostile audit: `RECORD_v0.2.0_hostile_audit.txt`
- Canonical CAPTUREDMIRAGE logo SHA-256: `df4f56b3ca47981e0202e433fe275bf15328ca58177599b3ba62a99cd796c8e6`

## Mechanical source gates

- JavaScript syntax: **PASS**
- JSON schema parse/self-test: **PASS**
- Static/security QA: **PASS**
- Deterministic Node test suite: **59 / 59 PASS**
- Allowlisted `dist/` build: **PASS**
- Content-addressed `dist/` verification: **PASS**
- Generated precache coverage: **43 / 43 runtime files verified**

## Hostile-audit closure gates represented in the 59-test suite

The release tests include direct regression coverage for the principal v0.2 hostile findings, including:

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

Trusted supplied Stockfish AVX2 binary extracted from `stockfish-ubuntu-x86-64-avx2.tar`.

Deterministic differential result:

- perft depth 1: **200 / 200 positions exact match**
- perft depth 2: **30 / 30 positions exact match**
- seed: `0x5eed1234`

This is independent evidence for legal-move generation. It is not a proof of every possible chess state.

## Browser/device/infrastructure commissioning boundary

The local environment does not provide the repository-hosted Playwright browser command required by `npm run test:browser`. The command therefore correctly exits without claiming a browser PASS.

The following remain **PENDING EXTERNAL** and are explicitly not release-manufactured PASS claims:

1. GitHub-hosted Chromium functional workflow.
2. GitHub-hosted WebKit functional workflow.
3. Physical iPhone Safari + Add to Home Screen matrix.
4. Physical iPhone camera/Photos/Files permission paths.
5. Physical iPhone process-kill/reboot/IndexedDB/offline recovery.
6. Physical iPhone share-sheet and VoiceOver acceptance.
7. Physical iPhone large-image/archive memory stress.
8. Dedicated HTTPS origin cutover/restore verification.
9. Deployed atomic gateway race/replay/budget/key-rotation commissioning.
10. Real provider handwritten-score-sheet accuracy/latency/cost/privacy/hostile-document benchmark.

## Release disposition

**SOURCE / DISTRIBUTION FREEZE: PASS SUBJECT TO EXTERNAL COMMISSIONING BOUNDARY**

The source package is eligible for release as RECORD 0.3.0 — RECONSTRUCTION / INTEGRITY. It must not be described as physically iPhone-commissioned, real-provider-commissioned, or tournament-frozen until the external matrix above has actually passed.
