# RECORD Capsule v3

## Purpose

A RECORD Capsule is the portable evidence handoff between RECORD and downstream systems such as CAPTUREDMIRAGE. PGN alone is insufficient because it cannot preserve source provenance, recognition uncertainty, reconstruction lineage or certification evidence.

## Typical contents

```text
<game>.record.zip
├── game.pgn
├── record.json
├── manifest.json
├── source/
├── derived/
├── observations/
├── reconstruction/
└── audit/
```

Not every directory is required for every record, but every included member is explicitly manifested.

## Canonical identities

The format separates:

- `canonicalRecordHash` — stable identity of the certified canonical game/evidence relationship;
- `certificationFingerprint` — canonical certification hash;
- `observationRoot` — normalized observation evidence root;
- `auditRoot` — exported game-audit root;
- `capsuleContentRoot` — root over manifested exported members;
- `capsuleInstanceId` — identity of a particular export instance.

An export timestamp may change between exports without changing canonical record identity.

## Required verification behavior

`verifyCapsule()` must:

1. reject traversal, duplicate and unmanifested files;
2. verify member sizes/SHA-256 and content root;
3. validate strict schemas;
4. replay the canonical move ledger;
5. reverify certification against the exported source/observation evidence;
6. verify source and derived descriptors against actual bytes;
7. require `game.pgn` to be canonically identical to PGN generated from `record.json`;
8. validate observation source/derivative bindings;
9. classify or, when requested, cryptographically verify signed gateway observations against trusted gateway keys;
10. validate reconstruction/audit exports and their roots.

Capsule creation rehashes evidence first and then self-verifies the generated archive before the bytes are returned to the UI.

## Integrity versus authenticity

SHA-256 manifests establish internal integrity, not identity of the human/device that created the archive. An attacker able to rewrite every member can build a new unsigned internally self-consistent Capsule. `manifest.signatures` remains reserved for a future device/user signing layer.

## Original image privacy

A full evidence Capsule includes the exact original source image and therefore may preserve EXIF/private metadata. The recognition derivative strips metadata. Future privacy-sanitized share exports must be a distinct export class and must never masquerade as full original evidence.
