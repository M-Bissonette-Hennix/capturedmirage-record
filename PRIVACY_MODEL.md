# Privacy Model — RECORD 0.3.3

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
