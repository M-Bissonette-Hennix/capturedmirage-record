# Third-Party Notices — RECORD 0.3.2

RECORD's shipped PWA contains **no third-party JavaScript runtime dependency graph**. Browser CI installs Playwright only in GitHub Actions and does not ship it in the deployed PWA.

## Cburnett chess piece SVGs

The chessboard currently bundles Colin M.L. Burnett's Cburnett piece artwork as distributed by the Lichess project. Lichess identifies `public/piece/cburnett` as Colin M.L. Burnett, licensed **GPLv2+**. The applicable GPL v2 license text is included in `licenses/GPL-2.0.txt`.

These third-party files are not relicensed by RECORD's proprietary `LICENSE`.

Before commercial distribution strategy is finalized, obtain appropriate legal review or replace/commission artwork under a license aligned with that distribution strategy. This notice is not legal advice.

## CAPTUREDMIRAGE / RECORD branding

The supplied CAPTUREDMIRAGE ecosystem logo and RECORD-specific brand assets are project assets and are not covered by the Cburnett license.

## Test/development tools

GitHub Actions uses SHA-pinned first-party Actions. The browser QA workflow installs an exact Playwright package version at CI time. Playwright is development/QA tooling and is not copied into `dist/`.
