# Third-Party Notices — RECORD 0.4.0

RECORD's shipped PWA contains **no third-party JavaScript runtime dependency graph**. The shipped PWA contains no Playwright runtime. The optional browser commissioning harness uses Playwright only when invoked in a separate QA environment; it is not copied into `dist/`.

## Cburnett chess piece SVGs

The chessboard currently bundles Colin M.L. Burnett's Cburnett piece artwork as distributed by the Lichess project. Lichess identifies `public/piece/cburnett` as Colin M.L. Burnett, licensed **GPLv2+**. The applicable GPL v2 license text is included in `licenses/GPL-2.0.txt`.

These third-party files are not relicensed by RECORD's proprietary `LICENSE`.

Before commercial distribution strategy is finalized, obtain appropriate legal review or replace/commission artwork under a license aligned with that distribution strategy. This notice is not legal advice.

## CAPTUREDMIRAGE / RECORD branding

The supplied CAPTUREDMIRAGE ecosystem logo and RECORD-specific brand assets are project assets and are not covered by the Cburnett license.

## Test/development tools

GitHub Actions uses SHA-pinned first-party Actions. Playwright remains optional development/commissioning tooling and is not installed by the operational Pages workflow or copied into `dist/`.
