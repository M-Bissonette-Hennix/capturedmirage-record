# RECORD 0.3.0 — RECONSTRUCTION / INTEGRITY

RECORD converts imperfect physical chess evidence into a trustworthy digital game record with the least possible human effort **without concealing uncertainty**.

> **Vision proposes. Chess logic constrains. The user certifies. CAPTUREDMIRAGE analyzes.**

0.3.0 is the first RECORD release with a chess-constrained sequence reconstruction engine. It also incorporates the corrective integrity/security program required by the hostile audit of 0.2.0. The audit is preserved verbatim at `audits/RECORD_v0.2.0_hostile_audit.txt`.

## Release identity

- Product: **RECORD**
- Release: **0.3.0 — RECONSTRUCTION / INTEGRITY**
- Working database: `record-chess`, schema version 3
- Legacy database recognized for migration: `record-foundation`, schema version 1
- Recognition preprocessing: `record-preprocess/3`
- Recognition envelope: `record-recognition-envelope/3`
- Reconstruction run: `record-reconstruction-run/1`
- Capsule: `record-capsule/3`

The canonical CAPTUREDMIRAGE ecosystem logo is included exactly as supplied; static QA pins its SHA-256 to `df4f56b3ca47981e0202e433fe275bf15328ca58177599b3ba62a99cd796c8e6`.

## What 0.3 adds

### Chess-constrained reconstruction

RECORD now converts ranked handwriting observations into ranked **legal game paths** rather than treating OCR text as chess truth. For each observed ply it:

1. enumerates legal moves from the actual current position;
2. compares their SAN notation to provider observations;
3. ranks evidence-compatible legal candidates;
4. carries a bounded beam of future-consistent legal histories;
5. preserves alternatives and ambiguity;
6. permits a missing ply only as an explicit `INFERRED_BRIDGE`, never as silent truth;
7. requires human review where evidence remains ambiguous or a bridge was used.

The engine does **not** use Stockfish evaluation, opening popularity, or move quality to decide what must have been played. It can preserve an existing manual prefix and continue reconstruction from the next observed ply.

### Hostile-audit integrity corrections

0.3 also closes the high-priority failures found in the 0.2 hostile audit, including:

- real cross-database migration from the actual 0.1 `record-foundation` database;
- zero-move `PLAYED_GAME` certification rejection;
- `needsReview` as a hard certification blocker;
- certification badges derived from re-verification, never raw stored `VALID` state;
- observation-reference resolution, page/source/hash binding, and move-number/side correspondence;
- semantic/byte-canonical PGN ↔ `record.json` parity in Capsule verification;
- restored certification re-verification;
- cross-store restore collision preflight;
- two-pass `IMPORT_AS_COPY` identifier remapping;
- one-use bootstrap capability and registered-device overwrite rejection;
- atomic gateway security coordination through a Durable Object reference implementation;
- retry versus deliberate recognition rerun semantics;
- crash reconciliation for stale recognition jobs;
- recognition-run supersession/current-run semantics;
- exact derived-blob rehash before Capsule generation;
- signed observation trust verification when a trusted gateway key is configured;
- generated content-addressed service-worker precache manifest;
- network-first/no-store runtime trust configuration;
- RECORD-cache-only reads/writes;
- source image magic-byte checking and animated-WebP rejection;
- lower mobile resource ceilings and bounded processing rasters;
- repetition-key correction for phantom en-passant targets;
- binary recognition upload instead of frontend base64 transport;
- relevant audit events and reconstruction runs in Capsule v3.

## Safe default deployment

The repository ships with remote recognition disabled:

```json
{
  "dedicatedOrigin": false,
  "requiredOrigin": "",
  "gatewayEnabled": false,
  "gatewayUrl": "",
  "gatewayPublicJwk": null,
  "providerProfile": "fixture"
}
```

This is deliberate. A normal GitHub project Pages URL shares its browser origin with other repositories under the same `USERNAME.github.io` host. RECORD therefore refuses commissioned remote recognition on a shared GitHub Pages origin.

Capture, manual chess entry, fixture recognition, reconstruction, backup/restore, certification and Capsule export remain usable there. Before remote recognition is enabled, move RECORD to a dedicated HTTPS origin, commission the gateway, pin its public P-256 JWK in `config/runtime.json`, and rebuild.

## GitHub Pages deployment

1. Extract the release ZIP.
2. Put the **contents of the release directory** at repository root.
3. Push to `main`.
4. Repository → **Settings → Pages → Source → GitHub Actions**.
5. The single QA/deploy trust graph must pass.

The workflow performs source QA, deterministic tests, allowlisted `dist/` build, content-addressed distribution verification, Chromium/WebKit functional QA, and a secret tripwire before Pages artifact upload. Only `dist/` is deployed.

## Local verification

Node 20+:

```bash
npm ci
npm run check
npm run build
npm run check:dist
```

Independent chess differential testing is available when a trusted Stockfish executable is supplied:

```bash
STOCKFISH_BIN=/path/to/stockfish npm run test:stockfish
```

Release artifacts also include `RELEASE_MANIFEST.json` and `RELEASE_QA.md`.

## Important assurance boundary

0.3.0 can be mechanically verified in this source package, but no source package can honestly manufacture evidence for tests requiring infrastructure not present in the build environment. The following remain commissioning gates until actually executed on the target deployment:

- GitHub-hosted Chromium/WebKit workflow run;
- physical iPhone Safari/Home-Screen/camera/storage/share/VoiceOver matrix;
- deployed dedicated-origin gateway;
- real provider accuracy, latency, cost, privacy-retention and hostile-document benchmark.

They must remain marked **PENDING EXTERNAL**, not converted to PASS by documentation.

See `DEVELOPMENT_BIBLE.md`, `ARCHITECTURE.md`, `AUDIT_STATUS.md`, `RECOGNITION_SPEC.md`, `RECORD_CAPSULE_SPEC.md`, `THREAT_MODEL.md`, `PRIVACY_MODEL.md`, `QA.md`, `PHYSICAL_IPHONE_QA.md`, `SECURITY.md`, and `BRANDING.md`.
