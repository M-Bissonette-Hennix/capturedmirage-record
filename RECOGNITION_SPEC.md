# RECORD 0.3.2 — Recognition and Reconstruction Specification

## Authority boundary

Recognition returns observations only. The service/gateway/provider is forbidden to return or persist a canonical `correctMove` authority.

```text
source photo
  ↓ local preprocessing
recognition derivative
  ↓ vision provider
authority-free observations
  ↓ deterministic chess reconstruction
ranked legal paths
  ↓ user review
canonical game
```

## Source and derivative

The original source remains exact evidence. `record-preprocess/3` produces a separate bounded JPEG derivative:

- source magic-byte validation;
- bounded raster decode;
- quadrilateral page detection;
- projective rectification when credible;
- fail-safe fallback when not credible;
- local illumination normalization;
- metadata stripping by re-encode;
- independent derivative SHA-256.

Only the derivative is sent to a remote provider by default.

## Recognition request v2 transport

The browser signs a binary request body containing bounded JSON metadata plus exact JPEG derivative bytes. The signed request binds:

- request/game/page IDs;
- source SHA-256;
- derivative ID/SHA/dimensions/preprocessor;
- run sequence/type;
- superseded request if rerun;
- idempotency key.

Retry uses the same request identity. Rerun uses a new identity.

## Recognition envelope v3

An envelope binds:

- `requestId`, `gameId`, `pageId`;
- `sourceSha256`;
- `runSequence`, `supersedesRequestId`;
- exact derivative identity;
- provider adapter/model/modelVersion/promptRevision;
- normalized document layout;
- bounded move cells and ranked candidate text;
- bounded metadata observations;
- gateway build/key/signedAt/signature.

Provider scores, if stored, are not presented as calibrated historical probabilities.

## Prompt-injection doctrine

Photographed text is untrusted. A score sheet may contain adversarial instructions. Prompting is defense in depth only. Security comes from the stronger property that provider output is schema-bounded untrusted evidence and cannot directly mutate canonical chess history.

## Reconstruction algorithm

`record-legal-beam/1` processes plies from the existing manual prefix onward.

For an observed ply:

1. enumerate every legal move from the current state;
2. obtain SAN for each legal move;
3. compare normalized SAN to ranked observation text;
4. discard candidates outside bounded transcription distance;
5. score candidate rank/distance;
6. advance each candidate into a new legal chess state;
7. deduplicate equivalent resulting states;
8. retain a bounded beam.

For a missing ply, a bounded legal bridge may be tried only if the configured bridge budget allows it. Its provenance is `INFERRED_BRIDGE`, it receives a strong score penalty and the path becomes review-required.

The best path is not silently canonical. If credible alternatives remain close, the run status is `AMBIGUOUS`. Even a `COMPLETE` best-supported path still requires user review/certification.

## Observation-to-ply binding

For ply `p`:

```text
moveNumber = floor((p + 1) / 2)
side       = odd p → white; even p → black
```

Direct acceptance and certification fail if a cited cell claims another coordinate.

## Gateway

The reference gateway uses a transactional security coordinator for one-use registration, device signatures, nonce/replay, rate/budget and device-namespaced body-bound idempotency. Provider credentials remain backend-only. Remote recognition must be commissioned at a dedicated HTTPS origin.
