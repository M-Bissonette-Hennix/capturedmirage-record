# RECORD 0.3.3 — RECONSTRUCTION / INTEGRITY — BROWSER DIAGNOSTIC CONSISTENCY
## Release QA Receipt

Release date: 2026-09-10

This receipt records evidence actually produced against the final 0.3.3 source tree and keeps hosted-browser/device/infrastructure claims separate until they are executed against the exact pushed commit.

## Inputs

- Immediate predecessor: RECORD 0.3.2 commit `83723cb0178a2c1fab5b021ba2ff4783c68ad332`.
- Original 0.2 source release: `RECORD-0.2.0-VISION-INTEGRITY(2).zip`.
- Original 0.2 source release SHA-256: `c77c17c85279d9b17371c488b79b60f264a6231d9793d13bce000cd9b493135c`.
- Controlling hostile audit: `RECORD_v0.2.0_hostile_audit.txt`.
- Controlling hostile-audit SHA-256: `23f31eea522ba68dec312d11580a4c4b91faa0133de38f72ba1fff7ef65f304a`.
- Canonical CAPTUREDMIRAGE logo SHA-256: `df4f56b3ca47981e0202e433fe275bf15328ca58177599b3ba62a99cd796c8e6`.

## 0.3.2 hosted evidence that controls this correction

GitHub Actions run `34478353081` against exact 0.3.2 commit `83723cb0178a2c1fab5b021ba2ff4783c68ad332` produced:

- Chromium actual `record-foundation` v1 → `record-chess` v3 browser migration: **PASS**.
- Chromium functional flow reached successful initial certification, then `MARK UNREADABLE`, then the intended failed recertification path.
- RECORD correctly emitted the user-visible `REC-CERT-006: Record is explicitly marked as needing review.` rejection.
- RECORD also intentionally logged that domain rejection through `console.error` in the central error reporter.
- The browser harness then failed because its global diagnostics collector treated that already-expected `console.error` as an unexpected browser error.
- WebKit was **NOT REACHED** because Chromium's harness assertion terminated the loop first.

This is a test-oracle/diagnostic-classification defect. It is not evidence that RECORD allowed recertification or violated the `needsReview` certification barrier.

## 0.3.3 correction

The Playwright harness now:

1. independently waits for the exact `REC-CERT-006` status/toast after the deliberate recertification attempt;
2. waits a bounded interval for the corresponding browser console event;
3. consumes exactly one console diagnostic matching `RecordError: Record is explicitly marked as needing review.`;
4. fails if the expected diagnostic never appears;
5. retains every unmatched error in the diagnostics buffer;
6. still calls `diagnostics.assertClean()` before closing each migration/functional browser context;
7. therefore still fails on any unexpected console error, page error, extra duplicate error, or unrelated failure.

The application certification semantics are unchanged.

The deployment commissioner is additionally corrected so the immutable archived hostile-audit TXT is first SHA-verified against `config/release.json` and is then the **only** path excluded from Git whitespace lint. Its CRLF bytes are preserved rather than silently rewritten for cosmetic Git output.

## Mechanical source gates

The final 0.3.3 source tree produced:

- JavaScript syntax: **PASS — 34 / 34 files**;
- JSON schema self-test: **PASS**;
- static/security QA: **PASS**;
- deterministic Node suite: **PASS — 61 / 61 tests**;
- allowlisted `dist/` build: **PASS**;
- content-addressed `dist/` verification: **PASS — 44 / 44 runtime files**;
- browser-diagnostics regression: **PASS** — expected `REC-CERT-006` console diagnostic must be consumed exactly while unmatched errors remain fatal;
- deployment commissioner: **PASS** under package-verification mode;
- independent Stockfish differential: **PASS — depth 1 200 / 200; depth 2 30 / 30; seed `0x5eed1234`**.

- release-manifest descriptor verification: **PASS — 150 / 150 files**.

Clean-extraction verification and the canonical ZIP SHA-256 are produced during final sealing and must match the distributed artifacts.

## External commissioning boundary

The following remain **PENDING EXTERNAL** until executed against the exact 0.3.3 commit:

1. GitHub-hosted Chromium full workflow.
2. GitHub-hosted WebKit full workflow.
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

**SOURCE / DISTRIBUTION FREEZE: PASS SUBJECT TO EXACT 0.3.3 HOSTED-BROWSER AND DEVICE COMMISSIONING.**

0.3.3 must not be described as WebKit-commissioned, physically iPhone-commissioned, real-provider-commissioned, or tournament-frozen until those gates actually pass.
