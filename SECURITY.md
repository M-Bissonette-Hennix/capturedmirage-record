# Security Policy

## Supported version

Security fixes are currently made against the latest RECORD development/release line only.

## Reporting

Do not place sensitive vulnerability details, private scoresheets, provider credentials, bootstrap secrets or gateway private material into a public GitHub issue.

For this project, report security/privacy problems privately to the repository owner / Office of Method through the private contact channel designated for the repository. If GitHub Private Vulnerability Reporting is enabled, use that mechanism.

Useful reports include:

- reproduction steps;
- affected RECORD version/commit;
- browser/iOS version;
- whether the issue affects source integrity, certification, backup/Capsule verification, same-origin boundaries, service worker behavior, recognition authentication, gateway budget or privacy.

## Secret policy

Provider tokens, gateway private JWKs, bootstrap secrets and other credentials must never be committed—even temporarily—to the public frontend repository. Removing a committed secret later does not make repository history safe; rotate it immediately.
