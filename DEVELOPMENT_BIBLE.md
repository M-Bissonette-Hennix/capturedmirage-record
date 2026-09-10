# RECORD — Development Bible
## 0.3.2 — RECONSTRUCTION / INTEGRITY

## Mission

RECORD exists to convert imperfect physical chess evidence into a trustworthy digital game record with the least possible human effort and without concealing uncertainty.

## Non-negotiable doctrine

1. **AI is an observer, never historical authority.**
2. **Chess legality constrains transcription but never converts good chess into assumed history.**
3. **The physical source remains evidence, not decoration.**
4. **Every correction preserves the evidence it corrected.**
5. **Certification is continuously verifiable, not a badge stored in a database.**
6. **CAPTUREDMIRAGE owns downstream chess analysis; RECORD owns ingress.**
7. **A failed or ambiguous reconstruction must remain visibly failed/ambiguous.**
8. **External acceptance gates are never fabricated as local PASS results.**

## Product surfaces

- **HOME** — create record, pending jobs, recent records.
- **SCAN** — capture/import pages, integrity hash, quality checks, page order, source/derived viewing, recognition.
- **GAME** — chessboard, canonical move timeline, metadata, manual correction/navigation.
- **REVIEW** — raw vision evidence, source crops, reconstruction paths, ambiguity, certification.
- **LIBRARY** — records, deletion, backup/restore, Capsule verification.
- **SYSTEM** — version, origin, storage, persistence, gateway/device state and diagnostics.

## Epistemic classes

Canonical move provenance:

- `SHEET_DIRECT`
- `SHEET_CONSTRAINED`
- `USER_CORRECTED`
- `USER_ENTERED`
- `INFERRED_BRIDGE`
- `UNRESOLVED`

`INFERRED_BRIDGE` and `UNRESOLVED` may never disappear into an ordinary certified move without deliberate human correction/review.

## Reconstruction doctrine

A reconstruction path is an evidentiary hypothesis, not a game record until applied and reviewed.

Scoring may use:

- provider candidate rank as ordinal evidence;
- transcription/SAN similarity;
- current legal-move set;
- future legal sequence viability.

Scoring may **not** use:

- Stockfish evaluation;
- opening popularity;
- player strength assumptions;
- “best move” preference;
- historical plausibility unsupported by the source.

Existing manually entered prefix plies are preserved. Gaps can only be crossed as explicit penalized bridges and always make the path review-required.

## Release progression

- **0.1 FOUNDATION** — local evidence/chess/PGN/Capsule substrate.
- **0.2 VISION / INTEGRITY** — source preprocessing, recognition observations, authenticated transport architecture.
- **0.3 RECONSTRUCTION / INTEGRITY** — hostile-audit corrective release plus legal sequence beam and reconstruction evidence.
- **0.4 CERTIFICATION** — deeper source↔move review ergonomics, device/user authenticity layer and correction lineage hardening.
- **0.5 CAPTUREDMIRAGE BRIDGE** — finalized frictionless handoff built on portable Capsule semantics.
- **1.0 TOURNAMENT** — physical-iPhone freeze after field corpus, benchmark and failure-recovery commissioning.

## Explicit exclusions from 0.3

- automatic Stockfish coaching/evaluation;
- repertoire recommendations;
- cloud accounts/sync;
- social/coach dashboards;
- writer-specific handwriting learning;
- silent multi-ply invention;
- direct CAPTUREDMIRAGE dependency replacing portable exports.

## Success metric

The eventual primary product metric is **human attention required to produce a verified game**. In 0.3, reconstruction QA also measures whether the legal beam preserves the historically plausible candidate set without hiding ambiguity.
