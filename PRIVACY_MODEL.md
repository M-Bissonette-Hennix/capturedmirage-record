# Privacy Model — RECORD 0.4.0

## Local-first default

RECORD has no account requirement, advertising, analytics or telemetry in the default build. Games, source photographs, derivatives, observations, reconstruction runs and audit events live primarily in local browser storage.

## Original images

The exact original source image is preserved because it is evidence. It may contain EXIF metadata. RECORD does not silently destroy that metadata in the canonical source. Users should therefore treat full Capsules/backups as potentially sensitive.

## Remote recognition

Remote recognition is disabled by default and blocked on shared `*.github.io` project origins. When commissioned:

- only a locally generated metadata-stripped bounded derivative is sent by default;
- provider credentials exist only at the gateway;
- the bundled OpenAI Responses adapter explicitly sets `store:false`; provider/org retention policy and eligibility still require commissioning review;
- the request is authenticated by a device-held private key;
- the gateway allows one configured RECORD origin;
- recognition observations return to local storage;
- provider retention/privacy behavior must be separately reviewed and benchmarked before production use.

## Dedicated origin

Browser storage is origin scoped. A dedicated custom origin is required before sensitive remote recognition use so RECORD does not share IndexedDB/CacheStorage with unrelated project Pages under the same host.

Moving origins is a data cutover. Export and verify a backup before cutover, restore it on the new origin, verify source hashes/certification state and register a new device key before retiring the old origin.

## Diagnostic exports

Diagnostics exclude raw score-sheet images and player names by default. They may contain hashes, versions, job state and error codes useful for debugging.

## Deletion

Deleting a local RECORD removes the local working copy and its dependent local objects. Previously exported backups/Capsules are independent files and are not remotely revoked.

## Concrete Office of Method recognition data flow

When the dedicated remote path is commissioned, a real scoresheet follows this privacy path:

1. the exact original source remains local RECORD evidence;
2. RECORD creates a bounded, perspective-corrected, metadata-stripped JPEG recognition derivative;
3. the derivative plus evidence-binding metadata is sent from `record.officeofmethod.com` to `recognition.record.officeofmethod.com/api`;
4. the public Vercel gateway hostname externally rewrites the request to the Cloudflare Worker;
5. the Worker verifies device/origin/digest/replay/idempotency controls and sends the derivative to the configured OpenAI Responses model;
6. the adapter requests observation-only structured output with `store:false`;
7. the Worker validates and signs the response;
8. RECORD verifies the pinned gateway signature and stores observations locally.

The external provider does not receive the canonical original image by default. It receives the locally generated recognition derivative. `store:false` controls API response storage at the API boundary but is not, by itself, a complete organizational privacy/retention guarantee; account-level data controls and current provider policy remain a commissioning/operations responsibility.
