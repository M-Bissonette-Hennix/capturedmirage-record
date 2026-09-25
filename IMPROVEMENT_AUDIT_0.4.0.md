# RECORD 0.4.0 — Improvement Audit

## Scope

This pass treats RECORD as an **actual post-game field instrument on an iPhone**, not merely a reconstruction prototype. The governing doctrine remains:

> Vision proposes → chess logic constrains → user certifies → CAPTUREDMIRAGE analyzes.

The objective is to reduce human friction **without reducing evidentiary friction where friction is protective**.

## High-priority weaknesses identified and corrected

### 1. Fixture recognition could be applied to arbitrary real scoresheets — HIGH
0.3.x exposed a fixture provider through the normal recognition control. Because the fixture provider deliberately rewrote binding fields to the current game/page, a user could run deterministic fixture observations against unrelated real evidence. Even though the UI and documentation called it a fixture, this was an avoidable integrity hazard.

**0.4.0 correction:** the fixture provider is source-hash fenced to the bundled fixture image. The UI also disables fixture recognition for all other source pages. This is enforced both at the UI boundary and provider boundary.

### 2. Certification was structurally strong but ergonomically too easy — HIGH
The canonical hash/source/move gates were strong, but the human historical assertion itself was a single button press.

**0.4.0 correction:** explicit readiness display plus a required human review checkbox immediately before certification. RECORD now distinguishes machine-verifiable readiness from the user's historical assertion.

### 3. Capsule export could be marked EXPORTED after the user cancelled the iOS share sheet — HIGH
The 0.3.x export path continued to mutate workflow state after `AbortError`.

**0.4.0 correction:** sharing/export returns an explicit delivered/cancelled result. `CAPSULE_EXPORTED` is emitted only after the share/save operation is initiated successfully.

### 4. Backup export was desktop-centric — HIGH for iPhone use
The backup path used a synthetic download anchor, while PGN/Capsule paths already understood the iOS share sheet.

**0.4.0 correction:** backups and diagnostics use the same native-share-first strategy. Backup timestamps advance only after successful export initiation.

### 5. Home screen did not communicate backup debt — MEDIUM/HIGH
IndexedDB is working storage, not archival truth, but backup freshness was buried in SYSTEM/LIBRARY.

**0.4.0 correction:** Home counts records updated since the last verified backup and elevates backup action when debt exists.

### 6. Move correction depended on context-menu behavior — MEDIUM/HIGH on iPhone
Long-press/context menus are unreliable and discoverability is poor in a Home Screen PWA.

**0.4.0 correction:** tapping any move selects its position; the board action row exposes an explicit `EDIT <SAN>` control. Context-menu editing remains secondary.

### 7. Undo was easy to hit accidentally — MEDIUM
`UNDO` mutated evidence immediately.

**0.4.0 correction:** `UNDO LAST` requires an explicit destructive confirmation.

### 8. Capture format copy contradicted the actual policy — MEDIUM
The file picker and explanatory copy advertised WebP while new evidentiary intake rejected WebP.

**0.4.0 correction:** capture controls advertise JPEG/PNG only.

### 9. Capture-quality heuristics were underexposed — MEDIUM
Warnings existed in derived metadata but were summarized mainly as a count.

**0.4.0 correction:** warnings are visible per page and in the source viewer so recapture decisions happen while the paper is still physically available.

### 10. New-game date used UTC slicing — MEDIUM
Near local midnight, a newly created game could inherit the wrong civil calendar date.

**0.4.0 correction:** PGN date defaults from local device calendar components.

### 11. PWA update availability was buried — MEDIUM
A waiting service worker was only actionable from SYSTEM.

**0.4.0 correction:** a top-bar `UPDATE READY` control appears when a waiting worker exists.

### 12. Capsule trust failure referenced an undefined error constant — MEDIUM
The verification UI could construct a `RecordError` with an undefined code in signed-observation trust failures.

**0.4.0 correction:** `REC-CAPS-001` is defined and regression-tested.

### 13. RECORD launcher icon did not reflect the requested CAPTUREDMIRAGE identity — UX
The app icon assets were a generic `R`.

**0.4.0 correction:** all launcher icon sizes are exact raster resizes of the canonical CAPTUREDMIRAGE logo. The in-app product name remains RECORD.


### 14. Scan intake overfavored live camera capture — MEDIUM field-friction
A single `capture=environment` picker is ideal immediately after a round, but it makes already-photographed pages, screenshots and Files imports less explicit on iPhone.

**0.4.0 correction:** SCAN now exposes separate `CAPTURE PAGE` and `ADD FROM PHOTOS / FILES` controls. Both routes pass through the identical JPEG/PNG signature validation, pixel/resource limits, exact-source preservation and derivative pipeline.

### 15. Rapid note blur/change events could enqueue duplicate evidence mutations — MEDIUM integrity/noise
Mobile text areas can emit `input`, `change` and `blur` close together. Independent asynchronous saves can create redundant revisions/audit events or race during navigation.

**0.4.0 correction:** postgame note writes are serialized through a single promise chain while retaining the short debounce and blur/change flush behavior.

### 16. Launcher branding could silently regress after later asset replacement — LOW/MEDIUM release integrity
Replacing icon files would not previously fail static QA as long as the canonical in-app logo remained intact.

**0.4.0 correction:** static QA pins all five launcher icon byte hashes in addition to pinning the canonical CAPTUREDMIRAGE source-logo hash.

## Improvements deliberately not implemented

- **No automatic engine analysis.** This would contaminate acquisition/certification with interpretation.
- **No silent auto-certification.** Human authority remains explicit.
- **No speculative reconstruction from opening popularity.**
- **No real recognition on shared GitHub Pages.** Dedicated-origin commissioning remains required.
- **No cloud account requirement.**
- **No automatic deletion of local evidence after backup/export.**
- **No background-sync dependency on iOS.**
- **No schema churn solely for UI improvements.** Database schema remains v3.

## Remaining external gates

- Physical iPhone camera/Photos/Files matrix.
- Physical iPhone low-storage / process-kill / reboot behavior.
- VoiceOver and Dynamic Type acceptance.
- Dedicated-origin recognition gateway.
- Real handwritten-scoresheet benchmark.
- Long-duration field use across multiple tournament days.

The release may be called **field-hardened source/distribution** after local mechanical gates pass. It must not be described as tournament-frozen or real-recognition commissioned until those external gates are exercised.
