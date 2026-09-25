# RECORD 0.4.0 — QA Doctrine

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

## Browser commissioning harness

`tests/browser/playwright.mjs` remains an optional commissioning harness for Chromium/WebKit legacy migration, fixture recognition, chess entry, certification invalidation/review and offline reopen. The currently commissioned **RECORD Operational Pages** workflow intentionally does not make Playwright a production-deployment dependency after the 0.3.x harness produced repeated false-negative release blocks. Hosted-browser results must therefore be reported separately when that harness is explicitly run; deterministic source/build/dist QA remains the deployment gate.

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


## 0.4.0 field/certification regression gates

- fixture provider rejects any source SHA other than the bundled fixture source;
- capture controls advertise only JPEG/PNG and expose distinct camera and Photos/Files intake paths;
- new-game date uses local calendar components;
- explicit certification assertion present;
- Capsule export UI requires valid certification;
- native-share-first export path present;
- Capsule verification trust error code defined;
- postgame note writes are serialized across input/change/blur events;
- launcher icons are byte-pinned to deterministic CAPTUREDMIRAGE-logo resizes;
- operational Pages workflow retains deterministic source/build/dist QA.

## Dedicated-origin recognition commissioning gate

The `record-recognition-commissioning` branch has a dedicated hosted QA workflow. It must pass:

- deterministic source QA;
- fail-closed default build;
- distribution verification;
- Wrangler parsing/type generation for the Worker + Durable Object configuration.

That green source/configuration gate is necessary but not sufficient for production recognition.

After the external infrastructure exists, `npm run recognition:verify` must also pass against the actual public endpoints. Real provider commissioning then requires a disposable scoresheet test followed by the adversarial registration/replay/digest/idempotency/rate-limit cases listed in `RECOGNITION_COMMISSIONING.md`.

No hosted source check may be represented as evidence that the OpenAI key, Cloudflare Durable Object, custom domains, TLS, live CORS, provider accuracy, latency or cost have been commissioned.
