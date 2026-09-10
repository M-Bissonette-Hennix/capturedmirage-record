# RECORD 0.3.2 — Physical iPhone Acceptance Protocol

Record device model, iOS version, RECORD release/commit, deployment origin and date. Do not mark any item PASS without exercising it on the physical target device.

## Installation / lifecycle

- Safari page-mode first load;
- Add to Home Screen;
- standalone launch;
- portrait / landscape / safe areas;
- force-kill and relaunch;
- iPhone reboot and relaunch;
- service-worker update waiting/apply flow;
- runtime trust-config rotation.

## Capture / memory

- rear-camera permission accepted / denied / recovered;
- Photos and Files selection;
- JPEG and PNG intake;
- MIME/magic mismatch rejection;
- invalid/oversize source rejection;
- multiple pages and reorder/delete/add-after-delete;
- full-source pinch zoom/pan;
- source/derived/crop view;
- high-resolution photo preprocessing without process termination;
- archive refusal/progress behavior near configured resource limits.

## Persistence / migration / recovery

- seed a genuine 0.1-style `record-foundation` database and verify v3 cross-database migration;
- old source bytes hash identically after migration;
- legacy DB remains present until deliberately retired;
- IndexedDB survives app kill/reboot;
- offline reopen after first successful online load;
- airplane-mode capture/manual editing;
- backup export → controlled wipe → restore;
- KEEP LOCAL / REPLACE LOCAL / IMPORT AS COPY;
- source/derived hashes identical after restore;
- stale `UPLOADING/PROCESSING` job recovery.

## Chess / reconstruction

- board/SAN entry, castling, en passant, promotion;
- board flip and timeline navigation;
- earlier-move replacement/downstream contradiction handling;
- run reconstruction on fixture observation;
- apply path;
- ambiguous path visibly remains review-required;
- bridge visibly remains `INFERRED_BRIDGE`/review-required;
- manual prefix is preserved when reconstructing later moves.

## Certification / export

- zero-move game cannot certify;
- `needsReview` cannot certify;
- metadata/note/move/source changes invalidate certification;
- dangling observation cannot certify;
- wrong-cell/ply observation cannot certify;
- Capsule export self-verifies;
- modified PGN Capsule is rejected;
- share PGN and Capsule through iOS share sheet/Files fallback.

## Remote recognition, only after dedicated-origin commissioning

- one-use device registration;
- second bootstrap use rejected;
- exact retry returns one provider result;
- explicit rerun produces new run;
- weak connectivity / timeout / foreground recovery;
- stale runtime trust config fails closed;
- gateway key rotation behavior.

## Accessibility

- Dynamic Type / larger text;
- VoiceOver board labels and actionable controls;
- dialogs and focus return;
- pinch zoom remains available;
- critical states are not color-only.
