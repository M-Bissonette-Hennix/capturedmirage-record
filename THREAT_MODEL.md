# Threat Model — RECORD 0.3.3 RECONSTRUCTION / INTEGRITY

## Protected assets

- exact score-sheet source bytes;
- canonical chess move ledger;
- player/event metadata and postgame notes;
- source/derivative SHA-256 identities;
- recognition observations and reconstruction lineage;
- certification state/fingerprint;
- device private authentication key;
- provider credentials at gateway;
- local backup/Capsule integrity.

## Principal adversaries/failure modes

### Corrupt or malicious local/imported state

Controls: strict runtime validators, canonical move replay, source rehashing, all-store restore preflight, import-as-copy remapping, certification reverification and quarantine/fail-closed behavior.

### Malicious backup/Capsule

Controls: path traversal/duplicate rejection, archive size/file/path limits, SHA-256 member/root verification, strict schemas, PGN↔record parity and certification/source/observation verification.

### Prompt-injected score sheet/provider output

Controls: original page text is untrusted; provider output cannot directly mutate canonical history; authority fields are rejected; raw strings are rendered as text; chess reconstruction owns legality; user owns final truth.

### Provider/gateway abuse

Controls: dedicated origin, exact CORS origin, one-use bootstrap, non-exportable P-256 device key where supported, body digest, timestamp/nonce signature, transactional replay/rate/budget/idempotency coordinator, derivative digest verification, bounded provider adapter and signed normalized response.

### Duplicate request/provider spend

Controls: device-namespaced full-binding idempotency; exact retry reuses identity; deliberate rerun gets a new run sequence/identity and supersession link.

### iOS process termination

Controls: source persistence before recognition; persistent jobs; foreground reconciliation of stale nonterminal jobs; observation/job completion transaction; debounced notes persistence; conservative resource ceilings.

### Shared-origin interference

Controls: remote recognition blocked on shared GitHub Pages origin, RECORD-only cache namespace, named-cache lookup, no foreign-cache deletion. Dedicated origin remains the required production boundary.

### Stale runtime trust configuration

Controls: runtime config is network-first/no-store; stale fallback is explicitly tagged and aged; remote recognition fails closed when trust data exceed the allowed staleness policy.

### Reconstruction overreach

Controls: legal beam uses transcription evidence and chess legality only; no engine quality/opening plausibility; bridges are explicit/penalized/review-required; multiple paths remain visible.

## Known residual boundaries

- current Capsule integrity is not yet a human/device authenticity signature;
- full original images can preserve EXIF in exported evidence;
- browser memory behavior requires physical-iPhone commissioning;
- real provider reliability/privacy cannot be established by fixture tests;
- Cburnett piece artwork has its own GPLv2+ licensing obligations and should be reviewed before commercial distribution strategy is finalized.
