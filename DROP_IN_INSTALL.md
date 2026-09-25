# RECORD 0.4.0 — Drop-in update

This package is intended to be copied **over the repository root** of the currently working `capturedmirage-record` project.

## Fast GitHub-web path

1. Keep a copy of the current working repo/release.
2. Extract `RECORD-0.4.0-DROP-IN.zip`.
3. In GitHub, open `capturedmirage-record` → **Add file → Upload files**.
4. Drag the **contents** of the extracted drop-in folder into the upload area, preserving folder structure. Do not create an extra nesting directory in the repository.
5. Commit directly to `main` with: `RECORD 0.4.0 — CERTIFICATION / FIELD OPERATIONS`.
6. Open **Actions** and wait for **RECORD Operational Pages** to finish green.
7. Open the live Pages URL once in Safari. RECORD 0.4.0 uses a new service-worker cache namespace; if an `UPDATE READY` chip appears, tap it once and allow the app to reload.
8. Confirm SYSTEM reports `0.4.0 · CERTIFICATION / FIELD OPERATIONS`.
9. Export a verified backup before deleting any older local records.

## Local Git path

Copy the drop-in contents over the existing local repository, then run:

```powershell
npm ci
npm run check
npm run build
npm run check:dist
git add --all
git commit -m "RECORD 0.4.0 — CERTIFICATION / FIELD OPERATIONS"
git pull --rebase origin main
git push origin main
```

If `git pull --rebase` reports a conflict, stop and resolve it rather than force-pushing.

## Expected migration behavior

No IndexedDB schema migration is required. 0.4.0 continues to use `record-chess` database version 3 and preserves existing local records in-place.

## First field checks after update

- Home shows `Quick Capture Scoresheet`.
- SCAN exposes both `CAPTURE PAGE` and `ADD FROM PHOTOS / FILES`.
- Real pages show `FIXTURE LOCKED` while the GitHub Pages build remains in fixture mode.
- Source page warnings and SHA-256 copy are visible.
- Review/Certify shows a readiness panel.
- Certification opens a confirmation sheet with an explicit review checkbox.
- A valid certification is required before Capsule export.
- Backup export opens the iOS share sheet when supported.
- Tap a move, then use explicit `EDIT <SAN>` instead of relying on long-press.
- Safari/Home Screen icon uses the CAPTUREDMIRAGE mark.
