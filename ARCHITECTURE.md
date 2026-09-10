# RECORD 0.3.0 — Architecture

## 1. Product boundary

RECORD is an acquisition/certification system, not a chess coach.

```text
PHYSICAL SCORESHEET
        ↓
exact source evidence
        ↓
local preprocessing derivative
        ↓
vision observations
        ↓
legal chess reconstruction
        ↓
human review/certification
        ↓
RECORD Capsule
        ↓
CAPTUREDMIRAGE
```

The responsibility boundary is fixed:

> **Vision proposes. Chess logic constrains. The user certifies. CAPTUREDMIRAGE analyzes.**

## 2. Trust domains

### Original evidence

Original JPEG/PNG bytes are preserved exactly in IndexedDB and SHA-256 hashed. They are never rewritten in place. The original source may include private embedded metadata; remote recognition receives a separately generated derivative by default.

### Derived recognition evidence

`record-preprocess/3` performs bounded local decode, candidate-page quadrilateral detection, projective homography rectification when credible, local illumination normalization, bounded JPEG re-encoding and metadata stripping. The derivative has its own SHA-256 identity and transformation metadata. The original and derivative hashes are intentionally different trust objects.

### Vision observations

Recognition envelopes are immutable untrusted observations. They bind:

- request/run identity;
- game ID and source page ID;
- original source SHA-256;
- exact derivative SHA-256;
- preprocessor version;
- provider adapter/model/version/prompt revision;
- normalized cell geometry and ranked text observations;
- gateway build/key/timestamp/signature when remote.

There is no `correctMove` field in the authoritative schema.

### Chess reconstruction

`record-legal-beam/1` owns chess interpretation. It generates only legal continuations from the actual board state. Candidate rank and notation distance can rank legal paths; Stockfish evaluation and opening frequency are prohibited as historical evidence.

Missing plies can be traversed only by explicit bridge candidates. Those plies receive `INFERRED_BRIDGE` provenance and always force review. A unique machine-ranked path still requires user certification.

### Human certification

Certification is a stored assertion plus a continuously re-verifiable canonical hash, not a Boolean authority flag. Validation replays chess, rehashes source bytes, resolves all cited observation cells, verifies record/source revisions and recomputes the canonical record hash.

## 3. Persistent data model

IndexedDB database `record-chess`, version 3:

```text
games
sourcePages
derivedAssets
recognitionJobs
recognitionObservations
reconstructionRuns
auditEvents
settings
deviceKeys
```

A game persists one canonical `moves[]` ledger. PGN, SAN arrays, ply counts and board state are derived from that ledger.

Every game has monotonic `revision` and `sourceRevision`. Evidence-bearing mutation invalidates certification through a centralized path.

## 4. Legacy migration

The actual 0.1 release used a different database, `record-foundation`. 0.3 therefore performs a cross-database commissioner rather than an impossible same-database version upgrade:

```text
record-foundation v1
        ↓ read-only transform
validate old objects / rehash source bytes
        ↓
record-chess v3 atomic import
        ↓
verify new snapshot
        ↓
migration receipt
```

The legacy database is not automatically deleted.

## 5. Recognition jobs

Jobs are persistent and foreground-recoverable:

```text
QUEUED → UPLOADING → PROCESSING → COMPLETE
                   ↘ FAILED_RETRYABLE / FAILED_TERMINAL / CANCELLED
```

Exact retry retains the same request and idempotency identity. Explicit rerun creates a new run sequence and request identity and records `supersedesRequestId`.

Foreground reconciliation recovers stale nonterminal jobs rather than leaving them stranded after iOS process termination.

## 6. Gateway

The PWA contains no provider credential.

The reference gateway uses:

- exact allowed origin;
- per-device P-256 request signatures;
- one-use bootstrap registration capability;
- transactional Durable Object coordinator for nonce, rate, budget and idempotency state;
- body SHA-256 and exact derivative-image SHA-256 verification;
- device-namespaced/full-binding idempotency;
- bounded provider calls and normalized observation schema;
- P-256-signed gateway envelopes.

The gateway may authenticate, rate-limit, call a provider, normalize and sign observations. It may not decide what chess move was historically played.

## 7. Backup / restore

Backups are portable recovery artifacts with member SHA-256 descriptors and a deterministic root. Restore:

- rejects traversal/duplicates/unsupported schemas;
- validates all members before write;
- allowlists settings;
- preflights identifiers across every persistent store;
- supports KEEP LOCAL / REPLACE LOCAL / IMPORT AS COPY;
- remaps copy identities in a two-pass transformation;
- revalidates referential integrity;
- re-verifies certification before retaining trusted status.

The archive implementation remains deliberately conservative on iPhone: oversized monolithic backups are refused rather than treated as safe merely because storage quota exists.

## 8. Capsule v3

A Capsule contains, as applicable:

```text
game.pgn
record.json
manifest.json
source/*
derived/*
observations/*
reconstruction/*
audit/*
```

Before export, source and derived blobs are rehashed, the certification is reverified, references are resolved, and the generated archive is independently passed through `verifyCapsule()`.

Verification checks manifest hashes/root, canonical record hash, certification fingerprint, PGN parity, source descriptors, observation bindings, reconstruction/audit structures and configured gateway observation trust.

Capsule integrity is not yet equivalent to a cryptographic user/device signature. `manifest.signatures` remains reserved for that future authenticity layer.

## 9. PWA / service worker

The build emits an allowlisted `dist/` and generates a content-addressed `precache-manifest.js` over all runtime files. The service worker:

- uses only RECORD-namespaced caches;
- deletes only obsolete RECORD caches;
- reads from its named cache rather than all origin caches;
- treats `config/runtime.json` as network-first/no-store;
- provides explicit stale-config fallback metadata;
- provides offline navigation fallback.

`npm run check:dist` recomputes every precache digest and rejects coverage drift.

## 10. Deployment origin

Remote recognition is blocked on shared `*.github.io` project origins. A commissioned remote deployment requires its own HTTPS origin so browser storage and gateway CORS/trust can be isolated at the origin boundary.
