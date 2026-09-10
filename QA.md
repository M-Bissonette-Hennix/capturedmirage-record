# RECORD 0.3.2 — QA Doctrine

A green release requires evidence from multiple layers. No single unit-test count is sufficient.

## Source gates

```bash
npm ci
npm run check
npm run build
npm run check:dist
```

`npm run check` covers syntax, schema JSON, static/security release assertions and deterministic Node tests.

## Mandatory adversarial classes

The deterministic suite must include, at minimum:

- zero-move certification rejection;
- `needsReview` certification rejection;
- stale certification failure;
- dangling and wrong-coordinate observation refs;
- source/derived byte mutation;
- PGN/record semantic mismatch despite rebuilt manifest;
- backup logical tamper;
- hostile settings import;
- import-as-copy remapping;
- one-use bootstrap and device overwrite rejection;
- request-body mutation and derivative digest mismatch;
- retry versus rerun idempotency;
- device-namespaced idempotency binding;
- prompt-authority field rejection;
- projective image preprocessing/magic sniff/animated-WebP policy;
- phantom en-passant repetition regression;
- legal reconstruction, ambiguity/bridge behavior and manual-prefix preservation;
- service-worker foreign-cache isolation;
- ZIP traversal/duplicate/CRC attacks.

## Chess oracle differential

When Stockfish is available, run:

```bash
STOCKFISH_BIN=/trusted/stockfish npm run test:stockfish
```

The release harness generates deterministic legal positions and compares RECORD to Stockfish at perft depth 1 and depth 2. This is independent evidence for legal-move generation; it does not prove every possible chess state.

## Distribution gate

`npm run build` constructs only the allowlisted PWA distribution. `npm run check:dist` independently:

- parses the generated precache manifest;
- recomputes every listed SHA-256;
- requires exact precache coverage of all deployed runtime files;
- requires critical runtime modules including perspective/reconstruction/database;
- rejects origin-global CacheStorage lookup;
- verifies runtime configuration remains network-first/no-store;
- refuses unsafe gateway-enabled distribution configuration.

## Browser CI

The GitHub workflow runs Chromium and WebKit functional QA against `dist/`, including actual legacy-DB seeding/migration, fixture recognition, chess entry, certification invalidation/review and offline reopen. This evidence only exists after the workflow actually runs in GitHub.

## Physical iPhone

The product's target environment must pass `PHYSICAL_IPHONE_QA.md` before tournament freeze. Node/WebKit emulation is not a substitute.

## Real provider benchmark

Before remote production recognition is described as commissioned, use a versioned ground-truth score-sheet corpus and record:

- page detection success;
- cell localization accuracy;
- top-1 token accuracy;
- top-3 token recall;
- metadata-field accuracy;
- capture retake rate;
- latency;
- provider cost/game;
- human review seconds/page;
- failure behavior under poor connectivity and adversarial document text.
